import express from 'express';
import { createServer as createHttpServer } from 'node:http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import { createClient } from 'redis';
import dotenv from 'dotenv';
import type { WebSocketEvents } from '../../shared/types';
import authRoutes from './routes/auth';

// Load environment variables
dotenv.config();

// Create Redis client
export const redis = createClient({
  url: process.env.REDIS_URL
});

// Connect to Redis
redis.connect()
  .then(() => console.log('Connected to Redis'))
  .catch((err) => console.error('Redis connection error:', err));

export function createServer() {
  // Create Express app
  const app = express();
  const httpServer = createHttpServer(app);

  // Initialize Socket.IO
  const io = new Server<WebSocketEvents>(httpServer, {
    cors: {
      origin: process.env.CORS_ORIGIN,
      credentials: true
    },
    pingInterval: Number.parseInt(process.env.WS_PING_INTERVAL || '30000', 10),
    pingTimeout: Number.parseInt(process.env.WS_PING_TIMEOUT || '5000', 10)
  });

  // Middleware
  app.use(express.json());
  app.use(cors({
    origin: process.env.CORS_ORIGIN,
    credentials: true
  }));

  // Routes
  app.use('/api/auth', authRoutes);

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Connect to MongoDB
  const MONGODB_URI = process.env.MONGODB_URI;
  if (!MONGODB_URI) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  mongoose.connect(MONGODB_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

  // Error handling middleware
  app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.stack);
    res.status(500).json({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred'
      }
    });
  });

  return httpServer;
} 