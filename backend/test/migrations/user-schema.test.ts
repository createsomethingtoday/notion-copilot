import { describe, it, expect } from '@jest/globals';
import { setupMigrationTest, getDatabaseState, getCollectionSchema } from './setup';
import mongoose from 'mongoose';

describe('User Schema Migrations', () => {
  setupMigrationTest();

  describe('Migration: Add email verification', () => {
    it('should add email verification fields to user schema', async () => {
      // Get initial schema
      const initialSchema = await getCollectionSchema('users');
      
      // Run migration
      await mongoose.connection.db.command({ 
        collMod: 'users',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['email'],
            properties: {
              email: { bsonType: 'string' },
              emailVerified: { bsonType: 'bool', default: false },
              verificationToken: { bsonType: 'string' }
            }
          }
        }
      });
      
      // Get updated schema
      const updatedSchema = await getCollectionSchema('users');
      
      // Verify schema changes
      expect(updatedSchema?.validator).toBeDefined();
      expect(updatedSchema?.validator.$jsonSchema.properties).toHaveProperty('emailVerified');
      expect(updatedSchema?.validator.$jsonSchema.properties).toHaveProperty('verificationToken');
      
      // Verify indexes
      const emailIndex = updatedSchema?.indexes.find(idx => idx.key.email === 1);
      expect(emailIndex).toBeDefined();
      expect(emailIndex?.unique).toBe(true);
    });

    it('should preserve existing user data during migration', async () => {
      // Create test user
      const testUser = {
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date()
      };
      
      await mongoose.connection.collection('users').insertOne(testUser);
      
      // Get initial state
      const initialState = await getDatabaseState();
      
      // Run migration
      await mongoose.connection.db.command({ 
        collMod: 'users',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['email'],
            properties: {
              email: { bsonType: 'string' },
              emailVerified: { bsonType: 'bool', default: false },
              verificationToken: { bsonType: 'string' }
            }
          }
        }
      });
      
      // Get final state
      const finalState = await getDatabaseState();
      
      // Verify user data is preserved
      expect(finalState.users).toHaveLength(1);
      expect(finalState.users[0]).toMatchObject({
        email: testUser.email,
        name: testUser.name,
        emailVerified: false // New field with default value
      });
    });

    it('should successfully rollback changes', async () => {
      // Run migration
      await mongoose.connection.db.command({ 
        collMod: 'users',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['email'],
            properties: {
              email: { bsonType: 'string' },
              emailVerified: { bsonType: 'bool', default: false },
              verificationToken: { bsonType: 'string' }
            }
          }
        }
      });
      
      // Get migrated schema
      const migratedSchema = await getCollectionSchema('users');
      
      // Run rollback
      await mongoose.connection.db.command({ 
        collMod: 'users',
        validator: {
          $jsonSchema: {
            bsonType: 'object',
            required: ['email'],
            properties: {
              email: { bsonType: 'string' }
            }
          }
        }
      });
      
      // Get rolled back schema
      const rolledBackSchema = await getCollectionSchema('users');
      
      // Verify schema is back to original state
      expect(rolledBackSchema?.validator.$jsonSchema.properties).not.toHaveProperty('emailVerified');
      expect(rolledBackSchema?.validator.$jsonSchema.properties).not.toHaveProperty('verificationToken');
      
      // Verify indexes are removed
      const emailIndex = rolledBackSchema?.indexes.find(idx => idx.key.email === 1);
      expect(emailIndex?.unique).toBeUndefined();
    });
  });
}); 