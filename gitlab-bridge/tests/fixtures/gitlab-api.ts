// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Test fixtures for GitLab API responses.
 * These are replayable fixtures for mocking GitLab API calls.
 */

import type { GitLabUser } from "../../src/auth/types";

/**
 * User fixtures for testing.
 */
export const USERS: Record<string, GitLabUser> = {
  /** Standard active user */
  active: {
    id: 12345,
    username: "testuser",
    name: "Test User",
    email: "test@example.com",
    state: "active",
    avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/12345/avatar.png",
    web_url: "https://gitlab.com/testuser",
    is_admin: false,
    bot: false,
  },

  /** Admin user */
  admin: {
    id: 1,
    username: "admin",
    name: "Administrator",
    email: "admin@example.com",
    state: "active",
    avatar_url: "https://gitlab.com/uploads/-/system/user/avatar/1/avatar.png",
    web_url: "https://gitlab.com/admin",
    is_admin: true,
    bot: false,
  },

  /** Bot user */
  bot: {
    id: 99999,
    username: "project_12345_bot",
    name: "Project Bot",
    state: "active",
    avatar_url: null,
    web_url: "https://gitlab.com/project_12345_bot",
    is_admin: false,
    bot: true,
  },

  /** Blocked user */
  blocked: {
    id: 54321,
    username: "blockeduser",
    name: "Blocked User",
    email: "blocked@example.com",
    state: "blocked",
    avatar_url: null,
    web_url: "https://gitlab.com/blockeduser",
    is_admin: false,
    bot: false,
  },

  /** Deactivated user */
  deactivated: {
    id: 11111,
    username: "deactivated",
    name: "Deactivated User",
    state: "deactivated",
    avatar_url: null,
    web_url: "https://gitlab.com/deactivated",
    is_admin: false,
    bot: false,
  },
};

/**
 * Project fixtures for testing.
 */
export const PROJECTS = {
  /** Standard public project */
  public: {
    id: 100,
    name: "test-project",
    path: "test-project",
    path_with_namespace: "testuser/test-project",
    visibility: "public",
    default_branch: "main",
    web_url: "https://gitlab.com/testuser/test-project",
    http_url_to_repo: "https://gitlab.com/testuser/test-project.git",
    ssh_url_to_repo: "git@gitlab.com:testuser/test-project.git",
    created_at: "2024-01-01T00:00:00Z",
    last_activity_at: "2024-06-15T12:00:00Z",
  },

  /** Private project */
  private: {
    id: 200,
    name: "private-project",
    path: "private-project",
    path_with_namespace: "testuser/private-project",
    visibility: "private",
    default_branch: "main",
    web_url: "https://gitlab.com/testuser/private-project",
    http_url_to_repo: "https://gitlab.com/testuser/private-project.git",
    ssh_url_to_repo: "git@gitlab.com:testuser/private-project.git",
    created_at: "2024-02-01T00:00:00Z",
    last_activity_at: "2024-06-15T12:00:00Z",
  },

  /** Internal project */
  internal: {
    id: 300,
    name: "internal-project",
    path: "internal-project",
    path_with_namespace: "company/internal-project",
    visibility: "internal",
    default_branch: "develop",
    web_url: "https://gitlab.com/company/internal-project",
    http_url_to_repo: "https://gitlab.com/company/internal-project.git",
    ssh_url_to_repo: "git@gitlab.com:company/internal-project.git",
    created_at: "2024-03-01T00:00:00Z",
    last_activity_at: "2024-06-15T12:00:00Z",
  },
};

/**
 * API error response fixtures.
 */
