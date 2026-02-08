// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Test fixtures barrel file.
 * Export all fixtures for easy importing in tests.
 */

// Token fixtures
export {
  VALID_TOKENS,
  INVALID_TOKENS,
  TOKEN_INFO_RESPONSES,
  SCOPE_SETS,
  createTokenInfo,
  expiresInDays,
  expiredDaysAgo,
} from "./tokens";

// GitLab API fixtures
export {
  USERS,
  PROJECTS,
  ISSUES,
  MERGE_REQUESTS,
  API_ERRORS,
  createUser,
  createApiError,
} from "./gitlab-api";

// Webhook fixtures
export {
  WEBHOOK_SECRET,
  WEAK_SECRETS,
  createWebhookHeaders,
  createSignedWebhookHeaders,
  createInvalidWebhookHeaders,
  createMissingTokenHeaders,
  PUSH_HOOK,
  ISSUE_HOOK,
  MERGE_REQUEST_HOOK,
  NOTE_HOOK,
  PIPELINE_HOOK,
  ALL_WEBHOOK_EVENTS,
  INVALID_WEBHOOKS,
  createWebhookPayload,
} from "./webhooks";

// Rate limit fixtures
export {
  RATE_LIMIT_CONFIGS,
  TEST_IPS,
  createMockRequest,
  createMockResponse,
  wait,
  simulateRequests,
} from "./rate-limit";
