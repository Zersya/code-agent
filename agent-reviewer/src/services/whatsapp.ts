import axios, { AxiosResponse } from 'axios';
import dotenv from 'dotenv';
import { WhatsAppMessage, WhatsAppApiResponse, WhatsAppNotificationContext, NotificationType } from '../models/whatsapp.js';

dotenv.config();

// WhatsApp API configuration
const WHATSAPP_API_BASE_URL = process.env.WHATSAPP_API_BASE_URL || '';
const WHATSAPP_API_KEY = process.env.WHATSAPP_API_KEY || '';
const WHATSAPP_SESSION = process.env.WHATSAPP_SESSION || 'default';
const WHATSAPP_ENABLED = process.env.WHATSAPP_ENABLED === 'true';
const WHATSAPP_TIMEOUT = parseInt(process.env.WHATSAPP_TIMEOUT || '10000');

/**
 * Service for sending WhatsApp notifications
 */
export class WhatsAppService {
  private baseUrl: string;
  private apiKey: string;
  private session: string;
  private enabled: boolean;
  private timeout: number;

  constructor() {
    this.baseUrl = WHATSAPP_API_BASE_URL;
    this.apiKey = WHATSAPP_API_KEY;
    this.session = WHATSAPP_SESSION;
    this.enabled = WHATSAPP_ENABLED;
    this.timeout = WHATSAPP_TIMEOUT;

    if (this.enabled) {
      console.log('WhatsApp service initialized:', {
        baseUrl: this.baseUrl,
        session: this.session,
        enabled: this.enabled
      });
    } else {
      console.log('WhatsApp service is disabled');
    }
  }

