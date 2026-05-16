// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2026 Jonathan D.A. Jewell

/**
 * Authentication and authorization error types
 */

// Base authentication error
type authError = {
  name: string,
  message: string,
  code: string,
  statusCode: int,
}

// Specific error types using Result/Error pattern

// Invalid token error
exception InvalidToken(string)

let invalidTokenError = (~message="Invalid or malformed token"): authError => {
  name: "InvalidTokenError",
  message,
  code: "INVALID_TOKEN",
  statusCode: 401,
}

// Token expired error
exception TokenExpired(Date.t)

let tokenExpiredError = (~expiredAt: Date.t): authError => {
  name: "TokenExpiredError",
  message: `Token expired at ${expiredAt->Date.toISOString}`,
  code: "TOKEN_EXPIRED",
  statusCode: 401,
}

// Insufficient scope error
exception InsufficientScope(array<string>, array<string>)

let insufficientScopeError = (
  ~requiredScopes: array<string>,
  ~availableScopes: array<string>,
): authError => {
  let missing =
    requiredScopes->Array.filter(scope => !(availableScopes->Array.includes(scope)))
  {
    name: "InsufficientScopeError",
    message: `Missing required scopes: ${missing->Array.join(", ")}`,
    code: "INSUFFICIENT_SCOPE",
    statusCode: 403,
  }
}

// Dangerous scope error
exception DangerousScope(array<string>)

let dangerousScopeError = (~dangerousScopes: array<string>): authError => {
  name: "DangerousScopeError",
  message: `Token contains dangerous scopes: ${dangerousScopes->Array.join(", ")}. These scopes are not allowed for security reasons.`,
  code: "DANGEROUS_SCOPE",
  statusCode: 403,
}

// Missing token error
exception MissingToken

let missingTokenError = (): authError => {
  name: "MissingTokenError",
  message: "Authentication required. No token provided.",
  code: "MISSING_TOKEN",
  statusCode: 401,
}

// Webhook signature error
exception WebhookSignatureError(string)

let webhookSignatureError = (~message="Invalid webhook signature"): authError => {
  name: "WebhookSignatureError",
  message,
  code: "INVALID_WEBHOOK_SIGNATURE",
  statusCode: 401,
}

// Rate limit error
exception RateLimit(int)

let rateLimitError = (~retryAfter: int): authError => {
  name: "RateLimitError",
  message: `Rate limit exceeded. Retry after ${retryAfter->Int.toString} seconds.`,
  code: "RATE_LIMIT_EXCEEDED",
  statusCode: 429,
}

// Token revoked error
exception TokenRevoked

let tokenRevokedError = (): authError => {
  name: "TokenRevokedError",
  message: "Token has been revoked",
  code: "TOKEN_REVOKED",
  statusCode: 401,
}

// User blocked error
exception UserBlocked(int, string)

let userBlockedError = (~userId: int, ~state: string): authError => {
  name: "UserBlockedError",
  message: `User ${userId->Int.toString} is ${state}`,
  code: "USER_BLOCKED",
  statusCode: 403,
}

// Helper to convert error to JSON for API responses.
// In ReScript 12 / @rescript/core, the JSON constructor helpers
// (`string`, `number`, `object`, …) live under `JSON.Encode`, and
// `object_` was renamed to `object`. Calls are fully qualified
// rather than via `open JSON.Encode` to avoid shadowing the
// top-level `float` identifier used elsewhere.
let errorToJSON = (error: authError): JSON.t =>
  JSON.Encode.object(
    Dict.fromArray([
      ("name", JSON.Encode.string(error.name)),
      ("message", JSON.Encode.string(error.message)),
      ("code", JSON.Encode.string(error.code)),
      ("statusCode", JSON.Encode.int(error.statusCode)),
    ]),
  )

// Helper to check if error is retryable
let isRetryable = (error: authError): bool =>
  switch error.code {
  | "RATE_LIMIT_EXCEEDED" => true
  | _ => false
  }
