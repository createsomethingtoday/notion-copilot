import type { Pool, PoolConfig, QueryResult, QueryResultRow } from 'pg';
import { Pool as PgPool } from 'pg';
import type { DBTask, DBTaskResult, DBMetric } from './schema';
import type { Task, TaskResult, TaskPriority, TaskStatus } from '../agent/types';
import { Logger } from '../utils/logger';

// Helper type for database-safe objects
type DatabaseObject = Record<string, unknown>;

export interface PostgresConfig extends PoolConfig {
  maxConnections?: number;
  minConnections?: number;
  connectionTimeoutMs?: number;
  idleTimeoutMs?: number;
}

export class PostgresAdapter {
  private readonly pool: PgPool;
  private readonly logger: Logger;

  constructor(config: PostgresConfig) {
    this.pool = new PgPool({
      max: config.maxConnections ?? 20,
      min: config.minConnections ?? 4,
      connectionTimeoutMillis: config.connectionTimeoutMs ?? 10000,
      idleTimeoutMillis: config.idleTimeoutMs ?? 30000,
      ...config
    });

    this.logger = new Logger('PostgresAdapter');

    // Handle pool errors
    this.pool.on('error', (err) => {
      this.logger.error('Unexpected error on idle client', err);
      process.exit(-1);
    });
  }

  /**
   * Execute a query with automatic connection management
   */
  private async query<T extends QueryResultRow>(
    text: string,
    params: unknown[] = []
  ): Promise<QueryResult<T>> {
    const client = await this.pool.connect();
    try {
      const start = Date.now();
      const result = await client.query<T>(text, params);
      const duration = Date.now() - start;
      
      this.logger.debug('Executed query', {
        text,
        duration,
        rows: result.rowCount
      });

      return result;
    } finally {
      client.release();
    }
  }

  /**
   * Begin a transaction
   */
  async beginTransaction(): Promise<void> {
    await this.query('BEGIN');
  }

  /**
   * Commit a transaction
   */
  async commitTransaction(): Promise<void> {
    await this.query('COMMIT');
  }

  /**
   * Rollback a transaction
   */
  async rollbackTransaction(): Promise<void> {
    await this.query('ROLLBACK');
  }

  /**
   * Save a task to the database
   */
  async saveTask(task: Task): Promise<void> {
    const dbTask: Partial<DBTask> = {
      id: task.id,
      type: task.type,
      status: task.status,
      priority: task.priority,
      description: task.description,
      dependencies: task.dependencies,
      retry_count: task.retryCount ?? 0,
      error: task.error?.message,
      result: task.result ? this.toDatabaseObject(task.result) : undefined,
      weight: task.weight,
      deadline: task.deadline
    };

    await this.query(
      `INSERT INTO tasks (
        id, type, status, priority, description, dependencies,
        retry_count, error, result, weight, deadline
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )`,
      [
        dbTask.id,
        dbTask.type,
        dbTask.status,
        dbTask.priority,
        dbTask.description,
        dbTask.dependencies,
        dbTask.retry_count,
        dbTask.error,
        dbTask.result,
        dbTask.weight,
        dbTask.deadline
      ]
    );
  }

  /**
   * Get a task by ID
   */
  async getTask(taskId: string): Promise<Task | null> {
    const result = await this.query<DBTask>(
      'SELECT * FROM tasks WHERE id = $1',
      [taskId]
    );

    if (result.rows.length === 0) return null;

    const dbTask = result.rows[0];
    return this.mapDBTaskToTask(dbTask);
  }

  /**
   * Get queued tasks
   */
  async getQueuedTasks(limit?: number): Promise<Task[]> {
    const query = limit
      ? 'SELECT * FROM tasks WHERE status = $1 ORDER BY created_at ASC LIMIT $2'
      : 'SELECT * FROM tasks WHERE status = $1 ORDER BY created_at ASC';
    
    const params = limit ? ['pending', limit] : ['pending'];
    const result = await this.query<DBTask>(query, params);

    return result.rows.map(this.mapDBTaskToTask);
  }

  /**
   * Convert domain object to database-safe object
   */
  private toDatabaseObject<T>(obj: T): DatabaseObject {
    return JSON.parse(JSON.stringify(obj)) as DatabaseObject;
  }

  /**
   * Update a task
   */
  async updateTask(taskId: string, updates: Partial<Task>): Promise<void> {
    const dbUpdates: Partial<DBTask> = {
      status: updates.status,
      priority: updates.priority,
      retry_count: updates.retryCount,
      error: updates.error?.message,
      result: updates.result ? this.toDatabaseObject(updates.result) : undefined,
      weight: updates.weight,
      completed_at: updates.status === 'completed' ? new Date() : undefined
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [key, value] of Object.entries(dbUpdates)) {
      if (value !== undefined) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) return;

    values.push(taskId);
    await this.query(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );
  }

  /**
   * Save task result
   */
  async saveTaskResult(taskId: string, result: TaskResult): Promise<void> {
    const dbResult: Partial<DBTaskResult> = {
      task_id: taskId,
      result: this.toDatabaseObject(result),
      error: 'error' in result ? result.error?.message : undefined
    };

    await this.query(
      `INSERT INTO task_results (task_id, result, error)
       VALUES ($1, $2, $3)`,
      [dbResult.task_id, dbResult.result, dbResult.error]
    );
  }

