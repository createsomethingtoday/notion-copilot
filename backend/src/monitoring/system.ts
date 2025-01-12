import { performance, PerformanceObserver } from 'node:perf_hooks';
import { getHeapStatistics } from 'node:v8';
import { loadavg } from 'node:os';
import type { MetricsAdapter } from './adapter';

// Internal Node.js types
interface NodeProcess {
  _getActiveHandles(): unknown[];
}

// Define gc function type
type GCFunction = () => void;

// Extend NodeJS.Global
declare global {
  interface NodeJS {
    gc?: GCFunction;
  }
}

export class SystemMetricsCollector {
  private collectInterval?: NodeJS.Timeout;
  private lastCPUUsage = process.cpuUsage();
  private lastGCStats = performance.nodeTiming;

  constructor(
    private readonly metrics: MetricsAdapter,
    private readonly options: {
      collectIntervalMs?: number;
      enableGCMetrics?: boolean;
    } = {}
  ) {
    // Default to 10 second collection interval
    this.options.collectIntervalMs = options.collectIntervalMs ?? 10000;
    this.options.enableGCMetrics = options.enableGCMetrics ?? true;

    if (this.options.enableGCMetrics) {
      this.setupGCMetrics();
    }
  }

  /**
   * Start collecting metrics
   */
  start(): void {
    this.collectMetrics();
    this.collectInterval = setInterval(() => {
      this.collectMetrics();
    }, this.options.collectIntervalMs);
    this.collectInterval.unref();
  }

  /**
   * Stop collecting metrics
   */
  stop(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
    }
  }

  /**
   * Collect all system metrics
   */
  private async collectMetrics(): Promise<void> {
    await Promise.all([
      this.collectMemoryMetrics(),
      this.collectCPUMetrics(),
      this.collectEventLoopMetrics(),
      this.collectHandleMetrics()
    ]);
  }

  /**
   * Collect memory metrics
   */
  private async collectMemoryMetrics(): Promise<void> {
    const memoryUsage = process.memoryUsage();
    
    await this.metrics.recordMetric('system_memory_usage', memoryUsage.heapUsed, {
      type: 'heap'
    });

    await this.metrics.recordMetric('system_memory_usage', memoryUsage.heapTotal, {
      type: 'heap_total'
    });

    await this.metrics.recordMetric('system_memory_usage', memoryUsage.rss, {
      type: 'rss'
    });

    // V8 heap statistics
    const heapStats = getHeapStatistics();
    await this.metrics.recordMetric('system_memory_usage', heapStats.used_heap_size, {
      type: 'v8_heap_used'
    });
  }

  /**
   * Collect CPU metrics
   */
  private async collectCPUMetrics(): Promise<void> {
    const currentCPUUsage = process.cpuUsage(this.lastCPUUsage);
    this.lastCPUUsage = process.cpuUsage();

    const totalCPUTime = currentCPUUsage.user + currentCPUUsage.system;
    const cpuPercent = (totalCPUTime / (this.options.collectIntervalMs || 10000)) * 100;

    await this.metrics.recordMetric('system_cpu_usage', cpuPercent, {
      type: 'process'
    });

    // System-wide CPU usage
    const [oneMinLoad] = loadavg();
    await this.metrics.recordMetric('system_cpu_usage', oneMinLoad, {
      type: 'system_1m'
    });
  }

  /**
   * Collect event loop metrics
   */
  private async collectEventLoopMetrics(): Promise<void> {
    const start = performance.now();
    
    await new Promise(resolve => setTimeout(resolve, 0));
    
    const lag = performance.now() - start;
    await this.metrics.recordMetric('system_event_loop_lag', lag);
  }

  /**
   * Collect handle metrics
   */
  private async collectHandleMetrics(): Promise<void> {
    // Cast process to access internal method
    const proc = process as unknown as NodeProcess;
    const activeHandles = proc._getActiveHandles().length;
    await this.metrics.recordMetric('system_active_handles', activeHandles);
  }

  /**
   * Set up garbage collection metrics
   */
  private setupGCMetrics(): void {
    if (typeof gc === 'function') {
      performance.timerify(gc);
      
      const observer = new PerformanceObserver((list) => {
        const entry = list.getEntries()[0];
        void this.metrics.recordMetric('system_gc_duration', entry.duration, {
          type: entry.name
        });
      });
      
      observer.observe({ entryTypes: ['function'], buffered: true });
    }
  }
} 