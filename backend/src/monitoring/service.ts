import type { MetricProvider, MetricValue } from './types';
import { DatadogProvider } from './providers/datadog';
import { getLogger } from '../logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../errors/types';
import { CircuitBreaker } from '../utils/circuit-breaker';
import type { Logger } from '@/logger';

const logger = getLogger('MonitoringService');

interface MonitoringOptions {
  provider: 'datadog' | 'console';
  apiKey: string;
  flushIntervalMs?: number;
  batchSize?: number;
  deduplicate?: boolean;
  systemMetrics?: {
    memoryUsage?: boolean;
    cpuUsage?: boolean;
    eventLoopLag?: boolean;
    activeHandles?: boolean;
  };
}

export class MonitoringService {
  private readonly metrics = new Map<string, MetricValue[]>();
  private readonly provider: MetricProvider;
  private readonly flushInterval: NodeJS.Timeout;
  private readonly circuitBreaker: CircuitBreaker;
  private readonly options: Required<MonitoringOptions>;
  private readonly logger: Logger;

  constructor(options: MonitoringOptions) {
    this.options = {
      ...options,
      flushIntervalMs: options.flushIntervalMs ?? 10000,
      batchSize: options.batchSize ?? 100,
      deduplicate: options.deduplicate ?? true,
      systemMetrics: {
        memoryUsage: options.systemMetrics?.memoryUsage ?? true,
        cpuUsage: options.systemMetrics?.cpuUsage ?? true,
        eventLoopLag: options.systemMetrics?.eventLoopLag ?? true,
        activeHandles: options.systemMetrics?.activeHandles ?? true
      }
    };

    this.provider = this.createProvider(this.options);
    this.circuitBreaker = new CircuitBreaker('monitoring', {
      maxFailures: 3,
      resetTimeoutMs: 60000,
      halfOpenMaxAttempts: 2,
      monitorIntervalMs: 30000
    }, logger);

    this.flushInterval = setInterval(() => {
      this.flush().catch(error => {
        logger.error({
          message: 'Failed to flush metrics',
          context: { error }
        });
      });
    }, this.options.flushIntervalMs);

    this.logger = getLogger('MonitoringService');

    if (this.options.systemMetrics.memoryUsage) {
      this.startMemoryMetrics();
    }
    if (this.options.systemMetrics.cpuUsage) {
      this.startCpuMetrics();
    }
    if (this.options.systemMetrics.eventLoopLag) {
      this.startEventLoopMetrics();
    }
    if (this.options.systemMetrics.activeHandles) {
      this.startHandleMetrics();
    }
  }

  private createProvider(options: MonitoringOptions): MetricProvider {
    if (options.provider === 'datadog') {
      if (!options.apiKey) {
        throw new NotionAssistantError(
          'Datadog API key is required',
          ErrorCode.INVALID_INPUT,
          ErrorSeverity.ERROR,
          false
        );
      }
      return new DatadogProvider(options.apiKey);
    }
    return {
      sendMetrics: async (metrics: MetricValue[]) => {
        logger.debug({
          message: 'Console metrics provider',
          context: { metrics }
        });
      }
    };
  }

  private startMemoryMetrics(): void {
    setInterval(() => {
      const usage = process.memoryUsage();
      this.gauge('system_memory_usage', usage.heapUsed / 1024 / 1024, {
        type: 'heap'
      });
      this.gauge('system_memory_usage', usage.heapTotal / 1024 / 1024, {
        type: 'heap_total'
      });
      this.gauge('system_memory_usage', usage.rss / 1024 / 1024, {
        type: 'rss'
      });
    }, 1000);
  }

  private startCpuMetrics(): void {
    let lastCpuUsage = process.cpuUsage();
    let lastHrTime = process.hrtime();

    setInterval(() => {
      const currentCpuUsage = process.cpuUsage();
      const currentHrTime = process.hrtime();

      const elapsedUser = currentCpuUsage.user - lastCpuUsage.user;
      const elapsedSystem = currentCpuUsage.system - lastCpuUsage.system;
      const elapsedHrTime = process.hrtime(lastHrTime);
      const elapsedNanos = elapsedHrTime[0] * 1e9 + elapsedHrTime[1];

      const userPercent = (elapsedUser / elapsedNanos) * 100;
      const systemPercent = (elapsedSystem / elapsedNanos) * 100;

      this.gauge('system_cpu_usage', userPercent, { type: 'user' });
      this.gauge('system_cpu_usage', systemPercent, { type: 'system' });

      lastCpuUsage = currentCpuUsage;
      lastHrTime = currentHrTime;
    }, 1000);
  }

