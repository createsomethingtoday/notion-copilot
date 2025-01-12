import type { Task, TaskResult } from '../types';

export interface StorageAdapter {
  /**
   * Save a task
   */
  saveTask(task: Task): Promise<void>;

  /**
   * Get a task by ID
   */
  getTask(taskId: string): Promise<Task | null>;

  /**
   * Update a task
   */
  updateTask(taskId: string, updates: Partial<Task>): Promise<void>;

  /**
   * Delete a task
   */
  deleteTask(taskId: string): Promise<void>;

  /**
   * Get queued tasks
   */
  getQueuedTasks(limit?: number): Promise<Task[]>;

  /**
   * Get active tasks
   */
  getActiveTasks(): Promise<Task[]>;

  /**
   * Save task result
   */
  saveResult(taskId: string, result: TaskResult): Promise<void>;

  /**
   * Get task result
   */
  getResult(taskId: string): Promise<TaskResult | null>;

  /**
   * Batch save tasks
   */
  batchSaveTasks(tasks: Task[]): Promise<void>;

  /**
   * Batch update tasks
   */
  batchUpdateTasks(updates: Array<{ taskId: string; updates: Partial<Task> }>): Promise<void>;

  /**
   * Clean up old tasks
   */
  cleanup(olderThan: Date): Promise<void>;

  /**
   * Check if storage is healthy
   */
  isHealthy(): Promise<boolean>;

  /**
   * Get dead letter tasks
   */
  getDeadLetterTasks(): Promise<Task[]>;

  /**
   * Get a dead letter task by ID
   */
  getDeadLetterTask(taskId: string): Promise<Task | null>;

  /**
   * Move a task to the dead letter queue
   */
  moveTaskToDeadLetter(task: Task): Promise<void>;

  /**
   * Remove a task from the dead letter queue
   */
  removeFromDeadLetter(taskId: string): Promise<void>;

  /**
   * Clean up old dead letter tasks
   */
  cleanupDeadLetterTasks(threshold: Date): Promise<number>;
} 