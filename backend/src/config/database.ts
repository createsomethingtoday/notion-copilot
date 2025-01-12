import type { PostgresConfig } from '../db/postgres';

interface DatabaseConfig {
  postgres: PostgresConfig;
}

export const databaseConfig: DatabaseConfig = {
  postgres: {
    host: process.env.POSTGRES_HOST ?? 'localhost',
    port: Number.parseInt(process.env.POSTGRES_PORT ?? '5432', 10),
    database: process.env.POSTGRES_DB ?? 'notion_assistant',
    user: process.env.POSTGRES_USER ?? 'postgres',
    password: process.env.POSTGRES_PASSWORD ?? 'postgres',
    maxConnections: Number.parseInt(process.env.POSTGRES_MAX_CONNECTIONS ?? '20', 10),
    minConnections: Number.parseInt(process.env.POSTGRES_MIN_CONNECTIONS ?? '4', 10),
    connectionTimeoutMs: Number.parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT ?? '10000', 10),
    idleTimeoutMs: Number.parseInt(process.env.POSTGRES_IDLE_TIMEOUT ?? '30000', 10),
    ssl: process.env.POSTGRES_SSL === 'true' ? {
      rejectUnauthorized: false
    } : undefined
  }
};

// Validate required configuration
const requiredEnvVars = [
  'POSTGRES_HOST',
  'POSTGRES_DB',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD'
];

export function validateDatabaseConfig(): void {
  const missingVars = requiredEnvVars.filter(
    varName => !process.env[varName]
  );

  if (missingVars.length > 0) {
    throw new Error(
      `Missing required database configuration: ${missingVars.join(', ')}`
    );
  }
} 