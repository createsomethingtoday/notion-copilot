import { CircuitBreaker } from '../utils/circuit-breaker';
import { Logger } from '../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../errors/types';
import type { MetricProvider, MetricValue } from './providers/types';
import { ConsoleProvider } from './providers/console';
import { DatadogProvider } from './providers/datadog';

export interface SystemMetricsOptions {
  memoryUsage?: boolean;
  cpuUsage?: boolean;
  eventLoopLag?: boolean;
  activeHandles?: boolean;
}

export interface MonitoringOptions {
  provider: 'console' | 'datadog';
  apiKey?: string;
  flushIntervalMs?: number;
  batchSize?: number;
  deduplicate?: boolean;
  systemMetrics?: SystemMetricsOptions;
  maxRetries?: number;
  retryDelayMs?: number;
  healthCheckIntervalMs?: number;
}

export class MonitoringService {
  private readonly metrics = new Map<string, MetricValue[]>();
  private readonly provider: MetricProvider;
  private readonly flushInterval: NodeJS.Timeout;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly options: Required<MonitoringOptions>;
  private readonly logger: Logger;
  private healthCheckInterval?: NodeJS.Timeout;
  private lastFlushTime?: number;
  private consecutiveFailures = 0;
  private isRecovering = false;

  constructor(options: MonitoringOptions) {
    this.options = {
      provider: options.provider,
      apiKey: options.apiKey ?? '',
      flushIntervalMs: options.flushIntervalMs ?? 10000,
      batchSize: options.batchSize ?? 100,
      deduplicate: options.deduplicate ?? true,
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      healthCheckIntervalMs: options.healthCheckIntervalMs ?? 30000,
      systemMetrics: {
        memoryUsage: options.systemMetrics?.memoryUsage ?? true,
        cpuUsage: options.systemMetrics?.cpuUsage ?? true,
        eventLoopLag: options.systemMetrics?.eventLoopLag ?? true,
        activeHandles: options.systemMetrics?.activeHandles ?? true
      }
    };

    this.logger = new Logger('MonitoringService');
    this.provider = this.createProvider(this.options);
    
    this.circuitBreaker = new CircuitBreaker('monitoring', {
      maxFailures: 3,
      resetTimeoutMs: 60000,
      halfOpenMaxAttempts: 2,
      monitorIntervalMs: this.options.healthCheckIntervalMs
    }, this.logger);

    this.flushInterval = setInterval(() => {
      this.flush().catch(err => {
        this.logger.error('Failed to flush metrics', { errorMessage: err instanceof Error ? err.message : String(err) });
      });
    }, this.options.flushIntervalMs);

    this.startHealthCheck();
    this.startSystemMetrics();
  }

