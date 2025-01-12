# Monitoring and Metrics

## Overview

The monitoring system provides comprehensive observability for the application, with a focus on security events and performance metrics. It currently supports Datadog as the primary monitoring provider.

## Monitoring Service

The `MonitoringService` class (`service.ts`) provides a unified interface for tracking various types of events and metrics:

### API Metrics

```typescript
trackAPI(
  path: string,
  method: string,
  statusCode: number,
  duration: number,
  metadata?: Record<string, string>
)
```

Tracks API request metrics including:
- Request path and method
- Status codes
- Response times
- Custom metadata

### Resource Metrics

```typescript
trackResource(
  resourceType: string,
  current: number,
  max: number,
  metadata?: Record<string, string>
)
```

Monitors resource utilization:
- Rate limit usage
- Queue sizes
- Memory usage
- Custom resources

### Error Tracking

```typescript
trackError(
  error: NotionAssistantError,
  metadata?: Record<string, string>
)
```

Tracks application errors with:
- Error codes and messages
- Severity levels
- Stack traces
- Custom metadata

### User Events

```typescript
trackUser(
  userId: string,
  action: string,
  success: boolean,
  metadata?: Record<string, string>
)
```

Monitors user-related events:
- Authentication attempts
- Registration events
- Profile updates
- Custom user actions

## Rate Limiting Metrics

### Events

1. **Attempts**
   ```typescript
   type: 'rate_limit_attempt'
   prefix: string    // Rate limit group
   ip: string       // Client IP
   ```

2. **Blocks**
   ```typescript
   type: 'rate_limit_blocked'
   prefix: string
   ip: string
   ttl: string      // Remaining block time
   ```

3. **Exceeded**
   ```typescript
   type: 'rate_limit_exceeded'
   prefix: string
   ip: string
   duration: string // Block duration
   ```

4. **Allowed**
   ```typescript
   type: 'rate_limit_allowed'
   prefix: string
   ip: string
   remaining: string // Remaining requests
   ```

### Resource Usage

```typescript
resourceType: 'rate_limit'
current: number    // Current request count
max: number       // Maximum allowed requests
metadata: {
  prefix: string
  ip: string
}
```

## Configuration

The monitoring service is configured with:

```typescript
interface MonitoringConfig {
  provider: 'datadog';
  apiKey: string;
  flushIntervalMs: number;
  batchSize: number;
  tags: Record<string, string>;
}
```

## Best Practices

1. **Metric Naming**
   - Use consistent prefixes
   - Include relevant dimensions
   - Follow naming conventions

2. **Tagging**
   - Tag by environment
   - Tag by service
   - Include relevant metadata

3. **Error Tracking**
   - Include sufficient context
   - Set appropriate severity
   - Group related errors

4. **Resource Monitoring**
   - Track both current and maximum values
   - Include usage percentages
   - Set appropriate thresholds

## Dashboards and Alerts

### Rate Limiting Dashboard

1. **Request Volume**
   - Total attempts by endpoint
   - Success vs blocked rates
   - Geographic distribution

2. **Block Metrics**
   - Block rate over time
   - Block duration distribution
   - Repeat offenders

3. **Resource Usage**
   - Current usage by endpoint
   - Usage patterns over time
   - Peak usage periods

### Recommended Alerts

1. **Security**
   - High block rates
   - Repeated violations
   - Geographic anomalies

2. **Performance**
   - Redis latency
   - Error rates
   - Resource exhaustion

3. **Availability**
   - Redis connectivity
   - Service health
   - Error spikes 