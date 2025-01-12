/**
 * Rate limiting middleware for Express applications using Redis as a distributed store.
 * Provides IP-based rate limiting with configurable limits, blocking, and monitoring.
 * 
 * Features:
 * - Distributed rate limiting using Redis
 * - IP-based request tracking and blocking
 * - Configurable limits and block durations
 * - Rate limit headers (X-RateLimit-*)
 * - Monitoring integration
 * - Graceful failure handling
 * 
 * @module middleware/rate-limit
 */

import type { Request, Response, NextFunction } from 'express';
import type { RedisClientType } from 'redis';
import { ErrorCode, NotionAssistantError, ErrorSeverity } from '../errors/types';
import { Logger } from '../utils/logger';
import type { MonitoringService } from '../monitoring/service';

const logger = new Logger('RateLimiter');

/**
 * Configuration options for the rate limiter
 * @interface RateLimitOptions
 */
export interface RateLimitOptions {
  /** Maximum number of requests allowed within the duration window */
  points: number;
  
  /** Duration window in seconds */
  duration: number;
  
  /** How long to block an IP after exceeding the limit (seconds) */
  blockDuration: number;
  
  /** Prefix for Redis keys to prevent collisions */
  keyPrefix: string;
}

/**
 * Default rate limiting configuration
 * Allows 5 requests per minute with a 10-minute block duration
 */
const DEFAULT_OPTIONS: RateLimitOptions = {
  points: 5,            // 5 requests
  duration: 60,         // per minute
  blockDuration: 600,   // block for 10 minutes if exceeded
  keyPrefix: 'rl'       // rate limit prefix
};

/**
 * Creates a rate limiting middleware function
 * 
 * @param redis - Redis client for distributed rate limiting
 * @param monitoring - Monitoring service for tracking rate limit events
 * @param options - Rate limiting configuration options
 * @returns Express middleware function
 * 
 * @example
 * ```typescript
 * // Create a rate limiter for login attempts
 * const loginLimiter = createRateLimiter(redis, monitoring, {
 *   points: 5,           // 5 attempts
 *   duration: 300,       // per 5 minutes
 *   blockDuration: 900,  // block for 15 minutes
 *   keyPrefix: 'rl:auth:login'
 * });
 * 
 * // Apply to login route
 * app.post('/login', loginLimiter, loginHandler);
 * ```
 */
export function createRateLimiter(
  redis: RedisClientType,
  monitoring: MonitoringService,
  options: Partial<RateLimitOptions> = {}
) {
  const opts: RateLimitOptions = { ...DEFAULT_OPTIONS, ...options };

  return async function rateLimitMiddleware(req: Request, res: Response, next: NextFunction) {
    const identifier = req.ip; // Use IP address as identifier
    const key = `${opts.keyPrefix}:${identifier}`;
    const blockKey = `${key}:blocked`;

    try {
      // Track attempt in monitoring
      monitoring.trackAPI(
        req.path || '/',
        req.method,
        200,
        0,
        {
          type: 'rate_limit_attempt',
          prefix: opts.keyPrefix,
          ip: identifier || 'unknown'
        }
      );

      // Check if IP is blocked
      const isBlocked = await redis.get(blockKey);
      if (isBlocked) {
        const ttl = await redis.ttl(blockKey);
        
        monitoring.trackAPI(
          req.path || '/',
          req.method,
          429,
          0,
          {
            type: 'rate_limit_blocked',
            prefix: opts.keyPrefix,
            ip: identifier || 'unknown',
            ttl: String(ttl)
          }
        );

        return res.status(429).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: `Too many requests. Please try again in ${ttl} seconds.`
          }
        });
      }

      // Get current count
      const current = await redis.incr(key);

      // Set expiry on first request
      if (current === 1) {
        await redis.expire(key, opts.duration);
      }

      // Track current usage
      monitoring.trackResource(
        'rate_limit',
        current,
        opts.points,
        {
          prefix: opts.keyPrefix,
          ip: identifier || 'unknown'
        }
      );

      // Check if limit exceeded
      if (current > opts.points) {
        // Block the IP
        await redis.setEx(blockKey, opts.blockDuration, '1');
        
        monitoring.trackAPI(
          req.path || '/',
          req.method,
          429,
          0,
          {
            type: 'rate_limit_exceeded',
            prefix: opts.keyPrefix,
            ip: identifier || 'unknown',
            duration: String(opts.blockDuration)
          }
        );

        return res.status(429).json({
          error: {
            code: ErrorCode.RATE_LIMIT_EXCEEDED,
            message: `Too many requests. Please try again in ${opts.blockDuration} seconds.`
          }
        });
      }

      // Add rate limit headers
      const ttl = await redis.ttl(key);
      res.setHeader('X-RateLimit-Limit', opts.points);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, opts.points - current));
      res.setHeader('X-RateLimit-Reset', Date.now() + (ttl * 1000));

      // Track successful request
      monitoring.trackAPI(
        req.path || '/',
        req.method,
        200,
        0,
        {
          type: 'rate_limit_allowed',
          prefix: opts.keyPrefix,
          ip: identifier || 'unknown',
          remaining: String(Math.max(0, opts.points - current))
        }
      );

      next();
    } catch (error) {
      const rateLimitError = new NotionAssistantError(
        (error as Error).message,
        ErrorCode.RATE_LIMIT_EXCEEDED,
        ErrorSeverity.WARNING,
        true
      );
      logger.error('Rate limit error', rateLimitError);
      monitoring.trackError(rateLimitError);
      // Fail open - let request through if Redis is down
      next();
    }
  };
} 