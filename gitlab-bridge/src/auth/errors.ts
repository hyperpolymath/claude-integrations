// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Base class for authentication errors.
 */
export class AuthError extends Error {
  readonly code: string;
  readonly statusCode: number;

  constructor(message: string, code: string, statusCode: number = 401) {
    super(message);
    this.name = "AuthError";
    this.code = code;
    this.statusCode = statusCode;
    Object.setPrototypeOf(this, AuthError.prototype);
  }
}

/**
 * Thrown when a token is invalid or malformed.
 */
export class InvalidTokenError extends AuthError {
  constructor(message: string = "Invalid or malformed token") {
    super(message, "INVALID_TOKEN", 401);
    this.name = "InvalidTokenError";
    Object.setPrototypeOf(this, InvalidTokenError.prototype);
  }
}

/**
 * Thrown when a token has expired.
 */
export class TokenExpiredError extends AuthError {
  readonly expiredAt: Date;

  constructor(expiredAt: Date) {
    super(`Token expired at ${expiredAt.toISOString()}`, "TOKEN_EXPIRED", 401);
    this.name = "TokenExpiredError";
    this.expiredAt = expiredAt;
    Object.setPrototypeOf(this, TokenExpiredError.prototype);
  }
}

/**
 * Thrown when required scopes are missing.
 */
export class InsufficientScopeError extends AuthError {
  readonly requiredScopes: string[];
  readonly availableScopes: string[];

  constructor(requiredScopes: string[], availableScopes: string[]) {
    const missing = requiredScopes.filter((s) => !availableScopes.includes(s));
    super(
      `Missing required scopes: ${missing.join(", ")}`,
      "INSUFFICIENT_SCOPE",
      403
    );
    this.name = "InsufficientScopeError";
    this.requiredScopes = requiredScopes;
    this.availableScopes = availableScopes;
    Object.setPrototypeOf(this, InsufficientScopeError.prototype);
  }
}

/**
 * Thrown when a token has dangerous scopes.
 */
export class DangerousScopeError extends AuthError {
  readonly dangerousScopes: string[];

  constructor(dangerousScopes: string[]) {
    super(
      `Token contains dangerous scopes: ${dangerousScopes.join(", ")}. ` +
        `These scopes are not allowed for security reasons.`,
      "DANGEROUS_SCOPE",
      403
    );
    this.name = "DangerousScopeError";
    this.dangerousScopes = dangerousScopes;
    Object.setPrototypeOf(this, DangerousScopeError.prototype);
  }
}

/**
 * Thrown when no token is provided.
 */
export class MissingTokenError extends AuthError {
  constructor() {
    super(
      "Authentication required. No token provided.",
      "MISSING_TOKEN",
      401
    );
    this.name = "MissingTokenError";
    Object.setPrototypeOf(this, MissingTokenError.prototype);
  }
}

/**
 * Thrown when webhook signature validation fails.
 */
export class WebhookSignatureError extends AuthError {
  constructor(message: string = "Invalid webhook signature") {
    super(message, "INVALID_WEBHOOK_SIGNATURE", 401);
    this.name = "WebhookSignatureError";
    Object.setPrototypeOf(this, WebhookSignatureError.prototype);
  }
}

/**
 * Thrown when rate limit is exceeded.
 */
export class RateLimitError extends AuthError {
  readonly retryAfter: number;

  constructor(retryAfter: number) {
    super(
      `Rate limit exceeded. Retry after ${retryAfter} seconds.`,
      "RATE_LIMIT_EXCEEDED",
      429
    );
    this.name = "RateLimitError";
    this.retryAfter = retryAfter;
    Object.setPrototypeOf(this, RateLimitError.prototype);
  }
}

/**
 * Thrown when a token is revoked.
 */
export class TokenRevokedError extends AuthError {
  constructor() {
    super("Token has been revoked", "TOKEN_REVOKED", 401);
    this.name = "TokenRevokedError";
    Object.setPrototypeOf(this, TokenRevokedError.prototype);
  }
}

/**
 * Thrown when user is blocked or deactivated.
 */
export class UserBlockedError extends AuthError {
  readonly userId: number;
  readonly state: string;

  constructor(userId: number, state: string) {
    super(`User ${userId} is ${state}`, "USER_BLOCKED", 403);
    this.name = "UserBlockedError";
    this.userId = userId;
    this.state = state;
    Object.setPrototypeOf(this, UserBlockedError.prototype);
  }
}
