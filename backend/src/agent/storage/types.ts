import type { Task, TaskResult } from '../types';

export interface StorageAdapter {
  // Task Operations
  saveTask(task: Task): Promise<void>;
  getTask(taskId: string): Promise<Task | null>;
  updateTask(taskId: string, updates: Partial<Task>): Promise<void>;
  deleteTask(taskId: string): Promise<void>;
  
  // Queue Operations
  getQueuedTasks(limit?: number): Promise<Task[]>;
  getActiveTasks(): Promise<Task[]>;
  
  // Results
  saveResult(taskId: string, result: TaskResult): Promise<void>;
  getResult(taskId: string): Promise<TaskResult | null>;
  
  // Batch Operations
  batchSaveTasks(tasks: Task[]): Promise<void>;
  batchUpdateTasks(updates: Array<{ taskId: string; updates: Partial<Task> }>): Promise<void>;
  
  // Maintenance
  cleanup(olderThan: Date): Promise<void>;
  
  // Health
  isHealthy(): Promise<boolean>;
} 