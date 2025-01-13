import type { Logger } from '../utils/logger';
import { NotionAssistantError } from '../errors/types';
import { ErrorCode, ErrorSeverity } from '../errors/types';

export interface MetricValue {
  name: string;
  value: number;
  type: 'counter' | 'gauge';
  timestamp: number;
  tags?: Record<string, string>;
}

export interface MetricProvider {
  sendMetrics(metrics: MetricValue[]): Promise<void>;
  reset(): void;
}

export class ConsoleMetricProvider implements MetricProvider {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger;
  }

  async sendMetrics(metrics: MetricValue[]): Promise<void> {
    this.logger.info('Sending metrics', { metrics });
  }

  reset(): void {
    // No-op for console provider
  }
}

export interface MonitoringOptions {
  logger: Logger;
  provider?: MetricProvider;
  flushIntervalMs?: number;
  batchSize?: number;
}

export class MonitoringService {
  private readonly logger: Logger;
  private readonly provider: MetricProvider;
  private readonly flushIntervalMs: number;
  private readonly batchSize: number;
  private metrics: MetricValue[] = [];
  private flushInterval?: NodeJS.Timeout;
  private consecutiveFailures = 0;
  private readonly maxConsecutiveFailures = 3;

  constructor(options: MonitoringOptions) {
    this.logger = options.logger;
    this.provider = options.provider || new ConsoleMetricProvider(options.logger);
    this.flushIntervalMs = options.flushIntervalMs || 10000;
    this.batchSize = options.batchSize || 100;
    this.startFlushInterval();
  }

  private startFlushInterval(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    this.flushInterval = setInterval(() => this.flush(), this.flushIntervalMs);
  }

  async recordMetric(metric: MetricValue): Promise<void> {
    this.metrics.push(metric);
    if (this.metrics.length >= this.batchSize) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.metrics.length === 0) {
      return;
    }

    const metricsToSend = [...this.metrics];
    this.metrics = [];

    try {
      await this.provider.sendMetrics(metricsToSend);
      this.consecutiveFailures = 0;
    } catch (error) {
      this.consecutiveFailures++;
      this.metrics.push(...metricsToSend);
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to flush metrics', { 
        errorMessage,
        consecutiveFailures: this.consecutiveFailures 
      });

      if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
        this.provider.reset();
        this.metrics = [];
        throw new NotionAssistantError(
          'Max consecutive failures reached for metric flushing',
          ErrorCode.SERVICE_UNAVAILABLE,
          ErrorSeverity.ERROR,
          true,
          { consecutiveFailures: this.consecutiveFailures }
        );
      }
    }
  }

  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    await this.flush();
  }

  // ... rest of the file unchanged ...
} 