import type { Task } from './types';
import { TaskPriority } from './types';

export interface PriorityScore {
  base: number;      // From priority enum
  deadline: number;  // Time pressure
  weight: number;    // Custom weight
  age: number;      // Time in queue
  final: number;    // Combined score
}

export class PriorityManager {
  private static readonly MAX_AGE_HOURS = 24;
  private static readonly AGE_WEIGHT = 0.1;
  private static readonly DEADLINE_WEIGHT = 0.3;
  private static readonly CUSTOM_WEIGHT = 0.2;

  /**
   * Calculate priority score for a task
   */
  calculateScore(task: Task, now: Date = new Date()): PriorityScore {
    // Base priority score (0-3)
    const base = task.priority ?? TaskPriority.NORMAL;

    // Age score (0-1)
    const ageHours = (now.getTime() - task.created.getTime()) / (1000 * 60 * 60);
    const age = Math.min(ageHours / PriorityManager.MAX_AGE_HOURS, 1);

    // Deadline score (0-1)
    let deadline = 0;
    if (task.deadline) {
      const timeLeft = task.deadline.getTime() - now.getTime();
      const totalTime = task.deadline.getTime() - task.created.getTime();
      deadline = Math.max(0, Math.min(1, 1 - (timeLeft / totalTime)));
    }

    // Custom weight (0-1)
    const weight = task.weight ?? 0.5;

    // Calculate final score
    const final = 
      base + 
      (age * PriorityManager.AGE_WEIGHT) +
      (deadline * PriorityManager.DEADLINE_WEIGHT) +
      (weight * PriorityManager.CUSTOM_WEIGHT);

    return { base, deadline, weight, age, final };
  }

  /**
   * Sort tasks by priority
   */
  sortTasks(tasks: Task[]): Task[] {
    const now = new Date();
    const withScores = tasks.map(task => ({
      task,
      score: this.calculateScore(task, now)
    }));

    return withScores
      .sort((a, b) => b.score.final - a.score.final)
      .map(({ task }) => task);
  }

  /**
   * Get tasks above a certain priority threshold
   */
  filterByMinPriority(
    tasks: Task[], 
    minPriority: TaskPriority
  ): Task[] {
    return tasks.filter(task => 
      (task.priority ?? TaskPriority.NORMAL) >= minPriority
    );
  }

  /**
   * Get urgent tasks (high priority or close to deadline)
   */
  getUrgentTasks(tasks: Task[]): Task[] {
    const now = new Date();
    return tasks.filter(task => {
      const score = this.calculateScore(task, now);
      return (
        task.priority === TaskPriority.URGENT ||
        (task.deadline && score.deadline > 0.8)
      );
    });
  }

  /**
   * Adjust weights based on waiting time
   */
  adjustWeights(tasks: Task[]): void {
    const now = new Date();
    for (const task of tasks) {
      const ageHours = (now.getTime() - task.created.getTime()) / (1000 * 60 * 60);
      if (ageHours > PriorityManager.MAX_AGE_HOURS / 2) {
        // Gradually increase weight for old tasks
        task.weight = Math.min(1, (task.weight ?? 0.5) + 0.1);
      }
    }
  }
} 