import type { Task, TaskResult } from './types';
import { TaskPriority } from './types';
import type { StorageAdapter } from './storage/types';
import { InMemoryStorage } from './storage/memory';
import { ConcurrencyManager, type ConcurrencyLimits } from './concurrency';
import { PriorityManager } from './priority';
import { MetricsCollector } from './monitoring';

export interface QueueStatus {
  size: number;
  activeTaskCount: number;
  waitingTaskCount: number;
  errorCount: number;
  isHealthy: boolean;
  urgentTaskCount: number;
  alerts: Array<{
    type: string;
    message: string;
    severity: 'warning' | 'error';
  }>;
}

export interface TaskQueueOptions {
  maxSize?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  storage?: StorageAdapter;
  concurrencyLimits?: Partial<ConcurrencyLimits>;
}

export class TaskQueue {
  private options: Required<Omit<TaskQueueOptions, 'concurrencyLimits'>>;
  private storage: StorageAdapter;
  private concurrency: ConcurrencyManager;
  private priority: PriorityManager;
  private metrics: MetricsCollector;

  constructor(options: TaskQueueOptions = {}) {
    this.options = {
      maxSize: options.maxSize ?? 1000,
      maxRetries: options.maxRetries ?? 3,
      retryDelayMs: options.retryDelayMs ?? 1000,
      storage: options.storage ?? new InMemoryStorage()
    };
    this.storage = this.options.storage;
    this.concurrency = new ConcurrencyManager(options.concurrencyLimits);
    this.priority = new PriorityManager();
    this.metrics = new MetricsCollector();
  }

  /**
   * Add a task to the queue
   */
  async enqueue(task: Task): Promise<void> {
    const queuedTasks = await this.storage.getQueuedTasks();
    if (queuedTasks.length >= this.options.maxSize) {
      throw new Error('Queue is full');
    }

    // Initialize task metadata if not present
    task.retryCount = task.retryCount ?? 0;
    task.status = task.status ?? 'pending';
    task.created = task.created ?? new Date();
    task.updated = new Date();
    task.priority = task.priority ?? TaskPriority.NORMAL;

    await this.storage.saveTask(task);
    this.metrics.recordTaskStart(task);
  }

  /**
   * Get the next task from the queue that can be executed
   */
  async dequeue(): Promise<Task | null> {
    // Get next tasks to try
    const tasks = await this.storage.getQueuedTasks(10); // Get more tasks for better priority selection
    if (tasks.length === 0) return null;

    // Sort by priority
    const prioritizedTasks = this.priority.sortTasks(tasks);

    // Try to acquire concurrency slot for each task in priority order
    for (const task of prioritizedTasks) {
      if (await this.concurrency.acquire(task)) {
        // Update task status
        task.status = 'in_progress';
        task.updated = new Date();
        await this.storage.updateTask(task.id, task);
        return task;
      }
    }

    return null; // No tasks could be executed right now
  }

  /**
   * Peek at the next task without removing it
   */
  async peek(): Promise<Task | null> {
    const tasks = await this.storage.getQueuedTasks(5);
    if (tasks.length === 0) return null;
    
    return this.priority.sortTasks(tasks)[0];
  }

  /**
   * Get current queue size
   */
  async size(): Promise<number> {
    const tasks = await this.storage.getQueuedTasks();
    return tasks.length;
  }

  /**
   * Get queue status
   */
  async getStatus(): Promise<QueueStatus> {
    const [queuedTasks, activeTasks] = await Promise.all([
      this.storage.getQueuedTasks(),
      this.storage.getActiveTasks()
    ]);

    const isHealthy = await this.storage.isHealthy();
    const metrics = this.concurrency.getMetrics();
    const urgentTasks = this.priority.getUrgentTasks(queuedTasks);

    // Update metrics
    this.metrics.updateQueueMetrics(
      queuedTasks.length,
      metrics.activeTaskCount,
      queuedTasks.filter(t => t.status === 'completed').length,
      queuedTasks.filter(t => t.status === 'failed').length,
      queuedTasks
    );

    return {
      size: queuedTasks.length,
      activeTaskCount: metrics.activeTaskCount,
      waitingTaskCount: queuedTasks.length,
      errorCount: activeTasks.filter(t => t.error).length,
      isHealthy,
      urgentTaskCount: urgentTasks.length,
      alerts: this.metrics.getAlerts()
    };
  }

  /**
   * Complete a task with its result
   */
  async completeTask(taskId: string, result: TaskResult): Promise<void> {
    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`No active task found with id: ${taskId}`);
    }

    task.status = 'completed';
    task.updated = new Date();
    task.completedAt = new Date();
    
    await Promise.all([
      this.storage.updateTask(taskId, task),
      this.storage.saveResult(taskId, result),
      this.concurrency.release(taskId)
    ]);

    this.metrics.recordTaskComplete(task, result);
  }

  /**
   * Handle task failure
   */
  async failTask(taskId: string, error: Error): Promise<void> {
    const task = await this.storage.getTask(taskId);
    if (!task) {
      throw new Error(`No active task found with id: ${taskId}`);
    }

    task.retryCount = (task.retryCount ?? 0) + 1;
    task.updated = new Date();

    if (task.retryCount >= this.options.maxRetries) {
      task.status = 'failed';
      task.error = error;
      await Promise.all([
        this.storage.updateTask(taskId, task),
        this.concurrency.release(taskId)
      ]);
      this.metrics.recordTaskComplete(task, { success: false, error } as TaskResult);
    } else {
      // Reset status and requeue after delay
      task.status = 'pending';
      // Increase priority for retries
      task.priority = Math.min(
        TaskPriority.URGENT,
        (task.priority ?? TaskPriority.NORMAL) + 1
      );
      await Promise.all([
        new Promise(resolve => setTimeout(resolve, this.options.retryDelayMs)),
        this.storage.updateTask(taskId, task),
        this.concurrency.release(taskId)
      ]);
    }
  }

  /**
   * Clear old completed tasks and their results
   */
  async cleanup(): Promise<void> {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 1); // 24 hours ago
    
    // Adjust weights for waiting tasks before cleanup
    const tasks = await this.storage.getQueuedTasks();
    this.priority.adjustWeights(tasks);
    await Promise.all(
      tasks.map(task => this.storage.updateTask(task.id, task))
    );

    await this.storage.cleanup(threshold);
  }

  /**
   * Update concurrency limits
   */
  updateConcurrencyLimits(limits: Partial<ConcurrencyLimits>): void {
    this.concurrency.updateLimits(limits);
  }

  /**
   * Get task metrics
   */
  getTaskMetrics(taskId: string) {
    return this.metrics.getTaskMetrics(taskId);
  }

  /**
   * Get recent queue metrics
   */
  getQueueMetrics(windowMs?: number) {
    return this.metrics.getRecentMetrics(windowMs);
  }
} 