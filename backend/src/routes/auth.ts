import type { Request, Response } from 'express';
import { Router } from 'express';
import { User } from '../models/user';
import { generateToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import { createRateLimiter } from '../middleware/rate-limit';
import { redis } from '../server';
import { MonitoringService } from '../monitoring/service';

interface RegisterRequest extends Request {
  body: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }
}

interface LoginRequest extends Request {
  body: {
    email: string;
    password: string;
  }
}

const router = Router();

// Initialize monitoring service
const monitoring = new MonitoringService({
  provider: 'datadog',
  apiKey: process.env.DATADOG_API_KEY || 'dev',
  flushIntervalMs: 10000,
  batchSize: 100,
  tags: {
    service: 'auth',
    environment: process.env.NODE_ENV || 'development'
  }
});

// Create rate limiters with type assertion for Redis client
const loginLimiter = createRateLimiter(redis as any, monitoring, {
  points: 5,           // 5 attempts
  duration: 300,       // per 5 minutes
  blockDuration: 900,  // block for 15 minutes
  keyPrefix: 'rl:auth:login'
});

const registerLimiter = createRateLimiter(redis as any, monitoring, {
  points: 3,           // 3 attempts
  duration: 3600,      // per hour
  blockDuration: 7200, // block for 2 hours
  keyPrefix: 'rl:auth:register'
});

// Register new user
router.post('/register', registerLimiter, async (req: RegisterRequest, res: Response) => {
  try {
    const { email, password, firstName, lastName } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        error: {
          code: 'USER_EXISTS',
          message: 'User with this email already exists'
        }
      });
    }

    // Create new user
    const user = new User({
      email,
      password,
      firstName,
      lastName
    });

    await user.save();

    // Generate token
    const token = generateToken(user);

    // Track successful registration
    monitoring.trackUser(user._id.toString(), 'register', true);

    res.status(201).json({
      message: 'User registered successfully',
      token
    });
  } catch (error) {
    monitoring.trackUser(req.body.email, 'register', false, {
      error: (error as Error).message
    });
    res.status(500).json({
      error: {
        code: 'REGISTRATION_FAILED',
        message: (error as Error).message
      }
    });
  }
});

// Login user
router.post('/login', loginLimiter, async (req: LoginRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
    const user = await User.findOne({ email });
    if (!user) {
      monitoring.trackUser(email, 'login', false, {
        reason: 'user_not_found'
      });
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Verify password
    const isValid = await user.comparePassword(password);
    if (!isValid) {
      monitoring.trackUser(user._id.toString(), 'login', false, {
        reason: 'invalid_password'
      });
      return res.status(401).json({
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user);

    // Track successful login
    monitoring.trackUser(user._id.toString(), 'login', true);

    res.json({
      message: 'Login successful',
      token
    });
  } catch (error) {
    monitoring.trackUser(req.body.email, 'login', false, {
      error: (error as Error).message
    });
    res.status(500).json({
      error: {
        code: 'LOGIN_FAILED',
        message: (error as Error).message
      }
    });
  }
});

// Verify token and get user info
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user;
    if (!user) {
      monitoring.trackUser('unknown', 'get_profile', false, {
        reason: 'user_not_found'
      });
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found'
        }
      });
    }

    // Track successful profile fetch
    monitoring.trackUser(user._id.toString(), 'get_profile', true);

    res.json({
      user: {
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        isVerified: user.isVerified,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    monitoring.trackUser(req.user?._id?.toString() || 'unknown', 'get_profile', false, {
      error: (error as Error).message
    });
    res.status(500).json({
      error: {
        code: 'FETCH_USER_FAILED',
        message: (error as Error).message
      }
    });
  }
});

export default router; 