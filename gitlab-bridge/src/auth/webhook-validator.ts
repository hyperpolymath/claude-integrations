// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import { createHmac, timingSafeEqual } from "crypto";
import { WebhookValidationResult } from "./types";
import { WebhookSignatureError } from "./errors";

/**
 * Header name for the GitLab webhook secret token.
 */
export const WEBHOOK_TOKEN_HEADER = "x-gitlab-token";

/**
 * Header name for the GitLab webhook event type.
 */
export const WEBHOOK_EVENT_HEADER = "x-gitlab-event";

/**
 * Header name for the GitLab instance URL.
 */
export const WEBHOOK_INSTANCE_HEADER = "x-gitlab-instance";

/**
 * Supported webhook event types.
 */
export const WEBHOOK_EVENTS = [
  "Push Hook",
  "Tag Push Hook",
  "Issue Hook",
  "Confidential Issue Hook",
  "Note Hook",
  "Confidential Note Hook",
  "Merge Request Hook",
  "Wiki Page Hook",
  "Pipeline Hook",
  "Job Hook",
  "Deployment Hook",
  "Feature Flag Hook",
  "Release Hook",
  "Emoji Hook",
  "Member Hook",
  "Subgroup Hook",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

/**
 * Validates a webhook token matches the expected secret.
 * Uses timing-safe comparison to prevent timing attacks.
 *
 * @param receivedToken - Token from the webhook header
 * @param expectedSecret - Expected secret from configuration
 * @returns true if tokens match
 */
export function validateWebhookToken(
  receivedToken: string,
  expectedSecret: string
): boolean {
  // Ensure both values are strings
  if (typeof receivedToken !== "string" || typeof expectedSecret !== "string") {
    return false;
  }

  // Ensure neither is empty
  if (receivedToken.length === 0 || expectedSecret.length === 0) {
    return false;
  }

  // Use timing-safe comparison to prevent timing attacks
  try {
    const received = Buffer.from(receivedToken, "utf8");
    const expected = Buffer.from(expectedSecret, "utf8");

    // If lengths differ, compare same-length buffers to prevent timing leak
    if (received.length !== expected.length) {
      // Create buffers of equal length for timing-safe compare
      const paddedReceived = Buffer.alloc(Math.max(received.length, expected.length));
      const paddedExpected = Buffer.alloc(Math.max(received.length, expected.length));
      received.copy(paddedReceived);
      expected.copy(paddedExpected);

      // Always run the comparison even though we know they differ
      timingSafeEqual(paddedReceived, paddedExpected);
      return false;
    }

    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

/**
 * Computes HMAC-SHA256 signature for webhook payload.
 *
 * @param payload - The raw request body
 * @param secret - The webhook secret
 * @returns Hex-encoded HMAC signature
 */
export function computeWebhookSignature(
  payload: string | Buffer,
  secret: string
): string {
  const hmac = createHmac("sha256", secret);
  hmac.update(payload);
  return hmac.digest("hex");
}

/**
 * Validates webhook signature using HMAC-SHA256.
 * This is for systems that use signature-based validation.
 *
 * @param payload - The raw request body
 * @param signature - The received signature
 * @param secret - The webhook secret
 * @returns true if signature is valid
 */
export function validateWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): boolean {
  if (!payload || !signature || !secret) {
    return false;
  }

  const expectedSignature = computeWebhookSignature(payload, secret);

  try {
    const received = Buffer.from(signature, "hex");
    const expected = Buffer.from(expectedSignature, "hex");

    if (received.length !== expected.length) {
      return false;
    }

    return timingSafeEqual(received, expected);
  } catch {
    return false;
  }
}

/**
 * Validates a complete webhook request.
 *
 * @param headers - Request headers
 * @param body - Request body
 * @param secret - Expected webhook secret
 * @returns WebhookValidationResult
 */
export function validateWebhookRequest(
  headers: Record<string, string | string[] | undefined>,
  _body: string | Buffer,
  secret: string
): WebhookValidationResult {
  // Check for required secret
  if (!secret || secret.trim().length === 0) {
    return {
      valid: false,
      reason: "Webhook secret not configured",
    };
  }

  // Get the token from headers
  const tokenHeader = headers[WEBHOOK_TOKEN_HEADER] ?? headers["X-Gitlab-Token"];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

  if (!token) {
    return {
      valid: false,
      reason: "Missing webhook token header",
    };
  }

  // Validate the token
  if (!validateWebhookToken(token, secret)) {
    return {
      valid: false,
      reason: "Invalid webhook token",
    };
  }

  // Get the event type
  const eventHeader = headers[WEBHOOK_EVENT_HEADER] ?? headers["X-Gitlab-Event"];
  const event = Array.isArray(eventHeader) ? eventHeader[0] : eventHeader;

  // Validate event type if present
  if (event && !WEBHOOK_EVENTS.includes(event as WebhookEvent)) {
    return {
      valid: false,
      event,
      reason: `Unknown webhook event type: ${event}`,
    };
  }

  return {
    valid: true,
    event: event ?? undefined,
  };
}

/**
 * Validates and throws if webhook request is invalid.
 *
 * @param headers - Request headers
 * @param body - Request body
 * @param secret - Expected webhook secret
 * @throws WebhookSignatureError if validation fails
 */
export function requireValidWebhook(
  headers: Record<string, string | string[] | undefined>,
  body: string | Buffer,
  secret: string
): void {
  const result = validateWebhookRequest(headers, body, secret);

  if (!result.valid) {
    throw new WebhookSignatureError(result.reason);
  }
}

/**
 * Extracts webhook metadata from headers.
 *
 * @param headers - Request headers
 * @returns Webhook metadata
 */
export function extractWebhookMetadata(
  headers: Record<string, string | string[] | undefined>
): {
  event?: string;
  instance?: string;
  requestId?: string;
} {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name] ?? headers[name.toLowerCase()];
    return Array.isArray(value) ? value[0] : value;
  };

  return {
    event: getHeader(WEBHOOK_EVENT_HEADER) ?? getHeader("X-Gitlab-Event"),
    instance: getHeader(WEBHOOK_INSTANCE_HEADER) ?? getHeader("X-Gitlab-Instance"),
    requestId: getHeader("x-request-id"),
  };
}

/**
 * Validates minimum secret strength.
 *
 * @param secret - The secret to validate
 * @returns Object with validation result
 */
export function validateSecretStrength(secret: string): {
  valid: boolean;
  issues: string[];
} {
  const issues: string[] = [];

  if (!secret) {
    issues.push("Secret is empty");
    return { valid: false, issues };
  }

  if (secret.length < 32) {
    issues.push("Secret should be at least 32 characters");
  }

  // Check for common weak patterns
  if (/^[a-z]+$/i.test(secret)) {
    issues.push("Secret should contain mixed character types");
  }

  if (/^(.)\1+$/.test(secret)) {
    issues.push("Secret should not be a repeated character");
  }

  const commonSecrets = [
    "your-webhook-secret-here",
    "secret",
    "password",
    "webhook",
    "test",
  ];
  if (commonSecrets.some((s) => secret.toLowerCase().includes(s))) {
    issues.push("Secret appears to be a placeholder or common value");
  }

  return {
    valid: issues.length === 0,
    issues,
  };
}
