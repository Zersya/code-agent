// Webhook processing models for duplicate prevention

/**
 * Webhook processing status enum
 */
export enum WebhookProcessingStatus {
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed'
}

/**
 * Interface for webhook processing record
 */
export interface WebhookProcessingRecord {
  id: string;
  webhookKey: string;
  eventType: string;
  projectId: number;
  status: WebhookProcessingStatus;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  serverId?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for webhook identification
 */
export interface WebhookIdentifier {
  eventType: string;
  projectId: number;
  uniqueKey: string;
}

/**
 * Interface for webhook processing result
 */
export interface WebhookProcessingResult {
  success: boolean;
  isDuplicate: boolean;
  processingId?: string;
  error?: string;
}

/**
 * Configuration for webhook processing
 */
export interface WebhookProcessingConfig {
  maxProcessingTimeMinutes: number;
  cleanupIntervalMinutes: number;
  serverId: string;
}
