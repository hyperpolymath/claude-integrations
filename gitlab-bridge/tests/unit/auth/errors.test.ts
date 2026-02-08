// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import { describe, it, expect } from "vitest";
import {
  AuthError,
  InvalidTokenError,
  TokenExpiredError,
  TokenRevokedError,
  InsufficientScopeError,
  DangerousScopeError,
  MissingTokenError,
  WebhookSignatureError,
  RateLimitError,
  UserBlockedError,
} from "../../../src/auth/errors";

describe("auth errors", () => {
  describe("AuthError", () => {
    it("should have correct properties", () => {
      const error = new AuthError("test message", "TEST_CODE", 401);

      expect(error.message).toBe("test message");
      expect(error.code).toBe("TEST_CODE");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("AuthError");
    });

    it("should default to 401 status code", () => {
      const error = new AuthError("test", "CODE");
      expect(error.statusCode).toBe(401);
    });

    it("should be instanceof Error", () => {
      const error = new AuthError("test", "CODE");
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AuthError);
    });
  });

  describe("InvalidTokenError", () => {
    it("should have correct code and status", () => {
      const error = new InvalidTokenError();

      expect(error.code).toBe("INVALID_TOKEN");
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe("InvalidTokenError");
    });

    it("should accept custom message", () => {
      const error = new InvalidTokenError("Custom message");
      expect(error.message).toBe("Custom message");
    });

    it("should be instanceof AuthError", () => {
      const error = new InvalidTokenError();
      expect(error).toBeInstanceOf(AuthError);
    });
  });

  describe("TokenExpiredError", () => {
    it("should include expiration date", () => {
      const expiredAt = new Date("2024-01-01T00:00:00Z");
      const error = new TokenExpiredError(expiredAt);

      expect(error.code).toBe("TOKEN_EXPIRED");
      expect(error.statusCode).toBe(401);
      expect(error.expiredAt).toBe(expiredAt);
      expect(error.message).toContain("2024-01-01");
    });
  });

  describe("TokenRevokedError", () => {
    it("should have correct code and status", () => {
      const error = new TokenRevokedError();

      expect(error.code).toBe("TOKEN_REVOKED");
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("revoked");
    });
  });

  describe("InsufficientScopeError", () => {
    it("should include scope information", () => {
      const error = new InsufficientScopeError(
        ["api", "write_repository"],
        ["read_repository"]
      );

      expect(error.code).toBe("INSUFFICIENT_SCOPE");
      expect(error.statusCode).toBe(403);
      expect(error.requiredScopes).toEqual(["api", "write_repository"]);
      expect(error.availableScopes).toEqual(["read_repository"]);
      expect(error.message).toContain("api");
      expect(error.message).toContain("write_repository");
    });
  });

  describe("DangerousScopeError", () => {
    it("should include dangerous scopes", () => {
      const error = new DangerousScopeError(["sudo", "admin_mode"]);

      expect(error.code).toBe("DANGEROUS_SCOPE");
      expect(error.statusCode).toBe(403);
      expect(error.dangerousScopes).toEqual(["sudo", "admin_mode"]);
      expect(error.message).toContain("sudo");
      expect(error.message).toContain("admin_mode");
    });
  });

  describe("MissingTokenError", () => {
    it("should have correct code and status", () => {
      const error = new MissingTokenError();

      expect(error.code).toBe("MISSING_TOKEN");
      expect(error.statusCode).toBe(401);
      expect(error.message).toContain("No token provided");
    });
  });

  describe("WebhookSignatureError", () => {
    it("should have correct code and status", () => {
      const error = new WebhookSignatureError();

      expect(error.code).toBe("INVALID_WEBHOOK_SIGNATURE");
      expect(error.statusCode).toBe(401);
    });

    it("should accept custom message", () => {
      const error = new WebhookSignatureError("Custom validation failure");
      expect(error.message).toBe("Custom validation failure");
    });
  });

  describe("RateLimitError", () => {
    it("should include retry-after information", () => {
      const error = new RateLimitError(60);

      expect(error.code).toBe("RATE_LIMIT_EXCEEDED");
      expect(error.statusCode).toBe(429);
      expect(error.retryAfter).toBe(60);
      expect(error.message).toContain("60 seconds");
    });
  });

  describe("UserBlockedError", () => {
    it("should include user and state information", () => {
      const error = new UserBlockedError(12345, "blocked");

      expect(error.code).toBe("USER_BLOCKED");
      expect(error.statusCode).toBe(403);
      expect(error.userId).toBe(12345);
      expect(error.state).toBe("blocked");
      expect(error.message).toContain("12345");
      expect(error.message).toContain("blocked");
    });
  });
});
