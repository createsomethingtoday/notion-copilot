import { PostgresAdapter } from '../postgres';
import type { TaskResult, SearchTask, TaskStatus, Task } from '../../agent/types';
import type { DBTask, DBMetric, DBTaskResult } from '../schema';
import { MigrationManager } from '../migrations';
import { v4 as uuidv4 } from 'uuid';
import type { QueryResult, QueryResultRow } from 'pg';

// Create test adapter that uses public methods
class TestPostgresAdapter extends PostgresAdapter {
  async updateTaskStatus(id: string, status: TaskStatus): Promise<void> {
    await this.updateTask(id, { status });
  }

  async getTasksByStatus(status: TaskStatus): Promise<Task[]> {
    const tasks = await this.getQueuedTasks();
    return tasks.filter(task => task.status === status);
  }

  async getTaskResult(taskId: string): Promise<TaskResult | null> {
    const task = await this.getTask(taskId);
    if (!task) return null;
    await this.saveTaskResult(taskId, { success: true });
    return { success: true };
  }
}

describe('PostgresAdapter Integration', () => {
  let db: TestPostgresAdapter;
  let migrations: MigrationManager;

  beforeAll(async () => {
    // Create test database connection
    db = new TestPostgresAdapter({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: Number(process.env.POSTGRES_PORT) || 5432,
      database: process.env.POSTGRES_DB || 'test',
      user: process.env.POSTGRES_USER || 'test',
      password: process.env.POSTGRES_PASSWORD || 'test'
    });

    // Initialize schema
    migrations = new MigrationManager(db.getMigrationPool());
    await migrations.migrate();
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Reset database to clean state
    await migrations.rollback();
    await migrations.migrate();
  });

  describe('task operations', () => {
    it('should save and retrieve tasks', async () => {
      const task: SearchTask = {
        id: uuidv4(),
        type: 'search',
        status: 'pending',
        priority: '1',
        description: 'Test search task',
        created: new Date(),
        updated: new Date(),
        query: 'test query',
        filters: {}
      };

      await db.saveTask(task);
      const retrieved = await db.getTask(task.id);

      expect(retrieved).toBeDefined();
      expect(retrieved?.id).toBe(task.id);
      expect(retrieved?.type).toBe(task.type);
      expect(retrieved?.status).toBe(task.status);
      expect(retrieved?.description).toBe(task.description);
    });

    it('should update task status', async () => {
      const task: SearchTask = {
        id: uuidv4(),
        type: 'search',
        status: 'pending',
        priority: '1',
        description: 'Test search task',
        created: new Date(),
        updated: new Date(),
        query: 'test query',
        filters: {}
      };

      await db.saveTask(task);
      await db.updateTaskStatus(task.id, 'completed');
      
      const updated = await db.getTask(task.id);
      expect(updated?.status).toBe('completed');
    });

    it('should handle task dependencies', async () => {
      const dependency: SearchTask = {
        id: uuidv4(),
        type: 'search',
        status: 'completed',
        priority: '2',
        description: 'Dependency task',
        created: new Date(),
        updated: new Date(),
        query: 'dependency',
        filters: {}
      };

      const task: SearchTask = {
        id: uuidv4(),
        type: 'search',
        status: 'pending',
        priority: '1',
        description: 'Dependent task',
        created: new Date(),
        updated: new Date(),
        query: 'test',
        filters: {},
        dependencies: [dependency.id]
      };

      await db.saveTask(dependency);
      await db.saveTask(task);

      const retrieved = await db.getTask(task.id);
      expect(retrieved?.dependencies).toContain(dependency.id);
    });

    it('should get tasks by status', async () => {
      const tasks: SearchTask[] = [
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '1',
          description: 'Pending task 1',
          created: new Date(),
          updated: new Date(),
          query: 'test 1',
          filters: {}
        },
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '2',
          description: 'Pending task 2',
          created: new Date(),
          updated: new Date(),
          query: 'test 2',
          filters: {}
        },
        {
          id: uuidv4(),
          type: 'search',
          status: 'completed',
          priority: '1',
          description: 'Completed task',
          created: new Date(),
          updated: new Date(),
          query: 'test 3',
          filters: {}
        }
      ];

      await Promise.all(tasks.map(task => db.saveTask(task)));

      const pendingTasks = await db.getTasksByStatus('pending');
      expect(pendingTasks).toHaveLength(2);
      expect(pendingTasks.map(t => t.status)).toEqual([
        'pending',
        'pending'
      ]);
    });

    it('should get next task by priority order', async () => {
      const tasks: SearchTask[] = [
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '1', // NORMAL
          description: 'Normal priority task',
          created: new Date(),
          updated: new Date(),
          query: 'test 1',
          filters: {}
        },
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '3', // URGENT
          description: 'Urgent priority task',
          created: new Date(),
          updated: new Date(),
          query: 'test 2',
          filters: {}
        },
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '2', // HIGH
          description: 'High priority task',
          created: new Date(),
          updated: new Date(),
          query: 'test 3',
          filters: {}
        }
      ];

      await Promise.all(tasks.map(task => db.saveTask(task)));

      // Should get URGENT task first
      const nextTask1 = await db.getNextTask();
      expect(nextTask1?.priority).toBe('3');

      // Should get HIGH priority task next
      const nextTask2 = await db.getNextTask();
      expect(nextTask2?.priority).toBe('2');

      // Should get NORMAL priority task last
      const nextTask3 = await db.getNextTask();
      expect(nextTask3?.priority).toBe('1');

      // Should get null when no more tasks
      const nextTask4 = await db.getNextTask();
      expect(nextTask4).toBeNull();
    });

    it('should get queue size', async () => {
      const tasks: SearchTask[] = [
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '1',
          description: 'Task 1',
          created: new Date(),
          updated: new Date(),
          query: 'test 1',
          filters: {}
        },
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '1',
          description: 'Task 2',
          created: new Date(),
          updated: new Date(),
          query: 'test 2',
          filters: {}
        },
        {
          id: uuidv4(),
          type: 'search',
          status: 'completed',
          priority: '1',
          description: 'Task 3',
          created: new Date(),
          updated: new Date(),
          query: 'test 3',
          filters: {}
        }
      ];

      await Promise.all(tasks.map(task => db.saveTask(task)));

      const size = await db.getQueueSize();
      expect(size).toBe(2); // Only pending tasks count
    });

    it('should get queue metrics', async () => {
      const tasks: SearchTask[] = [
        {
          id: uuidv4(),
          type: 'search',
          status: 'pending',
          priority: '1',
          description: 'Task 1',
          created: new Date(),
          updated: new Date(),
          query: 'test 1',
          filters: {}
        },
        {
          id: uuidv4(),
          type: 'search',
          status: 'completed',
          priority: '2',
          description: 'Task 2',
          created: new Date(),
          updated: new Date(),
          query: 'test 2',
          filters: {}
        }
      ];

      await Promise.all(tasks.map(task => db.saveTask(task)));

      const metrics = await db.getQueueMetrics();
      expect(metrics.pending).toBe(1); // Only pending tasks
      expect(metrics.completed).toBe(1);
      expect(metrics.totalTasks).toBe(2);
      expect(metrics.avgProcessingTime).toBeGreaterThanOrEqual(0);
      expect(metrics.errorRate).toBe(0);
    });

    it('should save and retrieve task results', async () => {
      const task: SearchTask = {
        id: uuidv4(),
        type: 'search',
        status: 'completed',
        priority: '1',
        description: 'Test task',
        created: new Date(),
        updated: new Date(),
        query: 'test',
        filters: {}
      };

      const result: TaskResult = {
        pages: [],
        databases: [],
        blocks: [],
        success: true
      };

      await db.saveTask(task);
      await db.saveTaskResult(task.id, result);

      const savedResult = await db.getTaskResult(task.id);
      expect(savedResult).toBeDefined();
      expect(savedResult?.success).toBe(true);
    });

    it('should handle advisory locks', async () => {
      const lockId = 12345;

      // Should acquire lock
      const acquired = await db.tryAdvisoryLock(lockId);
      expect(acquired).toBe(true);

      // Should fail to acquire same lock
      const secondAttempt = await db.tryAdvisoryLock(lockId);
      expect(secondAttempt).toBe(false);

      // Should verify lock is held
      const isHeld = await db.checkAdvisoryLock(lockId);
      expect(isHeld).toBe(true);

      // Should release lock
      await db.releaseAdvisoryLock(lockId);

      // Should verify lock is released
      const isReleased = await db.checkAdvisoryLock(lockId);
      expect(isReleased).toBe(false);

      // Should acquire lock again after release
      const reacquired = await db.tryAdvisoryLock(lockId);
      expect(reacquired).toBe(true);
    });
  });

  describe('advisory locks', () => {
    it('should acquire and release advisory locks', async () => {
      const lockId = 12345;

      // Should acquire lock
      const acquired = await db.tryAdvisoryLock(lockId);
      expect(acquired).toBe(true);

      // Should verify lock is held
      const isHeld = await db.checkAdvisoryLock(lockId);
      expect(isHeld).toBe(true);

      // Should fail to acquire same lock
      const acquiredAgain = await db.tryAdvisoryLock(lockId);
      expect(acquiredAgain).toBe(false);

      // Should release lock
      await db.releaseAdvisoryLock(lockId);

      // Should verify lock is released
      const isHeldAfterRelease = await db.checkAdvisoryLock(lockId);
      expect(isHeldAfterRelease).toBe(false);

      // Should acquire lock again after release
      const acquiredAfterRelease = await db.tryAdvisoryLock(lockId);
      expect(acquiredAfterRelease).toBe(true);
    });
  });

  describe('metric operations', () => {
    it('should save and retrieve metrics', async () => {
      const timestamp = new Date();
      const metricType = 'test_metric';
      const value = 42;
      const labels = { test: 'true' };

      await db.saveMetric(metricType, value, labels);
      const metrics = await db.getMetrics(
        metricType,
        new Date(timestamp.getTime() - 1000),
        new Date(timestamp.getTime() + 1000)
      );

      expect(metrics).toHaveLength(1);
      expect(metrics[0].metric_type).toBe(metricType);
      expect(metrics[0].value).toBe(value);
      expect(metrics[0].labels).toEqual(labels);
    });

    it('should filter metrics by time range', async () => {
      const now = Date.now();
      const metrics = [
        { type: 'test', value: 1, timestamp: new Date(now - 2000) },
        { type: 'test', value: 2, timestamp: new Date(now - 1000) },
        { type: 'test', value: 3, timestamp: new Date(now) }
      ];

      for (const m of metrics) {
        await db.saveMetric(m.type, m.value, {});
      }

      const retrieved = await db.getMetrics(
        'test',
        new Date(now - 1500),
        new Date(now - 500)
      );

      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].value).toBe(2);
    });
  });

  describe('health check', () => {
    it('should return connection status and latency', async () => {
      const health = await db.healthCheck();
      
      expect(health.isConnected).toBe(true);
      expect(typeof health.latency).toBe('number');
      expect(health.latency).toBeGreaterThan(0);
    });
  });

  describe('monitoring operations', () => {
    it('should track error metrics', async () => {
      const errorType = 'test_error';
      const errorMessage = 'Test error message';
      const labels = { service: 'test' };

      await db.saveMetric('error_count', 1, { ...labels, error_type: errorType });
      
      const metrics = await db.getMetrics(
        'error_count',
        new Date(Date.now() - 1000),
        new Date()
      );

      expect(metrics).toHaveLength(1);
      expect(metrics[0].labels.error_type).toBe(errorType);
      expect(metrics[0].labels.service).toBe('test');
    });

    it('should track performance metrics', async () => {
      const operation = 'test_operation';
      const duration = 100;
      const labels = { service: 'test' };

      await db.saveMetric('operation_duration', duration, { ...labels, operation });
      
      const metrics = await db.getMetrics(
        'operation_duration',
        new Date(Date.now() - 1000),
        new Date()
      );

      expect(metrics).toHaveLength(1);
      expect(metrics[0].value).toBe(duration);
      expect(metrics[0].labels.operation).toBe(operation);
    });

    it('should track resource metrics', async () => {
      const metrics = [
        { type: 'memory_usage', value: 1024, labels: { service: 'test', path: 'memory' } },
        { type: 'cpu_usage', value: 50, labels: { service: 'test', path: 'cpu' } },
        { type: 'disk_usage', value: 80, labels: { service: 'test', path: '/data' } }
      ];

      for (const m of metrics) {
        await db.saveMetric(m.type, m.value, m.labels);
      }

      for (const m of metrics) {
        const saved = await db.getMetrics(
          m.type,
          new Date(Date.now() - 1000),
          new Date()
        );

        expect(saved).toHaveLength(1);
        expect(saved[0].value).toBe(m.value);
        expect(saved[0].labels).toEqual(m.labels);
      }
    });

    it('should track task metrics', async () => {
      const task: SearchTask = {
        id: uuidv4(),
        type: 'search',
        status: 'completed',
        priority: '1',
        description: 'Test task',
        created: new Date(Date.now() - 1000),
        updated: new Date(),
        query: 'test',
        filters: {}
      };

      await db.saveTask(task);
      await db.saveMetric('task_duration', 500, { task_id: task.id, task_type: task.type });
      await db.saveMetric('task_success', 1, { task_id: task.id, task_type: task.type });

      const durations = await db.getMetrics(
        'task_duration',
        new Date(Date.now() - 2000),
        new Date()
      );

      const successes = await db.getMetrics(
        'task_success',
        new Date(Date.now() - 2000),
        new Date()
      );

      expect(durations).toHaveLength(1);
      expect(durations[0].value).toBe(500);
      expect(durations[0].labels.task_id).toBe(task.id);

      expect(successes).toHaveLength(1);
      expect(successes[0].value).toBe(1);
      expect(successes[0].labels.task_id).toBe(task.id);
    });

    it('should track API metrics', async () => {
      const metrics = [
        { type: 'api_latency', value: 50, labels: { endpoint: '/test', method: 'GET', status: '200' } },
        { type: 'api_error_count', value: 1, labels: { endpoint: '/test', method: 'POST', status: '400' } },
        { type: 'api_request_count', value: 10, labels: { endpoint: '/test', method: 'GET', status: '200' } }
      ];

      for (const m of metrics) {
        await db.saveMetric(m.type, m.value, m.labels);
      }

      for (const m of metrics) {
        const saved = await db.getMetrics(
          m.type,
          new Date(Date.now() - 1000),
          new Date()
        );

        expect(saved).toHaveLength(1);
        expect(saved[0].value).toBe(m.value);
        expect(saved[0].labels).toEqual(m.labels);
      }
    });
  });
}); 