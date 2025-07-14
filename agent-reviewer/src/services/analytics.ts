import { dbService } from './database.js';
import { 
  DeveloperMetrics, 
  MergeRequestAnalytics, 
  ReviewFeedbackAnalytics, 
  MergeRequestEventData, 
  ReviewCompletionData,
  DeveloperKPIs,
  AnalyticsFilters,
  FeedbackCategory,
  FeedbackType,
  FeedbackSeverity
} from '../models/analytics.js';
import { MergeRequestChange } from '../types/review.js';

/**
 * Analytics service for developer performance tracking
 */
export class AnalyticsService {
  
  /**
   * Track merge request creation from webhook event
   */
  async trackMergeRequestCreated(eventData: MergeRequestEventData): Promise<void> {
    try {
      console.log(`Tracking MR creation: !${eventData.mergeRequestIid} in project ${eventData.projectId}`);

      const analytics: MergeRequestAnalytics = {
        projectId: eventData.projectId,
        mergeRequestIid: eventData.mergeRequestIid,
        developerId: eventData.developerId,
        developerUsername: eventData.developerUsername,
        title: eventData.title,
        sourceBranch: eventData.sourceBranch,
        targetBranch: eventData.targetBranch,
        createdAt: eventData.createdAt,
        linesAdded: 0, // Will be updated during review
        linesRemoved: 0,
        filesChanged: 0,
        criticalIssuesCount: 0,
        totalReviewComments: 0,
        wasApproved: false,
        requiredRework: false,
        hasNotionContext: false,
        sequentialThinkingUsed: false
      };

      await dbService.saveMergeRequestAnalytics(analytics);

      // Update daily developer metrics
      await this.updateDailyDeveloperMetrics(
        eventData.developerId,
        eventData.developerUsername,
        eventData.developerEmail,
        eventData.projectId,
        eventData.createdAt,
        { mrsCreated: 1 }
      );

      console.log(`Successfully tracked MR creation for !${eventData.mergeRequestIid}`);
    } catch (error) {
      console.error('Error tracking merge request creation:', error);
      // Don't throw - analytics failures shouldn't break core functionality
    }
  }

  /**
   * Track merge request completion (merge/close)
   */
  async trackMergeRequestCompleted(eventData: MergeRequestEventData): Promise<void> {
    try {
      console.log(`Tracking MR completion: !${eventData.mergeRequestIid} in project ${eventData.projectId}`);

      const existing = await dbService.getMergeRequestAnalytics(eventData.projectId, eventData.mergeRequestIid);
      if (!existing) {
        console.warn(`No existing analytics found for MR !${eventData.mergeRequestIid}, creating new record`);
        await this.trackMergeRequestCreated(eventData);
        return;
      }

      const now = new Date();
      const cycleTimeHours = (now.getTime() - existing.createdAt.getTime()) / (1000 * 60 * 60);

      const updatedAnalytics: MergeRequestAnalytics = {
        ...existing,
        mergedAt: eventData.action === 'merge' ? now : undefined,
        closedAt: eventData.action === 'close' ? now : undefined,
        cycleTimeHours
      };

      await dbService.saveMergeRequestAnalytics(updatedAnalytics);

      // Update daily developer metrics
      const metricUpdate = eventData.action === 'merge' ? { mrsMerged: 1 } : { mrsClosed: 1 };
      await this.updateDailyDeveloperMetrics(
        eventData.developerId,
        eventData.developerUsername,
        eventData.developerEmail,
        eventData.projectId,
        now,
        metricUpdate
      );

      console.log(`Successfully tracked MR completion for !${eventData.mergeRequestIid}`);
    } catch (error) {
      console.error('Error tracking merge request completion:', error);
    }
  }

  /**
   * Track review completion with detailed analytics
   */
  async trackReviewCompleted(reviewData: ReviewCompletionData): Promise<void> {
    try {
      console.log(`Tracking review completion: !${reviewData.mergeRequestIid} in project ${reviewData.projectId}`);

      const existing = await dbService.getMergeRequestAnalytics(reviewData.projectId, reviewData.mergeRequestIid);
      if (!existing) {
        console.warn(`No existing analytics found for MR !${reviewData.mergeRequestIid}`);
        return;
      }

      // Calculate review time (assuming review started when MR was created)
      const reviewTimeHours = reviewData.reviewTimeHours;

      const updatedAnalytics: MergeRequestAnalytics = {
        ...existing,
        linesAdded: reviewData.linesAdded,
        linesRemoved: reviewData.linesRemoved,
        filesChanged: reviewData.filesChanged,
        reviewTimeHours,
        criticalIssuesCount: reviewData.criticalIssuesCount,
        totalReviewComments: reviewData.totalReviewComments,
        wasApproved: reviewData.shouldApprove,
        requiredRework: !reviewData.shouldApprove,
        codeQualityScore: reviewData.codeQualityScore,
        hasNotionContext: reviewData.hasNotionContext,
        reviewMode: reviewData.reviewMode,
        sequentialThinkingUsed: reviewData.sequentialThinkingUsed
      };

      const analyticsId = await dbService.saveMergeRequestAnalytics(updatedAnalytics);

      // Parse and store review feedback
      await this.parseAndStoreReviewFeedback(
        analyticsId,
        reviewData.projectId,
        reviewData.mergeRequestIid,
        reviewData.reviewResult
      );

      // Update daily developer metrics
      await this.updateDailyDeveloperMetrics(
        existing.developerId,
        existing.developerUsername,
        undefined,
        reviewData.projectId,
        new Date(),
        {
          totalLinesAdded: reviewData.linesAdded,
          totalLinesRemoved: reviewData.linesRemoved,
          totalFilesChanged: reviewData.filesChanged,
          criticalIssuesCount: reviewData.criticalIssuesCount,
          totalReviewComments: reviewData.totalReviewComments
        }
      );

      console.log(`Successfully tracked review completion for !${reviewData.mergeRequestIid}`);
    } catch (error) {
      console.error('Error tracking review completion:', error);
    }
  }

