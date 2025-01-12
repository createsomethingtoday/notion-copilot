import 'dotenv/config';
import { databaseInitializer } from '../db/init';
import { initializeMetrics } from '../monitoring/metrics';
import { Logger } from '../utils/logger';

const logger = new Logger('DatabaseInit');

interface ScriptOptions {
  migrateOnly: boolean;
  rollback: boolean;
}

function parseArgs(): ScriptOptions {
  const args = process.argv.slice(2);
  return {
    migrateOnly: args.includes('--migrate-only'),
    rollback: args.includes('--rollback')
  };
}

async function initializeDatabase(): Promise<void> {
  const options = parseArgs();

  // Validate conflicting options
  if (options.migrateOnly && options.rollback) {
    logger.error('Cannot specify both --migrate-only and --rollback');
    process.exit(1);
  }

  try {
    if (options.migrateOnly) {
      logger.info('Running migrations only');
    } else if (options.rollback) {
      logger.info('Rolling back last migration');
    } else {
      logger.info('Starting full database initialization');
    }

    // Initialize database with options
    const db = await databaseInitializer.initialize(options);

    // For full initialization, also set up metrics
    if (!options.migrateOnly && !options.rollback) {
      // Initialize metrics service
      const metrics = initializeMetrics(db);
      logger.info('Metrics service initialized');

      // Record initial metrics
      await Promise.all([
        metrics.recordMetric('db_connection_count', 1),
        metrics.recordMetric('task_queue_size', 0),
        metrics.recordMetric('task_error_count', 0)
      ]);
      logger.info('Initial metrics recorded');

      // Cleanup metrics
      await metrics.shutdown();
    }

    // Cleanup database
    await databaseInitializer.shutdown();
    logger.info('Database connections closed');

    if (options.migrateOnly) {
      logger.info('Migrations completed successfully');
    } else if (options.rollback) {
      logger.info('Rollback completed successfully');
    } else {
      logger.info('Database initialization completed successfully');
    }

    process.exit(0);
  } catch (error) {
    logger.error('Database operation failed', error as Error);
    process.exit(1);
  }
}

// Run initialization
initializeDatabase().catch(error => {
  logger.error('Unhandled error during database operation', error as Error);
  process.exit(1);
}); 