  /**
   * Save metric
   */
  async saveMetric(
    metricType: string,
    value: number,
    labels: Record<string, string> = {}
  ): Promise<void> {
    await this.query(
      `INSERT INTO metrics (metric_type, value, labels)
       VALUES ($1, $2, $3)`,
      [metricType, value, labels]
    );
  }

  /**
   * Get metrics by type and time range
   */
  async getMetrics(
    metricType: string,
    startTime: Date,
    endTime: Date
  ): Promise<DBMetric[]> {
    const result = await this.query<DBMetric>(
      `SELECT * FROM metrics
       WHERE metric_type = $1
       AND timestamp BETWEEN $2 AND $3
       ORDER BY timestamp ASC`,
      [metricType, startTime, endTime]
    );

    return result.rows;
  }

  /**
   * Map domain task to database task
   */
  private mapTaskToDBTask(task: Task): Partial<DBTask> {
    return {
      id: task.id,
      type: task.type as string,
      status: task.status,
      priority: task.priority,
      description: task.description,
      dependencies: task.dependencies,
      created_at: task.created,
      updated_at: task.updated,
      completed_at: task.completedAt,
      retry_count: task.retryCount || 0,
      error: task.error?.message,
      result: task.result ? this.toDatabaseObject(task.result) : undefined,
      weight: task.weight,
      deadline: task.deadline
    };
  }

  /**
   * Map database task to domain task
   */
  private mapDBTaskToTask(dbTask: DBTask): Task {
    const result = dbTask.result ? 
      (dbTask.result as unknown as TaskResult) : 
      undefined;
    
    const baseTask = {
      id: dbTask.id,
      type: dbTask.type as Task['type'],
      status: dbTask.status as TaskStatus,
      priority: dbTask.priority as TaskPriority,
      description: dbTask.description,
      dependencies: dbTask.dependencies,
      created: dbTask.created_at,
      updated: dbTask.updated_at,
      completedAt: dbTask.completed_at,
      retryCount: dbTask.retry_count,
      error: dbTask.error ? new Error(dbTask.error) : undefined,
      result,
      weight: dbTask.weight,
      deadline: dbTask.deadline
    };

    return baseTask as Task;
  }

  /**
   * Close the connection pool
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Get the database pool (for migrations only)
   */
  getMigrationPool(): Pool {
    return this.pool;
  }

  /**
   * Perform a health check query
   */
  async healthCheck(): Promise<{ latency: number; isConnected: boolean }> {
    const startTime = Date.now();
    try {
      await this.query('SELECT 1');
      return {
        latency: Date.now() - startTime,
        isConnected: true
      };
    } catch (error) {
      return {
        latency: Date.now() - startTime,
        isConnected: false
      };
    }
  }

  /**
   * Get next task from queue
   */
  async getNextTask(): Promise<Task | null> {
    await this.beginTransaction();
    try {
      // Get and lock next pending task
      const result = await this.query<DBTask>(
        `SELECT * FROM tasks
         WHERE status = 'pending'
         ORDER BY
           CASE priority
             WHEN '3' THEN 1  -- URGENT
             WHEN '2' THEN 2  -- HIGH
             WHEN '1' THEN 3  -- NORMAL
             WHEN '0' THEN 4  -- LOW
           END,
           created_at ASC
         FOR UPDATE SKIP LOCKED
         LIMIT 1`
      );

      if (result.rows.length === 0) {
        await this.commitTransaction();
        return null;
      }

      const task = this.mapDBTaskToTask(result.rows[0]);
      await this.commitTransaction();
      return task;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Get queue size
   */
  async getQueueSize(): Promise<number> {
    const result = await this.query<{ count: string }>(
      'SELECT COUNT(*) as count FROM tasks WHERE status = $1',
      ['pending']
    );
    return Number.parseInt(result.rows[0].count, 10);
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(): Promise<{
    pending: number;
    inProgress: number;
    completed: number;
    failed: number;
    totalTasks: number;
    avgProcessingTime: number;
    errorRate: number;
  }> {
    const results = await Promise.all([
      // Get task counts by status
      this.query<{ status: string; count: string }>(
        `SELECT status, COUNT(*) as count
         FROM tasks
         GROUP BY status`
      ),
      // Get average processing time for completed tasks
      this.query<{ avg_time: string }>(
        `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - updated_at))) as avg_time
         FROM tasks
         WHERE status = 'completed'
         AND completed_at IS NOT NULL`
      ),
      // Get error rate (failed tasks / total completed or failed tasks)
      this.query<{ error_rate: string }>(
        `SELECT 
           CASE 
             WHEN COUNT(*) = 0 THEN 0
             ELSE ROUND(COUNT(*) FILTER (WHERE status = 'failed')::numeric / COUNT(*)::numeric, 2)
           END as error_rate
         FROM tasks
         WHERE status IN ('completed', 'failed')`
      )
    ]);

    const statusCounts = results[0].rows.reduce((acc, row) => {
      acc[row.status] = Number.parseInt(row.count, 10);
      return acc;
    }, {} as Record<string, number>);

    return {
      pending: statusCounts.pending ?? 0,
      inProgress: statusCounts.in_progress ?? 0,
      completed: statusCounts.completed ?? 0,
      failed: statusCounts.failed ?? 0,
      totalTasks: Object.values(statusCounts).reduce((sum, count) => sum + count, 0),
      avgProcessingTime: Number.parseFloat(results[1].rows[0].avg_time ?? '0'),
      errorRate: Number.parseFloat(results[2].rows[0].error_rate ?? '0')
    };
  }
} 