  /**
   * Parse review result text and extract feedback for analytics
   */
  private async parseAndStoreReviewFeedback(
    analyticsId: number,
    projectId: number,
    mergeRequestIid: number,
    reviewResult: string
  ): Promise<void> {
    try {
      // Extract critical issues (🔴 markers)
      const criticalIssueRegex = /🔴\s*(.+?)(?=\n|$)/g;
      let match;
      
      while ((match = criticalIssueRegex.exec(reviewResult)) !== null) {
        const feedbackText = match[1].trim();
        
        if (feedbackText && feedbackText.length > 5) { // Filter out template placeholders
          const feedback: ReviewFeedbackAnalytics = {
            mergeRequestAnalyticsId: analyticsId,
            projectId,
            mergeRequestIid,
            feedbackType: FeedbackType.CRITICAL,
            category: this.categorizeFeedback(feedbackText),
            severity: FeedbackSeverity.HIGH,
            feedbackText,
            wasAddressed: false,
            createdAt: new Date()
          };

          await dbService.saveReviewFeedbackAnalytics(feedback);
        }
      }

      // Extract other feedback types (suggestions, questions, etc.)
      // This could be enhanced with more sophisticated NLP parsing
      
    } catch (error) {
      console.error('Error parsing review feedback:', error);
    }
  }

  /**
   * Categorize feedback based on content analysis
   */
  private categorizeFeedback(feedbackText: string): FeedbackCategory {
    const text = feedbackText.toLowerCase();
    
    if (text.includes('security') || text.includes('vulnerability') || text.includes('injection')) {
      return FeedbackCategory.SECURITY;
    }
    if (text.includes('performance') || text.includes('slow') || text.includes('optimization')) {
      return FeedbackCategory.PERFORMANCE;
    }
    if (text.includes('style') || text.includes('formatting') || text.includes('convention')) {
      return FeedbackCategory.STYLE;
    }
    if (text.includes('logic') || text.includes('algorithm') || text.includes('bug')) {
      return FeedbackCategory.LOGIC;
    }
    if (text.includes('documentation') || text.includes('comment') || text.includes('readme')) {
      return FeedbackCategory.DOCUMENTATION;
    }
    
    return FeedbackCategory.OTHER;
  }

  /**
   * Update daily developer metrics
   */
  private async updateDailyDeveloperMetrics(
    developerId: number,
    developerUsername: string,
    developerEmail: string | undefined,
    projectId: number,
    date: Date,
    updates: Partial<DeveloperMetrics>
  ): Promise<void> {
    try {
      const metricDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      
      // Get existing metrics for the day or create new
      const existing = await this.getDeveloperMetricsForDate(developerId, projectId, metricDate);
      
      const metrics: DeveloperMetrics = {
        ...existing,
        developerId,
        developerUsername,
        developerEmail,
        projectId,
        metricDate,
        mrsCreated: (existing?.mrsCreated || 0) + (updates.mrsCreated || 0),
        mrsMerged: (existing?.mrsMerged || 0) + (updates.mrsMerged || 0),
        mrsClosed: (existing?.mrsClosed || 0) + (updates.mrsClosed || 0),
        totalLinesAdded: (existing?.totalLinesAdded || 0) + (updates.totalLinesAdded || 0),
        totalLinesRemoved: (existing?.totalLinesRemoved || 0) + (updates.totalLinesRemoved || 0),
        totalFilesChanged: (existing?.totalFilesChanged || 0) + (updates.totalFilesChanged || 0),
        criticalIssuesCount: (existing?.criticalIssuesCount || 0) + (updates.criticalIssuesCount || 0),
        totalReviewComments: (existing?.totalReviewComments || 0) + (updates.totalReviewComments || 0),
        createdAt: existing?.createdAt || new Date(),
        updatedAt: new Date()
      };

      await dbService.updateDeveloperMetrics(metrics);
    } catch (error) {
      console.error('Error updating daily developer metrics:', error);
    }
  }

  /**
   * Get developer metrics for a specific date
   */
  private async getDeveloperMetricsForDate(
    developerId: number,
    projectId: number,
    date: Date
  ): Promise<DeveloperMetrics | null> {
    // This would need to be implemented in the database service
    // For now, return null to create new metrics
    return null;
  }

  /**
   * Calculate KPIs for a developer
   */
  async calculateDeveloperKPIs(
    developerId: number,
    projectId: number,
    startDate: Date,
    endDate: Date
  ): Promise<DeveloperKPIs> {
    // This would aggregate metrics and calculate KPI scores
    // Implementation would involve complex queries and calculations
    
    return {
      developerId,
      projectId,
      period: 'daily',
      startDate,
      endDate,
      productivityScore: 0,
      codeQualityScore: 0,
      avgCycleTime: 0,
      approvalRate: 0,
      criticalIssuesDensity: 0,
      reworkRate: 0
    };
  }
}

export const analyticsService = new AnalyticsService();
