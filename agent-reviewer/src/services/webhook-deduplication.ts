import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { dbService } from './database.js';
import {
  WebhookProcessingRecord,
  WebhookProcessingStatus,
  WebhookIdentifier,
  WebhookProcessingResult,
  WebhookProcessingConfig
} from '../models/webhook.js';
import { GitLabWebhookEvent, GitLabPushEvent, GitLabMergeRequestEvent, GitLabNoteEvent, GitLabEmojiEvent } from '../types/webhook.js';

/**
 * Service for preventing duplicate webhook processing
 */
class WebhookDeduplicationService {
  private config: WebhookProcessingConfig;
  private serverId: string;
  private cleanupInterval?: NodeJS.Timeout;

  constructor() {
    this.serverId = process.env.SERVER_ID || `server-${uuidv4()}`;
    this.config = {
      maxProcessingTimeMinutes: parseInt(process.env.WEBHOOK_MAX_PROCESSING_TIME_MINUTES || '30'),
      cleanupIntervalMinutes: parseInt(process.env.WEBHOOK_CLEANUP_INTERVAL_MINUTES || '5'),
      serverId: this.serverId
    };

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Generate a unique webhook key based on the event content
   */
  generateWebhookKey(event: GitLabWebhookEvent): string {
    let keyData: string;

    switch (event.object_kind) {
      case 'push':
        const pushEvent = event as GitLabPushEvent;
        keyData = `push-${pushEvent.project_id}-${pushEvent.after}-${pushEvent.ref}`;
        break;

      case 'merge_request':
        const mrEvent = event as GitLabMergeRequestEvent;
        keyData = `mr-${mrEvent.project.id}-${mrEvent.object_attributes.iid}-${mrEvent.object_attributes.last_commit.id}-${mrEvent.object_attributes.action}`;
        break;

      case 'note':
        const noteEvent = event as GitLabNoteEvent;
        keyData = `note-${noteEvent.project_id}-${noteEvent.object_attributes.id}-${noteEvent.object_attributes.updated_at}`;
        break;

      case 'emoji':
        const emojiEvent = event as GitLabEmojiEvent;
        keyData = `emoji-${emojiEvent.project_id}-${emojiEvent.object_attributes.id}-${emojiEvent.object_attributes.updated_at}`;
        break;

      default:
        keyData = `unknown-${JSON.stringify(event)}`;
    }

    // Generate a hash of the key data for consistent length
    return crypto.createHash('sha256').update(keyData).digest('hex');
  }

  /**
   * Create webhook identifier from event
   */
  createWebhookIdentifier(event: GitLabWebhookEvent): WebhookIdentifier {
    const webhookKey = this.generateWebhookKey(event);

    let projectId: number;
    switch (event.object_kind) {
      case 'push':
        projectId = (event as GitLabPushEvent).project_id;
        break;
      case 'merge_request':
        projectId = (event as GitLabMergeRequestEvent).project.id;
        break;
      case 'note':
        projectId = (event as GitLabNoteEvent).project_id;
        break;
      case 'emoji':
        projectId = (event as GitLabEmojiEvent).project_id;
        break;
      default:
        throw new Error(`Unsupported event type: ${(event as any).object_kind}`);
    }

    return {
      eventType: event.object_kind,
      projectId,
      uniqueKey: webhookKey
    };
  }

  /**
   * Check if webhook is already being processed and create processing record if not
   */
  async startWebhookProcessing(event: GitLabWebhookEvent): Promise<WebhookProcessingResult> {
    try {
      const identifier = this.createWebhookIdentifier(event);

      // Check if this webhook is already being processed
      const existingRecord = await dbService.getActiveWebhookProcessing(identifier.uniqueKey);

      if (existingRecord) {
        console.log(`Webhook ${identifier.uniqueKey} is already being processed (ID: ${existingRecord.id}), skipping duplicate`);
        return {
          success: true,
          isDuplicate: true,
          processingId: existingRecord.id
        };
      }

      // Create new processing record
      const processingId = uuidv4();
      const processingRecord: WebhookProcessingRecord = {
        id: processingId,
        webhookKey: identifier.uniqueKey,
        eventType: identifier.eventType,
        projectId: identifier.projectId,
        status: WebhookProcessingStatus.PROCESSING,
        startedAt: new Date(),
        serverId: this.serverId,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await dbService.createWebhookProcessing(processingRecord);

      console.log(`Started processing webhook ${identifier.uniqueKey} with ID ${processingId}`);

      return {
        success: true,
        isDuplicate: false,
        processingId
      };
    } catch (error) {
      console.error('Error starting webhook processing:', error);
      return {
        success: false,
        isDuplicate: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Mark webhook processing as completed
   */
  async completeWebhookProcessing(processingId: string): Promise<void> {
    try {
      await dbService.updateWebhookProcessingStatus(
        processingId,
        WebhookProcessingStatus.COMPLETED,
        new Date()
      );
      console.log(`Completed webhook processing ${processingId}`);
    } catch (error) {
      console.error(`Error completing webhook processing ${processingId}:`, error);
    }
  }

  /**
   * Mark webhook processing as failed
   */
  async failWebhookProcessing(processingId: string, error: string): Promise<void> {
    try {
      await dbService.updateWebhookProcessingStatus(
        processingId,
        WebhookProcessingStatus.FAILED,
        new Date(),
        error
      );
      console.log(`Failed webhook processing ${processingId}: ${error}`);
    } catch (dbError) {
      console.error(`Error updating failed webhook processing ${processingId}:`, dbError);
    }
  }

  /**
   * Clean up stale processing records
   */
  async cleanupStaleProcessing(): Promise<void> {
    try {
      const cutoffTime = new Date();
      cutoffTime.setMinutes(cutoffTime.getMinutes() - this.config.maxProcessingTimeMinutes);

      const cleanedCount = await dbService.cleanupStaleWebhookProcessing(cutoffTime);

      if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} stale webhook processing records`);
      }
    } catch (error) {
      console.error('Error cleaning up stale webhook processing:', error);
    }
  }

  /**
   * Start periodic cleanup of stale processing records
   */
  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(
      () => this.cleanupStaleProcessing(),
      this.config.cleanupIntervalMinutes * 60 * 1000
    );

    console.log(`Started periodic webhook cleanup every ${this.config.cleanupIntervalMinutes} minutes`);
  }

  /**
   * Stop periodic cleanup
   */
  stopPeriodicCleanup(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = undefined;
      console.log('Stopped periodic webhook cleanup');
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    active: number;
    completed: number;
    failed: number;
  }> {
    return await dbService.getWebhookProcessingStats();
  }
}

export const webhookDeduplicationService = new WebhookDeduplicationService();
