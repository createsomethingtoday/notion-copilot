import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createServer } from '../../src/server';
import { createClient } from 'redis';
import '@jest/globals';

// Mock redis-memory-server since it's not a real package
class MockRedisMemoryServer {
  private port: number;

  constructor() {
    this.port = Math.floor(Math.random() * 10000) + 10000;
  }

  async getConnectionString() {
    return `redis://localhost:${this.port}`;
  }

  async stop() {
    // No-op for mock
  }
}

const RedisMemoryServer = MockRedisMemoryServer;

let mongoServer: MongoMemoryServer;
let redisServer: RedisMemoryServer;
let redisClient: ReturnType<typeof createClient>;

beforeAll(async () => {
  // Setup MongoDB Memory Server
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  await mongoose.connect(mongoUri);

  // Setup Redis Memory Server
  redisServer = new RedisMemoryServer();
  const redisUri = await redisServer.getConnectionString();
  redisClient = createClient({ url: redisUri });
  await redisClient.connect();

  // Set environment variables for testing
  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongoUri;
  process.env.REDIS_URL = redisUri;
  process.env.JWT_SECRET = 'test-secret';
  process.env.NOTION_API_KEY = 'test-notion-key';
  process.env.OPENAI_API_KEY = 'test-openai-key';
});

beforeEach(async () => {
  // Clear all collections before each test
  const collections = await mongoose.connection.db.collections();
  for (const collection of collections) {
    await collection.deleteMany({});
  }
  
  // Clear Redis
  await redisClient.flushAll();
});

afterAll(async () => {
  // Cleanup
  await mongoose.disconnect();
  await redisClient.quit();
  await mongoServer.stop();
  await redisServer.stop();
});

// Export test server factory
export const createTestServer = () => {
  return createServer();
}; 