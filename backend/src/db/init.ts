import { PostgresAdapter } from './postgres';
import { MigrationManager } from './migrations';
import { databaseConfig, validateDatabaseConfig } from '../config/database';
import { Logger } from '../utils/logger';

export class DatabaseInitializer {
  private adapter!: PostgresAdapter;
  private migrations!: MigrationManager;
  private readonly logger: Logger;
  private healthCheckInterval?: ReturnType<typeof setInterval>;

  constructor() {
    this.logger = new Logger('DatabaseInitializer');
  }

  /**
   * Initialize the database connection and run migrations
   */
  async initialize(options: { migrateOnly?: boolean; rollback?: boolean } = {}): Promise<PostgresAdapter> {
    try {
      // Validate configuration
      validateDatabaseConfig();

      // Create adapter
      this.adapter = new PostgresAdapter(databaseConfig.postgres);
      this.migrations = new MigrationManager(this.adapter.getMigrationPool());

      // Handle migration options
      if (options.rollback) {
        await this.migrations.rollback();
        this.logger.info('Migration rollback completed');
      } else if (options.migrateOnly) {
        await this.migrations.migrate();
        this.logger.info('Migrations completed');
      } else {
        // Full initialization
        await this.migrations.migrate();
        this.startHealthChecks();
        this.logger.info('Database initialized successfully');
      }

      return this.adapter;
    } catch (error) {
      this.logger.error('Failed to initialize database', error as Error);
      throw error;
    }
  }

  /**
   * Start periodic health checks
   */
  private startHealthChecks(): void {
    const HEALTH_CHECK_INTERVAL = 30000; // 30 seconds

    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.checkHealth();
      } catch (error) {
        this.logger.error('Health check failed', error as Error);
      }
    }, HEALTH_CHECK_INTERVAL);

    this.healthCheckInterval.unref();
  }

  /**
   * Perform a health check
   */
  private async checkHealth(): Promise<void> {
    const metrics: Record<string, number> = {
      connectionCount: 0,
      migrationStatus: 0,
      queryLatency: 0
    };

    try {
      // Check database health
      const health = await this.adapter.healthCheck();
      metrics.queryLatency = health.latency;
      metrics.connectionCount = health.isConnected ? 1 : 0;

      // Check migrations
      const isUpToDate = await this.migrations.isUpToDate();
      metrics.migrationStatus = isUpToDate ? 1 : 0;

      // Record metrics
      await this.adapter.saveMetric('db_connection_count', metrics.connectionCount);
      await this.adapter.saveMetric('db_query_latency', metrics.queryLatency);
      await this.adapter.saveMetric('db_migration_status', metrics.migrationStatus);

      this.logger.debug('Health check completed', { metrics });
    } catch (error) {
      this.logger.error('Health check failed', error as Error, { metrics });
      throw error;
    }
  }

  /**
   * Stop health checks and close connections
   */
  async shutdown(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    try {
      await this.adapter.close();
      this.logger.info('Database connections closed');
    } catch (error) {
      this.logger.error('Error closing database connections', error as Error);
      throw error;
    }
  }

  /**
   * Get the database adapter
   */
  getAdapter(): PostgresAdapter {
    if (!this.adapter) {
      throw new Error('Database not initialized');
    }
    return this.adapter;
  }
}

// Export singleton instance
export const databaseInitializer = new DatabaseInitializer(); 