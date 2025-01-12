import { Logger } from '../utils/logger';
import type { PostgresAdapter } from '../db/postgres';

interface MetricValue {
  value: number;
  timestamp: Date;
  labels: Record<string, string>;
}

interface MetricDefinition {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
}

export class MetricsService {
  private readonly logger: Logger;
  private readonly db: PostgresAdapter;
  private readonly metrics: Map<string, MetricDefinition>;
  private readonly cache: Map<string, MetricValue[]>;
  private flushInterval?: ReturnType<typeof setInterval>;

  constructor(db: PostgresAdapter) {
    this.logger = new Logger('MetricsService');
    this.db = db;
    this.metrics = new Map();
    this.cache = new Map();

    // Register default metrics
    this.registerMetric({
      name: 'task_queue_size',
      help: 'Current number of tasks in queue',
      type: 'gauge'
    });

    this.registerMetric({
      name: 'task_processing_duration',
      help: 'Task processing duration in milliseconds',
      type: 'histogram'
    });

    this.registerMetric({
      name: 'task_error_count',
      help: 'Number of task processing errors',
      type: 'counter'
    });

    this.registerMetric({
      name: 'db_connection_count',
      help: 'Number of active database connections',
      type: 'gauge'
    });

    this.registerMetric({
      name: 'db_query_latency',
      help: 'Database query latency in milliseconds',
      type: 'histogram'
    });

    // System metrics
    this.registerMetric({
      name: 'system_memory_usage',
      help: 'System memory usage in bytes',
      type: 'gauge'
    });

    this.registerMetric({
      name: 'system_cpu_usage',
      help: 'System CPU usage percentage',
      type: 'gauge'
    });

    this.registerMetric({
      name: 'system_event_loop_lag',
      help: 'Node.js event loop lag in milliseconds',
      type: 'histogram'
    });

    this.registerMetric({
      name: 'system_gc_duration',
      help: 'Garbage collection duration in milliseconds',
      type: 'histogram'
    });

    this.registerMetric({
      name: 'system_active_handles',
      help: 'Number of active handles (sockets, file descriptors, etc)',
      type: 'gauge'
    });

    // Start periodic flush
    this.startPeriodicFlush();
  }

  /**
   * Register a new metric
   */
  registerMetric(definition: MetricDefinition): void {
    this.metrics.set(definition.name, definition);
    this.cache.set(definition.name, []);
  }

  /**
   * Record a metric value
   */
  async recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    if (!this.metrics.has(name)) {
      throw new Error(`Metric ${name} not registered`);
    }

    const metricValue: MetricValue = {
      value,
      timestamp: new Date(),
      labels
    };

    // Add to cache
    const cached = this.cache.get(name) ?? [];
    cached.push(metricValue);
    this.cache.set(name, cached);

    // If cache gets too large, flush immediately
    if (cached.length >= 100) {
      await this.flushMetric(name);
    }
  }

  /**
   * Start periodic metric flushing
   */
  private startPeriodicFlush(): void {
    const FLUSH_INTERVAL = 60000; // 1 minute

    this.flushInterval = setInterval(async () => {
      try {
        await this.flushAllMetrics();
      } catch (error) {
        this.logger.error('Failed to flush metrics', error as Error);
      }
    }, FLUSH_INTERVAL);

    this.flushInterval.unref();
  }

  /**
   * Flush all metrics to storage
   */
  private async flushAllMetrics(): Promise<void> {
    for (const name of this.metrics.keys()) {
      await this.flushMetric(name);
    }
  }

  /**
   * Flush a specific metric to storage
   */
  private async flushMetric(name: string): Promise<void> {
    const cached = this.cache.get(name);
    if (!cached || cached.length === 0) return;

    try {
      // Save each metric value
      for (const metric of cached) {
        await this.db.saveMetric(name, metric.value, metric.labels);
      }

      // Clear cache after successful save
      this.cache.set(name, []);
    } catch (error) {
      this.logger.error(`Failed to flush metric ${name}`, error as Error);
      throw error;
    }
  }

  /**
   * Get metric values for a time range
   */
  async getMetricValues(
    name: string,
    startTime: Date,
    endTime: Date
  ): Promise<MetricValue[]> {
    if (!this.metrics.has(name)) {
      throw new Error(`Metric ${name} not registered`);
    }

    const metrics = await this.db.getMetrics(name, startTime, endTime);
    return metrics.map(m => ({
      value: m.value,
      timestamp: m.timestamp,
      labels: m.labels
    }));
  }

  /**
   * Stop metric collection
   */
  async shutdown(): Promise<void> {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
    }

    try {
      await this.flushAllMetrics();
      this.logger.info('Metrics flushed and service stopped');
    } catch (error) {
      this.logger.error('Error shutting down metrics service', error as Error);
      throw error;
    }
  }
}

// Export singleton factory
let metricsService: MetricsService | undefined;

export function initializeMetrics(db: PostgresAdapter): MetricsService {
  if (!metricsService) {
    metricsService = new MetricsService(db);
  }
  return metricsService;
}

export function getMetricsService(): MetricsService {
  if (!metricsService) {
    throw new Error('Metrics service not initialized');
  }
  return metricsService;
} 