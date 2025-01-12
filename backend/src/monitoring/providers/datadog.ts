import { client, v2 } from '@datadog/datadog-api-client';
import type { Metric } from '../types';
import { MetricType } from '../types';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../../errors/types';

interface DatadogConfig {
  apiKey: string;
  appKey?: string;
  site?: string;
  tags?: Record<string, string>;
  retryConfig?: {
    maxRetries: number;
    backoffMs: number;
  };
}

type DatadogMetricType = 0 | 1 | 2 | 3; // gauge, counter, rate, histogram

interface DatadogPoint {
  timestamp: number;
  value: number;
}

interface DatadogMetric {
  metric: string;
  type: DatadogMetricType;
  points: DatadogPoint[];
  tags?: string[];
}

export class DatadogProvider {
  private client: v2.MetricsApi;
  private readonly retryConfig: Required<NonNullable<DatadogConfig['retryConfig']>>;

  constructor(private config: DatadogConfig) {
    this.retryConfig = {
      maxRetries: config.retryConfig?.maxRetries ?? 3,
      backoffMs: config.retryConfig?.backoffMs ?? 1000
    };

    const configuration = client.createConfiguration({
      authMethods: {
        apiKeyAuth: config.apiKey,
        appKeyAuth: config.appKey
      }
    });

    this.client = new v2.MetricsApi(configuration);
  }

  /**
   * Send metrics to Datadog
   */
  async sendMetrics(metrics: Metric[]): Promise<void> {
    try {
      // Group metrics by type for batch submission
      const metricsByType = this.groupMetricsByType(metrics);

      // Submit each type of metric
      await Promise.all([
        this.submitGaugeMetrics(metricsByType.get(MetricType.GAUGE) || []),
        this.submitCounterMetrics(metricsByType.get(MetricType.COUNTER) || []),
        this.submitHistogramMetrics(metricsByType.get(MetricType.HISTOGRAM) || [])
      ]);
    } catch (error) {
      throw this.normalizeError(error as Error, {
        metrics: metrics.map(m => m.name)
      });
    }
  }

  /**
   * Group metrics by their type
   */
  private groupMetricsByType(metrics: Metric[]): Map<MetricType, Metric[]> {
    return metrics.reduce((acc, metric) => {
      if (!acc.has(metric.type)) {
        acc.set(metric.type, []);
      }
      acc.get(metric.type)?.push(metric);
      return acc;
    }, new Map<MetricType, Metric[]>());
  }

  /**
   * Submit gauge metrics
   */
  private async submitGaugeMetrics(metrics: Metric[]): Promise<void> {
    if (metrics.length === 0) return;

    const series = metrics.map(metric => ({
      metric: this.formatMetricName(metric.name),
      type: 0 as DatadogMetricType, // gauge
      points: [{
        timestamp: Math.floor(metric.timestamp.getTime() / 1000),
        value: metric.value
      }],
      tags: this.formatTags(metric.labels)
    }));

    await this.submitWithRetry(() => 
      this.client.submitMetrics({
        body: {
          series
        }
      })
    );
  }

  /**
   * Submit counter metrics
   */
  private async submitCounterMetrics(metrics: Metric[]): Promise<void> {
    if (metrics.length === 0) return;

    const series = metrics.map(metric => ({
      metric: this.formatMetricName(metric.name),
      type: 1 as DatadogMetricType, // counter
      points: [{
        timestamp: Math.floor(metric.timestamp.getTime() / 1000),
        value: metric.value
      }],
      tags: this.formatTags(metric.labels)
    }));

    await this.submitWithRetry(() => 
      this.client.submitMetrics({
        body: {
          series
        }
      })
    );
  }

  /**
   * Submit histogram metrics
   */
  private async submitHistogramMetrics(metrics: Metric[]): Promise<void> {
    if (metrics.length === 0) return;

    const series = metrics.map(metric => ({
      metric: this.formatMetricName(metric.name),
      type: 3 as DatadogMetricType, // histogram
      points: [{
        timestamp: Math.floor(metric.timestamp.getTime() / 1000),
        value: metric.value
      }],
      tags: this.formatTags(metric.labels)
    }));

    await this.submitWithRetry(() => 
      this.client.submitMetrics({
        body: {
          series
        }
      })
    );
  }

  /**
   * Submit metrics with retry logic
   */
  private async submitWithRetry<T>(
    operation: () => Promise<T>,
    attempt = 1
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (attempt >= this.retryConfig.maxRetries) {
        throw this.normalizeError(error as Error, { attempt });
      }

      // Wait with exponential backoff
      const delay = this.retryConfig.backoffMs * (2 ** (attempt - 1));
      await new Promise(resolve => setTimeout(resolve, delay));

      // Retry the operation
      return this.submitWithRetry(operation, attempt + 1);
    }
  }

  /**
   * Format metric name to Datadog format
   */
  private formatMetricName(name: string): string {
    return `notion_assistant.${name}`.replace(/[^a-zA-Z0-9_.]/g, '_');
  }

  /**
   * Format tags to Datadog format
   */
  private formatTags(labels?: Record<string, string>): string[] {
    const tags = [];

    // Add global tags
    if (this.config.tags) {
      for (const [key, value] of Object.entries(this.config.tags)) {
        tags.push(`${key}:${value}`);
      }
    }

    // Add metric-specific tags
    if (labels) {
      for (const [key, value] of Object.entries(labels)) {
        tags.push(`${key}:${value}`);
      }
    }

    return tags;
  }

  /**
   * Normalize errors into NotionAssistantError
   */
  private normalizeError(
    error: Error,
    context?: Record<string, unknown>
  ): NotionAssistantError {
    // Handle rate limiting
    if (error.message.includes('rate limit')) {
      return new NotionAssistantError(
        'Datadog rate limit exceeded',
        ErrorCode.RATE_LIMIT_EXCEEDED,
        ErrorSeverity.WARNING,
        true,
        context
      );
    }

    // Handle authentication errors
    if (error.message.includes('authentication') || error.message.includes('403')) {
      return new NotionAssistantError(
        'Datadog authentication failed',
        ErrorCode.UNAUTHORIZED,
        ErrorSeverity.ERROR,
        true,
        context
      );
    }

    // Handle network errors
    if (error.message.includes('network') || error.message.includes('ECONNREFUSED')) {
      return new NotionAssistantError(
        'Datadog network error',
        ErrorCode.NETWORK_UNAVAILABLE,
        ErrorSeverity.ERROR,
        true,
        context
      );
    }

    // Default to internal error
    return new NotionAssistantError(
      `Datadog error: ${error.message}`,
      ErrorCode.INTERNAL_ERROR,
      ErrorSeverity.ERROR,
      false,
      context
    );
  }
} 