import type { Task, TaskResult, TaskPriority } from './types';

export interface TaskMetrics {
  taskId: string;
  type: string;
  priority: TaskPriority;
  queueTime: number;    // Time spent in queue (ms)
  executionTime: number; // Time spent executing (ms)
  retryCount: number;
  status: string;
  error?: string;
}

export interface QueueMetrics {
  timestamp: number;
  queueSize: number;
  activeTaskCount: number;
  completedTaskCount: number;
  failedTaskCount: number;
  avgQueueTime: number;
  avgExecutionTime: number;
  throughput: number;    // Tasks/minute
  errorRate: number;     // Errors/minute
  priorityDistribution: Record<TaskPriority, number>;
}

export class MetricsCollector {
  private static readonly WINDOW_SIZE = 60 * 1000; // 1 minute
  private taskMetrics: Map<string, TaskMetrics> = new Map();
  private queueMetrics: QueueMetrics[] = [];
  private lastCleanup: number = Date.now();

  /**
   * Record task start
   */
  recordTaskStart(task: Task): void {
    const metrics: TaskMetrics = {
      taskId: task.id,
      type: task.type,
      priority: task.priority,
      queueTime: Date.now() - task.created.getTime(),
      executionTime: 0,
      retryCount: task.retryCount ?? 0,
      status: task.status
    };
    this.taskMetrics.set(task.id, metrics);
  }

  /**
   * Record task completion
   */
  recordTaskComplete(task: Task, result: TaskResult): void {
    const metrics = this.taskMetrics.get(task.id);
    if (!metrics) return;

    metrics.status = task.status;
    metrics.executionTime = Date.now() - task.updated.getTime();
    metrics.error = result.error?.message;
  }

  /**
   * Update queue metrics
   */
  updateQueueMetrics(
    queueSize: number,
    activeCount: number,
    completedCount: number,
    failedCount: number,
    tasks: Task[]
  ): void {
    const now = Date.now();
    
    // Calculate metrics
    const recentMetrics = Array.from(this.taskMetrics.values())
      .filter(m => now - m.executionTime < MetricsCollector.WINDOW_SIZE);

    const avgQueueTime = recentMetrics.reduce(
      (sum, m) => sum + m.queueTime, 0
    ) / (recentMetrics.length || 1);

    const avgExecutionTime = recentMetrics.reduce(
      (sum, m) => sum + m.executionTime, 0
    ) / (recentMetrics.length || 1);

    // Calculate priority distribution
    const priorityDistribution = tasks.reduce((dist, task) => {
      dist[task.priority] = (dist[task.priority] || 0) + 1;
      return dist;
    }, {} as Record<TaskPriority, number>);

    // Calculate throughput and error rate
    const recentCompleted = recentMetrics.filter(
      m => m.status === 'completed'
    ).length;
    const recentErrors = recentMetrics.filter(
      m => m.error !== undefined
    ).length;

    const metrics: QueueMetrics = {
      timestamp: now,
      queueSize,
      activeTaskCount: activeCount,
      completedTaskCount: completedCount,
      failedTaskCount: failedCount,
      avgQueueTime,
      avgExecutionTime,
      throughput: (recentCompleted / MetricsCollector.WINDOW_SIZE) * 60000,
      errorRate: (recentErrors / MetricsCollector.WINDOW_SIZE) * 60000,
      priorityDistribution
    };

    this.queueMetrics.push(metrics);
    this.cleanup();
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(windowMs: number = MetricsCollector.WINDOW_SIZE): QueueMetrics[] {
    const cutoff = Date.now() - windowMs;
    return this.queueMetrics.filter(m => m.timestamp >= cutoff);
  }

  /**
   * Get task metrics
   */
  getTaskMetrics(taskId: string): TaskMetrics | undefined {
    return this.taskMetrics.get(taskId);
  }

  /**
   * Get performance alerts
   */
  getAlerts(): Array<{
    type: string;
    message: string;
    severity: 'warning' | 'error';
  }> {
    const recent = this.getRecentMetrics()[0];
    if (!recent) return [];

    const alerts: Array<{
      type: string;
      message: string;
      severity: 'warning' | 'error';
    }> = [];

    // Check queue growth
    if (recent.queueSize > recent.activeTaskCount * 3) {
      alerts.push({
        type: 'queue_growth',
        message: 'Queue size growing faster than processing rate',
        severity: 'warning'
      });
    }

    // Check error rate
    if (recent.errorRate > 0.1) {
      alerts.push({
        type: 'error_rate',
        message: `High error rate: ${(recent.errorRate * 100).toFixed(1)}%`,
        severity: 'error'
      });
    }

    // Check processing time
    if (recent.avgExecutionTime > 10000) { // 10 seconds
      alerts.push({
        type: 'slow_execution',
        message: 'Tasks taking longer than expected to execute',
        severity: 'warning'
      });
    }

    return alerts;
  }

  /**
   * Cleanup old metrics
   */
  private cleanup(): void {
    const now = Date.now();
    if (now - this.lastCleanup < MetricsCollector.WINDOW_SIZE) return;

    // Keep last hour of queue metrics
    const cutoff = now - (60 * 60 * 1000);
    this.queueMetrics = this.queueMetrics.filter(m => m.timestamp >= cutoff);

    // Clean up old task metrics
    for (const [taskId, metrics] of this.taskMetrics.entries()) {
      if (now - metrics.executionTime > MetricsCollector.WINDOW_SIZE * 2) {
        this.taskMetrics.delete(taskId);
      }
    }

    this.lastCleanup = now;
  }
} 