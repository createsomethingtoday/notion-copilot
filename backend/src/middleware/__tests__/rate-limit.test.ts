import type { Request, Response, NextFunction } from 'express';
import type { RedisClientType } from 'redis';
import type { MonitoringService } from '../../monitoring/service';
import { createRateLimiter } from '../rate-limit';
import { ErrorCode } from '../../errors/types';

// Mock redis client
const mockRedis = {
  get: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  setEx: jest.fn(),
  ttl: jest.fn(),
  flushall: jest.fn(),
  quit: jest.fn()
};

describe('Rate Limiter Middleware', () => {
  let redis: jest.Mocked<RedisClientType>;
  let monitoring: jest.Mocked<MonitoringService>;
  let req: Partial<Request>;
  let res: {
    status: jest.Mock;
    json: jest.Mock;
    setHeader: jest.Mock;
  };
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    // Setup Redis mock
    redis = mockRedis as unknown as jest.Mocked<RedisClientType>;

    // Setup monitoring mock
    monitoring = {
      trackAPI: jest.fn(),
      trackError: jest.fn(),
      trackResource: jest.fn()
    } as unknown as jest.Mocked<MonitoringService>;

    // Setup Express mocks
    req = {
      ip: '127.0.0.1',
      path: '/test',
      method: 'POST'
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      setHeader: jest.fn()
    };

    next = jest.fn();

    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should allow requests within rate limit', async () => {
    // Setup Redis mock responses
    redis.get.mockResolvedValue(null);
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(true);
    redis.ttl.mockResolvedValue(60);

    const rateLimiter = createRateLimiter(redis, monitoring, {
      points: 2,
      duration: 60,
      blockDuration: 60,
      keyPrefix: 'test'
    });

    // First request
    await rateLimiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
    expect(monitoring.trackAPI).toHaveBeenCalledWith(
      '/test',
      'POST',
      200,
      0,
      expect.objectContaining({
        type: 'rate_limit_attempt'
      })
    );

    // Second request
    redis.incr.mockResolvedValue(2);
    next.mockClear();
    await rateLimiter(req as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should block requests exceeding rate limit', async () => {
    // Setup Redis mock responses
    redis.get.mockResolvedValue(null);
    redis.incr.mockResolvedValue(3);
    redis.expire.mockResolvedValue(true);
    redis.ttl.mockResolvedValue(60);
    redis.setEx.mockResolvedValue('OK');

    const rateLimiter = createRateLimiter(redis, monitoring, {
      points: 2,
      duration: 60,
      blockDuration: 60,
      keyPrefix: 'test'
    });

    await rateLimiter(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: expect.objectContaining({
          code: ErrorCode.RATE_LIMIT_EXCEEDED
        })
      })
    );
    expect(monitoring.trackAPI).toHaveBeenCalledWith(
      '/test',
      'POST',
      429,
      0,
      expect.objectContaining({
        type: 'rate_limit_exceeded'
      })
    );
  });

  it('should maintain separate limits for different IPs', async () => {
    // Setup Redis mock responses for first IP
    redis.get.mockResolvedValueOnce(null);
    redis.incr.mockResolvedValueOnce(3);
    redis.expire.mockResolvedValue(true);
    redis.ttl.mockResolvedValue(60);
    redis.setEx.mockResolvedValue('OK');

    const rateLimiter = createRateLimiter(redis, monitoring, {
      points: 2,
      duration: 60,
      blockDuration: 60,
      keyPrefix: 'test'
    });

    // First IP gets blocked
    await rateLimiter(req as Request, res as Response, next);
    expect(next).not.toHaveBeenCalled();

    // Setup Redis mock responses for second IP
    redis.get.mockResolvedValueOnce(null);
    redis.incr.mockResolvedValueOnce(1);

    // Different IP should be allowed
    const newReq = { ...req, ip: '127.0.0.2' } as Partial<Request>;
    next.mockClear();
    await rateLimiter(newReq as Request, res as Response, next);
    expect(next).toHaveBeenCalled();
  });

  it('should add rate limit headers', async () => {
    // Setup Redis mock responses
    redis.get.mockResolvedValue(null);
    redis.incr.mockResolvedValue(1);
    redis.expire.mockResolvedValue(true);
    redis.ttl.mockResolvedValue(60);

    const rateLimiter = createRateLimiter(redis, monitoring, {
      points: 2,
      duration: 60,
      blockDuration: 60,
      keyPrefix: 'test'
    });

    await rateLimiter(req as Request, res as Response, next);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 2);
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);
    expect(res.setHeader).toHaveBeenCalledWith(
      'X-RateLimit-Reset',
      expect.any(Number)
    );
  });

  it('should fail open if Redis is down', async () => {
    // Setup Redis mock to fail
    redis.get.mockRejectedValue(new Error('Redis connection error'));

    const rateLimiter = createRateLimiter(redis, monitoring, {
      points: 2,
      duration: 60,
      blockDuration: 60,
      keyPrefix: 'test'
    });

    await rateLimiter(req as Request, res as Response, next);

    expect(next).toHaveBeenCalled();
    expect(monitoring.trackError).toHaveBeenCalled();
  });
}); 