export const API_ERRORS = {
  /** Unauthorized error */
  unauthorized: {
    status: 401,
    body: {
      message: "401 Unauthorized",
    },
  },

  /** Forbidden error */
  forbidden: {
    status: 403,
    body: {
      message: "403 Forbidden",
    },
  },

  /** Not found error */
  notFound: {
    status: 404,
    body: {
      message: "404 Not Found",
    },
  },

  /** Rate limited */
  rateLimited: {
    status: 429,
    body: {
      message: "429 Too Many Requests",
    },
    headers: {
      "Retry-After": "60",
      "RateLimit-Limit": "2000",
      "RateLimit-Remaining": "0",
      "RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
    },
  },

  /** Internal server error */
  serverError: {
    status: 500,
    body: {
      message: "500 Internal Server Error",
    },
  },

  /** Invalid token */
  invalidToken: {
    status: 401,
    body: {
      error: "invalid_token",
      error_description: "Token is expired or has been revoked",
    },
  },

  /** Insufficient scope */
  insufficientScope: {
    status: 403,
    body: {
      error: "insufficient_scope",
      error_description: "The request requires higher privileges than provided by the access token.",
      scope: "api",
    },
  },
};

/**
 * Issue fixtures for testing.
 */
export const ISSUES = {
  /** Open issue */
  open: {
    id: 1,
    iid: 1,
    project_id: 100,
    title: "Test Issue",
    description: "This is a test issue",
    state: "opened",
    created_at: "2024-06-01T10:00:00Z",
    updated_at: "2024-06-15T12:00:00Z",
    closed_at: null,
    labels: ["bug", "priority::high"],
    author: USERS.active,
    assignees: [],
    web_url: "https://gitlab.com/testuser/test-project/-/issues/1",
  },

  /** Closed issue */
  closed: {
    id: 2,
    iid: 2,
    project_id: 100,
    title: "Closed Issue",
    description: "This issue has been closed",
    state: "closed",
    created_at: "2024-05-01T10:00:00Z",
    updated_at: "2024-05-15T12:00:00Z",
    closed_at: "2024-05-15T12:00:00Z",
    labels: ["resolved"],
    author: USERS.active,
    assignees: [],
    web_url: "https://gitlab.com/testuser/test-project/-/issues/2",
  },
};

/**
 * Merge request fixtures for testing.
 */
export const MERGE_REQUESTS = {
  /** Open merge request */
  open: {
    id: 1,
    iid: 1,
    project_id: 100,
    title: "Feature: Add new functionality",
    description: "This MR adds new functionality",
    state: "opened",
    merged_by: null,
    merged_at: null,
    source_branch: "feature/new-feature",
    target_branch: "main",
    created_at: "2024-06-10T10:00:00Z",
    updated_at: "2024-06-15T12:00:00Z",
    author: USERS.active,
    web_url: "https://gitlab.com/testuser/test-project/-/merge_requests/1",
    draft: false,
    work_in_progress: false,
  },

  /** Draft merge request */
  draft: {
    id: 2,
    iid: 2,
    project_id: 100,
    title: "Draft: Work in progress",
    description: "This is a work in progress",
    state: "opened",
    merged_by: null,
    merged_at: null,
    source_branch: "feature/wip",
    target_branch: "main",
    created_at: "2024-06-12T10:00:00Z",
    updated_at: "2024-06-14T12:00:00Z",
    author: USERS.active,
    web_url: "https://gitlab.com/testuser/test-project/-/merge_requests/2",
    draft: true,
    work_in_progress: true,
  },

  /** Merged merge request */
  merged: {
    id: 3,
    iid: 3,
    project_id: 100,
    title: "Fix: Bug fix",
    description: "This MR fixes a bug",
    state: "merged",
    merged_by: USERS.admin,
    merged_at: "2024-06-14T15:00:00Z",
    source_branch: "fix/bug",
    target_branch: "main",
    created_at: "2024-06-13T10:00:00Z",
    updated_at: "2024-06-14T15:00:00Z",
    author: USERS.active,
    web_url: "https://gitlab.com/testuser/test-project/-/merge_requests/3",
    draft: false,
    work_in_progress: false,
  },
};

/**
 * Creates a user fixture with custom properties.
 */
export function createUser(
  overrides: Partial<GitLabUser> = {}
): GitLabUser {
  return {
    ...USERS.active,
    ...overrides,
  };
}

/**
 * Creates an API error response with custom properties.
 */
export function createApiError(
  status: number,
  message: string,
  extra: Record<string, unknown> = {}
): { status: number; body: Record<string, unknown> } {
  return {
    status,
    body: {
      message,
      ...extra,
    },
  };
}
