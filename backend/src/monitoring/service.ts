import type {
  Metric,
  ErrorMetric,
  PerformanceMetric,
  ResourceMetric,
  TaskMetric,
  APIMetric,
  UserMetric,
  Alert,
  AlertConfig,
  MonitoringConfig
} from './types';
import { MetricType, MetricCategory } from './types';
import type { NotionAssistantError } from '../errors/types';
import { ErrorCategory } from '../errors/types';
import { DatadogProvider } from './providers/datadog';

interface ProviderInstance {
  sendMetrics(metrics: Metric[]): Promise<void>;
}

/**
 * Base monitoring service that handles metric collection and alerting
 */
export class MonitoringService {
  private metrics: Metric[] = [];
  private alerts: Alert[] = [];
  private flushInterval?: NodeJS.Timeout;
  private alertCheckInterval?: NodeJS.Timeout;
  private provider?: ProviderInstance;

  constructor(private config: MonitoringConfig) {
    this.setupProvider();
    this.setupIntervals();
  }

  /**
   * Track an error metric
   */
  trackError(error: NotionAssistantError): void {
    const metric: ErrorMetric = {
      name: 'error_occurrence',
      type: MetricType.COUNTER,
      category: MetricCategory.ERROR,
      value: 1,
      timestamp: new Date(),
      error,
      severity: error.severity,
      errorCategory: error.code.split('_')[0].toUpperCase() as ErrorCategory,
      labels: {
        code: error.code,
        recoverable: String(error.recoverable)
      }
    };

    this.addMetric(metric);
  }

  /**
   * Track a performance metric
   */
  trackPerformance(
    operation: string,
    duration: number,
    success: boolean,
    labels?: Record<string, string>
  ): void {
    const metric: PerformanceMetric = {
      name: 'operation_duration',
      type: MetricType.HISTOGRAM,
      category: MetricCategory.PERFORMANCE,
      value: duration,
      timestamp: new Date(),
      operation,
      duration,
      success,
      labels: {
        operation,
        success: String(success),
        ...labels
      }
    };

    this.addMetric(metric);
  }

  /**
   * Track a resource metric
   */
  trackResource(
    resource: string,
    usage: number,
    limit?: number,
    labels?: Record<string, string>
  ): void {
    const metric: ResourceMetric = {
      name: 'resource_usage',
      type: MetricType.GAUGE,
      category: MetricCategory.RESOURCE,
      value: usage,
      timestamp: new Date(),
      resource,
      usage,
      limit,
      labels: {
        resource,
        ...labels
      }
    };

    this.addMetric(metric);
  }

  /**
   * Track a task metric
   */
  trackTask(
    taskType: string,
    duration: number,
    success: boolean,
    retries?: number,
    labels?: Record<string, string>
  ): void {
    const metric: TaskMetric = {
      name: 'task_execution',
      type: MetricType.HISTOGRAM,
      category: MetricCategory.TASK,
      value: duration,
      timestamp: new Date(),
      taskType,
      duration,
      success,
      retries,
      labels: {
        taskType,
        success: String(success),
        ...labels
      }
    };

    this.addMetric(metric);
  }

  /**
   * Track an API metric
   */
  trackAPI(
    endpoint: string,
    method: string,
    statusCode: number,
    duration: number,
    labels?: Record<string, string>
  ): void {
    const metric: APIMetric = {
      name: 'api_request',
      type: MetricType.HISTOGRAM,
      category: MetricCategory.API,
      value: duration,
      timestamp: new Date(),
      endpoint,
      method,
      statusCode,
      duration,
      labels: {
        endpoint,
        method,
        statusCode: String(statusCode),
        ...labels
      }
    };

    this.addMetric(metric);
  }

  /**
   * Track a user metric
   */
  trackUser(
    userId: string,
    action: string,
    success: boolean,
    labels?: Record<string, string>
  ): void {
    const metric: UserMetric = {
      name: 'user_action',
      type: MetricType.COUNTER,
      category: MetricCategory.USER,
      value: 1,
      timestamp: new Date(),
      userId,
      action,
      success,
      labels: {
        userId,
        action,
        success: String(success),
        ...labels
      }
    };

    this.addMetric(metric);
  }

  /**
   * Add an alert configuration
   */
  addAlertConfig(config: AlertConfig): void {
    this.config.alertConfigs = [
      ...(this.config.alertConfigs || []),
      config
    ];
  }

