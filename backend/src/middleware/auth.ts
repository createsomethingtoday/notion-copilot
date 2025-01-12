import type { Request, Response, NextFunction } from 'express';
import { verifyToken, extractTokenFromHeader } from '../utils/jwt';
import { User, type IUser } from '../models/user';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    // Extract token from Authorization header
    const token = extractTokenFromHeader(req.headers.authorization);
    
    // Verify token
    const payload = verifyToken(token);
    
    // Get user from database
    const user = await User.findById(payload.userId);
    if (!user) {
      return res.status(401).json({
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not found'
        }
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: (error as Error).message
      }
    });
  }
}

export function requireVerified(req: Request, res: Response, next: NextFunction) {
  if (!req.user?.isVerified) {
    return res.status(403).json({
      error: {
        code: 'FORBIDDEN',
        message: 'Email verification required'
      }
    });
  }
  next();
} 