# Troubleshooting Guide

## Common Issues and Solutions

### Development Environment

#### Port Already in Use (EADDRINUSE)
```
Error: listen EADDRINUSE: address already in use :::3001
```

**Cause**: Another process is already using port 3001

**Solutions**:
1. Find and kill the existing process:
   ```bash
   # Find process using port 3001
   lsof -i :3001
   
   # Kill the process
   kill -9 <PID>
   ```

2. Change the port in `src/index.ts`:
   ```typescript
   const PORT = process.env.PORT || 3002;
   ```

#### TypeScript Compilation Errors

1. **Missing Redis Export**
   ```
   error TS2305: Module '"../server"' has no exported member 'redis'
   ```
   
   **Solution**:
   - Ensure Redis client is exported in `src/server.ts`:
     ```typescript
     export const redis = createClient({
       url: process.env.REDIS_URL
     });
     ```

2. **Monitoring Service Type Errors**
   ```
   error TS2724: '"../monitoring/service"' has no exported member named 'getMonitoringService'
   ```
   
   **Solution**:
   - Use `MonitoringService` class directly:
     ```typescript
     import { MonitoringService } from '../monitoring/service';
     
     const monitoring = new MonitoringService({
       provider: 'datadog',
       apiKey: process.env.DATADOG_API_KEY
     });
     ```

### Runtime Issues

#### Redis Connection Failures

**Symptoms**:
- Rate limiting fails open
- Redis connection errors in logs
- High latency in rate-limited endpoints

**Solutions**:
1. Check Redis connection:
   ```bash
   redis-cli ping
   ```

2. Verify Redis URL:
   ```typescript
   // Should match format:
   redis://[[username][:password]@][host][:port][/db-number]
   ```

3. Check Redis memory usage:
   ```bash
   redis-cli info memory
   ```

4. Monitor Redis operations:
   ```bash
   redis-cli monitor
   ```

#### Rate Limiting Issues

**Symptoms**:
- Unexpected blocking
- Rate limit not enforced
- Incorrect remaining requests

**Debug Steps**:
1. Check Redis keys:
   ```bash
   # List rate limit keys
   redis-cli keys "rl:*"
   
   # Check specific key
   redis-cli get "rl:auth:login:127.0.0.1"
   ```

2. Verify headers:
   ```bash
   curl -i http://localhost:3001/login
   # Look for X-RateLimit-* headers
   ```

3. Monitor rate limit events:
   ```bash
   # Check Datadog for events:
   - rate_limit_attempt
   - rate_limit_blocked
   - rate_limit_exceeded
   ```

#### Monitoring Integration

**Symptoms**:
- Missing metrics
- Delayed metric updates
- Metric submission errors

**Solutions**:
1. Verify Datadog API key:
   ```bash
   curl -X GET "https://api.datadoghq.com/api/v1/validate" \
   -H "Accept: application/json" \
   -H "DD-API-KEY: ${DD_API_KEY}"
   ```

2. Check metric batching:
   ```typescript
   // Adjust batch settings
   const monitoring = new MonitoringService({
     flushIntervalMs: 5000,  // Decrease for more frequent updates
     batchSize: 50           // Adjust based on volume
   });
   ```

3. Enable debug logging:
   ```typescript
   const logger = new Logger('Monitoring', LogLevel.DEBUG);
   ```

### Performance Issues

#### High Memory Usage

**Symptoms**:
- Increasing memory usage
- Slow response times
- Out of memory errors

**Solutions**:
1. Check Node.js memory usage:
   ```bash
   node --expose-gc --trace-gc index.js
   ```

2. Monitor Redis memory:
   ```bash
   redis-cli info memory
   ```

3. Adjust rate limit cleanup:
   ```bash
   # Run periodic cleanup
   redis-cli keys "rl:*" | xargs redis-cli del
   ```

#### High Latency

**Symptoms**:
- Slow response times
- Timeouts
- Connection drops

**Debug Steps**:
1. Enable detailed logging:
   ```typescript
   const logger = new Logger('RateLimiter', LogLevel.DEBUG);
   ```

2. Monitor Redis latency:
   ```bash
   redis-cli --latency
   ```

3. Check system resources:
   ```bash
   top -o cpu  # CPU usage
   iostat      # I/O stats
   ```

### Emergency Procedures

#### Rate Limit Reset

If rate limits need to be reset immediately:

```bash
# Clear all rate limit keys
redis-cli keys "rl:*" | xargs redis-cli del

# Clear specific endpoint
redis-cli keys "rl:auth:login:*" | xargs redis-cli del
```

#### Monitoring Reset

If monitoring needs to be reset:

```typescript
await monitoring.flush();  // Force flush metrics
await monitoring.reset();  // Reset internal state
```

#### Service Recovery

If the service needs to be restarted:

1. Graceful shutdown:
   ```bash
   kill -SIGTERM <PID>
   ```

2. Force shutdown (if needed):
   ```bash
   kill -9 <PID>
   ```

3. Restart service:
   ```bash
   npm run start
   ```

## Health Checks

### System Health

```bash
# Check all services
curl http://localhost:3001/health

# Check Redis
redis-cli ping

# Check Monitoring
curl -X GET "https://api.datadoghq.com/api/v1/validate" \
-H "DD-API-KEY: ${DD_API_KEY}"
```

### Metrics Health

```bash
# Check metric submission
curl http://localhost:3001/metrics

# Check Datadog metrics
curl -X GET "https://api.datadoghq.com/api/v1/metrics" \
-H "DD-API-KEY: ${DD_API_KEY}"
```

## Support Resources

- [Redis Documentation](https://redis.io/documentation)
- [Datadog API Documentation](https://docs.datadoghq.com/api/)
- [Node.js Debugging Guide](https://nodejs.org/en/docs/guides/debugging-getting-started/)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/) 