# Known Issues and Solutions

## Monitoring Issues

### Datadog Authentication Failures
**Symptoms:**
- `NotionAssistantError: Datadog authentication failed`
- Repeated metric flush failures
- Unauthorized errors in logs

**Solutions:**
1. Check environment variables:
   ```bash
   # Required in .env
   DATADOG_API_KEY=your_api_key
   DATADOG_APP_KEY=your_app_key  # if using API endpoints
   ```

2. Verify API key validity:
   ```bash
   curl -X GET "https://api.datadoghq.com/api/v1/validate" \
   -H "Accept: application/json" \
   -H "DD-API-KEY: ${DATADOG_API_KEY}"
   ```

3. Development mode:
   ```typescript
   // Use development mode to prevent auth errors locally
   const monitoring = new MonitoringService({
     provider: process.env.NODE_ENV === 'production' ? 'datadog' : 'console'
   });
   ```

### Metric Flooding
**Symptoms:**
- Large batches of duplicate metrics
- Memory usage spikes
- Frequent flush attempts

**Solutions:**
1. Adjust batch settings:
   ```typescript
   const monitoring = new MonitoringService({
     flushIntervalMs: 10000,  // Increase interval
     batchSize: 50,          // Reduce batch size
     deduplicate: true       // Enable deduplication
   });
   ```

2. Filter system metrics:
   ```typescript
   const monitoring = new MonitoringService({
     systemMetrics: {
       memoryUsage: true,
       cpuUsage: true,
       eventLoopLag: false,  // Disable noisy metrics
       activeHandles: false
     }
   });
   ```

## Development Environment

### Port Conflicts (EADDRINUSE)
**Symptoms:**
- `Error: listen EADDRINUSE: address already in use :::3001`
- Server fails to start
- Development server crashes

**Solutions:**
1. Find and kill existing process:
   ```bash
   # Find process
   lsof -i :3001
   
   # Kill process
   kill -9 <PID>
   ```

2. Use dynamic port assignment:
   ```typescript
   // In src/index.ts
   const PORT = process.env.PORT || findAvailablePort(3001, 3010);
   ```

3. Development script:
   ```bash
   # Add to package.json
   "dev": "kill-port 3001 && ts-node-dev src/index.ts"
   ```

### Redis Type Issues
**Symptoms:**
- `Module '"../server"' has no exported member 'redis'`
- Type errors with Redis client
- Missing type definitions

**Solutions:**
1. Proper Redis export:
   ```typescript
   // In src/server.ts
   import { createClient } from 'redis';
   import type { RedisClientType } from 'redis';
   
   export const redis: RedisClientType = createClient({
     url: process.env.REDIS_URL
   });
   ```

2. Type assertions:
   ```typescript
   // When strict typing is needed
   import type { RedisClientType } from 'redis';
   const typedRedis = redis as RedisClientType;
   ```

## Best Practices

### Environment Configuration
1. Use `.env.example`:
   ```bash
   # Required variables
   REDIS_URL=redis://localhost:6379
   DATADOG_API_KEY=
   PORT=3001
   ```

2. Validate environment:
   ```typescript
   function validateEnv() {
     const required = ['REDIS_URL', 'DATADOG_API_KEY'];
     const missing = required.filter(key => !process.env[key]);
     if (missing.length) {
       throw new Error(`Missing required env vars: ${missing.join(', ')}`);
     }
   }
   ```

### Error Recovery
1. Implement backoff for monitoring:
   ```typescript
   class MonitoringService {
     private async flushWithBackoff(retries = 3) {
       for (let i = 0; i < retries; i++) {
         try {
           await this.flush();
           break;
         } catch (error) {
           if (i === retries - 1) throw error;
           await sleep(Math.pow(2, i) * 1000);
         }
       }
     }
   }
   ```

2. Graceful degradation:
   ```typescript
   // Fall back to local storage if Redis fails
   const storage = redis.isReady ? redis : new LocalStorage();
   ```

### Development Workflow
1. Use consistent ports:
   - Backend: 3001
   - Frontend: 3000
   - Redis: 6379
   - Metrics: 9090

2. Standard startup:
   ```bash
   # Start all services
   docker-compose up -d redis
   npm run dev
   ``` 