  private createProvider(options: Required<MonitoringOptions>): MetricProvider {
    switch (options.provider) {
      case 'datadog':
        if (!options.apiKey) {
          throw new NotionAssistantError(
            'Datadog API key is required',
            ErrorCode.CONFIGURATION_ERROR,
            ErrorSeverity.ERROR,
            false
          );
        }
        return new DatadogProvider(options.apiKey);
      case 'console':
        return new ConsoleProvider();
      default:
        throw new NotionAssistantError(
          `Unknown monitoring provider: ${options.provider}`,
          ErrorCode.CONFIGURATION_ERROR,
          ErrorSeverity.ERROR,
          false
        );
    }
  }

  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck().catch(err => {
        this.logger.error('Health check failed', { errorMessage: err instanceof Error ? err.message : String(err) });
      });
    }, this.options.healthCheckIntervalMs);
  }

  private async performHealthCheck(): Promise<void> {
    // Check last flush time
    if (this.lastFlushTime) {
      const timeSinceLastFlush = Date.now() - this.lastFlushTime;
      if (timeSinceLastFlush > this.options.flushIntervalMs * 2) {
        this.logger.warn('Metrics flush delayed', { timeSinceLastFlush });
        await this.attemptRecovery();
      }
    }

    // Check circuit breaker state
    const circuitBreakerState = (this.circuitBreaker as unknown as { state: string }).state;
    if (circuitBreakerState === 'open') {
      this.logger.warn('Circuit breaker is open, attempting recovery');
      await this.attemptRecovery();
    }
  }

  private async attemptRecovery(): Promise<void> {
    if (this.isRecovering) return;
    this.isRecovering = true;

    try {
      // Reset provider connection
      if ('reset' in this.provider && typeof this.provider.reset === 'function') {
        await this.provider.reset();
      }

      // Attempt to flush metrics
      await this.flush();
      
      this.consecutiveFailures = 0;
      this.logger.info('Monitoring service recovered successfully');
    } catch (err) {
      this.consecutiveFailures++;
      this.logger.error('Recovery attempt failed', { 
        errorMessage: err instanceof Error ? err.message : String(err),
        consecutiveFailures: this.consecutiveFailures 
      });

      if (this.consecutiveFailures >= this.options.maxRetries) {
        this.logger.error('Max recovery attempts reached');
      }
    } finally {
      this.isRecovering = false;
    }
  }

  private startSystemMetrics(): void {
    if (this.options.systemMetrics.memoryUsage) {
      setInterval(() => {
        const usage = process.memoryUsage();
        this.gauge('memory.heap_used', usage.heapUsed);
        this.gauge('memory.heap_total', usage.heapTotal);
        this.gauge('memory.rss', usage.rss);
      }, 30000);
    }

    if (this.options.systemMetrics.cpuUsage) {
      let lastCpuUsage = process.cpuUsage();
      setInterval(() => {
        const usage = process.cpuUsage(lastCpuUsage);
        this.gauge('cpu.user', usage.user);
        this.gauge('cpu.system', usage.system);
        lastCpuUsage = process.cpuUsage();
      }, 30000);
    }

    if (this.options.systemMetrics.eventLoopLag) {
      setInterval(() => {
        const start = Date.now();
        setImmediate(() => {
          const lag = Date.now() - start;
          this.gauge('eventloop.lag', lag);
        });
      }, 30000);
    }

    if (this.options.systemMetrics.activeHandles) {
      setInterval(() => {
        const handles = process._getActiveHandles();
        if (handles) {
          this.gauge('handles.active', handles.length);
        }
      }, 30000);
    }
  }

  public gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: 'gauge',
      timestamp: Date.now(),
      tags
    });
  }

  public increment(name: string, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value: 1,
      type: 'counter',
      timestamp: Date.now(),
      tags
    });
  }

  public histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      type: 'histogram',
      timestamp: Date.now(),
      tags
    });
  }

  private recordMetric(metric: MetricValue): void {
    const metrics = this.metrics.get(metric.name) ?? [];
    metrics.push(metric);
    this.metrics.set(metric.name, metrics);
  }

  public async flush(): Promise<void> {
    if (this.metrics.size === 0) return;

    const allMetrics: MetricValue[] = [];
    for (const metrics of this.metrics.values()) {
      if (this.options.deduplicate) {
        // Only keep the latest value for each unique combination of name and tags
        const latest = new Map<string, MetricValue>();
        for (const metric of metrics) {
          const key = `${metric.name}:${JSON.stringify(metric.tags)}`;
          latest.set(key, metric);
        }
        allMetrics.push(...Array.from(latest.values()));
      } else {
        allMetrics.push(...metrics);
      }
    }

    try {
      await this.circuitBreaker.execute(async () => {
        await this.provider.sendMetrics(allMetrics);
      });
      this.metrics.clear();
      this.lastFlushTime = Date.now();
      this.consecutiveFailures = 0;
    } catch (err) {
      this.consecutiveFailures++;
      if (err instanceof NotionAssistantError) {
        throw err;
      }
      throw new NotionAssistantError(
        'Failed to flush metrics',
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorSeverity.ERROR,
        true,
        { errorMessage: err instanceof Error ? err.message : String(err) }
      );
    }
  }

  public destroy(): void {
    clearInterval(this.flushInterval);
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    this.circuitBreaker.destroy();
    if ('destroy' in this.provider && typeof this.provider.destroy === 'function') {
      this.provider.destroy();
    }
  }
} 