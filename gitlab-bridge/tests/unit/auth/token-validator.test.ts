// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import { describe, it, expect } from "vitest";
import {
  validateTokenFormat,
  validateToken,
  getTokenType,
  maskToken,
  parseTokenInfo,
  checkTokenExpiration,
  checkTokenRevocation,
  checkDangerousScopes,
  checkExpirationWarning,
} from "../../../src/auth/token-validator";
import {
  InvalidTokenError,
  TokenExpiredError,
  TokenRevokedError,
  DangerousScopeError,
} from "../../../src/auth/errors";
import {
  VALID_TOKENS,
  INVALID_TOKENS,
  TOKEN_INFO_RESPONSES,
  expiresInDays,
  expiredDaysAgo,
} from "../../fixtures";

describe("token-validator", () => {
  describe("validateTokenFormat", () => {
    it("should accept valid personal access token", () => {
      const result = validateTokenFormat(VALID_TOKENS.personal);
      expect(result.isValid).toBe(true);
      expect(result.type).toBe("PERSONAL");
    });

    it("should accept valid deploy token", () => {
      const result = validateTokenFormat(VALID_TOKENS.deploy);
      expect(result.isValid).toBe(true);
      expect(result.type).toBe("DEPLOY");
    });

    it("should accept valid runner token", () => {
      const result = validateTokenFormat(VALID_TOKENS.runner);
      expect(result.isValid).toBe(true);
      expect(result.type).toBe("RUNNER");
    });

    it("should accept valid job token", () => {
      const result = validateTokenFormat(VALID_TOKENS.job);
      expect(result.isValid).toBe(true);
      expect(result.type).toBe("JOB");
    });

    it("should accept valid agent token", () => {
      const result = validateTokenFormat(VALID_TOKENS.agent);
      expect(result.isValid).toBe(true);
      expect(result.type).toBe("AGENT");
    });

    it("should accept token at minimum length", () => {
      const result = validateTokenFormat(VALID_TOKENS.minLength);
      expect(result.isValid).toBe(true);
    });

    it("should accept long valid token", () => {
      const result = validateTokenFormat(VALID_TOKENS.long);
      expect(result.isValid).toBe(true);
    });

    it("should trim whitespace from token", () => {
      const result = validateTokenFormat("  " + VALID_TOKENS.personal + "  ");
      expect(result.isValid).toBe(true);
    });

    it("should reject empty token", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.empty)).toThrow(
        InvalidTokenError
      );
    });

    it("should reject whitespace-only token", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.whitespace)).toThrow(
        InvalidTokenError
      );
    });

    it("should reject token that is too short", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.tooShort)).toThrow(
        InvalidTokenError
      );
    });

    it("should reject token that is too long", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.tooLong)).toThrow(
        InvalidTokenError
      );
    });

    it("should reject token with invalid prefix", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.invalidPrefix)).toThrow(
        InvalidTokenError
      );
    });

    it("should reject token without prefix", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.noPrefix)).toThrow(
        InvalidTokenError
      );
    });

    it("should reject token with invalid characters", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.invalidChars)).toThrow(
        InvalidTokenError
      );
    });

    it("should reject token with spaces", () => {
      expect(() => validateTokenFormat(INVALID_TOKENS.withSpaces)).toThrow(
        InvalidTokenError
      );
    });

    it("should include validation timestamp", () => {
      const before = new Date();
      const result = validateTokenFormat(VALID_TOKENS.personal);
      const after = new Date();

      expect(result.validatedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(result.validatedAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("getTokenType", () => {
    it("should identify personal access token", () => {
      expect(getTokenType(VALID_TOKENS.personal)).toBe("PERSONAL");
    });

    it("should identify deploy token", () => {
      expect(getTokenType(VALID_TOKENS.deploy)).toBe("DEPLOY");
    });

    it("should identify runner token", () => {
      expect(getTokenType(VALID_TOKENS.runner)).toBe("RUNNER");
    });

    it("should return null for unknown prefix", () => {
      expect(getTokenType("unknown-token")).toBeNull();
    });
  });

  describe("maskToken", () => {
    it("should mask token showing prefix and suffix", () => {
      const masked = maskToken(VALID_TOKENS.personal);
      expect(masked).toMatch(/^glpat-xx\.\.\.xxxx$/);
    });

    it("should fully mask short tokens", () => {
      const masked = maskToken("short");
      expect(masked).toBe("***");
    });

    it("should handle long tokens", () => {
      const masked = maskToken(VALID_TOKENS.long);
      expect(masked.length).toBeLessThan(VALID_TOKENS.long.length);
      expect(masked).toContain("...");
    });
  });

  describe("parseTokenInfo", () => {
    it("should parse valid token info response", () => {
      const result = parseTokenInfo(TOKEN_INFO_RESPONSES.validActive);
      expect(result.scopes).toEqual(["api", "read_repository", "write_repository"]);
      expect(result.active).toBe(true);
    });

    it("should parse token with no expiration", () => {
      const result = parseTokenInfo(TOKEN_INFO_RESPONSES.noExpiration);
      expect(result.expires_at).toBeNull();
    });

    it("should throw on invalid response", () => {
      expect(() => parseTokenInfo({ invalid: "response" })).toThrow(
        InvalidTokenError
      );
    });

    it("should throw on null response", () => {
      expect(() => parseTokenInfo(null)).toThrow(InvalidTokenError);
    });
  });

  describe("checkTokenExpiration", () => {
    it("should not throw for non-expired token", () => {
      expect(() =>
        checkTokenExpiration({
          ...TOKEN_INFO_RESPONSES.validActive,
          expires_at: expiresInDays(30),
        })
      ).not.toThrow();
    });

    it("should not throw for token with no expiration", () => {
      expect(() =>
        checkTokenExpiration(TOKEN_INFO_RESPONSES.noExpiration)
      ).not.toThrow();
    });

    it("should throw TokenExpiredError for expired token", () => {
      expect(() =>
        checkTokenExpiration({
          ...TOKEN_INFO_RESPONSES.expired,
          expires_at: expiredDaysAgo(1),
        })
      ).toThrow(TokenExpiredError);
    });
  });

  describe("checkTokenRevocation", () => {
    it("should not throw for active non-revoked token", () => {
      expect(() =>
        checkTokenRevocation(TOKEN_INFO_RESPONSES.validActive)
      ).not.toThrow();
    });

    it("should throw TokenRevokedError for revoked token", () => {
      expect(() =>
        checkTokenRevocation(TOKEN_INFO_RESPONSES.revoked)
      ).toThrow(TokenRevokedError);
    });

    it("should throw TokenRevokedError for inactive token", () => {
      expect(() =>
        checkTokenRevocation({
          ...TOKEN_INFO_RESPONSES.validActive,
          active: false,
        })
      ).toThrow(TokenRevokedError);
    });
  });

  describe("checkDangerousScopes", () => {
    it("should not throw for safe scopes", () => {
      expect(() =>
        checkDangerousScopes(["api", "read_repository", "write_repository"])
      ).not.toThrow();
    });

    it("should throw DangerousScopeError for sudo scope", () => {
      expect(() => checkDangerousScopes(["api", "sudo"])).toThrow(
        DangerousScopeError
      );
    });

    it("should throw DangerousScopeError for admin_mode scope", () => {
      expect(() => checkDangerousScopes(["api", "admin_mode"])).toThrow(
        DangerousScopeError
      );
    });

    it("should include all dangerous scopes in error", () => {
      try {
        checkDangerousScopes(["api", "sudo", "admin_mode"]);
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof DangerousScopeError) {
          expect(error.dangerousScopes).toContain("sudo");
          expect(error.dangerousScopes).toContain("admin_mode");
        } else {
          throw error;
        }
      }
    });
  });

  describe("checkExpirationWarning", () => {
    it("should return shouldWarn=false for null expiration", () => {
      const result = checkExpirationWarning(null);
      expect(result.shouldWarn).toBe(false);
      expect(result.expiresInDays).toBeNull();
    });

    it("should return shouldWarn=true for token expiring in 5 days", () => {
      const result = checkExpirationWarning(expiresInDays(5));
      expect(result.shouldWarn).toBe(true);
      expect(result.expiresInDays).toBeLessThanOrEqual(5);
    });

    it("should return shouldWarn=false for token expiring in 30 days", () => {
      const result = checkExpirationWarning(expiresInDays(30));
      expect(result.shouldWarn).toBe(false);
      expect(result.expiresInDays).toBeGreaterThan(7);
    });

    it("should respect custom warning days", () => {
      const result = checkExpirationWarning(expiresInDays(20), 30);
      expect(result.shouldWarn).toBe(true);
    });
  });

  describe("validateToken", () => {
    it("should validate token format without API response", () => {
      const { tokenInfo, scopes } = validateToken(VALID_TOKENS.personal);
      expect(tokenInfo.isValid).toBe(true);
      expect(scopes).toEqual([]);
    });

    it("should validate token with API response", () => {
      const { tokenInfo, scopes } = validateToken(
        VALID_TOKENS.personal,
        TOKEN_INFO_RESPONSES.validActive
      );
      expect(tokenInfo.isValid).toBe(true);
      expect(scopes).toContain("api");
    });

    it("should throw for invalid format", () => {
      expect(() => validateToken(INVALID_TOKENS.invalidPrefix)).toThrow(
        InvalidTokenError
      );
    });

    it("should throw for expired token in API response", () => {
      expect(() =>
        validateToken(VALID_TOKENS.personal, {
          ...TOKEN_INFO_RESPONSES.expired,
          expires_at: expiredDaysAgo(1),
        })
      ).toThrow(TokenExpiredError);
    });

    it("should throw for dangerous scopes in API response", () => {
      expect(() =>
        validateToken(VALID_TOKENS.personal, TOKEN_INFO_RESPONSES.dangerous)
      ).toThrow(DangerousScopeError);
    });
  });
});
