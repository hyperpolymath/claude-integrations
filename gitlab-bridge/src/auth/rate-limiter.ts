// SPDX-License-Identifier: MIT
// SPDX-FileCopyrightText: 2024 hyperpolymath

import type { Request, Response, NextFunction } from "express";
import { RateLimitInfo, AuditEntry } from "./types";
import { RateLimitError } from "./errors";

/**
 * Configuration for rate limiting.
 */
export interface RateLimitConfig {
  /** Maximum requests per window (default: 60) */
  limit?: number;
  /** Window size in milliseconds (default: 60000) */
  windowMs?: number;
  /** Key generator function (default: IP-based) */
  keyGenerator?: (req: Request) => string;
  /** Skip rate limiting for certain requests */
  skip?: (req: Request) => boolean;
  /** Handler when rate limit is exceeded */
  onLimitReached?: (req: Request, res: Response, info: RateLimitInfo) => void;
  /** Audit logging function */
  auditLog?: (entry: AuditEntry) => void | Promise<void>;
  /** Whether to include rate limit headers in response */
  headers?: boolean;
  /** Custom message when rate limited */
  message?: string;
}

/**
 * Default rate limit configuration.
 */
export const DEFAULT_RATE_LIMIT_CONFIG: Required<Omit<RateLimitConfig, 'auditLog' | 'onLimitReached' | 'skip'>> = {
  limit: 60,
  windowMs: 60 * 1000, // 1 minute
  keyGenerator: (req: Request) => req.ip || req.socket.remoteAddress || 'unknown',
  headers: true,
  message: 'Too many requests, please try again later.',
};

/**
 * Internal record for tracking request timestamps.
 */
interface RateLimitRecord {
  /** Timestamps of requests in the current window */
  timestamps: number[];
  /** When this record was last accessed */
  lastAccess: number;
}

/**
 * In-memory rate limiter using sliding window algorithm.
 */
export class RateLimiter {
  private readonly config: Required<Omit<RateLimitConfig, 'auditLog' | 'onLimitReached' | 'skip'>> &
    Pick<RateLimitConfig, 'auditLog' | 'onLimitReached' | 'skip'>;
  private readonly store: Map<string, RateLimitRecord> = new Map();
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(config: RateLimitConfig = {}) {
    this.config = {
      ...DEFAULT_RATE_LIMIT_CONFIG,
      ...config,
    };

    // Start cleanup interval to prevent memory leaks
    this.startCleanup();
  }

  /**
   * Starts the cleanup interval to remove expired records.
   */
  private startCleanup(): void {
    // Clean up every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60 * 1000);

    // Don't prevent Node from exiting
    if (this.cleanupInterval.unref) {
      this.cleanupInterval.unref();
    }
  }

  /**
   * Stops the cleanup interval.
   */
  public stop(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * Removes expired records from the store.
   */
  private cleanup(): void {
    const now = Date.now();
    const expireTime = this.config.windowMs * 2; // Keep records for 2x window size

    for (const [key, record] of this.store.entries()) {
      if (now - record.lastAccess > expireTime) {
        this.store.delete(key);
      }
    }
  }

  /**
   * Checks if a key is rate limited and records the request.
   *
   * @param key - The rate limit key (e.g., IP address)
   * @returns Rate limit info for the key
   */
  public check(key: string): RateLimitInfo {
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    // Get or create record
    let record = this.store.get(key);
    if (!record) {
      record = { timestamps: [], lastAccess: now };
      this.store.set(key, record);
    }

    // Filter out timestamps outside the window
    record.timestamps = record.timestamps.filter((ts) => ts > windowStart);
    record.lastAccess = now;

    // Calculate remaining requests
    const remaining = Math.max(0, this.config.limit - record.timestamps.length);
    const isLimited = remaining === 0;

    // Calculate reset time
    const oldestTimestamp = record.timestamps[0];
    const resetAt = oldestTimestamp
      ? new Date(oldestTimestamp + this.config.windowMs)
      : new Date(now + this.config.windowMs);

    return {
      limit: this.config.limit,
      remaining,
      resetAt,
      isLimited,
    };
  }

  /**
   * Records a request for a key.
   *
   * @param key - The rate limit key
   * @returns Updated rate limit info
   */
  public hit(key: string): RateLimitInfo {
    const now = Date.now();
    const info = this.check(key);

    if (!info.isLimited) {
      const record = this.store.get(key)!;
      record.timestamps.push(now);
      info.remaining = Math.max(0, info.remaining - 1);
    }

    return info;
  }

  /**
   * Resets the rate limit for a key.
   *
   * @param key - The rate limit key
   */
  public reset(key: string): void {
    this.store.delete(key);
  }

  /**
   * Resets all rate limits.
   */
  public resetAll(): void {
    this.store.clear();
  }

  /**
   * Gets the current count of tracked keys.
   */
  public get size(): number {
    return this.store.size;
  }

  /**
   * Gets rate limit info without recording a hit.
   *
   * @param key - The rate limit key
   * @returns Rate limit info for the key
   */
  public getInfo(key: string): RateLimitInfo {
    return this.check(key);
  }
}

/**
 * Creates a rate limiting middleware.
 *
 * @param config - Rate limit configuration
 * @returns Express middleware function
 */
export function createRateLimitMiddleware(
  config: RateLimitConfig = {}
): (req: Request, res: Response, next: NextFunction) => void {
  const limiter = new RateLimiter(config);
  const mergedConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };

