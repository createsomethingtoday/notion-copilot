import { Router } from 'express';
import { getMetricsService } from '../monitoring/metrics';
import { databaseInitializer } from '../db/init';
import { Logger } from '../utils/logger';

const router = Router();
const logger = new Logger('HealthRouter');

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  components: {
    database: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latency: number;
      connectionCount: number;
      migrationStatus: number;
    };
    taskQueue: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      size: number;
      errorRate: number;
      processingTime: number;
    };
  };
}

type ComponentStatus = 'healthy' | 'degraded' | 'unhealthy';

/**
 * Get system health metrics for the last minute
 */
async function getHealthMetrics(): Promise<HealthStatus['components']> {
  const metrics = getMetricsService();
  const endTime = new Date();
  const startTime = new Date(endTime.getTime() - 60000); // Last minute

  try {
    // Get database metrics
    const [latency, connections, migrations] = await Promise.all([
      metrics.getMetricValues('db_query_latency', startTime, endTime),
      metrics.getMetricValues('db_connection_count', startTime, endTime),
      metrics.getMetricValues('db_migration_status', startTime, endTime)
    ]);

    // Get task queue metrics
    const [queueSize, errorCount, processingTime] = await Promise.all([
      metrics.getMetricValues('task_queue_size', startTime, endTime),
      metrics.getMetricValues('task_error_count', startTime, endTime),
      metrics.getMetricValues('task_processing_duration', startTime, endTime)
    ]);

    // Calculate averages and latest values
    let dbStatus: ComponentStatus = 'healthy';
    let taskStatus: ComponentStatus = 'healthy';

    const dbMetrics = {
      status: dbStatus,
      latency: getLastValue(latency, 0),
      connectionCount: getLastValue(connections, 0),
      migrationStatus: getLastValue(migrations, 0)
    };

    const taskMetrics = {
      status: taskStatus,
      size: getLastValue(queueSize, 0),
      errorRate: calculateRate(errorCount),
      processingTime: calculateAverage(processingTime)
    };

    // Determine component health
    if (dbMetrics.latency > 1000 || dbMetrics.connectionCount === 0) {
      dbStatus = 'degraded';
    }
    if (dbMetrics.latency > 5000 || dbMetrics.migrationStatus === 0) {
      dbStatus = 'unhealthy';
    }

    if (taskMetrics.errorRate > 0.1) {
      taskStatus = 'degraded';
    }
    if (taskMetrics.errorRate > 0.3 || taskMetrics.processingTime > 10000) {
      taskStatus = 'unhealthy';
    }

    return {
      database: { ...dbMetrics, status: dbStatus },
      taskQueue: { ...taskMetrics, status: taskStatus }
    };
  } catch (error) {
    logger.error('Failed to get health metrics', error as Error);
    throw error;
  }
}

/**
 * Get the last value from a metric series
 */
function getLastValue(metrics: Array<{ value: number }>, defaultValue: number): number {
  return metrics.length > 0 ? metrics[metrics.length - 1].value : defaultValue;
}

/**
 * Calculate average value from a metric series
 */
function calculateAverage(metrics: Array<{ value: number }>): number {
  if (metrics.length === 0) return 0;
  const sum = metrics.reduce((acc, m) => acc + m.value, 0);
  return sum / metrics.length;
}

/**
 * Calculate rate (per second) from a counter metric
 */
function calculateRate(metrics: Array<{ value: number }>): number {
  if (metrics.length < 2) return 0;
  const first = metrics[0].value;
  const last = metrics[metrics.length - 1].value;
  const duration = 60; // 1 minute in seconds
  return (last - first) / duration;
}

// Health check endpoint
router.get('/', async (req, res) => {
  try {
    const components = await getHealthMetrics();
    
    // Determine overall system health
    const status: HealthStatus['status'] = 
      components.database.status === 'unhealthy' || components.taskQueue.status === 'unhealthy'
        ? 'unhealthy'
        : components.database.status === 'degraded' || components.taskQueue.status === 'degraded'
        ? 'degraded'
        : 'healthy';

    const health: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      components
    };

    // Set appropriate status code
    const statusCode = status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed', error as Error);
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

// Detailed metrics endpoint
router.get('/metrics', async (req, res) => {
  try {
    const metrics = getMetricsService();
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - 300000); // Last 5 minutes

    const allMetrics = await Promise.all([
      metrics.getMetricValues('db_query_latency', startTime, endTime),
      metrics.getMetricValues('db_connection_count', startTime, endTime),
      metrics.getMetricValues('task_queue_size', startTime, endTime),
      metrics.getMetricValues('task_error_count', startTime, endTime),
      metrics.getMetricValues('task_processing_duration', startTime, endTime)
    ]);

    res.json({
      timestamp: endTime.toISOString(),
      metrics: {
        db_query_latency: allMetrics[0],
        db_connection_count: allMetrics[1],
        task_queue_size: allMetrics[2],
        task_error_count: allMetrics[3],
        task_processing_duration: allMetrics[4]
      }
    });
  } catch (error) {
    logger.error('Failed to get metrics', error as Error);
    res.status(500).json({
      error: 'Failed to get metrics',
      message: (error as Error).message
    });
  }
});

export default router; 