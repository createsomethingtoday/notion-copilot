import type { Task } from '../agent/types';
import type { StorageAdapter } from '../agent/storage/types';
import { Logger } from '../utils/logger';
import { NotionAssistantError, ErrorCode, ErrorSeverity } from '../errors/types';

export interface DeadLetterQueueOptions {
  maxSize?: number;
  retentionDays?: number;
  alertThreshold?: number;
}

export class DeadLetterQueue {
  private readonly logger: Logger;
  private readonly options: Required<DeadLetterQueueOptions>;
  private readonly storage: StorageAdapter;

  constructor(storage: StorageAdapter, options: DeadLetterQueueOptions = {}) {
    this.logger = new Logger('DeadLetterQueue');
    this.storage = storage;
    this.options = {
      maxSize: options.maxSize ?? 1000,
      retentionDays: options.retentionDays ?? 30,
      alertThreshold: options.alertThreshold ?? 100
    };
  }

  /**
   * Move a failed task to the dead letter queue
   */
  async moveToDeadLetter(task: Task, error: Error): Promise<void> {
    const deadLetterTasks = await this.storage.getDeadLetterTasks();
    if (deadLetterTasks.length >= this.options.maxSize) {
      throw new NotionAssistantError(
        'Dead letter queue is full',
        ErrorCode.INTERNAL_ERROR,
        ErrorSeverity.ERROR,
        false
      );
    }

    // Update task metadata
    task.status = 'dead_letter';
    task.error = error;
    task.movedToDeadLetterAt = new Date();
    task.updated = new Date();

    await this.storage.moveTaskToDeadLetter(task);

    this.logger.warn({
      message: 'Task moved to dead letter queue',
      context: {
        taskId: task.id,
        type: task.type,
        error: error.message
      }
    });

    // Check if we should alert
    if (deadLetterTasks.length >= this.options.alertThreshold) {
      this.logger.error({
        message: 'Dead letter queue threshold exceeded',
        context: {
          queueSize: deadLetterTasks.length,
          threshold: this.options.alertThreshold
        }
      });
    }
  }

  /**
   * Retry a task from the dead letter queue
   */
  async retryTask(taskId: string): Promise<void> {
    const task = await this.storage.getDeadLetterTask(taskId);
    if (!task) {
      throw new NotionAssistantError(
        'Task not found in dead letter queue',
        ErrorCode.NOT_FOUND,
        ErrorSeverity.ERROR,
        false
      );
    }

    // Reset task for retry
    task.status = 'pending';
    task.error = undefined;
    task.retryCount = 0;
    task.movedToDeadLetterAt = undefined;
    task.updated = new Date();

    await Promise.all([
      this.storage.saveTask(task),
      this.storage.removeFromDeadLetter(taskId)
    ]);

    this.logger.info({
      message: 'Task moved from dead letter queue for retry',
      context: { taskId: task.id, type: task.type }
    });
  }

  /**
   * Get all tasks in the dead letter queue
   */
  async getDeadLetterTasks(): Promise<Task[]> {
    return this.storage.getDeadLetterTasks();
  }

  /**
   * Clean up old tasks from the dead letter queue
   */
  async cleanup(): Promise<void> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - this.options.retentionDays);

    const removedCount = await this.storage.cleanupDeadLetterTasks(threshold);
    if (removedCount > 0) {
      this.logger.info({
        message: 'Cleaned up dead letter queue',
        context: {
          removedCount,
          threshold: threshold.toISOString()
        }
      });
    }
  }
} 