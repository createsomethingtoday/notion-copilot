import type { Pool } from 'pg';
import { Logger } from '../../utils/logger';
import { SCHEMA_SQL, MIGRATION_TABLE_SQL } from '../schema';

interface Migration {
  version: number;
  name: string;
  up: string;
  down: string;
}

export class MigrationManager {
  private pool: Pool;
  private logger: Logger;

  constructor(pool: Pool) {
    this.pool = pool;
    this.logger = new Logger('MigrationManager');
  }

  /**
   * Initialize migration tracking
   */
  private async initMigrationTable(): Promise<void> {
    await this.pool.query(MIGRATION_TABLE_SQL);
  }

  /**
   * Get current schema version
   */
  private async getCurrentVersion(): Promise<number> {
    const result = await this.pool.query(
      'SELECT version FROM schema_migrations ORDER BY version DESC LIMIT 1'
    );
    return result.rows.length > 0 ? result.rows[0].version : 0;
  }

  /**
   * Apply initial schema
   */
  private async applyInitialSchema(): Promise<void> {
    await this.pool.query(SCHEMA_SQL);
    await this.recordMigration(1, 'Initial schema');
  }

  /**
   * Record a completed migration
   */
  private async recordMigration(version: number, name: string): Promise<void> {
    await this.pool.query(
      'INSERT INTO schema_migrations (version) VALUES ($1)',
      [version]
    );
    this.logger.info(`Applied migration ${version}: ${name}`);
  }

  /**
   * Remove a migration record
   */
  private async removeMigration(version: number): Promise<void> {
    await this.pool.query(
      'DELETE FROM schema_migrations WHERE version = $1',
      [version]
    );
    this.logger.info(`Rolled back migration ${version}`);
  }

  /**
   * Get all available migrations
   */
  private getMigrations(): Migration[] {
    // For now, just return the initial schema migration
    // In the future, this would load migration files dynamically
    return [
      {
        version: 1,
        name: 'Initial schema',
        up: SCHEMA_SQL,
        down: `
          DROP TABLE IF EXISTS metrics;
          DROP TABLE IF EXISTS task_results;
          DROP TABLE IF EXISTS tasks;
          DROP TYPE IF EXISTS task_status;
          DROP TYPE IF EXISTS task_priority;
        `
      }
    ];
  }

  /**
   * Run all pending migrations
   */
  async migrate(): Promise<void> {
    await this.initMigrationTable();
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrations();

    for (const migration of migrations) {
      if (migration.version > currentVersion) {
        this.logger.info(`Applying migration ${migration.version}: ${migration.name}`);
        
        const client = await this.pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(migration.up);
          await this.recordMigration(migration.version, migration.name);
          await client.query('COMMIT');
        } catch (error) {
          await client.query('ROLLBACK');
          this.logger.error(
            `Failed to apply migration ${migration.version}`,
            error as Error
          );
          throw error;
        } finally {
          client.release();
        }
      }
    }
  }

  /**
   * Rollback the last migration
   */
  async rollback(): Promise<void> {
    const currentVersion = await this.getCurrentVersion();
    if (currentVersion === 0) {
      this.logger.info('No migrations to roll back');
      return;
    }

    const migrations = this.getMigrations();
    const migration = migrations.find(m => m.version === currentVersion);
    
    if (!migration) {
      throw new Error(`Migration ${currentVersion} not found`);
    }

    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(migration.down);
      await this.removeMigration(migration.version);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error(
        `Failed to roll back migration ${migration.version}`,
        error as Error
      );
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if database is up to date
   */
  async isUpToDate(): Promise<boolean> {
    const currentVersion = await this.getCurrentVersion();
    const migrations = this.getMigrations();
    return currentVersion === Math.max(...migrations.map(m => m.version));
  }
} 