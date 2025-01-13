import { Logger } from '../../utils/logger';
import type { MetricProvider, MetricValue } from './types';

export class ConsoleProvider implements MetricProvider {
  private readonly logger: Logger;

  constructor() {
    this.logger = new Logger('ConsoleMetricProvider');
  }

  async sendMetrics(metrics: MetricValue[]): Promise<void> {
    this.logger.debug('Metrics received', { metrics });
  }
} 