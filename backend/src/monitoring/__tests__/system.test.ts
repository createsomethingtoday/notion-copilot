import { SystemMetricsCollector } from '../system';
import { MetricsAdapter } from '../adapter';
import type { MonitoringService } from '../service';

describe('SystemMetricsCollector', () => {
  let collector: SystemMetricsCollector;
  let mockMetrics: MetricsAdapter;

  beforeEach(() => {
    const mockMonitoring = {
      recordMetric: jest.fn().mockResolvedValue(undefined)
    } as unknown as MonitoringService;

    mockMetrics = new MetricsAdapter(mockMonitoring);
    jest.spyOn(mockMetrics, 'recordMetric');
    jest.spyOn(mockMetrics, 'registerMetric');

    collector = new SystemMetricsCollector(mockMetrics, {
      collectIntervalMs: 100,
      enableGCMetrics: false
    });
  });

  afterEach(() => {
    collector.stop();
  });

  describe('memory metrics', () => {
    it('should collect memory usage metrics', async () => {
      type PrivateCollector = {
        collectMemoryMetrics(): Promise<void>;
      };

      await (collector as unknown as PrivateCollector).collectMemoryMetrics();

      // Should record heap metrics
      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_memory_usage',
        expect.any(Number),
        { type: 'heap' }
      );

      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_memory_usage',
        expect.any(Number),
        { type: 'heap_total' }
      );

      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_memory_usage',
        expect.any(Number),
        { type: 'rss' }
      );

      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_memory_usage',
        expect.any(Number),
        { type: 'v8_heap_used' }
      );
    });
  });

  describe('CPU metrics', () => {
    it('should collect CPU usage metrics', async () => {
      type PrivateCollector = {
        collectCPUMetrics(): Promise<void>;
      };

      await (collector as unknown as PrivateCollector).collectCPUMetrics();

      // Should record process CPU usage
      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_cpu_usage',
        expect.any(Number),
        { type: 'process' }
      );

      // Should record system CPU usage
      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_cpu_usage',
        expect.any(Number),
        { type: 'system_1m' }
      );
    });
  });

  describe('event loop metrics', () => {
    it('should collect event loop lag metrics', async () => {
      type PrivateCollector = {
        collectEventLoopMetrics(): Promise<void>;
      };

      await (collector as unknown as PrivateCollector).collectEventLoopMetrics();

      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_event_loop_lag',
        expect.any(Number)
      );

      // Lag should be a reasonable value
      const lagCall = (mockMetrics.recordMetric as jest.Mock).mock.calls.find(
        call => call[0] === 'system_event_loop_lag'
      );
      expect(lagCall?.[1]).toBeGreaterThanOrEqual(0);
      expect(lagCall?.[1]).toBeLessThanOrEqual(100);
    });
  });

  describe('handle metrics', () => {
    it('should collect active handle metrics', async () => {
      type PrivateCollector = {
        collectHandleMetrics(): Promise<void>;
      };

      await (collector as unknown as PrivateCollector).collectHandleMetrics();

      expect(mockMetrics.recordMetric).toHaveBeenCalledWith(
        'system_active_handles',
        expect.any(Number)
      );

      // Should be a non-negative integer
      const handleCall = (mockMetrics.recordMetric as jest.Mock).mock.calls.find(
        call => call[0] === 'system_active_handles'
      );
      expect(handleCall?.[1]).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(handleCall?.[1])).toBe(true);
    });
  });

  describe('collection lifecycle', () => {
    it('should start and stop collection', async () => {
      type PrivateCollector = {
        collectMetrics(): Promise<void>;
      };

      const spy = jest.spyOn(
        collector as unknown as PrivateCollector,
        'collectMetrics'
      );

      collector.start();
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(spy).toHaveBeenCalled();

      collector.stop();
      spy.mockClear();

      await new Promise(resolve => setTimeout(resolve, 150));
      expect(spy).not.toHaveBeenCalled();
    });
  });
}); 