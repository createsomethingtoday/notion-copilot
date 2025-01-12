/// <reference types="jest" />

import { MongoMemoryServer } from 'mongodb-memory-server';
import type { RedisClientType } from 'redis';
import { PostgresAdapter } from '../src/db/postgres';
import { MonitoringService } from '../src/monitoring/service';
import type { Config } from '@jest/types';

// Mock redis client
const mockRedisClient = {
  quit: async () => undefined
} as unknown as RedisClientType;

// Global test utilities
declare global {
  // eslint-disable-next-line no-var
  var __MONGO__: MongoMemoryServer;
  // eslint-disable-next-line no-var
  var __REDIS__: RedisClientType;
  // eslint-disable-next-line no-var
  var __DB__: PostgresAdapter;
  // eslint-disable-next-line no-var
  var __MONITORING__: MonitoringService;

  namespace jest {
    interface Matchers<R> {
      toBeWithinRange(floor: number, ceiling: number): R;
    }
  }
}

// Setup before all tests
beforeAll(async () => {
  // Setup in-memory MongoDB
  const mongod = await MongoMemoryServer.create();
  global.__MONGO__ = mongod;

  // Setup Redis mock
  global.__REDIS__ = mockRedisClient;

  // Setup test monitoring
  global.__MONITORING__ = new MonitoringService({
    provider: 'datadog',
    apiKey: 'test',
    flushIntervalMs: 100,
    batchSize: 10
  });
});

// Cleanup after all tests
afterAll(async () => {
  // Cleanup MongoDB
  await global.__MONGO__.stop();

  // Cleanup Redis
  await global.__REDIS__.quit();

  // Cleanup monitoring
  await global.__MONITORING__.destroy();
});

// Reset state between tests
afterEach(() => {
  // Clear all mocks
  jest.resetAllMocks();
});

// Test utilities
export const createTestDb = async (): Promise<PostgresAdapter> => {
  // Create test database connection
  const db = new PostgresAdapter({
    host: 'localhost',
    port: 5432,
    database: 'test',
    user: 'test',
    password: 'test'
  });

  // Store globally
  global.__DB__ = db;

  return db;
};

export const getTestMonitoring = (): MonitoringService => {
  return global.__MONITORING__;
};

// Add custom matchers
expect.extend({
  toBeWithinRange(received: number, floor: number, ceiling: number) {
    const pass = received >= floor && received <= ceiling;
    if (pass) {
      return {
        message: () =>
          `expected ${received} not to be within range ${floor} - ${ceiling}`,
        pass: true,
      };
    }
    return {
      message: () =>
        `expected ${received} to be within range ${floor} - ${ceiling}`,
      pass: false,
    };
  },
}); 