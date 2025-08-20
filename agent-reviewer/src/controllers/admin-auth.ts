import { Request, Response } from 'express';
import { verifyAdminSecret, generateAdminToken, type AdminUser, type AuthenticatedRequest } from '../middleware/admin-auth.js';

/**
 * Admin login endpoint
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { secretKey } = req.body;

    if (!secretKey) {
      res.status(400).json({
        success: false,
        message: 'Secret key is required'
      });
      return;
    }

    // Verify the secret key
    if (!verifyAdminSecret(secretKey)) {
      res.status(401).json({
        success: false,
        message: 'Invalid secret key'
      });
      return;
    }

    // Create admin user object
    const adminUser: AdminUser = {
      id: 'admin',
      username: 'admin',
      role: 'administrator'
    };

    // Generate JWT token
    const token = generateAdminToken(adminUser);

    res.json({
      success: true,
      token,
      user: adminUser
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Admin logout endpoint
 */
export const adminLogout = async (req: Request, res: Response): Promise<void> => {
  try {
    // For JWT tokens, logout is handled client-side by removing the token
    // In a production environment, you might want to implement token blacklisting
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

/**
 * Get current admin user info
 */
export const getAdminUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        user: req.user
      }
    });
  } catch (error) {
    console.error('Get admin user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
