import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { Document, Collection } from 'mongoose';
import { describe, beforeAll, afterAll, beforeEach } from '@jest/globals';
import { WithId } from 'mongodb';

let mongoServer: MongoMemoryServer;

export const setupMigrationTest = () => {
  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = mongoUri;
  });

  beforeEach(async () => {
    // Clear all collections before each test
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });
};

// Helper to get database state
export const getDatabaseState = async () => {
  const collections = await mongoose.connection.db.collections();
  const state: Record<string, WithId<Document>[]> = {};

  for (const collection of collections) {
    state[collection.collectionName] = await collection.find({}).toArray();
  }

  return state;
};

// Helper to get collection schema
export const getCollectionSchema = async (collectionName: string) => {
  try {
    const collection = mongoose.connection.collection(collectionName);
    // Get collection validation info
    const collInfo = await mongoose.connection.db
      .listCollections({ name: collectionName })
      .next();
    // Get indexes
    const indexes = await collection.indexes();
    
    return {
      validator: collInfo?.options?.validator || null,
      indexes
    };
  } catch (error) {
    return null;
  }
}; 