  return (req: Request, res: Response, next: NextFunction): void => {
    // Check if we should skip this request
    if (config.skip?.(req)) {
      next();
      return;
    }

    // Generate key for this request
    const key = mergedConfig.keyGenerator(req);

    // Record the hit
    const info = limiter.hit(key);

    // Set rate limit headers if enabled
    if (mergedConfig.headers) {
      res.setHeader('X-RateLimit-Limit', info.limit);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetAt.getTime() / 1000));
    }

    // Check if rate limited
    if (info.isLimited) {
      const retryAfter = Math.ceil((info.resetAt.getTime() - Date.now()) / 1000);

      // Set Retry-After header
      res.setHeader('Retry-After', retryAfter);

      // Audit log if configured
      if (config.auditLog) {
        config.auditLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'rate_limit.exceeded',
          actor: key,
          resource: req.path,
          success: false,
          metadata: {
            method: req.method,
            limit: info.limit,
            retryAfter,
          },
          ipAddress: req.ip,
        });
      }

      // Call custom handler if provided
      if (config.onLimitReached) {
        config.onLimitReached(req, res, info);
        return;
      }

      // Default response
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: mergedConfig.message,
        retryAfter,
      });
      return;
    }

    next();
  };
}

/**
 * Creates a rate limiter that can be shared across middleware.
 *
 * @param config - Rate limit configuration
 * @returns Object with limiter instance and middleware
 */
export function createSharedRateLimiter(config: RateLimitConfig = {}): {
  limiter: RateLimiter;
  middleware: (req: Request, res: Response, next: NextFunction) => void;
} {
  const limiter = new RateLimiter(config);
  const mergedConfig = { ...DEFAULT_RATE_LIMIT_CONFIG, ...config };

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    if (config.skip?.(req)) {
      next();
      return;
    }

    const key = mergedConfig.keyGenerator(req);
    const info = limiter.hit(key);

    if (mergedConfig.headers) {
      res.setHeader('X-RateLimit-Limit', info.limit);
      res.setHeader('X-RateLimit-Remaining', info.remaining);
      res.setHeader('X-RateLimit-Reset', Math.ceil(info.resetAt.getTime() / 1000));
    }

    if (info.isLimited) {
      const retryAfter = Math.ceil((info.resetAt.getTime() - Date.now()) / 1000);
      res.setHeader('Retry-After', retryAfter);

      if (config.auditLog) {
        config.auditLog({
          id: crypto.randomUUID(),
          timestamp: new Date(),
          action: 'rate_limit.exceeded',
          actor: key,
          resource: req.path,
          success: false,
          metadata: { method: req.method, limit: info.limit, retryAfter },
          ipAddress: req.ip,
        });
      }

      if (config.onLimitReached) {
        config.onLimitReached(req, res, info);
        return;
      }

      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: mergedConfig.message,
        retryAfter,
      });
      return;
    }

    next();
  };

  return { limiter, middleware };
}

/**
 * Preset rate limit configurations.
 */
export const RATE_LIMIT_PRESETS = {
  /** Strict: 30 requests per minute */
  strict: { limit: 30, windowMs: 60 * 1000 },

  /** Standard: 60 requests per minute */
  standard: { limit: 60, windowMs: 60 * 1000 },

  /** Relaxed: 120 requests per minute */
  relaxed: { limit: 120, windowMs: 60 * 1000 },

  /** API: 1000 requests per hour */
  api: { limit: 1000, windowMs: 60 * 60 * 1000 },

  /** Webhook: 100 requests per minute */
  webhook: { limit: 100, windowMs: 60 * 1000 },

  /** Auth: 10 requests per minute (for login attempts) */
  auth: { limit: 10, windowMs: 60 * 1000 },
} as const;

/**
 * Creates rate limit middleware with a preset configuration.
 *
 * @param preset - Preset name
 * @param overrides - Optional config overrides
 * @returns Express middleware function
 */
export function createRateLimitFromPreset(
  preset: keyof typeof RATE_LIMIT_PRESETS,
  overrides: Partial<RateLimitConfig> = {}
): (req: Request, res: Response, next: NextFunction) => void {
  return createRateLimitMiddleware({
    ...RATE_LIMIT_PRESETS[preset],
    ...overrides,
  });
}

/**
 * Decorator to check rate limit and throw if exceeded.
 *
 * @param limiter - Rate limiter instance
 * @param key - Rate limit key
 * @throws RateLimitError if rate limited
 */
export function requireRateLimit(limiter: RateLimiter, key: string): void {
  const info = limiter.hit(key);

  if (info.isLimited) {
    const retryAfter = Math.ceil((info.resetAt.getTime() - Date.now()) / 1000);
    throw new RateLimitError(retryAfter);
  }
}
