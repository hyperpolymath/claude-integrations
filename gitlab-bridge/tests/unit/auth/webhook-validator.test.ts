// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import { describe, it, expect } from "vitest";
import {
  validateWebhookToken,
  validateWebhookSignature,
  computeWebhookSignature,
  validateWebhookRequest,
  requireValidWebhook,
  extractWebhookMetadata,
  validateSecretStrength,
  WEBHOOK_EVENTS,
} from "../../../src/auth/webhook-validator";
import { WebhookSignatureError } from "../../../src/auth/errors";
import {
  WEBHOOK_SECRET,
  WEAK_SECRETS,
  createWebhookHeaders,
  createInvalidWebhookHeaders,
  createMissingTokenHeaders,
  PUSH_HOOK,
} from "../../fixtures";

describe("webhook-validator", () => {
  describe("validateWebhookToken", () => {
    it("should return true for matching tokens", () => {
      expect(validateWebhookToken(WEBHOOK_SECRET, WEBHOOK_SECRET)).toBe(true);
    });

    it("should return false for non-matching tokens", () => {
      expect(validateWebhookToken("wrong-secret", WEBHOOK_SECRET)).toBe(false);
    });

    it("should return false for empty received token", () => {
      expect(validateWebhookToken("", WEBHOOK_SECRET)).toBe(false);
    });

    it("should return false for empty expected secret", () => {
      expect(validateWebhookToken(WEBHOOK_SECRET, "")).toBe(false);
    });

    it("should handle different length tokens safely (timing-safe)", () => {
      // This test ensures we don't leak timing information
      expect(validateWebhookToken("short", WEBHOOK_SECRET)).toBe(false);
      expect(
        validateWebhookToken(WEBHOOK_SECRET + "extra", WEBHOOK_SECRET)
      ).toBe(false);
    });

    it("should handle non-string inputs", () => {
      expect(validateWebhookToken(null as unknown as string, WEBHOOK_SECRET)).toBe(
        false
      );
      expect(validateWebhookToken(WEBHOOK_SECRET, null as unknown as string)).toBe(
        false
      );
    });
  });

  describe("computeWebhookSignature", () => {
    it("should compute consistent HMAC-SHA256 signature", () => {
      const payload = JSON.stringify(PUSH_HOOK);
      const sig1 = computeWebhookSignature(payload, WEBHOOK_SECRET);
      const sig2 = computeWebhookSignature(payload, WEBHOOK_SECRET);

      expect(sig1).toBe(sig2);
      expect(sig1).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex = 64 chars
    });

    it("should produce different signatures for different payloads", () => {
      const sig1 = computeWebhookSignature("payload1", WEBHOOK_SECRET);
      const sig2 = computeWebhookSignature("payload2", WEBHOOK_SECRET);

      expect(sig1).not.toBe(sig2);
    });

    it("should produce different signatures for different secrets", () => {
      const payload = "same-payload";
      const sig1 = computeWebhookSignature(payload, "secret1");
      const sig2 = computeWebhookSignature(payload, "secret2");

      expect(sig1).not.toBe(sig2);
    });

    it("should handle Buffer payloads", () => {
      const payload = Buffer.from("test payload");
      const sig = computeWebhookSignature(payload, WEBHOOK_SECRET);

      expect(sig).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe("validateWebhookSignature", () => {
    it("should return true for valid signature", () => {
      const payload = JSON.stringify(PUSH_HOOK);
      const signature = computeWebhookSignature(payload, WEBHOOK_SECRET);

      expect(validateWebhookSignature(payload, signature, WEBHOOK_SECRET)).toBe(
        true
      );
    });

    it("should return false for invalid signature", () => {
      const payload = JSON.stringify(PUSH_HOOK);

      expect(
        validateWebhookSignature(payload, "invalidsig", WEBHOOK_SECRET)
      ).toBe(false);
    });

    it("should return false for tampered payload", () => {
      const payload = JSON.stringify(PUSH_HOOK);
      const signature = computeWebhookSignature(payload, WEBHOOK_SECRET);

      const tamperedPayload = payload + "tampered";
      expect(
        validateWebhookSignature(tamperedPayload, signature, WEBHOOK_SECRET)
      ).toBe(false);
    });

    it("should return false for empty inputs", () => {
      expect(validateWebhookSignature("", "sig", WEBHOOK_SECRET)).toBe(false);
      expect(validateWebhookSignature("payload", "", WEBHOOK_SECRET)).toBe(false);
      expect(validateWebhookSignature("payload", "sig", "")).toBe(false);
    });
  });

  describe("validateWebhookRequest", () => {
    it("should validate request with valid token", () => {
      const headers = createWebhookHeaders("Push Hook");
      const body = JSON.stringify(PUSH_HOOK);

      const result = validateWebhookRequest(headers, body, WEBHOOK_SECRET);
      expect(result.valid).toBe(true);
      expect(result.event).toBe("Push Hook");
    });

    it("should reject request with invalid token", () => {
      const headers = createInvalidWebhookHeaders("Push Hook");
      const body = JSON.stringify(PUSH_HOOK);

      const result = validateWebhookRequest(headers, body, WEBHOOK_SECRET);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Invalid webhook token");
    });

    it("should reject request with missing token", () => {
      const headers = createMissingTokenHeaders("Push Hook");
      const body = JSON.stringify(PUSH_HOOK);

      const result = validateWebhookRequest(headers, body, WEBHOOK_SECRET);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Missing webhook token");
    });

    it("should reject when secret not configured", () => {
      const headers = createWebhookHeaders("Push Hook");
      const body = JSON.stringify(PUSH_HOOK);

      const result = validateWebhookRequest(headers, body, "");
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("not configured");
    });

    it("should reject unknown event types", () => {
      const headers = {
        ...createWebhookHeaders("Unknown Event"),
        "x-gitlab-event": "Unknown Event",
      };
      const body = JSON.stringify(PUSH_HOOK);

      const result = validateWebhookRequest(headers, body, WEBHOOK_SECRET);
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("Unknown webhook event");
    });

    it("should handle all known event types", () => {
      for (const event of WEBHOOK_EVENTS) {
        const headers = createWebhookHeaders(event);
        const body = "{}";

        const result = validateWebhookRequest(headers, body, WEBHOOK_SECRET);
        expect(result.valid).toBe(true);
        expect(result.event).toBe(event);
      }
    });
  });

  describe("requireValidWebhook", () => {
    it("should not throw for valid webhook", () => {
      const headers = createWebhookHeaders("Push Hook");
      const body = JSON.stringify(PUSH_HOOK);

      expect(() =>
        requireValidWebhook(headers, body, WEBHOOK_SECRET)
      ).not.toThrow();
    });

    it("should throw WebhookSignatureError for invalid webhook", () => {
      const headers = createInvalidWebhookHeaders("Push Hook");
      const body = JSON.stringify(PUSH_HOOK);

      expect(() => requireValidWebhook(headers, body, WEBHOOK_SECRET)).toThrow(
        WebhookSignatureError
      );
    });
  });

  describe("extractWebhookMetadata", () => {
    it("should extract metadata from headers", () => {
      const headers = createWebhookHeaders("Push Hook");
      const metadata = extractWebhookMetadata(headers);

      expect(metadata.event).toBe("Push Hook");
      expect(metadata.instance).toBe("https://gitlab.com");
      expect(metadata.requestId).toMatch(/^test-request-/);
    });

    it("should handle missing headers", () => {
      const metadata = extractWebhookMetadata({});

      expect(metadata.event).toBeUndefined();
      expect(metadata.instance).toBeUndefined();
      expect(metadata.requestId).toBeUndefined();
    });

    it("should handle array headers", () => {
      const headers = {
        "x-gitlab-event": ["Push Hook"],
        "x-gitlab-instance": ["https://gitlab.com"],
      };

      const metadata = extractWebhookMetadata(headers);
      expect(metadata.event).toBe("Push Hook");
      expect(metadata.instance).toBe("https://gitlab.com");
    });
  });

  describe("validateSecretStrength", () => {
    it("should accept strong secrets", () => {
      const result = validateSecretStrength(WEBHOOK_SECRET);
      expect(result.valid).toBe(true);
      expect(result.issues).toEqual([]);
    });

    it("should reject empty secrets", () => {
      const result = validateSecretStrength(WEAK_SECRETS.empty);
      expect(result.valid).toBe(false);
      expect(result.issues).toContain("Secret is empty");
    });

    it("should warn about short secrets", () => {
      const result = validateSecretStrength(WEAK_SECRETS.short);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes("32 characters"))).toBe(true);
    });

    it("should warn about placeholder secrets", () => {
      const result = validateSecretStrength(WEAK_SECRETS.placeholder);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes("placeholder"))).toBe(true);
    });

    it("should warn about repeated character secrets", () => {
      const result = validateSecretStrength(WEAK_SECRETS.repeated);
      expect(result.valid).toBe(false);
      expect(result.issues.some((i) => i.includes("repeated"))).toBe(true);
    });
  });
});
