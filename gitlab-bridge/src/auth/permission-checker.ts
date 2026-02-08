// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import {
  GitLabScope,
  PermissionResult,
  REQUIRED_SCOPES,
  DANGEROUS_SCOPES,
} from "./types";
import { InsufficientScopeError, DangerousScopeError } from "./errors";

/**
 * Mapping of operations to required scopes.
 */
export const OPERATION_SCOPES: Record<string, GitLabScope[]> = {
  // Repository operations
  "repository:read": ["api", "read_repository"],
  "repository:write": ["api", "write_repository"],
  "repository:clone": ["read_repository"],

  // Issue operations
  "issue:read": ["api", "read_api"],
  "issue:write": ["api"],
  "issue:create": ["api"],
  "issue:close": ["api"],

  // Merge request operations
  "merge_request:read": ["api", "read_api"],
  "merge_request:write": ["api"],
  "merge_request:create": ["api", "write_repository"],
  "merge_request:merge": ["api", "write_repository"],
  "merge_request:approve": ["api"],

  // User operations
  "user:read": ["api", "read_api", "read_user"],

  // Project operations
  "project:read": ["api", "read_api"],
  "project:admin": ["api"],

  // CI/CD operations
  "pipeline:read": ["api", "read_api"],
  "pipeline:trigger": ["api"],

  // Branch operations
  "branch:create": ["api", "write_repository"],
  "branch:delete": ["api", "write_repository"],

  // Commit operations
  "commit:read": ["api", "read_repository"],
  "commit:create": ["api", "write_repository"],
};

/**
 * Checks if the given scopes satisfy the required scopes for an operation.
 * Uses "any-of" logic: any one of the required scopes is sufficient.
 *
 * @param availableScopes - Scopes the token has
 * @param requiredScopes - Scopes required for the operation
 * @returns PermissionResult with the check outcome
 */
export function checkScopeSatisfaction(
  availableScopes: GitLabScope[],
  requiredScopes: GitLabScope[]
): PermissionResult {
  // If no scopes required, always allowed
  if (requiredScopes.length === 0) {
    return {
      allowed: true,
      requiredScopes: [],
      availableScopes,
      missingScopes: [],
    };
  }

  // Check if any required scope is available (OR logic)
  const hasAnyRequiredScope = requiredScopes.some((scope) =>
    availableScopes.includes(scope)
  );

  if (hasAnyRequiredScope) {
    return {
      allowed: true,
      requiredScopes,
      availableScopes,
      missingScopes: [],
    };
  }

  // None of the required scopes are present
  return {
    allowed: false,
    requiredScopes,
    availableScopes,
    missingScopes: requiredScopes,
    reason: `Missing required scope. Need one of: ${requiredScopes.join(", ")}`,
  };
}

/**
 * Checks permission for a specific operation.
 *
 * @param operation - The operation to check (e.g., "repository:read")
 * @param availableScopes - Scopes the token has
 * @returns PermissionResult with the check outcome
 */
export function checkOperationPermission(
  operation: string,
  availableScopes: GitLabScope[]
): PermissionResult {
  const requiredScopes = OPERATION_SCOPES[operation];

  if (!requiredScopes) {
    return {
      allowed: false,
      requiredScopes: [],
      availableScopes,
      missingScopes: [],
      reason: `Unknown operation: ${operation}`,
    };
  }

  return checkScopeSatisfaction(availableScopes, requiredScopes);
}

/**
 * Validates that required scopes are present.
 *
 * @param scopes - Scopes to validate
 * @throws InsufficientScopeError if required scopes are missing
 */
export function validateRequiredScopes(scopes: GitLabScope[]): void {
  const missing = REQUIRED_SCOPES.filter((s) => !scopes.includes(s));

  if (missing.length > 0) {
    throw new InsufficientScopeError([...REQUIRED_SCOPES], scopes);
  }
}

/**
 * Validates that no dangerous scopes are present.
 *
 * @param scopes - Scopes to validate
 * @throws DangerousScopeError if dangerous scopes are present
 */
export function validateNoDangerousScopes(scopes: GitLabScope[]): void {
  const dangerous = scopes.filter((s) =>
    DANGEROUS_SCOPES.includes(s as GitLabScope)
  );

  if (dangerous.length > 0) {
    throw new DangerousScopeError(dangerous);
  }
}

/**
 * Performs a full permission check for an operation.
 *
 * @param operation - The operation to check
 * @param availableScopes - Scopes the token has
 * @throws InsufficientScopeError if permission is denied
 * @throws DangerousScopeError if dangerous scopes are present
 */
export function requirePermission(
  operation: string,
  availableScopes: GitLabScope[]
): void {
  // First check for dangerous scopes
  validateNoDangerousScopes(availableScopes);

  // Then check operation permission
  const result = checkOperationPermission(operation, availableScopes);

  if (!result.allowed) {
    throw new InsufficientScopeError(result.requiredScopes, result.availableScopes);
  }
}

/**
 * Checks if all required bridge scopes are present.
 *
 * @param scopes - Scopes to check
 * @returns Object indicating completeness and missing scopes
 */
export function checkBridgeScopes(scopes: GitLabScope[]): {
  complete: boolean;
  missing: GitLabScope[];
  hasAll: boolean;
} {
  const missing = REQUIRED_SCOPES.filter(
    (required) => !scopes.includes(required)
  );

  return {
    complete: missing.length === 0,
    missing: [...missing],
    hasAll: missing.length === 0,
  };
}

/**
 * Gets the minimum required scopes for a set of operations.
 *
 * @param operations - Operations to check
 * @returns Unique set of required scopes
 */
export function getRequiredScopesForOperations(
  operations: string[]
): GitLabScope[] {
  const allScopes = new Set<GitLabScope>();

  for (const op of operations) {
    const scopes = OPERATION_SCOPES[op];
    if (scopes) {
      // For OR logic, we just need one scope from each operation
      // So we add the first (typically most permissive) scope
      allScopes.add(scopes[0]);
    }
  }

  return Array.from(allScopes);
}

/**
 * Checks multiple operations at once.
 *
 * @param operations - Operations to check
 * @param availableScopes - Scopes the token has
 * @returns Map of operation to permission result
 */
export function checkMultipleOperations(
  operations: string[],
  availableScopes: GitLabScope[]
): Map<string, PermissionResult> {
  const results = new Map<string, PermissionResult>();

  for (const op of operations) {
    results.set(op, checkOperationPermission(op, availableScopes));
  }

  return results;
}
