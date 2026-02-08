// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Test fixtures for GitLab webhooks.
 * These are replayable fixtures for testing webhook handling.
 */

import { createHmac } from "crypto";
import { USERS, PROJECTS, ISSUES, MERGE_REQUESTS } from "./gitlab-api";

/**
 * Valid webhook secret for testing (hex-like format, 64 chars).
 */
export const WEBHOOK_SECRET = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2";

/**
 * Invalid/weak secrets for testing validation.
 */
export const WEAK_SECRETS = {
  empty: "",
  short: "abc",
  placeholder: "your-webhook-secret-here",
  common: "password123",
  repeated: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
};

/**
 * Creates webhook headers with proper token.
 */
export function createWebhookHeaders(
  event: string,
  secret: string = WEBHOOK_SECRET
): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-gitlab-token": secret,
    "x-gitlab-event": event,
    "x-gitlab-instance": "https://gitlab.com",
    "x-request-id": "test-request-" + Date.now(),
  };
}

/**
 * Creates webhook headers with signature instead of token.
 */
export function createSignedWebhookHeaders(
  event: string,
  payload: string,
  secret: string = WEBHOOK_SECRET
): Record<string, string> {
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");

  return {
    "content-type": "application/json",
    "x-gitlab-event": event,
    "x-gitlab-instance": "https://gitlab.com",
    "x-hub-signature-256": `sha256=${signature}`,
    "x-request-id": "test-request-" + Date.now(),
  };
}

/**
 * Push event webhook payload.
 */
export const PUSH_HOOK = {
  object_kind: "push",
  event_name: "push",
  before: "0000000000000000000000000000000000000000",
  after: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
  ref: "refs/heads/main",
  checkout_sha: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
  user_id: USERS.active.id,
  user_name: USERS.active.name,
  user_username: USERS.active.username,
  user_email: USERS.active.email,
  user_avatar: USERS.active.avatar_url,
  project_id: PROJECTS.public.id,
  project: {
    id: PROJECTS.public.id,
    name: PROJECTS.public.name,
    path_with_namespace: PROJECTS.public.path_with_namespace,
    web_url: PROJECTS.public.web_url,
    git_http_url: PROJECTS.public.http_url_to_repo,
    git_ssh_url: PROJECTS.public.ssh_url_to_repo,
    default_branch: PROJECTS.public.default_branch,
    visibility_level: 20,
  },
  commits: [
    {
      id: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
      message: "Add new feature\n\nThis commit adds a new feature.",
      timestamp: "2024-06-15T12:00:00Z",
      url: `${PROJECTS.public.web_url}/-/commit/da1560886d4f094c3e6c9ef40349f7d38b5d27d7`,
      author: {
        name: USERS.active.name,
        email: USERS.active.email,
      },
      added: ["src/feature.ts"],
      modified: ["src/index.ts"],
      removed: [],
    },
  ],
  total_commits_count: 1,
};

/**
 * Issue event webhook payload.
 */
export const ISSUE_HOOK = {
  object_kind: "issue",
  event_type: "issue",
  user: USERS.active,
  project: PROJECTS.public,
  object_attributes: {
    ...ISSUES.open,
    action: "open",
  },
  labels: ISSUES.open.labels.map((label, i) => ({
    id: i + 1,
    title: label,
    color: "#428BCA",
    description: null,
  })),
  changes: {},
};

/**
 * Merge request event webhook payload.
 */
export const MERGE_REQUEST_HOOK = {
  object_kind: "merge_request",
  event_type: "merge_request",
  user: USERS.active,
  project: PROJECTS.public,
  object_attributes: {
    ...MERGE_REQUESTS.open,
    action: "open",
    oldrev: null,
  },
  labels: [],
  changes: {},
};

/**
 * Note (comment) event webhook payload.
 */
export const NOTE_HOOK = {
  object_kind: "note",
  event_type: "note",
  user: USERS.active,
  project: PROJECTS.public,
  object_attributes: {
    id: 1,
    note: "This is a test comment",
    noteable_type: "Issue",
    author_id: USERS.active.id,
    created_at: "2024-06-15T12:00:00Z",
    updated_at: "2024-06-15T12:00:00Z",
    project_id: PROJECTS.public.id,
    attachment: null,
    line_code: null,
    commit_id: null,
    noteable_id: ISSUES.open.id,
    system: false,
    st_diff: null,
    url: `${PROJECTS.public.web_url}/-/issues/${ISSUES.open.iid}#note_1`,
  },
  issue: ISSUES.open,
};

/**
 * Pipeline event webhook payload.
 */
export const PIPELINE_HOOK = {
  object_kind: "pipeline",
  object_attributes: {
    id: 1,
    iid: 1,
    ref: "main",
    tag: false,
    sha: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
    before_sha: "0000000000000000000000000000000000000000",
    source: "push",
    status: "success",
    detailed_status: "passed",
    stages: ["build", "test", "deploy"],
    created_at: "2024-06-15T12:00:00Z",
    finished_at: "2024-06-15T12:10:00Z",
    duration: 600,
    queued_duration: 10,
  },
  user: USERS.active,
  project: PROJECTS.public,
  commit: {
    id: "da1560886d4f094c3e6c9ef40349f7d38b5d27d7",
    message: "Add new feature",
    timestamp: "2024-06-15T12:00:00Z",
    url: `${PROJECTS.public.web_url}/-/commit/da1560886d4f094c3e6c9ef40349f7d38b5d27d7`,
    author: {
      name: USERS.active.name,
      email: USERS.active.email,
    },
  },
  builds: [
    {
      id: 1,
      stage: "build",
      name: "build",
      status: "success",
      created_at: "2024-06-15T12:00:00Z",
      started_at: "2024-06-15T12:00:10Z",
      finished_at: "2024-06-15T12:02:00Z",
      duration: 110,
      queued_duration: 10,
      runner: null,
    },
  ],
};

/**
 * All webhook events for iteration testing.
 */
export const ALL_WEBHOOK_EVENTS = {
  "Push Hook": PUSH_HOOK,
  "Issue Hook": ISSUE_HOOK,
  "Merge Request Hook": MERGE_REQUEST_HOOK,
  "Note Hook": NOTE_HOOK,
  "Pipeline Hook": PIPELINE_HOOK,
};

/**
 * Invalid webhook payloads for error testing.
 */
export const INVALID_WEBHOOKS = {
  /** Missing object_kind */
  missingKind: {
    user: USERS.active,
    project: PROJECTS.public,
  },

  /** Invalid event type */
  invalidEvent: {
    object_kind: "unknown_event",
    user: USERS.active,
    project: PROJECTS.public,
  },

  /** Malformed JSON (as string for testing) */
  malformedJson: '{"incomplete": true',

  /** Empty object */
  empty: {},
};

/**
 * Creates a webhook payload with custom properties.
 */
export function createWebhookPayload<T extends Record<string, unknown>>(
  base: T,
  overrides: Partial<T> = {}
): T {
  return {
    ...base,
    ...overrides,
  };
}

/**
 * Creates headers with invalid token for testing rejection.
 */
export function createInvalidWebhookHeaders(
  event: string
): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-gitlab-token": "invalid-secret-that-should-not-match",
    "x-gitlab-event": event,
  };
}

/**
 * Creates headers with missing token for testing rejection.
 */
export function createMissingTokenHeaders(
  event: string
): Record<string, string> {
  return {
    "content-type": "application/json",
    "x-gitlab-event": event,
  };
}
