// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Authentication and authorization module for Claude GitLab Bridge.
 *
 * @module auth
 */

// Types
export * from "./types";

// Errors
export * from "./errors";

// Token validation
export {
  validateTokenFormat,
  validateToken,
  parseTokenInfo,
  getTokenType,
  maskToken,
  checkTokenExpiration,
  checkTokenRevocation,
  checkDangerousScopes,
  checkExpirationWarning,
} from "./token-validator";

// Permission checking
export {
  checkScopeSatisfaction,
  checkOperationPermission,
  validateRequiredScopes,
  validateNoDangerousScopes,
  requirePermission,
  checkBridgeScopes,
  getRequiredScopesForOperations,
  checkMultipleOperations,
  OPERATION_SCOPES,
} from "./permission-checker";

// Webhook validation
export {
  validateWebhookToken,
  validateWebhookSignature,
  computeWebhookSignature,
  validateWebhookRequest,
  requireValidWebhook,
  extractWebhookMetadata,
  validateSecretStrength,
  WEBHOOK_TOKEN_HEADER,
  WEBHOOK_EVENT_HEADER,
  WEBHOOK_INSTANCE_HEADER,
  WEBHOOK_EVENTS,
} from "./webhook-validator";

// Middleware
export {
  createAuthMiddleware,
  createWebhookMiddleware,
  requirePermissionMiddleware,
  authErrorHandler,
  extractToken,
  type AuthMiddlewareConfig,
} from "./middleware";

// Rate limiting
export {
  RateLimiter,
  createRateLimitMiddleware,
  createSharedRateLimiter,
  createRateLimitFromPreset,
  requireRateLimit,
  RATE_LIMIT_PRESETS,
  DEFAULT_RATE_LIMIT_CONFIG,
  type RateLimitConfig,
} from "./rate-limiter";
