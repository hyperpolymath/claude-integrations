// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import type { Request, Response, NextFunction } from "express";
import { AuthContext, GitLabScope, AuditEntry } from "./types";
import { validateTokenFormat } from "./token-validator";
import { requirePermission, checkBridgeScopes } from "./permission-checker";
import { requireValidWebhook, extractWebhookMetadata } from "./webhook-validator";
import {
  AuthError,
  MissingTokenError,
  InvalidTokenError,
} from "./errors";

/**
 * Configuration for auth middleware.
 */
export interface AuthMiddlewareConfig {
  /** Header name for the token (default: "x-gitlab-token") */
  tokenHeader?: string;
  /** Whether to allow requests without auth (default: false) */
  allowAnonymous?: boolean;
  /** Required scopes for all requests */
  requiredScopes?: GitLabScope[];
  /** Function to fetch token info from GitLab API */
  fetchTokenInfo?: (token: string) => Promise<{
    scopes: GitLabScope[];
    expiresAt: string | null;
    userId?: number;
  }>;
  /** Audit logging function */
  auditLog?: (entry: AuditEntry) => void | Promise<void>;
  /** GitLab instance URL */
  gitlabUrl?: string;
}

/**
 * Extend Express Request to include auth context.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

/**
 * Extracts the token from a request.
 *
 * @param req - Express request
 * @param headerName - Header to check for token
 * @returns Token string or null
 */
export function extractToken(
  req: Request,
  headerName: string = "x-gitlab-token"
): string | null {
  // Check custom header first
  const headerToken = req.get(headerName) || req.get("X-GitLab-Token");
  if (headerToken) {
    return headerToken;
  }

  // Check Authorization header (Bearer token)
  const authHeader = req.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }

  // Check PRIVATE-TOKEN header (GitLab convention)
  const privateToken = req.get("private-token") || req.get("PRIVATE-TOKEN");
  if (privateToken) {
    return privateToken;
  }

  return null;
}

/**
 * Creates an authentication middleware.
 *
 * @param config - Middleware configuration
 * @returns Express middleware function
 */
export function createAuthMiddleware(
  config: AuthMiddlewareConfig = {}
): (req: Request, res: Response, next: NextFunction) => Promise<void> {
  const {
    tokenHeader = "x-gitlab-token",
    allowAnonymous = false,
    requiredScopes = [],
    fetchTokenInfo,
    auditLog,
    gitlabUrl = process.env.GITLAB_URL || "https://gitlab.com",
  } = config;

  return async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const startTime = Date.now();

    try {
      // Extract token
      const token = extractToken(req, tokenHeader);

      // Handle missing token
      if (!token) {
        if (allowAnonymous) {
          req.auth = {
            authenticated: false,
            scopes: [],
            gitlabUrl,
            authenticatedAt: new Date(),
          };
          next();
          return;
        }
        throw new MissingTokenError();
      }

      // Validate token format
      const tokenInfo = validateTokenFormat(token);

      // Fetch additional info if available
      let scopes: GitLabScope[] = [];
      if (fetchTokenInfo) {
        try {
          const info = await fetchTokenInfo(token);
          scopes = info.scopes;
        } catch (error) {
          // Log but don't fail - token format was valid
          console.warn("Failed to fetch token info:", error);
        }
      }

      // Check required scopes
      if (requiredScopes.length > 0) {
        for (const scope of requiredScopes) {
          if (!scopes.includes(scope)) {
            const scopeResult = checkBridgeScopes(scopes);
            if (!scopeResult.complete) {
              throw new InvalidTokenError(
                `Missing required scope: ${scope}. Available: ${scopes.join(", ")}`
              );
            }
          }
        }
      }

      // Build auth context
      req.auth = {
        authenticated: true,
        token: tokenInfo,
        scopes,
        gitlabUrl,
        authenticatedAt: new Date(),
      };

      // Audit log successful auth
      if (auditLog) {
        await auditLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: "auth.success",
          actor: tokenInfo.maskedToken,
          resource: req.path,
          success: true,
          metadata: {
            method: req.method,
            tokenType: tokenInfo.type,
            duration: Date.now() - startTime,
          },
          ipAddress: req.ip,
        });
      }

      next();
    } catch (error) {
      // Handle auth errors
      if (error instanceof AuthError) {
        // Audit log failed auth
        if (auditLog) {
          await auditLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: "auth.failure",
            actor: "unknown",
            resource: req.path,
            success: false,
            metadata: {
              method: req.method,
              errorCode: error.code,
              errorMessage: error.message,
              duration: Date.now() - startTime,
            },
            ipAddress: req.ip,
          });
        }

        res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }

      // Unknown error
      next(error);
    }
  };
}

/**
 * Creates a webhook validation middleware.
 *
 * @param secret - Webhook secret (or function to get it)
 * @param auditLog - Optional audit logging function
 * @returns Express middleware function
 */
export function createWebhookMiddleware(
  secret: string | (() => string),
  auditLog?: (entry: AuditEntry) => void | Promise<void>
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    const startTime = Date.now();

    try {
      const webhookSecret = typeof secret === "function" ? secret() : secret;

      // Get raw body (requires raw body parser)
      const rawBody =
        typeof req.body === "string"
          ? req.body
          : JSON.stringify(req.body);

      // Validate webhook
      requireValidWebhook(
        req.headers as Record<string, string | string[] | undefined>,
        rawBody,
        webhookSecret
      );

      // Extract and attach metadata
      const metadata = extractWebhookMetadata(
        req.headers as Record<string, string | string[] | undefined>
      );

      // Attach webhook info to request
      (req as Request & { webhook?: typeof metadata }).webhook = metadata;

      // Audit log successful webhook
      if (auditLog) {
        auditLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: "webhook.received",
          actor: metadata.instance || "gitlab",
          resource: req.path,
          success: true,
          metadata: {
            event: metadata.event,
            requestId: metadata.requestId,
            duration: Date.now() - startTime,
          },
          ipAddress: req.ip,
        });
      }

      next();
    } catch (error) {
      if (error instanceof AuthError) {
        // Audit log failed webhook
        if (auditLog) {
          auditLog({
            id: crypto.randomUUID(),
            timestamp: new Date(),
            action: "webhook.rejected",
            actor: "unknown",
            resource: req.path,
            success: false,
            metadata: {
              errorCode: error.code,
              errorMessage: error.message,
              duration: Date.now() - startTime,
            },
            ipAddress: req.ip,
          });
        }

        res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }

      next(error);
    }
  };
}

/**
 * Creates a permission-checking middleware.
 *
 * @param operation - The operation to check permission for
 * @returns Express middleware function
 */
export function requirePermissionMiddleware(
  operation: string
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.auth?.authenticated) {
        throw new MissingTokenError();
      }

      requirePermission(operation, req.auth.scopes);
      next();
    } catch (error) {
      if (error instanceof AuthError) {
        res.status(error.statusCode).json({
          error: error.code,
          message: error.message,
        });
        return;
      }
      next(error);
    }
  };
}

/**
 * Error handler middleware for auth errors.
 *
 * @param error - The error
 * @param req - Express request
 * @param res - Express response
 * @param next - Next function
 */
export function authErrorHandler(
  error: Error,
  _req: Request,
  res: Response,
  next: NextFunction
): void {
  if (error instanceof AuthError) {
    res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
    });
    return;
  }

  // Pass non-auth errors to default handler
  next(error);
}
