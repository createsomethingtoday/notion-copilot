import type { Task, TaskStatus } from '../agent/types';
import type { StorageAdapter } from '../agent/storage/types';
import { Logger } from '../utils/logger';
import { DistributedLockManager } from './lock';
import type { PostgresAdapter } from '../db/postgres';

export interface SchedulerOptions {
  schedulingIntervalMs?: number;
  maxConcurrentTasks?: number;
  taskTimeoutMs?: number;
  retryDelayMs?: number;
}

export class TaskScheduler {
  private readonly logger: Logger;
  private readonly storage: StorageAdapter;
  private readonly lockManager: DistributedLockManager;
  private readonly options: Required<SchedulerOptions>;
  private schedulingInterval?: NodeJS.Timeout;
  private readonly activeTasks: Map<string, Task> = new Map();

  constructor(
    storage: StorageAdapter,
    db: PostgresAdapter,
    options: SchedulerOptions = {}
  ) {
    this.storage = storage;
    this.lockManager = new DistributedLockManager(db);
    this.logger = new Logger('TaskScheduler');
    this.options = {
      schedulingIntervalMs: options.schedulingIntervalMs ?? 1000, // 1 second
      maxConcurrentTasks: options.maxConcurrentTasks ?? 10,
      taskTimeoutMs: options.taskTimeoutMs ?? 30000, // 30 seconds
      retryDelayMs: options.retryDelayMs ?? 5000 // 5 seconds
    };
  }

  /**
   * Start the scheduler
   */
  start(): void {
    if (this.schedulingInterval) return;

    this.schedulingInterval = setInterval(
      () => this.scheduleTasks(),
      this.options.schedulingIntervalMs
    );

    this.logger.info('Task scheduler started', {
      interval: this.options.schedulingIntervalMs,
      maxConcurrent: this.options.maxConcurrentTasks
    });
  }

  /**
   * Stop the scheduler
   */
  stop(): void {
    if (this.schedulingInterval) {
      clearInterval(this.schedulingInterval);
      this.schedulingInterval = undefined;
      this.logger.info('Task scheduler stopped');
    }
  }

  /**
   * Schedule pending tasks
   */
  private async scheduleTasks(): Promise<void> {
    try {
      // Skip if at capacity
      if (this.activeTasks.size >= this.options.maxConcurrentTasks) {
        return;
      }

      // Get pending tasks
      const pendingTasks = await this.storage.getQueuedTasks();
      if (pendingTasks.length === 0) {
        return;
      }

      // Sort tasks by priority and deadline
      const sortedTasks = this.sortTasks(pendingTasks);
      const availableSlots = this.options.maxConcurrentTasks - this.activeTasks.size;
      const tasksToSchedule = sortedTasks.slice(0, availableSlots);

      // Schedule each task
      for (const task of tasksToSchedule) {
        await this.scheduleTask(task);
      }
    } catch (error) {
      this.logger.error('Error scheduling tasks', error as Error);
    }
  }

  /**
   * Schedule a single task
   */
  private async scheduleTask(task: Task): Promise<void> {
    const lockKey = `task:${task.id}`;

    try {
      // Try to acquire lock
      if (!await this.lockManager.acquireLock(lockKey)) {
        return; // Task is being processed by another scheduler
      }

      // Update task status
      task.status = 'in_progress' as TaskStatus;
      task.updated = new Date();
      await this.storage.updateTask(task.id, task);

      // Add to active tasks
      this.activeTasks.set(task.id, task);

      this.logger.debug(`Scheduled task: ${task.id}`, {
        type: task.type,
        priority: task.priority
      });

      // Set timeout to prevent stuck tasks
      setTimeout(() => this.checkTaskTimeout(task), this.options.taskTimeoutMs);
    } catch (error) {
      this.logger.error(`Error scheduling task: ${task.id}`, error as Error);
      await this.lockManager.releaseLock(lockKey);
    }
  }

  /**
   * Sort tasks by priority and deadline
   */
  private sortTasks(tasks: Task[]): Task[] {
    return [...tasks].sort((a, b) => {
      // First sort by priority (higher priority first)
      const priorityA = Number(a.priority ?? 1); // Default to NORMAL priority (1)
      const priorityB = Number(b.priority ?? 1);
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }

      // Then by deadline if present
      if (a.deadline && b.deadline) {
        return a.deadline.getTime() - b.deadline.getTime();
      }
      if (a.deadline) return -1;
      if (b.deadline) return 1;

      // Finally by creation time
      const timeA = a.created?.getTime() ?? 0;
      const timeB = b.created?.getTime() ?? 0;
      return timeA - timeB;
    });
  }

  /**
   * Check if a task has exceeded its timeout
   */
  private async checkTaskTimeout(task: Task): Promise<void> {
    if (!this.activeTasks.has(task.id)) {
      return; // Task already completed
    }

    this.logger.warn(`Task timeout reached: ${task.id}`);

    // Release lock and update status
    await this.lockManager.releaseLock(`task:${task.id}`);
    this.activeTasks.delete(task.id);

    // Increment retry count and requeue if possible
    task.retryCount = (task.retryCount ?? 0) + 1;
    if (task.retryCount < 3) { // Max retries hardcoded for now
      task.status = 'pending';
      task.error = new Error('Task timeout');
      await this.storage.updateTask(task.id, task);

      // Wait before allowing retry
      await new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs));
    } else {
      // Mark as failed if max retries reached
      task.status = 'failed';
      task.error = new Error('Max retries reached after timeouts');
      await this.storage.updateTask(task.id, task);
    }
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return;
    }

    // Update task status
    task.status = 'completed';
    task.completedAt = new Date();
    task.updated = new Date();
    await this.storage.updateTask(taskId, task);

    // Cleanup
    this.activeTasks.delete(taskId);
    await this.lockManager.releaseLock(`task:${taskId}`);

    this.logger.debug(`Completed task: ${taskId}`);
  }

  /**
   * Fail a task
   */
  async failTask(taskId: string, error: Error): Promise<void> {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return;
    }

    // Update task status
    task.status = 'failed';
    task.error = error;
    task.updated = new Date();
    await this.storage.updateTask(taskId, task);

    // Cleanup
    this.activeTasks.delete(taskId);
    await this.lockManager.releaseLock(`task:${taskId}`);

    this.logger.error(`Failed task: ${taskId}`, error);
  }

  /**
   * Get current scheduler status
   */
  getStatus(): {
    isRunning: boolean;
    activeTaskCount: number;
    activeTasks: Array<{
      id: string;
      type: string;
      priority: number;
      startedAt: Date;
    }>;
  } {
    return {
      isRunning: !!this.schedulingInterval,
      activeTaskCount: this.activeTasks.size,
      activeTasks: Array.from(this.activeTasks.values()).map(task => ({
        id: task.id,
        type: task.type,
        priority: Number(task.priority ?? 1), // Default to NORMAL priority (1)
        startedAt: task.updated ?? new Date()
      }))
    };
  }
} 