import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const ADMIN_SECRET_KEY = process.env.ADMIN_SECRET_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'default-jwt-secret-change-in-production';

if (!ADMIN_SECRET_KEY) {
  console.warn('ADMIN_SECRET_KEY is not set. Admin authentication will be disabled.');
}

export interface AdminUser {
  id: string;
  username: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AdminUser;
}

/**
 * Middleware to authenticate admin dashboard requests
 * 
 * Clients should send an Authorization header with Bearer token
 * This middleware verifies that the token is valid and contains admin user info
 */
export const adminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ 
      success: false,
      error: 'Unauthorized: Missing or invalid authorization header' 
    });
    return;
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AdminUser;
    req.user = decoded;
    next();
  } catch (error) {
    console.error('Admin authentication failed:', error);
    res.status(401).json({ 
      success: false,
      error: 'Unauthorized: Invalid token' 
    });
  }
};

/**
 * Generate JWT token for admin user
 */
export const generateAdminToken = (user: AdminUser): string => {
  return jwt.sign(user, JWT_SECRET, { expiresIn: '24h' });
};

/**
 * Verify admin secret key
 */
export const verifyAdminSecret = (secretKey: string): boolean => {
  if (!ADMIN_SECRET_KEY) {
    console.warn('Admin secret key verification skipped: ADMIN_SECRET_KEY not configured');
    return true; // Allow access if not configured (for development)
  }
  
  return secretKey === ADMIN_SECRET_KEY;
};
