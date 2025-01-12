import type { Task, TaskResult } from '../agent/types';
import type { StorageAdapter } from '../agent/storage/types';
import type { PostgresAdapter } from '../db/postgres';
import { Logger } from '../utils/logger';
import { TaskScheduler, type SchedulerOptions } from './scheduler';
import { TaskRecoveryManager, type RecoveryOptions } from './recovery';
import { DistributedLockManager, type LockOptions } from './lock';

export interface OrchestratorOptions {
  scheduler?: SchedulerOptions;
  recovery?: RecoveryOptions;
  locks?: LockOptions;
}

export interface QueueStatus {
  scheduler: ReturnType<TaskScheduler['getStatus']>;
  queueSize: number;
  activeLockCount: number;
}

export class TaskQueueOrchestrator {
  private readonly logger: Logger;
  private readonly storage: StorageAdapter;
  private readonly scheduler: TaskScheduler;
  private readonly recovery: TaskRecoveryManager;
  private readonly lockManager: DistributedLockManager;

  constructor(
    storage: StorageAdapter,
    db: PostgresAdapter,
    options: OrchestratorOptions = {}
  ) {
    this.logger = new Logger('TaskQueueOrchestrator');
    this.storage = storage;
    this.lockManager = new DistributedLockManager(db, options.locks);
    this.scheduler = new TaskScheduler(storage, db, options.scheduler);
    this.recovery = new TaskRecoveryManager(storage, options.recovery);
  }

  /**
   * Start the task queue system
   */
  async start(): Promise<void> {
    this.logger.info('Starting task queue system');

    // Start components in order
    this.recovery.start();
    this.scheduler.start();

    this.logger.info('Task queue system started');
  }

  /**
   * Stop the task queue system
   */
  async stop(): Promise<void> {
    this.logger.info('Stopping task queue system');

    // Stop components in reverse order
    this.scheduler.stop();
    this.recovery.stop();
    await this.lockManager.releaseAllLocks();

    this.logger.info('Task queue system stopped');
  }

  /**
   * Add a task to the queue
   */
  async enqueueTask(task: Task): Promise<void> {
    await this.storage.saveTask(task);
    this.logger.debug(`Task enqueued: ${task.id}`, {
      type: task.type,
      priority: task.priority
    });
  }

  /**
   * Complete a task with its result
   */
  async completeTask(taskId: string, result: TaskResult): Promise<void> {
    await this.scheduler.completeTask(taskId);
    this.logger.debug(`Task completed: ${taskId}`);
  }

  /**
   * Fail a task with an error
   */
  async failTask(taskId: string, error: Error): Promise<void> {
    await this.scheduler.failTask(taskId, error);
    this.logger.debug(`Task failed: ${taskId}`, { error: error.message });
  }

  /**
   * Get system status
   */
  async getStatus(): Promise<QueueStatus> {
    const schedulerStatus = this.scheduler.getStatus();
    const queueSize = schedulerStatus.activeTaskCount + schedulerStatus.activeTasks.length;
    const activeLockCount = schedulerStatus.activeTaskCount; // Each active task has a lock

    return {
      scheduler: schedulerStatus,
      queueSize,
      activeLockCount
    };
  }

  /**
   * Get task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    return this.storage.getTask(taskId);
  }

  /**
   * Get queued tasks
   */
  async getQueuedTasks(limit?: number): Promise<Task[]> {
    return this.storage.getQueuedTasks(limit);
  }
} 