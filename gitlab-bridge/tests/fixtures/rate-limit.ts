// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

/**
 * Test fixtures for rate limiting.
 */

import type { RateLimitConfig } from "../../src/auth/rate-limiter";

/**
 * Test rate limit configurations.
 */
export const RATE_LIMIT_CONFIGS: Record<string, RateLimitConfig> = {
  /** Very strict for testing (2 requests per 100ms) */
  testStrict: {
    limit: 2,
    windowMs: 100,
  },

  /** Standard test config (5 requests per 500ms) */
  testStandard: {
    limit: 5,
    windowMs: 500,
  },

  /** Relaxed test config (10 requests per 1s) */
  testRelaxed: {
    limit: 10,
    windowMs: 1000,
  },

  /** Single request for edge case testing */
  testSingle: {
    limit: 1,
    windowMs: 100,
  },
};

/**
 * Mock IP addresses for testing.
 */
export const TEST_IPS = {
  client1: "192.168.1.100",
  client2: "192.168.1.101",
  client3: "10.0.0.50",
  localhost: "127.0.0.1",
  unknown: "unknown",
};

/**
 * Creates a mock Express request for testing.
 */
export function createMockRequest(overrides: {
  ip?: string;
  path?: string;
  method?: string;
  headers?: Record<string, string>;
} = {}): {
  ip: string;
  path: string;
  method: string;
  headers: Record<string, string>;
  get: (name: string) => string | undefined;
  socket: { remoteAddress: string };
} {
  const headers = overrides.headers || {};
  return {
    ip: overrides.ip || TEST_IPS.client1,
    path: overrides.path || "/api/test",
    method: overrides.method || "GET",
    headers,
    get: (name: string) => headers[name.toLowerCase()],
    socket: { remoteAddress: overrides.ip || TEST_IPS.client1 },
  };
}

/**
 * Creates a mock Express response for testing.
 */
export function createMockResponse(): {
  statusCode: number;
  headers: Record<string, string | number>;
  body: unknown;
  status: (code: number) => { json: (data: unknown) => void };
  setHeader: (name: string, value: string | number) => void;
  json: (data: unknown) => void;
} {
  const res = {
    statusCode: 200,
    headers: {} as Record<string, string | number>,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return {
        json(data: unknown) {
          res.body = data;
        },
      };
    },
    setHeader(name: string, value: string | number) {
      res.headers[name] = value;
    },
    json(data: unknown) {
      res.body = data;
    },
  };
  return res;
}

/**
 * Helper to wait for a specified time.
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Helper to simulate multiple rapid requests.
 */
export async function simulateRequests(
  hitFn: () => void,
  count: number,
  delayMs: number = 0
): Promise<void> {
  for (let i = 0; i < count; i++) {
    hitFn();
    if (delayMs > 0 && i < count - 1) {
      await wait(delayMs);
    }
  }
}
