import { MetricsAdapter } from '../adapter';
import type { MonitoringService } from '../service';

describe('MetricsAdapter', () => {
  let adapter: MetricsAdapter;
  let mockMonitoring: jest.Mocked<MonitoringService>;

  beforeEach(() => {
    mockMonitoring = {
      recordMetric: jest.fn().mockResolvedValue(undefined)
    } as unknown as jest.Mocked<MonitoringService>;

    adapter = new MetricsAdapter(mockMonitoring);
  });

  describe('recordMetric', () => {
    it('should forward metric recording to monitoring service', async () => {
      const metric = {
        name: 'test_metric',
        value: 42,
        labels: { test: 'true' }
      };

      await adapter.recordMetric(
        metric.name,
        metric.value,
        metric.labels
      );

      expect(mockMonitoring.recordMetric).toHaveBeenCalledWith(
        metric.name,
        metric.value,
        metric.labels
      );
    });

    it('should handle missing labels', async () => {
      await adapter.recordMetric('test_metric', 42);

      expect(mockMonitoring.recordMetric).toHaveBeenCalledWith(
        'test_metric',
        42,
        {}
      );
    });
  });

  describe('registerMetric', () => {
    it('should not throw when registering metrics', () => {
      expect(() => {
        adapter.registerMetric({
          name: 'test_metric',
          help: 'Test metric',
          type: 'gauge'
        });
      }).not.toThrow();
    });
  });
}); 