// WhatsApp configuration models

export interface WhatsAppConfiguration {
  id?: number;
  gitlabUsername: string;
  whatsappNumber: string;
  isActive: boolean;
  notificationTypes: NotificationType[];
  createdAt?: Date;
  updatedAt?: Date;
}

export type NotificationType = 
  | 'merge_request_created'
  | 'merge_request_assigned'
  | 'merge_request_merged'
  | 'merge_request_closed'
  | 'review_completed';

export interface WhatsAppMessage {
  to: string;
  message: string;
  type?: 'text' | 'media';
}

export interface WhatsAppNotificationContext {
  type: NotificationType;
  projectName: string;
  mergeRequestTitle: string;
  mergeRequestUrl: string;
  authorName: string;
  assigneeName?: string;
  reviewerName?: string;
}

export interface WhatsAppApiResponse {
  success: boolean;
  message?: string;
  error?: string;
  messageId?: string;
}

// Database record type (matches database schema)
export interface WhatsAppConfigurationRecord {
  id: number;
  gitlab_username: string;
  whatsapp_number: string;
  is_active: boolean;
  notification_types: string | NotificationType[]; // JSONB can return as string or parsed object
  created_at: Date;
  updated_at: Date;
}
