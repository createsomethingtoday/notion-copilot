import { EventEmitter } from 'node:events';
import type { Task, TaskResult } from '../agent/types';
import type { PostgresAdapter } from '../db/postgres';
import { Logger } from '../utils/logger';
import type { TaskExecutor } from './executor';

export interface WorkerConfig {
  id: string;
  maxRetries?: number;
  retryDelayMs?: number;
  taskTimeoutMs?: number;
}

export class Worker extends EventEmitter {
  private readonly id: string;
  private readonly logger: Logger;
  private readonly db: PostgresAdapter;
  private readonly executor: TaskExecutor;
  private currentTask?: Task;
  private isRunning = false;
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;
  private readonly taskTimeoutMs: number;

  constructor(db: PostgresAdapter, executor: TaskExecutor, config: WorkerConfig) {
    super();
    this.id = config.id;
    this.db = db;
    this.executor = executor;
    this.logger = new Logger(`Worker:${this.id}`);
    this.maxRetries = config.maxRetries ?? 3;
    this.retryDelayMs = config.retryDelayMs ?? 5000;
    this.taskTimeoutMs = config.taskTimeoutMs ?? 30000;
  }

  /**
   * Start the worker
   */
  async start(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    this.logger.info('Worker started');
    this.emit('started');
    await this.processNextTask();
  }

  /**
   * Stop the worker
   */
  async stop(): Promise<void> {
    if (!this.isRunning) return;
    this.isRunning = false;
    this.logger.info('Worker stopped');
    this.emit('stopped');
  }

  /**
   * Process the next task in the queue
   */
  private async processNextTask(): Promise<void> {
    while (this.isRunning) {
      try {
        // Get next task from queue
        const task = await this.db.getNextTask();
        if (!task) {
          // No tasks available, wait before checking again
          await new Promise(resolve => setTimeout(resolve, 1000));
          continue;
        }

        this.currentTask = task;
        this.logger.info(`Processing task: ${task.id}`, { type: task.type });
        this.emit('taskStarted', task);

        // Update task status
        await this.db.updateTask(task.id, {
          status: 'in_progress',
          updated: new Date()
        });

        // Execute task with timeout
        const result = await Promise.race([
          this.executor.executeTask(task),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Task timeout')), this.taskTimeoutMs);
          })
        ]);

        // Save result
        await this.db.updateTask(task.id, {
          status: 'completed',
          result,
          completedAt: new Date(),
          updated: new Date()
        });

        this.logger.info(`Task completed: ${task.id}`);
        this.emit('taskCompleted', task, result);

      } catch (error) {
        if (this.currentTask) {
          const retryCount = (this.currentTask.retryCount ?? 0) + 1;
          const shouldRetry = retryCount <= this.maxRetries;

          await this.db.updateTask(this.currentTask.id, {
            status: shouldRetry ? 'pending' : 'failed',
            error: error as Error,
            retryCount,
            updated: new Date()
          });

          this.logger.error(
            `Task ${shouldRetry ? 'failed, will retry' : 'failed permanently'}: ${this.currentTask.id}`,
            error as Error
          );
          this.emit('taskFailed', this.currentTask, error);

          if (shouldRetry) {
            // Wait before retrying
            await new Promise(resolve => setTimeout(resolve, this.retryDelayMs));
          }
        }
      } finally {
        this.currentTask = undefined;
      }
    }
  }

  /**
   * Get worker status
   */
  getStatus(): {
    id: string;
    isRunning: boolean;
    currentTask?: { id: string; type: string };
  } {
    return {
      id: this.id,
      isRunning: this.isRunning,
      currentTask: this.currentTask
        ? { id: this.currentTask.id, type: this.currentTask.type }
        : undefined
    };
  }
} 