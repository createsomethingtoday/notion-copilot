import type { Logger } from '@/logger';
import { getLogger } from '@/logger';
import type { Task } from './types';
import { TaskStatus } from './types';
import type { StorageAdapter } from '../storage/adapter';
import { DeadLetterQueue } from './dead-letter-queue';
import type { DeadLetterQueueConfig } from './types';
import { NotionAssistantError } from '@/errors/types';
import { ErrorCode, ErrorSeverity } from '@/errors/types';
import { CleanupJob } from './cleanup-job';
import type { MonitoringService } from '@/monitoring/service';

export interface WorkerConfig {
  pollIntervalMs: number;
  maxConcurrent: number;
  deadLetterConfig: DeadLetterQueueConfig;
  cleanupIntervalMs: number;
}

export class Worker {
  private readonly logger: Logger;
  private readonly deadLetterQueue: DeadLetterQueue;
  private readonly cleanupJob: CleanupJob;
  private isRunning = false;
  private activeTaskCount = 0;

  constructor(
    private readonly storage: StorageAdapter,
    private readonly config: WorkerConfig,
    private readonly monitoring: MonitoringService
  ) {
    this.logger = getLogger('Worker');
    this.deadLetterQueue = new DeadLetterQueue(storage, config.deadLetterConfig);
    this.cleanupJob = new CleanupJob(this.deadLetterQueue, {
      intervalMs: config.cleanupIntervalMs
    }, monitoring);
  }

  public async start(): Promise<void> {
    if (this.isRunning) {
      return;
    }

    this.isRunning = true;
    this.logger.info('Worker started');
    this.cleanupJob.start();

    while (this.isRunning) {
      try {
        if (this.activeTaskCount < this.config.maxConcurrent) {
          const tasks = await this.storage.getTasks({
            status: [TaskStatus.PENDING],
            limit: this.config.maxConcurrent - this.activeTaskCount
          });

          for (const task of tasks) {
            this.processTask(task).catch(error => {
              this.logger.error('Failed to process task', error as Error, {
                taskId: task.id
              });
            });
          }
        }

        await new Promise(resolve => setTimeout(resolve, this.config.pollIntervalMs));
      } catch (error) {
        this.logger.error('Worker loop error', error as Error);
        await new Promise(resolve => setTimeout(resolve, this.config.pollIntervalMs));
      }
    }
  }

  public stop(): void {
    this.isRunning = false;
    this.cleanupJob.stop();
    this.logger.info('Worker stopped');
  }

  private async processTask(task: Task): Promise<void> {
    this.activeTaskCount++;

    try {
      task.status = TaskStatus.RUNNING;
      task.updated = new Date();
      await this.storage.updateTask(task);

      // Mock task execution
      await new Promise(resolve => setTimeout(resolve, 1000));

      task.status = TaskStatus.COMPLETED;
      task.completed_at = new Date();
      task.updated = new Date();
      await this.storage.updateTask(task);

      this.logger.info('Task completed successfully', {
        taskId: task.id,
        type: task.type
      });
    } catch (error) {
      task.status = TaskStatus.FAILED;
      task.error = error instanceof NotionAssistantError ? error : new NotionAssistantError(
        'Task execution failed',
        ErrorCode.TASK_EXECUTION_FAILED,
        ErrorSeverity.ERROR,
        true,
        { error }
      );
      task.updated = new Date();
      task.retry_count++;

      if (task.retry_count >= task.max_retries) {
        await this.deadLetterQueue.moveToDeadLetter(task);
      } else {
        await this.storage.updateTask(task);
      }

      this.logger.error('Task failed', task.error, {
        taskId: task.id,
        type: task.type,
        retryCount: task.retry_count,
        maxRetries: task.max_retries
      });
    } finally {
      this.activeTaskCount--;
    }
  }
} 