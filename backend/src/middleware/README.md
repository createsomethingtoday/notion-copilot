# Rate Limiting and Security Features

## Overview

This directory contains security-critical middleware for protecting the API endpoints. The primary components are:

- Rate limiting middleware for preventing abuse
- Authentication middleware for user verification
- Error handling for security-related issues

## Rate Limiting

The rate limiting implementation (`rate-limit.ts`) provides distributed rate limiting using Redis as the storage backend. This ensures consistent rate limiting across multiple application instances.

### Features

- **Distributed Rate Limiting**: Uses Redis for cross-instance coordination
- **IP-Based Tracking**: Limits and blocks based on client IP addresses
- **Configurable Limits**: Customizable request limits and time windows
- **Automatic Blocking**: Temporarily blocks IPs that exceed limits
- **Rate Limit Headers**: Standard headers for client feedback
- **Monitoring Integration**: Comprehensive event tracking
- **Fail-Open Design**: Gracefully handles Redis failures

### Configuration

Rate limits are configured per-endpoint with the following options:

```typescript
interface RateLimitOptions {
  points: number;        // Maximum requests allowed
  duration: number;      // Time window in seconds
  blockDuration: number; // Block duration in seconds
  keyPrefix: string;     // Redis key prefix
}
```

### Current Rate Limits

1. **Login Endpoint**
   - 5 attempts per 5 minutes
   - 15-minute block after exceeding limit
   - Prevents brute force attacks

2. **Registration Endpoint**
   - 3 attempts per hour
   - 2-hour block after exceeding limit
   - Prevents account enumeration and spam

### Monitoring

The rate limiter tracks the following events:

- `rate_limit_attempt`: Each request attempt
- `rate_limit_blocked`: Requests from blocked IPs
- `rate_limit_exceeded`: When limits are exceeded
- `rate_limit_allowed`: Successful requests
- Resource usage metrics (current/max requests)

### Headers

The middleware sets standard rate limit headers:

- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Timestamp when limit resets

### Error Handling

- Returns 429 (Too Many Requests) when limits exceeded
- Includes retry-after information in error response
- Fails open if Redis is unavailable
- Logs errors with WARNING severity

## Best Practices

1. **Rate Limit Selection**
   - Start conservative and adjust based on monitoring
   - Consider user experience vs security trade-offs
   - Use stricter limits for security-critical endpoints

2. **Monitoring**
   - Watch for unusual patterns in blocked requests
   - Monitor Redis connection health
   - Track rate limit events for anomaly detection

3. **Maintenance**
   - Regularly review and adjust limits based on usage
   - Monitor Redis memory usage
   - Clean up expired keys periodically

## Future Improvements

1. **Enhanced Rate Limiting**
   - Token bucket algorithm implementation
   - User-based rate limiting after authentication
   - Rate sharing across related IPs

2. **Security Enhancements**
   - IP reputation tracking
   - Machine learning for abuse detection
   - Geographic-based rate limiting

3. **Monitoring**
   - Real-time rate limit dashboards
   - Automated limit adjustment
   - Abuse pattern detection 