import type { Logger } from '@/logger';
import { getLogger } from '@/logger';
import type { DeadLetterQueue } from './dead-letter-queue';
import type { MonitoringService } from '@/monitoring/service';

export interface CleanupJobConfig {
  /**
   * How often to run the cleanup job in milliseconds
   */
  intervalMs: number;
}

/**
 * Periodically cleans up old tasks from the dead letter queue
 */
export class CleanupJob {
  private readonly logger: Logger;
  private isRunning = false;
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly deadLetterQueue: DeadLetterQueue,
    private readonly config: CleanupJobConfig,
    private readonly monitoring: MonitoringService
  ) {
    this.logger = getLogger('CleanupJob');
  }

  /**
   * Starts the cleanup job
   */
  public start(): void {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logger.info('Cleanup job started', {
      intervalMs: this.config.intervalMs
    });

    // Run cleanup immediately then schedule recurring cleanup
    this.runCleanup();
    this.timer = setInterval(() => this.runCleanup(), this.config.intervalMs);
  }

  /**
   * Stops the cleanup job
   */
  public stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }

    this.logger.info('Cleanup job stopped');
  }

  /**
   * Runs a single cleanup iteration
   */
  private async runCleanup(): Promise<void> {
    try {
      const startTime = Date.now();
      const tasksBeforeCleanup = await this.deadLetterQueue.getTasks();
      await this.deadLetterQueue.cleanup();
      const tasksAfterCleanup = await this.deadLetterQueue.getTasks();
      const duration = Date.now() - startTime;

      // Track cleanup metrics
      this.monitoring.recordMetric('dlq_cleanup_duration', duration);
      this.monitoring.recordMetric('dlq_tasks_cleaned', tasksBeforeCleanup.length - tasksAfterCleanup.length);
      this.monitoring.recordMetric('dlq_tasks_remaining', tasksAfterCleanup.length);
      
      // Track cleanup success
      this.monitoring.incrementCounter('dlq_cleanup_success');

      this.logger.info('Cleanup completed', {
        durationMs: duration,
        tasksCleaned: tasksBeforeCleanup.length - tasksAfterCleanup.length,
        tasksRemaining: tasksAfterCleanup.length
      });
    } catch (error) {
      // Track cleanup failure
      this.monitoring.incrementCounter('dlq_cleanup_failure');
      
      this.logger.error('Cleanup failed', error as Error);
    }
  }
} 