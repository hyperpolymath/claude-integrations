// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import { z } from "zod";

/**
 * GitLab token scopes as defined by the GitLab API.
 * @see https://docs.gitlab.com/ee/user/profile/personal_access_tokens.html#personal-access-token-scopes
 */
export const GitLabScope = z.enum([
  "api",
  "read_api",
  "read_user",
  "read_repository",
  "write_repository",
  "read_registry",
  "write_registry",
  "sudo",
  "admin_mode",
  "create_runner",
  "manage_runner",
  "ai_features",
  "k8s_proxy",
]);

export type GitLabScope = z.infer<typeof GitLabScope>;

/**
 * Scopes that should never be granted for security reasons.
 */
export const DANGEROUS_SCOPES: readonly GitLabScope[] = [
  "sudo",
  "admin_mode",
] as const;

/**
 * Minimum required scopes for the bridge to function.
 */
export const REQUIRED_SCOPES: readonly GitLabScope[] = [
  "api",
  "read_repository",
  "write_repository",
] as const;

/**
 * GitLab token types and their prefixes.
 */
export const TOKEN_PREFIXES = {
  /** Personal Access Token */
  PERSONAL: "glpat-",
  /** Project Access Token */
  PROJECT: "glpat-",
  /** Group Access Token */
  GROUP: "glpat-",
  /** Deploy Token */
  DEPLOY: "gldt-",
  /** Runner Token */
  RUNNER: "glrt-",
  /** CI/CD Job Token */
  JOB: "glcbt-",
  /** Feature Flags Token */
  FEATURE_FLAG: "glffct-",
  /** Incoming Email Token */
  EMAIL: "glimt-",
  /** GitLab Agent Token */
  AGENT: "glagent-",
  /** OAuth Application Secret */
  OAUTH: "gloas-",
  /** SCIM Token */
  SCIM: "glsoat-",
} as const;

export type TokenPrefix = (typeof TOKEN_PREFIXES)[keyof typeof TOKEN_PREFIXES];

/**
 * Validated GitLab token information.
 */
export interface TokenInfo {
  /** The token value (masked for logging) */
  maskedToken: string;
  /** The type of token based on prefix */
  type: keyof typeof TOKEN_PREFIXES;
  /** Whether the token format is valid */
  isValid: boolean;
  /** Timestamp when validation occurred */
  validatedAt: Date;
}

/**
 * Result of a permission check.
 */
export interface PermissionResult {
  /** Whether the permission is granted */
  allowed: boolean;
  /** Required scopes for the operation */
  requiredScopes: GitLabScope[];
  /** Currently available scopes */
  availableScopes: GitLabScope[];
  /** Missing scopes if not allowed */
  missingScopes: GitLabScope[];
  /** Reason for denial if not allowed */
  reason?: string;
}

/**
 * User info from GitLab API for authenticated requests.
 */
export const GitLabUserSchema = z.object({
  id: z.number(),
  username: z.string(),
  name: z.string(),
  email: z.string().email().optional(),
  state: z.enum(["active", "blocked", "deactivated"]),
  avatar_url: z.string().url().nullable(),
  web_url: z.string().url(),
  is_admin: z.boolean().optional(),
  bot: z.boolean().optional(),
});

export type GitLabUser = z.infer<typeof GitLabUserSchema>;

/**
 * Token validation response from GitLab API.
 */
export const GitLabTokenInfoSchema = z.object({
  scopes: z.array(z.string()),
  created_at: z.string(),
  expires_at: z.string().nullable(),
  user_id: z.number().optional(),
  active: z.boolean().optional(),
  revoked: z.boolean().optional(),
});

export type GitLabTokenInfo = z.infer<typeof GitLabTokenInfoSchema>;

/**
 * Authentication context for requests.
 */
export interface AuthContext {
  /** Whether the request is authenticated */
  authenticated: boolean;
  /** The authenticated user (if available) */
  user?: GitLabUser;
  /** Token information */
  token?: TokenInfo;
  /** Available scopes for this token */
  scopes: GitLabScope[];
  /** GitLab instance URL */
  gitlabUrl: string;
  /** Timestamp of authentication */
  authenticatedAt: Date;
}

/**
 * Webhook payload validation result.
 */
export interface WebhookValidationResult {
  /** Whether the signature is valid */
  valid: boolean;
  /** The webhook event type */
  event?: string;
  /** Reason for failure if invalid */
  reason?: string;
}

/**
 * Rate limit information.
 */
export interface RateLimitInfo {
  /** Maximum requests allowed in the window */
  limit: number;
  /** Remaining requests in the current window */
  remaining: number;
  /** Timestamp when the window resets */
  resetAt: Date;
  /** Whether rate limited */
  isLimited: boolean;
}

/**
 * Audit log entry for security tracking.
 */
export interface AuditEntry {
  /** Unique entry ID */
  id: string;
  /** Timestamp of the action */
  timestamp: Date;
  /** Action performed */
  action: string;
  /** Actor (user or system) */
  actor: string;
  /** Resource affected */
  resource: string;
  /** Whether the action succeeded */
  success: boolean;
  /** Additional context */
  metadata?: Record<string, unknown>;
  /** IP address (if available) */
  ipAddress?: string;
}
