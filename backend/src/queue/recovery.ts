import type { Task, TaskResult } from '../agent/types';
import type { StorageAdapter } from '../agent/storage/types';
import { Logger } from '../utils/logger';
import type { ErrorRecoveryStrategy, NotionAssistantError, ErrorCode } from '../errors/types';
import { DEFAULT_RECOVERY_STRATEGIES } from '../errors/types';

export interface RecoveryOptions {
  maxRetries?: number;
  retryDelayMs?: number;
  recoveryWindowMs?: number;
  healthCheckIntervalMs?: number;
}

export class TaskRecoveryManager {
  private readonly logger: Logger;
  private readonly storage: StorageAdapter;
  private readonly options: Required<RecoveryOptions>;
  private healthCheckInterval?: NodeJS.Timeout;

  constructor(storage: StorageAdapter, options: RecoveryOptions = {}) {
    this.storage = storage;
    this.logger = new Logger('TaskRecoveryManager');
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 5000,
      recoveryWindowMs: options.recoveryWindowMs ?? 30 * 60 * 1000, // 30 minutes
      healthCheckIntervalMs: options.healthCheckIntervalMs ?? 60 * 1000 // 1 minute
    };
  }

  /**
   * Start recovery monitoring
   */
  start(): void {
    if (this.healthCheckInterval) return;

    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.options.healthCheckIntervalMs
    );

    this.logger.info('Recovery monitoring started', {
      checkInterval: this.options.healthCheckIntervalMs
    });
  }

  /**
   * Stop recovery monitoring
   */
  stop(): void {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
      this.logger.info('Recovery monitoring stopped');
    }
  }

  /**
   * Perform health check and recover tasks if needed
   */
  private async performHealthCheck(): Promise<void> {
    try {
      const activeTasks = await this.storage.getActiveTasks();
      const now = Date.now();

      for (const task of activeTasks) {
        // Check for stuck tasks
        const taskAge = now - (task.updated?.getTime() ?? task.created?.getTime() ?? now);
        if (taskAge > this.options.recoveryWindowMs) {
          await this.recoverTask(task);
        }
      }
    } catch (error) {
      this.logger.error('Error during health check', error as Error);
    }
  }

  /**
   * Recover a failed or stuck task
   */
  private async recoverTask(task: Task): Promise<void> {
    this.logger.info(`Attempting to recover task: ${task.id}`, {
      type: task.type,
      status: task.status
    });

    // Get recovery strategy
    const strategy = this.getRecoveryStrategy(task);
    if (!strategy.retryable || (task.retryCount ?? 0) >= (strategy.maxRetries ?? this.options.maxRetries)) {
      await this.markTaskAsFailed(task);
      return;
    }

    // Reset task for retry
    task.status = 'pending';
    task.retryCount = (task.retryCount ?? 0) + 1;
    task.updated = new Date();

    await this.storage.updateTask(task.id, task);
    this.logger.info(`Task ${task.id} recovered and requeued`, {
      retryCount: task.retryCount
    });
  }

  /**
   * Get recovery strategy for a task
   */
  private getRecoveryStrategy(task: Task): ErrorRecoveryStrategy {
    if (!task.error) {
      // Default strategy for stuck tasks
      return {
        retryable: true,
        maxRetries: this.options.maxRetries,
        backoffMs: this.options.retryDelayMs
      };
    }

    // Get strategy based on error code if available
    const error = task.error as NotionAssistantError;
    if (error.code && error.code in DEFAULT_RECOVERY_STRATEGIES) {
      return DEFAULT_RECOVERY_STRATEGIES[error.code as ErrorCode];
    }

    // Default strategy for unknown errors
    return {
      retryable: true,
      maxRetries: 1,
      backoffMs: this.options.retryDelayMs
    };
  }

  /**
   * Mark a task as permanently failed
   */
  private async markTaskAsFailed(task: Task): Promise<void> {
    task.status = 'failed';
    task.updated = new Date();
    await this.storage.updateTask(task.id, task);

    this.logger.warn(`Task ${task.id} marked as failed`, {
      type: task.type,
      retryCount: task.retryCount,
      error: task.error?.message
    });
  }
} 