// SPDX-License-Identifier: PMPL-1.0-or-later
// SPDX-FileCopyrightText: 2026 Jonathan D.A. Jewell

/**
 * Vitest setup file for global test configuration.
 * Clears cached environment variables before each test suite.
 */

// External bindings for reading process.env. Setters are not needed
// here — the `%%raw` block below uses JS `delete` directly to clear
// env vars, which is what tests actually call. (The previous version
// also declared `@set @scope(("process", "env")) external …` setters
// for each variable; those were unused and rejected by ReScript 12's
// stricter handling of `@set` + nested `@scope`. Removing them fixes
// the build break flagged in PR #10's "out of scope" notes.)
@val @scope(("process", "env")) external gitlabToken: option<string> = "GITLAB_TOKEN"
@val @scope(("process", "env")) external gitlabUrl: option<string> = "GITLAB_URL"
@val @scope(("process", "env")) external anthropicApiKey: option<string> = "ANTHROPIC_API_KEY"
@val @scope(("process", "env")) external webhookSecret: option<string> = "WEBHOOK_SECRET"

// We use JS interop to delete env vars
%%raw(`
import { beforeEach } from "vitest";

beforeEach(() => {
  delete process.env.GITLAB_TOKEN;
  delete process.env.GITLAB_URL;
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.WEBHOOK_SECRET;
});
`)