  private startEventLoopMetrics(): void {
    let lastCheck = process.hrtime();

    setInterval(() => {
      const elapsed = process.hrtime(lastCheck);
      const lag = (elapsed[0] * 1e9 + elapsed[1]) / 1e6 - 500;
      this.gauge('system_event_loop_lag', lag);
      lastCheck = process.hrtime();
    }, 500);
  }

  private startHandleMetrics(): void {
    setInterval(() => {
      let handles = 0;
      try {
        handles = process._getActiveHandles()?.length ?? 0;
      } catch {
        // Ignore errors accessing internal API
      }
      this.gauge('system_active_handles', handles);
    }, 1000);
  }

  public increment(metric: string, tags?: Record<string, string>): void {
    this.record({
      name: metric,
      value: 1,
      timestamp: Date.now(),
      tags
    });
  }

  public gauge(metric: string, value: number, tags?: Record<string, string>): void {
    this.record({
      name: metric,
      value,
      timestamp: Date.now(),
      tags
    });
  }

  public histogram(metric: string, value: number, tags?: Record<string, string>): void {
    this.record({
      name: metric,
      value,
      timestamp: Date.now(),
      tags
    });
  }

  private record(metric: MetricValue): void {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, []);
    }
    this.metrics.get(metric.name)?.push(metric);

    if (this.metrics.get(metric.name)?.length === this.options.batchSize) {
      this.flush().catch(error => {
        logger.error({
          message: 'Failed to flush metrics on batch size limit',
          context: { error }
        });
      });
    }
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
    } catch (error) {
      if (error instanceof NotionAssistantError) {
        throw error;
      }
      throw new NotionAssistantError(
        'Failed to flush metrics',
        ErrorCode.SERVICE_UNAVAILABLE,
        ErrorSeverity.ERROR,
        true,
        { error }
      );
    }
  }

  public destroy(): void {
    clearInterval(this.flushInterval);
    this.circuitBreaker.destroy();
    if (this.provider.destroy) {
      this.provider.destroy();
    }
  }

  private collectSystemMetrics(): void {
    // CPU Usage
    const cpuUsage = process.cpuUsage();
    this.gauge('system_cpu_usage', cpuUsage.user + cpuUsage.system);

    // Memory Usage
    const memoryUsage = process.memoryUsage();
    this.gauge('system_memory_usage', memoryUsage.heapUsed);
    this.gauge('system_memory_total', memoryUsage.heapTotal);

    // Event Loop Lag
    const startTime = process.hrtime();
    setImmediate(() => {
      const [seconds, nanoseconds] = process.hrtime(startTime);
      const lag = (seconds * 1e9 + nanoseconds) / 1e6; // Convert to milliseconds
      this.gauge('system_event_loop_lag', lag);
    });

    // Active Handles (connections, timers, etc)
    const activeHandles = process._getActiveHandles?.() ?? [];
    this.gauge('system_active_handles', activeHandles.length);

    // Active Requests
    const activeRequests = process._getActiveRequests?.() ?? [];
    this.gauge('system_active_requests', activeRequests.length);
  }

  /**
   * Records a metric value
   */
  public recordMetric(name: string, value: number, tags?: Record<string, string>): void {
    try {
      if (!this.provider) {
        this.logger.warn('No metric provider configured');
        return;
      }

      this.provider.sendMetrics([{
        name,
        value,
        timestamp: Date.now(),
        tags
      }]);
    } catch (error) {
      this.logger.error('Failed to record metric', error as Error, {
        name,
        value
      });
    }
  }

  /**
   * Increments a counter metric by 1
   */
  public incrementCounter(name: string, tags?: Record<string, string>): void {
    this.recordMetric(name, 1, tags);
  }

  /**
   * Records a gauge metric
   */
  public recordGauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags);
  }

  /**
   * Records a histogram metric
   */
  public recordHistogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(name, value, tags);
  }
} 