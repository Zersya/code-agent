import { Request, Response } from 'express';
import { dbService } from '../services/database.js';
import { whatsappService } from '../services/whatsapp.js';
import { WhatsAppConfiguration, NotificationType } from '../models/whatsapp.js';

/**
 * Get all WhatsApp configurations
 */
export const getWhatsAppConfigurations = async (req: Request, res: Response): Promise<void> => {
  try {
    console.log('Getting WhatsApp configurations...');
    const configurations = await dbService.getWhatsAppConfigurations();
    console.log('Retrieved configurations:', configurations.length);

    // Transform database records to API format
    const transformedConfigurations = configurations.map(config => ({
      id: config.id,
      gitlabUsername: config.gitlab_username,
      whatsappNumber: config.whatsapp_number,
      isActive: config.is_active,
      notificationTypes: JSON.parse(config.notification_types),
      createdAt: config.created_at,
      updatedAt: config.updated_at
    }));

    console.log('Sending response with', transformedConfigurations.length, 'configurations');
    res.json({
      success: true,
      data: transformedConfigurations
    });
  } catch (error) {
    console.error('Error getting WhatsApp configurations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WhatsApp configurations'
    });
  }
};

/**
 * Get WhatsApp configuration by GitLab username
 */
export const getWhatsAppConfiguration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;
    
    if (!username) {
      res.status(400).json({
        success: false,
        error: 'Username is required'
      });
      return;
    }

    const config = await dbService.getWhatsAppConfigurationByUsername(username);
    
    if (!config) {
      res.status(404).json({
        success: false,
        error: 'WhatsApp configuration not found'
      });
      return;
    }

    // Transform database record to API format
    const transformedConfig = {
      id: config.id,
      gitlabUsername: config.gitlab_username,
      whatsappNumber: config.whatsapp_number,
      isActive: config.is_active,
      notificationTypes: JSON.parse(config.notification_types),
      createdAt: config.created_at,
      updatedAt: config.updated_at
    };

    res.json({
      success: true,
      data: transformedConfig
    });
  } catch (error) {
    console.error('Error getting WhatsApp configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WhatsApp configuration'
    });
  }
};

/**
 * Create or update WhatsApp configuration
 */
export const upsertWhatsAppConfiguration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { gitlabUsername, whatsappNumber, isActive, notificationTypes } = req.body;

    // Validation
    if (!gitlabUsername || !whatsappNumber) {
      res.status(400).json({
        success: false,
        error: 'GitLab username and WhatsApp number are required'
      });
      return;
    }

    // Validate phone number format
    if (!whatsappService.validatePhoneNumber(whatsappNumber)) {
      res.status(400).json({
        success: false,
        error: 'Invalid WhatsApp number format'
      });
      return;
    }

    // Validate notification types
    const validNotificationTypes: NotificationType[] = [
      'merge_request_created',
      'merge_request_assigned',
      'merge_request_merged',
      'merge_request_closed',
      'review_completed'
    ];

    if (notificationTypes && !Array.isArray(notificationTypes)) {
      res.status(400).json({
        success: false,
        error: 'Notification types must be an array'
      });
      return;
    }

    if (notificationTypes) {
      const invalidTypes = notificationTypes.filter((type: string) => 
        !validNotificationTypes.includes(type as NotificationType)
      );
      
      if (invalidTypes.length > 0) {
        res.status(400).json({
          success: false,
          error: `Invalid notification types: ${invalidTypes.join(', ')}`
        });
        return;
      }
    }

    const config = await dbService.upsertWhatsAppConfiguration({
      gitlabUsername,
      whatsappNumber,
      isActive: isActive !== undefined ? isActive : true,
      notificationTypes: notificationTypes || ['merge_request_created', 'merge_request_assigned']
    });

    // Transform database record to API format
    const transformedConfig = {
      id: config.id,
      gitlabUsername: config.gitlab_username,
      whatsappNumber: config.whatsapp_number,
      isActive: config.is_active,
      notificationTypes: JSON.parse(config.notification_types),
      createdAt: config.created_at,
      updatedAt: config.updated_at
    };

    res.json({
      success: true,
      data: transformedConfig,
      message: 'WhatsApp configuration saved successfully'
    });
  } catch (error) {
    console.error('Error upserting WhatsApp configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to save WhatsApp configuration'
    });
  }
};

/**
 * Delete WhatsApp configuration
 */
export const deleteWhatsAppConfiguration = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;
    
    if (!username) {
      res.status(400).json({
        success: false,
        error: 'Username is required'
      });
      return;
    }

    const deleted = await dbService.deleteWhatsAppConfiguration(username);
    
    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'WhatsApp configuration not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'WhatsApp configuration deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting WhatsApp configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete WhatsApp configuration'
    });
  }
};

/**
 * Test WhatsApp message sending
 */
export const testWhatsAppMessage = async (req: Request, res: Response): Promise<void> => {
  try {
    const { whatsappNumber, message } = req.body;

    if (!whatsappNumber) {
      res.status(400).json({
        success: false,
        error: 'WhatsApp number is required'
      });
      return;
    }

    // Validate phone number format
    if (!whatsappService.validatePhoneNumber(whatsappNumber)) {
      res.status(400).json({
        success: false,
        error: 'Invalid WhatsApp number format'
      });
      return;
    }

    // Check if WhatsApp service is enabled
    if (!whatsappService.isEnabled()) {
      res.status(503).json({
        success: false,
        error: 'WhatsApp service is currently disabled'
      });
      return;
    }

    const result = await whatsappService.sendTestMessage(whatsappNumber, message);

    if (result.success) {
      res.json({
        success: true,
        data: {
          message: 'Test message sent successfully',
          messageId: result.messageId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || 'Failed to send test message'
      });
    }
  } catch (error) {
    console.error('Error sending test WhatsApp message:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send test message'
    });
  }
};

/**
 * Get WhatsApp service status
 */
export const getWhatsAppServiceStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const config = whatsappService.getConfig();
    
    res.json({
      success: true,
      data: {
        enabled: config.enabled,
        baseUrl: config.baseUrl,
        session: config.session,
        timeout: config.timeout
      }
    });
  } catch (error) {
    console.error('Error getting WhatsApp service status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get WhatsApp service status'
    });
  }
};
