import type { Logger } from '@/logger';
import { getLogger } from '@/logger';
import { TaskStatus } from './types';
import type { Task, DeadLetterQueueConfig } from './types';
import type { StorageAdapter } from '../storage/adapter';
import { NotionAssistantError } from '@/errors/types';
import { ErrorCode, ErrorSeverity } from '@/errors/types';

/**
 * Handles permanently failed tasks by moving them to a separate queue for
 * analysis and potential retry.
 */
export class DeadLetterQueue {
  private readonly logger: Logger;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly config: DeadLetterQueueConfig
  ) {
    this.logger = getLogger('DeadLetterQueue');
  }

  /**
   * Moves a failed task to the dead letter queue
   */
  public async moveToDeadLetter(task: Task): Promise<void> {
    try {
      const count = await this.storage.getDeadLetterCount();
      if (count >= this.config.maxSize) {
        throw new NotionAssistantError(
          'Dead letter queue is full',
          ErrorCode.RESOURCE_EXHAUSTED,
          ErrorSeverity.ERROR,
          false,
          { maxSize: this.config.maxSize }
        );
      }

      task.status = TaskStatus.DEAD_LETTER;
      task.moved_to_dead_letter_at = new Date();
      await this.storage.moveTaskToDeadLetter(task);

      this.logger.warn('Task moved to dead letter queue', {
        taskId: task.id,
        type: task.type,
        error: task.error?.message
      });
    } catch (error) {
      this.logger.error('Failed to move task to dead letter queue', error as Error, {
        taskId: task.id
      });
      throw error;
    }
  }

  /**
   * Retrieves tasks from the dead letter queue
   */
  public async getTasks(limit?: number): Promise<Task[]> {
    try {
      return await this.storage.getDeadLetterTasks(limit);
    } catch (error) {
      this.logger.error('Failed to get tasks from dead letter queue', error as Error);
      throw error;
    }
  }

  /**
   * Retries a task from the dead letter queue
   */
  public async retryTask(taskId: string): Promise<void> {
    try {
      const task = await this.storage.getDeadLetterTask(taskId);
      if (!task) {
        throw new NotionAssistantError(
          'Task not found in dead letter queue',
          ErrorCode.NOT_FOUND,
          ErrorSeverity.ERROR,
          false,
          { taskId }
        );
      }

      if (task.retry_count >= this.config.retryLimit) {
        throw new NotionAssistantError(
          'Task retry limit exceeded',
          ErrorCode.RESOURCE_EXHAUSTED,
          ErrorSeverity.ERROR,
          false,
          { 
            taskId,
            retryCount: task.retry_count,
            retryLimit: this.config.retryLimit
          }
        );
      }

      task.status = TaskStatus.PENDING;
      task.retry_count++;
      task.moved_to_dead_letter_at = undefined;
      await this.storage.removeFromDeadLetter(taskId);

      this.logger.info('Task retried from dead letter queue', {
        taskId: task.id,
        retryCount: task.retry_count
      });
    } catch (error) {
      this.logger.error('Failed to retry task from dead letter queue', error as Error, {
        taskId
      });
      throw error;
    }
  }

  /**
   * Cleans up old tasks from the dead letter queue
   */
  public async cleanup(): Promise<void> {
    try {
      const threshold = new Date(Date.now() - this.config.retentionPeriodMs);
      await this.storage.cleanupDeadLetterTasks(threshold);
      
      this.logger.info('Cleaned up dead letter queue', {
        threshold: threshold.toISOString()
      });
    } catch (error) {
      this.logger.error('Failed to cleanup dead letter queue', error as Error);
      throw error;
    }
  }
} 