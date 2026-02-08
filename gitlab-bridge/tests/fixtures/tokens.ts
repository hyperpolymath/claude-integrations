// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Test fixtures for GitLab tokens.
 * These are fake tokens for testing purposes only - never use in production.
 */

import type { GitLabScope } from "../../src/auth/types";

/**
 * Valid token fixtures for testing.
 */
export const VALID_TOKENS = {
  /** Standard personal access token */
  personal: "glpat-xxxxxxxxxxxxxxxxxxxx",

  /** Personal access token with dashes */
  personalWithDashes: "glpat-abc123-def456-ghi789",

  /** Deploy token */
  deploy: "gldt-xxxxxxxxxxxxxxxxxxxx",

  /** Runner token */
  runner: "glrt-xxxxxxxxxxxxxxxxxxxx",

  /** CI/CD job token */
  job: "glcbt-xxxxxxxxxxxxxxxxxxxx",

  /** Feature flag token */
  featureFlag: "glffct-xxxxxxxxxxxxxxxxxxxx",

  /** GitLab Agent token */
  agent: "glagent-xxxxxxxxxxxxxxxxxxxx",

  /** Long valid token */
  long: "glpat-" + "x".repeat(100),

  /** Exactly minimum length */
  minLength: "glpat-xxxxxxxxxxxxxxx",
} as const;

/**
 * Invalid token fixtures for testing.
 */
export const INVALID_TOKENS = {
  /** Empty string */
  empty: "",

  /** Whitespace only */
  whitespace: "   ",

  /** Too short */
  tooShort: "glpat-xxx",

  /** Too long */
  tooLong: "glpat-" + "x".repeat(300),

  /** Invalid prefix */
  invalidPrefix: "invalid-xxxxxxxxxxxxxxxxxxxx",

  /** No prefix */
  noPrefix: "xxxxxxxxxxxxxxxxxxxx",

  /** Contains invalid characters */
  invalidChars: "glpat-xxx!@#$%^&*()",

  /** Contains spaces */
  withSpaces: "glpat-xxxx xxxx xxxx",

  /** Only prefix */
  onlyPrefix: "glpat-",

  /** Null-like strings */
  nullString: "null",
  undefinedString: "undefined",
} as const;

/**
 * Token information response fixtures.
 */
export const TOKEN_INFO_RESPONSES = {
  /** Valid active token with full scopes */
  validActive: {
    scopes: ["api", "read_repository", "write_repository"],
    created_at: "2024-01-01T00:00:00Z",
    expires_at: "2025-12-31T23:59:59Z",
    user_id: 12345,
    active: true,
    revoked: false,
  },

  /** Valid token with no expiration */
  noExpiration: {
    scopes: ["api", "read_repository"],
    created_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    user_id: 12345,
    active: true,
    revoked: false,
  },

  /** Expired token */
  expired: {
    scopes: ["api"],
    created_at: "2023-01-01T00:00:00Z",
    expires_at: "2023-12-31T23:59:59Z",
    user_id: 12345,
    active: false,
    revoked: false,
  },

  /** Revoked token */
  revoked: {
    scopes: ["api"],
    created_at: "2024-01-01T00:00:00Z",
    expires_at: "2025-12-31T23:59:59Z",
    user_id: 12345,
    active: false,
    revoked: true,
  },

  /** Token with dangerous scopes */
  dangerous: {
    scopes: ["api", "sudo", "admin_mode"],
    created_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    user_id: 12345,
    active: true,
    revoked: false,
  },

  /** Token expiring soon (7 days) */
  expiringSoon: {
    scopes: ["api", "read_repository"],
    created_at: "2024-01-01T00:00:00Z",
    expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
    user_id: 12345,
    active: true,
    revoked: false,
  },

  /** Minimal scopes */
  minimalScopes: {
    scopes: ["read_api"],
    created_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    user_id: 12345,
    active: true,
    revoked: false,
  },

  /** Read-only token */
  readOnly: {
    scopes: ["read_api", "read_repository", "read_user"],
    created_at: "2024-01-01T00:00:00Z",
    expires_at: null,
    user_id: 12345,
    active: true,
    revoked: false,
  },
};

/**
 * Scope combinations for permission testing.
 */
export const SCOPE_SETS: Record<string, GitLabScope[]> = {
  /** Full bridge scopes (recommended) */
  fullBridge: ["api", "read_repository", "write_repository"],

  /** Read-only scopes */
  readOnly: ["read_api", "read_repository", "read_user"],

  /** Write scopes */
  writeOnly: ["api", "write_repository"],

  /** Minimal API access */
  minimalApi: ["read_api"],

  /** All available scopes */
  all: [
    "api",
    "read_api",
    "read_user",
    "read_repository",
    "write_repository",
    "read_registry",
    "write_registry",
  ],

  /** Dangerous scopes (should be rejected) */
  dangerous: ["api", "sudo", "admin_mode"],

  /** Empty scopes */
  empty: [],

  /** CI/CD focused */
  cicd: ["api", "read_repository", "create_runner"],
};

/**
 * Creates a token info response with custom properties.
 */
export function createTokenInfo(
  overrides: Partial<(typeof TOKEN_INFO_RESPONSES)["validActive"]> = {}
): (typeof TOKEN_INFO_RESPONSES)["validActive"] {
  return {
    ...TOKEN_INFO_RESPONSES.validActive,
    ...overrides,
  };
}

/**
 * Creates an expiration date a certain number of days from now.
 */
export function expiresInDays(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Creates an expiration date a certain number of days ago.
 */
export function expiredDaysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