  /**
   * Remove an alert configuration
   */
  removeAlertConfig(name: string): void {
    if (!this.config.alertConfigs) return;
    this.config.alertConfigs = this.config.alertConfigs.filter(
      config => config.name !== name
    );
  }

  /**
   * Get current alerts
   */
  getAlerts(): Alert[] {
    return this.alerts;
  }

  /**
   * Clean up resources
   */
  async destroy(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }
    if (this.alertCheckInterval) {
      clearInterval(this.alertCheckInterval);
    }
    await this.flush();
  }

  /**
   * Add a metric to the buffer
   */
  private addMetric(metric: Metric): void {
    // Add global tags
    if (this.config.tags) {
      metric.labels = {
        ...this.config.tags,
        ...metric.labels
      };
    }

    this.metrics.push(metric);

    // Check if we need to flush
    if (this.metrics.length >= (this.config.batchSize ?? 100)) {
      void this.flush();
    }
  }

  /**
   * Flush metrics to the monitoring provider
   */
  private async flush(): Promise<void> {
    if (this.metrics.length === 0) return;

    const metrics = [...this.metrics];
    this.metrics = [];

    try {
      await this.sendMetrics(metrics);
    } catch (error) {
      // If flush fails, add back to buffer
      this.metrics = [...metrics, ...this.metrics];
      console.error('Failed to flush metrics:', error);
    }
  }

  /**
   * Set up the monitoring provider
   */
  private setupProvider(): void {
    switch (this.config.provider) {
      case 'datadog':
        if (!this.config.apiKey) {
          throw new Error('Datadog API key is required');
        }
        this.provider = new DatadogProvider({
          apiKey: this.config.apiKey,
          appKey: this.config.apiKey,
          tags: this.config.tags
        });
        break;
      // Add other providers here
    }
  }

  /**
   * Send metrics to the monitoring provider
   */
  private async sendMetrics(metrics: Metric[]): Promise<void> {
    if (!this.provider) {
      console.warn('No monitoring provider configured');
      return;
    }

    await this.provider.sendMetrics(metrics);
  }

  /**
   * Check for alerts based on current metrics
   */
  private async checkAlerts(): Promise<void> {
    if (!this.config.alertConfigs) return;

    const now = new Date();
    const alertableMetrics = this.metrics.reduce((acc, metric) => {
      if (!acc[metric.name]) {
        acc[metric.name] = [];
      }
      acc[metric.name].push(metric);
      return acc;
    }, {} as Record<string, Metric[]>);

    // Check each alert configuration
    for (const config of this.config.alertConfigs) {
      const metrics = alertableMetrics[config.condition.metric] || [];
      if (metrics.length === 0) continue;

      // Calculate the metric value based on the metrics
      const value = this.calculateMetricValue(metrics);

      // Check if the condition is met
      const triggered = this.evaluateCondition(config.condition, value);

      if (triggered) {
        // Add new alert if one doesn't exist for this config
        const existingAlert = this.alerts.find(
          alert => alert.config.name === config.name && !alert.resolved
        );

        if (!existingAlert) {
          this.alerts.push({
            config,
            triggered: now,
            value
          });

          // TODO: Send notifications based on channels
        }
      } else {
        // Resolve any existing alerts for this config
        this.alerts = this.alerts.map(alert => {
          if (alert.config.name === config.name && !alert.resolved) {
            return { ...alert, resolved: now };
          }
          return alert;
        });
      }
    }
  }

  /**
   * Calculate a single value from multiple metrics
   */
  private calculateMetricValue(metrics: Metric[]): number {
    // This is a simple implementation - could be more sophisticated
    return metrics.reduce((sum, metric) => sum + metric.value, 0) / metrics.length;
  }

  /**
   * Evaluate an alert condition
   */
  private evaluateCondition(
    condition: AlertConfig['condition'],
    value: number
  ): boolean {
    switch (condition.operator) {
      case '>':
        return value > condition.threshold;
      case '<':
        return value < condition.threshold;
      case '>=':
        return value >= condition.threshold;
      case '<=':
        return value <= condition.threshold;
      case '==':
        return value === condition.threshold;
      case '!=':
        return value !== condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Set up flush and alert check intervals
   */
  private setupIntervals(): void {
    // Flush metrics periodically
    this.flushInterval = setInterval(() => {
      void this.flush();
    }, this.config.flushIntervalMs ?? 10000);

    // Check alerts periodically
    this.alertCheckInterval = setInterval(() => {
      void this.checkAlerts();
    }, 1000); // Check alerts every second
  }
} 