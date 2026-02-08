// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  RateLimiter,
  createRateLimitMiddleware,
  createSharedRateLimiter,
  createRateLimitFromPreset,
  requireRateLimit,
  RATE_LIMIT_PRESETS,
  DEFAULT_RATE_LIMIT_CONFIG,
} from "../../../src/auth/rate-limiter";
import { RateLimitError } from "../../../src/auth/errors";
import {
  RATE_LIMIT_CONFIGS,
  TEST_IPS,
  createMockRequest,
  createMockResponse,
  wait,
} from "../../fixtures/rate-limit";
import type { Request, Response } from "express";

describe("rate-limiter", () => {
  describe("RateLimiter", () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter(RATE_LIMIT_CONFIGS.testStrict);
    });

    afterEach(() => {
      limiter.stop();
    });

    it("should allow requests within limit", () => {
      const info1 = limiter.hit(TEST_IPS.client1);
      expect(info1.isLimited).toBe(false);
      expect(info1.remaining).toBe(1);

      const info2 = limiter.hit(TEST_IPS.client1);
      expect(info2.isLimited).toBe(false);
      expect(info2.remaining).toBe(0);
    });

    it("should block requests over limit", () => {
      limiter.hit(TEST_IPS.client1);
      limiter.hit(TEST_IPS.client1);

      const info = limiter.hit(TEST_IPS.client1);
      expect(info.isLimited).toBe(true);
      expect(info.remaining).toBe(0);
    });

    it("should track different keys separately", () => {
      limiter.hit(TEST_IPS.client1);
      limiter.hit(TEST_IPS.client1);

      const info1 = limiter.hit(TEST_IPS.client1);
      expect(info1.isLimited).toBe(true);

      const info2 = limiter.hit(TEST_IPS.client2);
      expect(info2.isLimited).toBe(false);
      expect(info2.remaining).toBe(1);
    });

    it("should reset limit after window expires", async () => {
      limiter.hit(TEST_IPS.client1);
      limiter.hit(TEST_IPS.client1);

      let info = limiter.hit(TEST_IPS.client1);
      expect(info.isLimited).toBe(true);

      // Wait for window to expire
      await wait(150);

      info = limiter.hit(TEST_IPS.client1);
      expect(info.isLimited).toBe(false);
      expect(info.remaining).toBe(1);
    });

    it("should return correct limit info", () => {
      const info = limiter.getInfo(TEST_IPS.client1);

      expect(info.limit).toBe(2);
      expect(info.remaining).toBe(2);
      expect(info.isLimited).toBe(false);
      expect(info.resetAt).toBeInstanceOf(Date);
    });

    it("should reset specific key", () => {
      limiter.hit(TEST_IPS.client1);
      limiter.hit(TEST_IPS.client1);
      limiter.reset(TEST_IPS.client1);

      const info = limiter.hit(TEST_IPS.client1);
      expect(info.isLimited).toBe(false);
      expect(info.remaining).toBe(1);
    });

    it("should reset all keys", () => {
      limiter.hit(TEST_IPS.client1);
      limiter.hit(TEST_IPS.client2);
      limiter.resetAll();

      expect(limiter.size).toBe(0);

      const info1 = limiter.getInfo(TEST_IPS.client1);
      const info2 = limiter.getInfo(TEST_IPS.client2);

      expect(info1.remaining).toBe(2);
      expect(info2.remaining).toBe(2);
    });

    it("should track store size", () => {
      expect(limiter.size).toBe(0);

      limiter.hit(TEST_IPS.client1);
      expect(limiter.size).toBe(1);

      limiter.hit(TEST_IPS.client2);
      expect(limiter.size).toBe(2);
    });

    it("should use sliding window correctly", async () => {
      // Hit once
      limiter.hit(TEST_IPS.client1);

      // Wait half the window
      await wait(60);

      // Hit again
      limiter.hit(TEST_IPS.client1);

      // Should be limited now
      let info = limiter.hit(TEST_IPS.client1);
      expect(info.isLimited).toBe(true);

      // Wait for first hit to expire (remaining window time)
      await wait(60);

      // Should have room for one more request now
      info = limiter.hit(TEST_IPS.client1);
      expect(info.isLimited).toBe(false);
    });
  });

  describe("createRateLimitMiddleware", () => {
    it("should allow requests within limit", () => {
      const middleware = createRateLimitMiddleware(RATE_LIMIT_CONFIGS.testStrict);
      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = vi.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.statusCode).toBe(200);
    });

    it("should block requests over limit", () => {
      const middleware = createRateLimitMiddleware(RATE_LIMIT_CONFIGS.testStrict);
      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      // Exhaust limit
      middleware(req as unknown as Request, res as unknown as Response, next);
      middleware(req as unknown as Request, res as unknown as Response, next);

      // This should be blocked
      middleware(req as unknown as Request, res as unknown as Response, next);

      expect(res.statusCode).toBe(429);
      expect(res.body).toMatchObject({
        error: "RATE_LIMIT_EXCEEDED",
      });
    });

    it("should set rate limit headers", () => {
      const middleware = createRateLimitMiddleware(RATE_LIMIT_CONFIGS.testStrict);
      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req as unknown as Request, res as unknown as Response, next);

      expect(res.headers["X-RateLimit-Limit"]).toBe(2);
      expect(res.headers["X-RateLimit-Remaining"]).toBe(1);
      expect(res.headers["X-RateLimit-Reset"]).toBeDefined();
    });

    it("should set Retry-After header when limited", () => {
      const middleware = createRateLimitMiddleware(RATE_LIMIT_CONFIGS.testStrict);
      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      // Exhaust limit
      middleware(req as unknown as Request, res as unknown as Response, next);
      middleware(req as unknown as Request, res as unknown as Response, next);
      middleware(req as unknown as Request, res as unknown as Response, next);

      expect(res.headers["Retry-After"]).toBeDefined();
      expect(typeof res.headers["Retry-After"]).toBe("number");
    });

    it("should skip requests when skip function returns true", () => {
      const middleware = createRateLimitMiddleware({
        ...RATE_LIMIT_CONFIGS.testSingle,
        skip: (req) => req.path === "/health",
      });

      const healthReq = createMockRequest({ path: "/health" }) as unknown as Request;
      const apiReq = createMockRequest({ path: "/api/test" }) as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      // Health check should be skipped (unlimited)
      middleware(healthReq, res as unknown as Response, next);
      middleware(healthReq, res as unknown as Response, next);
      middleware(healthReq, res as unknown as Response, next);

      expect(next).toHaveBeenCalledTimes(3);

      // API request should be limited
      middleware(apiReq, res as unknown as Response, next);
      expect(next).toHaveBeenCalledTimes(4);

      middleware(apiReq, res as unknown as Response, next);
      expect(res.statusCode).toBe(429);
    });

    it("should use custom key generator", () => {
      const middleware = createRateLimitMiddleware({
        ...RATE_LIMIT_CONFIGS.testStrict,
        keyGenerator: (req) => req.get("x-api-key") || "anonymous",
      });

      const req1 = createMockRequest({
        headers: { "x-api-key": "key1" },
      }) as unknown as Request;
      const req2 = createMockRequest({
        headers: { "x-api-key": "key2" },
      }) as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      // Exhaust limit for key1
      middleware(req1 as unknown as Request, res as unknown as Response, next);
      middleware(req1 as unknown as Request, res as unknown as Response, next);
      middleware(req1 as unknown as Request, res as unknown as Response, next);

      expect(res.statusCode).toBe(429);

      // key2 should still work
      const res2 = createMockResponse();
      middleware(req2 as unknown as Request, res2 as unknown as Response, next);
      expect(res2.statusCode).toBe(200);
    });

    it("should call custom onLimitReached handler", () => {
      const onLimitReached = vi.fn();
      const middleware = createRateLimitMiddleware({
        ...RATE_LIMIT_CONFIGS.testSingle,
        onLimitReached,
      });

      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = vi.fn();

      middleware(req, res, next);
      middleware(req, res, next);

      expect(onLimitReached).toHaveBeenCalledTimes(1);
      expect(onLimitReached).toHaveBeenCalledWith(
        req,
        res,
        expect.objectContaining({ isLimited: true })
      );
    });

    it("should call audit log when rate limited", () => {
      const auditLog = vi.fn();
      const middleware = createRateLimitMiddleware({
        ...RATE_LIMIT_CONFIGS.testSingle,
        auditLog,
      });

      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = vi.fn();

      middleware(req, res, next);
      middleware(req, res, next);

      expect(auditLog).toHaveBeenCalledWith(
        expect.objectContaining({
          action: "rate_limit.exceeded",
          success: false,
        })
      );
    });

    it("should use custom message", () => {
      const middleware = createRateLimitMiddleware({
        ...RATE_LIMIT_CONFIGS.testSingle,
        message: "Custom rate limit message",
      });

      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req as unknown as Request, res as unknown as Response, next);
      middleware(req as unknown as Request, res as unknown as Response, next);

      expect(res.body).toMatchObject({
        message: "Custom rate limit message",
      });
    });

    it("should not set headers when disabled", () => {
      const middleware = createRateLimitMiddleware({
        ...RATE_LIMIT_CONFIGS.testStrict,
        headers: false,
      });

      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req as unknown as Request, res as unknown as Response, next);

      expect(res.headers["X-RateLimit-Limit"]).toBeUndefined();
      expect(res.headers["X-RateLimit-Remaining"]).toBeUndefined();
    });
  });

  describe("createSharedRateLimiter", () => {
    it("should return limiter and middleware", () => {
      const { limiter, middleware } = createSharedRateLimiter(
        RATE_LIMIT_CONFIGS.testStrict
      );

      expect(limiter).toBeInstanceOf(RateLimiter);
      expect(typeof middleware).toBe("function");

      limiter.stop();
    });

    it("should share state between middleware and limiter", () => {
      const { limiter, middleware } = createSharedRateLimiter(
        RATE_LIMIT_CONFIGS.testStrict
      );

      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse() as unknown as Response;
      const next = vi.fn();

      // Hit via middleware
      middleware(req, res, next);

      // Check via limiter
      const info = limiter.getInfo(TEST_IPS.client1);
      expect(info.remaining).toBe(1);

      limiter.stop();
    });
  });

  describe("createRateLimitFromPreset", () => {
    it("should create middleware from preset", () => {
      const middleware = createRateLimitFromPreset("strict");
      expect(typeof middleware).toBe("function");
    });

    it("should use preset values", () => {
      const { limiter } = createSharedRateLimiter(RATE_LIMIT_PRESETS.strict);

      const info = limiter.getInfo("test");
      expect(info.limit).toBe(30);

      limiter.stop();
    });

    it("should allow overriding preset values", () => {
      const middleware = createRateLimitFromPreset("strict", { limit: 5 });
      const req = createMockRequest() as unknown as Request;
      const res = createMockResponse();
      const next = vi.fn();

      middleware(req as unknown as Request, res as unknown as Response, next);

      expect(res.headers["X-RateLimit-Limit"]).toBe(5);
    });
  });

  describe("requireRateLimit", () => {
    let limiter: RateLimiter;

    beforeEach(() => {
      limiter = new RateLimiter(RATE_LIMIT_CONFIGS.testSingle);
    });

    afterEach(() => {
      limiter.stop();
    });

    it("should not throw when within limit", () => {
      expect(() => requireRateLimit(limiter, "test")).not.toThrow();
    });

    it("should throw RateLimitError when over limit", () => {
      requireRateLimit(limiter, "test");

      expect(() => requireRateLimit(limiter, "test")).toThrow(RateLimitError);
    });

    it("should include retry after in error", () => {
      requireRateLimit(limiter, "test");

      try {
        requireRateLimit(limiter, "test");
        expect.fail("Should have thrown");
      } catch (error) {
        if (error instanceof RateLimitError) {
          expect(error.retryAfter).toBeGreaterThan(0);
          expect(error.statusCode).toBe(429);
        } else {
          throw error;
        }
      }
    });
  });

  describe("RATE_LIMIT_PRESETS", () => {
    it("should have all expected presets", () => {
      expect(RATE_LIMIT_PRESETS.strict).toBeDefined();
      expect(RATE_LIMIT_PRESETS.standard).toBeDefined();
      expect(RATE_LIMIT_PRESETS.relaxed).toBeDefined();
      expect(RATE_LIMIT_PRESETS.api).toBeDefined();
      expect(RATE_LIMIT_PRESETS.webhook).toBeDefined();
      expect(RATE_LIMIT_PRESETS.auth).toBeDefined();
    });

    it("should have valid configurations", () => {
      for (const [_name, preset] of Object.entries(RATE_LIMIT_PRESETS)) {
        expect(preset.limit).toBeGreaterThan(0);
        expect(preset.windowMs).toBeGreaterThan(0);
      }
    });
  });

  describe("DEFAULT_RATE_LIMIT_CONFIG", () => {
    it("should have sensible defaults", () => {
      expect(DEFAULT_RATE_LIMIT_CONFIG.limit).toBe(60);
      expect(DEFAULT_RATE_LIMIT_CONFIG.windowMs).toBe(60 * 1000);
      expect(DEFAULT_RATE_LIMIT_CONFIG.headers).toBe(true);
      expect(typeof DEFAULT_RATE_LIMIT_CONFIG.keyGenerator).toBe("function");
    });
  });
});
