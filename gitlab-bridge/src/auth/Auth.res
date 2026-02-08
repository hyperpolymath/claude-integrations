// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2025 Jonathan D.A. Jewell <jonathan.jewell@open.ac.uk>

/**
 * Authentication and authorization module for Claude GitLab Bridge
 * Re-exports all auth functionality
 */

// Types
module Types = Types

// Errors
module Errors = Errors

// Token validation
module TokenValidator = TokenValidator

// Permission checking
module PermissionChecker = PermissionChecker

// Re-export commonly used types
type gitLabScope = Types.gitLabScope
type tokenInfo = Types.tokenInfo
type permissionResult = Types.permissionResult
type authContext = Types.authContext
type authError = Errors.authError

// Re-export commonly used functions
let validateTokenFormat = TokenValidator.validateTokenFormat
let maskToken = TokenValidator.maskToken
let checkScopeSatisfaction = PermissionChecker.checkScopeSatisfaction
let checkOperationPermission = PermissionChecker.checkOperationPermission
let validateRequiredScopes = PermissionChecker.validateRequiredScopes
