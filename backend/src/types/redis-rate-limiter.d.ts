declare module 'redis-rate-limiter' {
  import type { RedisClientType } from 'redis';

  interface RateLimiterOptions {
    redis: RedisClientType;
    namespace?: string;
    points: number;
    duration: number;
  }

  interface RateLimiter {
    try(key: string, callback: (err: Error | null, timeLeft: number | null) => void): void;
  }

  export class RateLimiter {
    constructor(options: RateLimiterOptions);
    try(key: string, callback: (err: Error | null, timeLeft: number | null) => void): void;
  }
} 