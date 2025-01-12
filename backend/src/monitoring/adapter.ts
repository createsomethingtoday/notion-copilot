import type { MonitoringService } from './service';

/**
 * Adapter to make MonitoringService compatible with SystemMetricsCollector
 */
export class MetricsAdapter {
  constructor(private readonly monitoring: MonitoringService) {}

  /**
   * Register a new metric
   */
  registerMetric(definition: { name: string; help: string; type: string }): void {
    // MonitoringService handles registration internally
  }

  /**
   * Record a metric value
   */
  async recordMetric(
    name: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    await this.monitoring.recordMetric(name, value, labels);
  }
} 