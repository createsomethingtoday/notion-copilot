import { MonitoringService } from './service';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../errors/types';

describe('MonitoringService', () => {
  let monitoring: MonitoringService;

  beforeEach(() => {
    monitoring = new MonitoringService({
      provider: 'console',
      apiKey: 'test-key'
    });
  });

  afterEach(() => {
    monitoring.destroy();
  });

  describe('metric recording', () => {
    it('should record gauge metrics', () => {
      monitoring.gauge('test_metric', 42, { tag: 'value' });
      monitoring.gauge('test_metric', 43, { tag: 'value' });
    });

    it('should record counter metrics', () => {
      monitoring.increment('test_counter', { tag: 'value' });
      monitoring.increment('test_counter', { tag: 'value' });
    });

    it('should record histogram metrics', () => {
      monitoring.histogram('test_histogram', 100, { tag: 'value' });
      monitoring.histogram('test_histogram', 200, { tag: 'value' });
    });
  });

  describe('circuit breaker', () => {
    let failingMonitoring: MonitoringService;

    beforeEach(() => {
      failingMonitoring = new MonitoringService({
        provider: 'datadog',
        apiKey: 'invalid-key'
      });
    });

    afterEach(() => {
      failingMonitoring.destroy();
    });

    it('should open circuit after repeated failures', async () => {
      // Record some metrics
      failingMonitoring.gauge('test_metric', 42);
      failingMonitoring.gauge('test_metric', 43);
      
      // Attempt to flush metrics (should fail)
      await expect(failingMonitoring.flush()).rejects.toThrow(NotionAssistantError);
      await expect(failingMonitoring.flush()).rejects.toThrow(NotionAssistantError);
      await expect(failingMonitoring.flush()).rejects.toThrow(NotionAssistantError);
      
      // Circuit should be open now
      await expect(failingMonitoring.flush()).rejects.toThrow('Circuit breaker is open');
    });
  });

  describe('system metrics', () => {
    it('should collect memory metrics', () => {
      const monitoring = new MonitoringService({
        provider: 'console',
        apiKey: 'test-key',
        systemMetrics: {
          memoryUsage: true,
          cpuUsage: false,
          eventLoopLag: false,
          activeHandles: false
        }
      });

      // Wait for metrics collection
      return new Promise(resolve => {
        setTimeout(() => {
          monitoring.destroy();
          resolve(true);
        }, 1100);
      });
    });

    it('should collect CPU metrics', () => {
      const monitoring = new MonitoringService({
        provider: 'console',
        apiKey: 'test-key',
        systemMetrics: {
          memoryUsage: false,
          cpuUsage: true,
          eventLoopLag: false,
          activeHandles: false
        }
      });

      // Wait for metrics collection
      return new Promise(resolve => {
        setTimeout(() => {
          monitoring.destroy();
          resolve(true);
        }, 1100);
      });
    });
  });

  describe('error handling', () => {
    it('should handle provider errors gracefully', async () => {
      const errorMonitoring = new MonitoringService({
        provider: 'datadog',
        apiKey: 'invalid-key'
      });

      errorMonitoring.gauge('test_metric', 42);

      try {
        await errorMonitoring.flush();
      } catch (error) {
        expect(error).toBeInstanceOf(NotionAssistantError);
        expect((error as NotionAssistantError).code).toBe(ErrorCode.UNAUTHORIZED);
      }

      errorMonitoring.destroy();
    });

    it('should handle metric flooding', () => {
      const monitoring = new MonitoringService({
        provider: 'console',
        apiKey: 'test-key',
        batchSize: 2
      });

      // Should trigger flush after batch size
      monitoring.gauge('test_metric', 1);
      monitoring.gauge('test_metric', 2);
      monitoring.gauge('test_metric', 3);

      monitoring.destroy();
    });
  });
}); 