  /**
   * Send a WhatsApp message
   */
  async sendMessage(message: WhatsAppMessage): Promise<WhatsAppApiResponse> {
    if (!this.enabled) {
      console.log('WhatsApp service is disabled, skipping message send');
      return {
        success: false,
        error: 'WhatsApp service is disabled'
      };
    }

    try {
      const url = `${this.baseUrl}/client/sendMessage/${this.session}`;
      
      const payload = {
        chatId: this.formatPhoneNumber(message.to),
        contentType: 'string',
        content: message.message
      };

      console.log('Sending WhatsApp message:', {
        url,
        to: message.to,
        messageLength: message.message.length
      });

      const response: AxiosResponse = await axios.post(url, payload, {
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        timeout: this.timeout
      });

      if (response.status === 200 && response.data) {
        console.log('WhatsApp message sent successfully:', response.data);
        return {
          success: true,
          message: 'Message sent successfully',
          messageId: response.data.messageId || response.data.id
        };
      } else {
        console.error('WhatsApp API returned unexpected response:', response.data);
        return {
          success: false,
          error: 'Unexpected response from WhatsApp API'
        };
      }
    } catch (error) {
      console.error('Error sending WhatsApp message:', error);
      
      if (axios.isAxiosError(error)) {
        const errorMessage = error.response?.data?.message || error.message;
        return {
          success: false,
          error: `WhatsApp API error: ${errorMessage}`
        };
      }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Send a test message
   */
  async sendTestMessage(phoneNumber: string, customMessage?: string): Promise<WhatsAppApiResponse> {
    const message = customMessage || 'Test message from Repopo Merge Request Reviewer Bot 🤖\n\nThis is a test to verify your WhatsApp notification setup is working correctly.';
    
    return this.sendMessage({
      to: phoneNumber,
      message: message
    });
  }

  /**
   * Send merge request notification
   */
  async sendMergeRequestNotification(
    phoneNumber: string,
    context: WhatsAppNotificationContext
  ): Promise<WhatsAppApiResponse> {
    const message = this.formatNotificationMessage(context);
    
    return this.sendMessage({
      to: phoneNumber,
      message: message
    });
  }

  /**
   * Format notification message based on context
   */
  private formatNotificationMessage(context: WhatsAppNotificationContext): string {
    const { type, projectName, mergeRequestTitle, mergeRequestUrl, authorName, assigneeName, reviewerName } = context;

    let message = '';
    let emoji = '';

    switch (type) {
      case 'merge_request_created':
        emoji = '🔄';
        message = `${emoji} *New Merge Request Created*\n\n`;
        message += `📁 *Project:* ${projectName}\n`;
        message += `📝 *Title:* ${mergeRequestTitle}\n`;
        message += `👤 *Author:* ${authorName}\n`;
        message += `🔗 *Link:* ${mergeRequestUrl}`;
        break;

      case 'merge_request_assigned':
        emoji = '👥';
        message = `${emoji} *Merge Request Assigned*\n\n`;
        message += `📁 *Project:* ${projectName}\n`;
        message += `📝 *Title:* ${mergeRequestTitle}\n`;
        message += `👤 *Author:* ${authorName}\n`;
        if (assigneeName) {
          message += `🎯 *Assigned to:* ${assigneeName}\n`;
        }
        message += `🔗 *Link:* ${mergeRequestUrl}`;
        break;

      case 'merge_request_merged':
        emoji = '✅';
        message = `${emoji} *Merge Request Merged*\n\n`;
        message += `📁 *Project:* ${projectName}\n`;
        message += `📝 *Title:* ${mergeRequestTitle}\n`;
        message += `👤 *Author:* ${authorName}\n`;
        message += `🔗 *Link:* ${mergeRequestUrl}`;
        break;

      case 'merge_request_closed':
        emoji = '❌';
        message = `${emoji} *Merge Request Closed*\n\n`;
        message += `📁 *Project:* ${projectName}\n`;
        message += `📝 *Title:* ${mergeRequestTitle}\n`;
        message += `👤 *Author:* ${authorName}\n`;
        message += `🔗 *Link:* ${mergeRequestUrl}`;
        break;

      case 'review_completed':
        emoji = '📋';
        message = `${emoji} *Code Review Completed*\n\n`;
        message += `📁 *Project:* ${projectName}\n`;
        message += `📝 *Title:* ${mergeRequestTitle}\n`;
        message += `👤 *Author:* ${authorName}\n`;
        if (reviewerName) {
          message += `🔍 *Reviewer:* ${reviewerName}\n`;
        }
        message += `🔗 *Link:* ${mergeRequestUrl}`;
        break;

      default:
        emoji = '📢';
        message = `${emoji} *Repopo Notification*\n\n`;
        message += `📁 *Project:* ${projectName}\n`;
        message += `📝 *Title:* ${mergeRequestTitle}\n`;
        message += `👤 *Author:* ${authorName}\n`;
        message += `🔗 *Link:* ${mergeRequestUrl}`;
    }

    message += '\n\n_Sent by Repopo Merge Request Reviewer Bot_';
    return message;
  }

  /**
   * Format phone number for WhatsApp API
   */
  private formatPhoneNumber(phoneNumber: string): string {
    // Remove all non-digit characters
    let cleaned = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present (assuming Indonesia +62 as default)
    if (!cleaned.startsWith('62') && cleaned.length >= 10) {
      // Remove leading 0 if present and add 62
      if (cleaned.startsWith('0')) {
        cleaned = '62' + cleaned.substring(1);
      } else {
        cleaned = '62' + cleaned;
      }
    }
    
    // Add @c.us suffix for WhatsApp
    return cleaned + '@c.us';
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phoneNumber: string): boolean {
    // Remove all non-digit characters
    const cleaned = phoneNumber.replace(/\D/g, '');
    
    // Check if it's a valid length (at least 10 digits)
    if (cleaned.length < 10) {
      return false;
    }
    
    // Check if it starts with valid country code or local format
    return /^(62|0)/.test(cleaned);
  }

  /**
   * Check if WhatsApp service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Get service configuration
   */
  getConfig() {
    return {
      enabled: this.enabled,
      baseUrl: this.baseUrl,
      session: this.session,
      timeout: this.timeout
    };
  }
}

export const whatsappService = new WhatsAppService();
