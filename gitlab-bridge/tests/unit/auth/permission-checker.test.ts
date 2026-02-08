// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import { describe, it, expect } from "vitest";
import {
  checkScopeSatisfaction,
  checkOperationPermission,
  validateRequiredScopes,
  validateNoDangerousScopes,
  requirePermission,
  checkBridgeScopes,
  getRequiredScopesForOperations,
  checkMultipleOperations,
  OPERATION_SCOPES,
} from "../../../src/auth/permission-checker";
import {
  InsufficientScopeError,
  DangerousScopeError,
} from "../../../src/auth/errors";
import { SCOPE_SETS } from "../../fixtures";
import type { GitLabScope } from "../../../src/auth/types";

describe("permission-checker", () => {
  describe("checkScopeSatisfaction", () => {
    it("should allow when required scope is present", () => {
      const result = checkScopeSatisfaction(
        ["api", "read_repository"],
        ["api"]
      );
      expect(result.allowed).toBe(true);
      expect(result.missingScopes).toEqual([]);
    });

    it("should allow when any of the required scopes is present (OR logic)", () => {
      const result = checkScopeSatisfaction(
        ["read_repository"],
        ["api", "read_repository"]
      );
      expect(result.allowed).toBe(true);
    });

    it("should deny when no required scope is present", () => {
      const result = checkScopeSatisfaction(
        ["read_user"],
        ["api", "read_repository"]
      );
      expect(result.allowed).toBe(false);
      expect(result.missingScopes).toEqual(["api", "read_repository"]);
    });

    it("should allow with empty required scopes", () => {
      const result = checkScopeSatisfaction(["api"], []);
      expect(result.allowed).toBe(true);
    });

    it("should include reason when denied", () => {
      const result = checkScopeSatisfaction([], ["api"]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Missing required scope");
    });
  });

  describe("checkOperationPermission", () => {
    it("should allow repository:read with api scope", () => {
      const result = checkOperationPermission("repository:read", ["api"]);
      expect(result.allowed).toBe(true);
    });

    it("should allow repository:read with read_repository scope", () => {
      const result = checkOperationPermission("repository:read", [
        "read_repository",
      ]);
      expect(result.allowed).toBe(true);
    });

    it("should deny repository:write without write scope", () => {
      const result = checkOperationPermission("repository:write", [
        "read_repository",
      ]);
      expect(result.allowed).toBe(false);
    });

    it("should handle unknown operations", () => {
      const result = checkOperationPermission("unknown:operation", ["api"]);
      expect(result.allowed).toBe(false);
      expect(result.reason).toContain("Unknown operation");
    });

    it("should check merge_request:create requires api and write_repository", () => {
      const withBoth = checkOperationPermission("merge_request:create", [
        "api",
        "write_repository",
      ]);
      expect(withBoth.allowed).toBe(true);

      const withApiOnly = checkOperationPermission("merge_request:create", [
        "api",
      ]);
      expect(withApiOnly.allowed).toBe(true);

      const withReadOnly = checkOperationPermission("merge_request:create", [
        "read_repository",
      ]);
      expect(withReadOnly.allowed).toBe(false);
    });
  });

  describe("validateRequiredScopes", () => {
    it("should not throw with all required scopes", () => {
      expect(() =>
        validateRequiredScopes(SCOPE_SETS.fullBridge as GitLabScope[])
      ).not.toThrow();
    });

    it("should throw InsufficientScopeError when scopes are missing", () => {
      expect(() =>
        validateRequiredScopes(SCOPE_SETS.readOnly as GitLabScope[])
      ).toThrow(InsufficientScopeError);
    });

    it("should throw with empty scopes", () => {
      expect(() => validateRequiredScopes([])).toThrow(InsufficientScopeError);
    });
  });

  describe("validateNoDangerousScopes", () => {
    it("should not throw with safe scopes", () => {
      expect(() =>
        validateNoDangerousScopes(SCOPE_SETS.fullBridge as GitLabScope[])
      ).not.toThrow();
    });

    it("should throw DangerousScopeError with sudo", () => {
      expect(() =>
        validateNoDangerousScopes(SCOPE_SETS.dangerous as GitLabScope[])
      ).toThrow(DangerousScopeError);
    });
  });

  describe("requirePermission", () => {
    it("should not throw when permission is granted", () => {
      expect(() =>
        requirePermission("repository:read", ["api"])
      ).not.toThrow();
    });

    it("should throw InsufficientScopeError when permission denied", () => {
      expect(() =>
        requirePermission("repository:write", ["read_repository"])
      ).toThrow(InsufficientScopeError);
    });

    it("should throw DangerousScopeError for dangerous scopes", () => {
      expect(() =>
        requirePermission("repository:read", ["api", "sudo"])
      ).toThrow(DangerousScopeError);
    });
  });

  describe("checkBridgeScopes", () => {
    it("should report complete when all bridge scopes present", () => {
      const result = checkBridgeScopes(SCOPE_SETS.fullBridge as GitLabScope[]);
      expect(result.complete).toBe(true);
      expect(result.hasAll).toBe(true);
      expect(result.missing).toEqual([]);
    });

    it("should report incomplete with missing scopes", () => {
      const result = checkBridgeScopes(["api"] as GitLabScope[]);
      expect(result.complete).toBe(false);
      expect(result.missing).toContain("read_repository");
      expect(result.missing).toContain("write_repository");
    });

    it("should report incomplete with empty scopes", () => {
      const result = checkBridgeScopes([]);
      expect(result.complete).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });
  });

  describe("getRequiredScopesForOperations", () => {
    it("should return unique scopes for multiple operations", () => {
      const scopes = getRequiredScopesForOperations([
        "repository:read",
        "repository:write",
      ]);
      expect(scopes).toContain("api");
      expect(new Set(scopes).size).toBe(scopes.length); // No duplicates
    });

    it("should handle unknown operations gracefully", () => {
      const scopes = getRequiredScopesForOperations([
        "repository:read",
        "unknown:op",
      ]);
      expect(scopes).toContain("api");
    });

    it("should return empty for empty operations", () => {
      const scopes = getRequiredScopesForOperations([]);
      expect(scopes).toEqual([]);
    });
  });

  describe("checkMultipleOperations", () => {
    it("should check all operations and return results", () => {
      const results = checkMultipleOperations(
        ["repository:read", "repository:write"],
        ["api"]
      );

      expect(results.get("repository:read")?.allowed).toBe(true);
      expect(results.get("repository:write")?.allowed).toBe(true);
    });

    it("should handle mixed results", () => {
      const results = checkMultipleOperations(
        ["repository:read", "repository:write"],
        ["read_repository"]
      );

      expect(results.get("repository:read")?.allowed).toBe(true);
      expect(results.get("repository:write")?.allowed).toBe(false);
    });
  });

  describe("OPERATION_SCOPES", () => {
    it("should have scopes defined for common operations", () => {
      expect(OPERATION_SCOPES["repository:read"]).toBeDefined();
      expect(OPERATION_SCOPES["repository:write"]).toBeDefined();
      expect(OPERATION_SCOPES["issue:read"]).toBeDefined();
      expect(OPERATION_SCOPES["merge_request:create"]).toBeDefined();
    });

    it("should have array of scopes for each operation", () => {
      for (const [_op, scopes] of Object.entries(OPERATION_SCOPES)) {
        expect(Array.isArray(scopes)).toBe(true);
        expect(scopes.length).toBeGreaterThan(0);
      }
    });
  });
});
