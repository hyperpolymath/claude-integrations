// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import {
  TokenInfo,
  TOKEN_PREFIXES,
  GitLabTokenInfo,
  GitLabTokenInfoSchema,
  GitLabScope,
  DANGEROUS_SCOPES,
} from "./types";
import {
  InvalidTokenError,
  TokenExpiredError,
  TokenRevokedError,
  DangerousScopeError,
} from "./errors";

/**
 * Minimum token length (prefix + random characters).
 * GitLab PATs are typically 20+ characters after the prefix.
 */
const MIN_TOKEN_LENGTH = 20;

/**
 * Maximum token length to prevent DoS attacks.
 */
const MAX_TOKEN_LENGTH = 256;

/**
 * Valid characters in a GitLab token (alphanumeric and hyphens).
 */
const TOKEN_CHAR_PATTERN = /^[a-zA-Z0-9_-]+$/;

/**
 * Validates the format of a GitLab token.
 *
 * @param token - The token to validate
 * @returns TokenInfo with validation result
 * @throws InvalidTokenError if the token format is invalid
 */
export function validateTokenFormat(token: string): TokenInfo {
  // Check for empty or whitespace-only tokens
  if (!token || token.trim().length === 0) {
    throw new InvalidTokenError("Token cannot be empty");
  }

  const trimmedToken = token.trim();

  // Length checks to prevent DoS
  if (trimmedToken.length < MIN_TOKEN_LENGTH) {
    throw new InvalidTokenError(
      `Token too short (minimum ${MIN_TOKEN_LENGTH} characters)`
    );
  }

  if (trimmedToken.length > MAX_TOKEN_LENGTH) {
    throw new InvalidTokenError(
      `Token too long (maximum ${MAX_TOKEN_LENGTH} characters)`
    );
  }

  // Determine token type from prefix
  const tokenType = getTokenType(trimmedToken);

  if (!tokenType) {
    throw new InvalidTokenError(
      "Invalid token prefix. Expected glpat-, gldt-, glrt-, glcbt-, or similar GitLab token prefix."
    );
  }

  // Extract the token part after the prefix
  const prefix = TOKEN_PREFIXES[tokenType];
  const tokenPart = trimmedToken.substring(prefix.length);

  // Validate token characters
  if (!TOKEN_CHAR_PATTERN.test(tokenPart)) {
    throw new InvalidTokenError(
      "Token contains invalid characters. Only alphanumeric characters, hyphens, and underscores are allowed."
    );
  }

  return {
    maskedToken: maskToken(trimmedToken),
    type: tokenType,
    isValid: true,
    validatedAt: new Date(),
  };
}

/**
 * Determines the token type from its prefix.
 *
 * @param token - The token to check
 * @returns The token type key or null if unknown
 */
export function getTokenType(
  token: string
): keyof typeof TOKEN_PREFIXES | null {
  for (const [type, prefix] of Object.entries(TOKEN_PREFIXES)) {
    if (token.startsWith(prefix)) {
      return type as keyof typeof TOKEN_PREFIXES;
    }
  }
  return null;
}

/**
 * Masks a token for safe logging, showing only first and last few characters.
 *
 * @param token - The token to mask
 * @returns Masked token string
 */
export function maskToken(token: string): string {
  if (token.length <= 12) {
    return "***";
  }
  const prefix = token.substring(0, 8);
  const suffix = token.substring(token.length - 4);
  return `${prefix}...${suffix}`;
}

/**
 * Validates token information from GitLab API response.
 *
 * @param response - The raw API response
 * @returns Parsed and validated GitLabTokenInfo
 * @throws InvalidTokenError if the response is invalid
 */
export function parseTokenInfo(response: unknown): GitLabTokenInfo {
  const result = GitLabTokenInfoSchema.safeParse(response);

  if (!result.success) {
    throw new InvalidTokenError(
      `Invalid token info response: ${result.error.message}`
    );
  }

  return result.data;
}

/**
 * Checks if a token has expired.
 *
 * @param tokenInfo - Token information from GitLab API
 * @throws TokenExpiredError if the token has expired
 */
export function checkTokenExpiration(tokenInfo: GitLabTokenInfo): void {
  if (tokenInfo.expires_at) {
    const expiresAt = new Date(tokenInfo.expires_at);
    if (expiresAt <= new Date()) {
      throw new TokenExpiredError(expiresAt);
    }
  }
}

/**
 * Checks if a token has been revoked.
 *
 * @param tokenInfo - Token information from GitLab API
 * @throws TokenRevokedError if the token has been revoked
 */
export function checkTokenRevocation(tokenInfo: GitLabTokenInfo): void {
  if (tokenInfo.revoked === true) {
    throw new TokenRevokedError();
  }

  if (tokenInfo.active === false) {
    throw new TokenRevokedError();
  }
}

/**
 * Checks if a token has dangerous scopes.
 *
 * @param scopes - The scopes to check
 * @throws DangerousScopeError if dangerous scopes are present
 */
export function checkDangerousScopes(scopes: string[]): void {
  const dangerous = scopes.filter((s) =>
    DANGEROUS_SCOPES.includes(s as GitLabScope)
  );

  if (dangerous.length > 0) {
    throw new DangerousScopeError(dangerous);
  }
}

/**
 * Fully validates a token including format and API response.
 *
 * @param token - The token string to validate
 * @param apiResponse - Optional API response for deeper validation
 * @returns Validated token info and scopes
 */
export function validateToken(
  token: string,
  apiResponse?: unknown
): { tokenInfo: TokenInfo; scopes: GitLabScope[] } {
  // Validate format first
  const tokenInfo = validateTokenFormat(token);

  // If API response provided, validate that too
  if (apiResponse) {
    const gitlabInfo = parseTokenInfo(apiResponse);

    // Check expiration
    checkTokenExpiration(gitlabInfo);

    // Check revocation
    checkTokenRevocation(gitlabInfo);

    // Parse scopes
    const scopes = gitlabInfo.scopes.filter((s) =>
      Object.values(GitLabScope.options).includes(s as GitLabScope)
    ) as GitLabScope[];

    // Check for dangerous scopes
    checkDangerousScopes(scopes);

    return { tokenInfo, scopes };
  }

  // Without API response, return empty scopes (will need API call to get them)
  return { tokenInfo, scopes: [] };
}

/**
 * Checks if a token is close to expiration.
 *
 * @param expiresAt - Expiration date
 * @param warningDays - Days before expiration to warn (default: 7)
 * @returns Object with expiration status
 */
export function checkExpirationWarning(
  expiresAt: string | null,
  warningDays: number = 7
): { expiresInDays: number | null; shouldWarn: boolean } {
  if (!expiresAt) {
    return { expiresInDays: null, shouldWarn: false };
  }

  const expDate = new Date(expiresAt);
  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  return {
    expiresInDays: diffDays,
    shouldWarn: diffDays > 0 && diffDays <= warningDays,
  };
}
