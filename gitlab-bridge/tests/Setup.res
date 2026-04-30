// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2026 Jonathan D.A. Jewell

/**
 * Vitest setup file for global test configuration.
 * Clears cached environment variables before each test suite.
 */

// Env-var deletion is done entirely via %%raw below; no ReScript externals
// are needed. The previously-declared @val and @set externals on
// process.env were unused (no caller in this file or anywhere else) and
// the @set form was incompatible with rescript@12's tightened external
// validation, so they have been removed.
%%raw(`
import { beforeEach } from "vitest";

beforeEach(() => {
  delete process.env.GITLAB_TOKEN;
  delete process.env.GITLAB_URL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WEBHOOK_SECRET;
});
`)
