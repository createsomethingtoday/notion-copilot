import jwt from 'jsonwebtoken';
import type { IUser } from '../models/user';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

interface TokenPayload {
  userId: string;
  email: string;
}

export function generateToken(user: IUser): string {
  const payload: TokenPayload = {
    userId: user._id.toString(),
    email: user.email
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN
  });
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  } catch (error) {
    throw new Error('Invalid token');
  }
}

export function extractTokenFromHeader(header: string | undefined): string {
  if (!header || !header.startsWith('Bearer ')) {
    throw new Error('No token provided');
  }
  
  return header.split(' ')[1];
} 