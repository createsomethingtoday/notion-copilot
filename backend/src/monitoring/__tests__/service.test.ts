import { MonitoringService } from '../service';
import { MetricType, MetricCategory, AlertSeverity } from '../types';
import type { Metric, AlertConfig } from '../types';

describe('MonitoringService', () => {
  let monitoring: MonitoringService;

  beforeEach(() => {
    monitoring = new MonitoringService({
      provider: 'datadog',
      apiKey: 'test',
      flushIntervalMs: 100,
      batchSize: 10
    });
  });

  afterEach(async () => {
    await monitoring.destroy();
  });

  describe('metric recording', () => {
    it('should record and buffer metrics', async () => {
      const metric = {
        name: 'test_metric',
        value: 42,
        labels: { test: 'true' }
      };

      await monitoring.recordMetric(
        metric.name,
        metric.value,
        metric.labels
      );

      const values = await monitoring.getMetricValues(
        metric.name,
        new Date(Date.now() - 1000),
        new Date()
      );

      expect(values).toHaveLength(1);
      expect(values[0].value).toBe(metric.value);
      expect(values[0].labels).toEqual(metric.labels);
    });

    it('should flush metrics when buffer is full', async () => {
      const metrics = Array.from({ length: 11 }, (_, i) => ({
        name: 'test_metric',
        value: i,
        labels: { index: String(i) }
      }));

      // Record more metrics than batch size
      await Promise.all(
        metrics.map(m => 
          monitoring.recordMetric(m.name, m.value, m.labels)
        )
      );

      // Wait for flush
      await new Promise(resolve => setTimeout(resolve, 200));

      const values = await monitoring.getMetricValues(
        'test_metric',
        new Date(Date.now() - 1000),
        new Date()
      );

      expect(values).toHaveLength(11);
    });
  });

  describe('alerts', () => {
    const alertConfig: AlertConfig = {
      name: 'test_alert',
      description: 'Test alert',
      severity: AlertSeverity.WARNING,
      condition: {
        metric: 'test_metric',
        operator: '>',
        threshold: 100,
        duration: 1
      }
    };

    beforeEach(() => {
      monitoring.addAlertConfig(alertConfig);
    });

    it('should trigger alert when condition is met', async () => {
      await monitoring.recordMetric('test_metric', 150);

      // Wait for alert check
      await new Promise(resolve => setTimeout(resolve, 1100));

      const alerts = monitoring.getAlerts();
      expect(alerts).toHaveLength(1);
      expect(alerts[0].config.name).toBe(alertConfig.name);
      expect(alerts[0].value).toBe(150);
    });

    it('should resolve alert when condition is no longer met', async () => {
      // First trigger alert
      await monitoring.recordMetric('test_metric', 150);
      await new Promise(resolve => setTimeout(resolve, 1100));

      // Then resolve it
      await monitoring.recordMetric('test_metric', 50);
      await new Promise(resolve => setTimeout(resolve, 1100));

      const alerts = monitoring.getAlerts();
      expect(alerts[0].resolved).toBeDefined();
    });
  });

  describe('performance tracking', () => {
    it('should track operation duration', () => {
      monitoring.trackPerformance('test_op', 100, true);

      const metrics = monitoring['metrics'] as Metric[];
      const perfMetric = metrics.find(m => 
        m.name === 'operation_duration' && 
        m.category === MetricCategory.PERFORMANCE
      );

      expect(perfMetric).toBeDefined();
      expect(perfMetric?.type).toBe(MetricType.HISTOGRAM);
      expect(perfMetric?.value).toBe(100);
      expect(perfMetric?.labels?.operation).toBe('test_op');
      expect(perfMetric?.labels?.success).toBe('true');
    });
  });

  describe('resource tracking', () => {
    it('should track resource usage', () => {
      monitoring.trackResource('memory', 1024, 2048);

      const metrics = monitoring['metrics'] as Metric[];
      const resourceMetric = metrics.find(m => 
        m.name === 'resource_usage' && 
        m.category === MetricCategory.RESOURCE
      );

      expect(resourceMetric).toBeDefined();
      expect(resourceMetric?.type).toBe(MetricType.GAUGE);
      expect(resourceMetric?.value).toBe(1024);
      expect(resourceMetric?.labels?.resource).toBe('memory');
    });
  });
}); 