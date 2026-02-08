// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Vitest setup file for global test configuration
 */

// Reset environment before each test suite
beforeEach(() => {
  // Clear any cached environment variables
  delete process.env.GITLAB_TOKEN;
  delete process.env.GITLAB_URL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WEBHOOK_SECRET;
});
