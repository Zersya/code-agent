// Test file for analytics service functionality
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import { analyticsService } from '../../../services/analytics.js';
import { 
  MergeRequestEventData, 
  ReviewCompletionData, 
  FeedbackCategory, 
  FeedbackType, 
  FeedbackSeverity 
} from '../../../models/analytics.js';

// Mock the database service
const mockDbService = {
  saveMergeRequestAnalytics: jest.fn(),
  saveReviewFeedbackAnalytics: jest.fn(),
  updateDeveloperMetrics: jest.fn(),
  getMergeRequestAnalytics: jest.fn()
};

jest.mock('../../../services/database.js', () => ({
  dbService: mockDbService
}));

describe('Analytics Service', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  describe('Service initialization', () => {
    test('should be importable and have expected methods', () => {
      expect(analyticsService).toBeDefined();
      expect(typeof analyticsService.trackMergeRequestCreated).toBe('function');
      expect(typeof analyticsService.trackMergeRequestCompleted).toBe('function');
      expect(typeof analyticsService.trackReviewCompleted).toBe('function');
      expect(typeof analyticsService.calculateDeveloperKPIs).toBe('function');
    });
  });

  describe('trackMergeRequestCreated', () => {
    test('should track merge request creation successfully', async () => {
      const eventData: MergeRequestEventData = {
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        developerEmail: 'test@example.com',
        title: 'Test MR',
        description: 'Test description',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        lastCommitId: 'abc123',
        action: 'open'
      };

      mockDbService.saveMergeRequestAnalytics.mockResolvedValue(1);

      await analyticsService.trackMergeRequestCreated(eventData);

      expect(mockDbService.saveMergeRequestAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          projectId: 123,
          mergeRequestIid: 456,
          developerId: 789,
          developerUsername: 'testuser',
          title: 'Test MR',
          sourceBranch: 'feature/test',
          targetBranch: 'main',
          createdAt: eventData.createdAt,
          linesAdded: 0,
          linesRemoved: 0,
          filesChanged: 0,
          criticalIssuesCount: 0,
          totalReviewComments: 0,
          wasApproved: false,
          requiredRework: false,
          hasNotionContext: false,
          sequentialThinkingUsed: false
        })
      );
    });

    test('should handle errors gracefully without throwing', async () => {
      const eventData: MergeRequestEventData = {
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt: new Date(),
        lastCommitId: 'abc123',
        action: 'open'
      };

      mockDbService.saveMergeRequestAnalytics.mockRejectedValue(new Error('Database error'));

      // Should not throw
      await expect(analyticsService.trackMergeRequestCreated(eventData)).resolves.toBeUndefined();
    });
  });

  describe('trackMergeRequestCompleted', () => {
    test('should track merge request completion with cycle time calculation', async () => {
      const createdAt = new Date('2024-01-01T10:00:00Z');
      const existingAnalytics = {
        id: 1,
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt,
        linesAdded: 100,
        linesRemoved: 50,
        filesChanged: 5,
        criticalIssuesCount: 2,
        totalReviewComments: 3,
        wasApproved: true,
        requiredRework: false,
        hasNotionContext: false,
        sequentialThinkingUsed: true
      };

      const eventData: MergeRequestEventData = {
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt,
        lastCommitId: 'abc123',
        action: 'merge'
      };

      mockDbService.getMergeRequestAnalytics.mockResolvedValue(existingAnalytics);
      mockDbService.saveMergeRequestAnalytics.mockResolvedValue(1);

      await analyticsService.trackMergeRequestCompleted(eventData);

      expect(mockDbService.getMergeRequestAnalytics).toHaveBeenCalledWith(123, 456);
      expect(mockDbService.saveMergeRequestAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingAnalytics,
          mergedAt: expect.any(Date),
          cycleTimeHours: expect.any(Number)
        })
      );
    });

    test('should create new analytics record if none exists', async () => {
      const eventData: MergeRequestEventData = {
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt: new Date(),
        lastCommitId: 'abc123',
        action: 'merge'
      };

      mockDbService.getMergeRequestAnalytics.mockResolvedValue(null);
      mockDbService.saveMergeRequestAnalytics.mockResolvedValue(1);

      await analyticsService.trackMergeRequestCompleted(eventData);

      // Should call trackMergeRequestCreated instead
      expect(mockDbService.saveMergeRequestAnalytics).toHaveBeenCalled();
    });
  });

  describe('trackReviewCompleted', () => {
    test('should track review completion with feedback parsing', async () => {
      const existingAnalytics = {
        id: 1,
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt: new Date('2024-01-01T10:00:00Z'),
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 0,
        criticalIssuesCount: 0,
        totalReviewComments: 0,
        wasApproved: false,
        requiredRework: false,
        hasNotionContext: false,
        sequentialThinkingUsed: false
      };

      const reviewData: ReviewCompletionData = {
        projectId: 123,
        mergeRequestIid: 456,
        reviewResult: 'Review completed. 🔴 Critical security issue found in authentication logic.',
        shouldApprove: false,
        criticalIssuesCount: 1,
        totalReviewComments: 1,
        reviewMode: 'sequential',
        sequentialThinkingUsed: true,
        hasNotionContext: false,
        linesAdded: 100,
        linesRemoved: 50,
        filesChanged: 3,
        reviewTimeHours: 2.5,
        codeQualityScore: 85.5
      };

      mockDbService.getMergeRequestAnalytics.mockResolvedValue(existingAnalytics);
      mockDbService.saveMergeRequestAnalytics.mockResolvedValue(1);
      mockDbService.saveReviewFeedbackAnalytics.mockResolvedValue(undefined);

      await analyticsService.trackReviewCompleted(reviewData);

      expect(mockDbService.saveMergeRequestAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          ...existingAnalytics,
          linesAdded: 100,
          linesRemoved: 50,
          filesChanged: 3,
          reviewTimeHours: 2.5,
          criticalIssuesCount: 1,
          totalReviewComments: 1,
          wasApproved: false,
          requiredRework: true,
          codeQualityScore: 85.5,
          hasNotionContext: false,
          reviewMode: 'sequential',
          sequentialThinkingUsed: true
        })
      );

      expect(mockDbService.saveReviewFeedbackAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          mergeRequestAnalyticsId: 1,
          projectId: 123,
          mergeRequestIid: 456,
          feedbackType: FeedbackType.CRITICAL,
          category: FeedbackCategory.SECURITY,
          severity: FeedbackSeverity.HIGH,
          feedbackText: 'Critical security issue found in authentication logic.',
          wasAddressed: false
        })
      );
    });

    test('should handle missing existing analytics gracefully', async () => {
      const reviewData: ReviewCompletionData = {
        projectId: 123,
        mergeRequestIid: 456,
        reviewResult: 'Review completed.',
        shouldApprove: true,
        criticalIssuesCount: 0,
        totalReviewComments: 1,
        reviewMode: 'direct',
        sequentialThinkingUsed: false,
        hasNotionContext: false,
        linesAdded: 50,
        linesRemoved: 25,
        filesChanged: 2,
        reviewTimeHours: 1.0,
        codeQualityScore: 95.0
      };

      mockDbService.getMergeRequestAnalytics.mockResolvedValue(null);

      await analyticsService.trackReviewCompleted(reviewData);

      // Should not proceed with update if no existing analytics found
      expect(mockDbService.saveMergeRequestAnalytics).not.toHaveBeenCalled();
    });
  });

  describe('feedback categorization', () => {
    test('should categorize security-related feedback correctly', async () => {
      const reviewData: ReviewCompletionData = {
        projectId: 123,
        mergeRequestIid: 456,
        reviewResult: '🔴 SQL injection vulnerability detected in user input handling.',
        shouldApprove: false,
        criticalIssuesCount: 1,
        totalReviewComments: 1,
        reviewMode: 'direct',
        sequentialThinkingUsed: false,
        hasNotionContext: false,
        linesAdded: 20,
        linesRemoved: 5,
        filesChanged: 1,
        reviewTimeHours: 0.5,
        codeQualityScore: 60.0
      };

      const existingAnalytics = {
        id: 1,
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt: new Date(),
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 0,
        criticalIssuesCount: 0,
        totalReviewComments: 0,
        wasApproved: false,
        requiredRework: false,
        hasNotionContext: false,
        sequentialThinkingUsed: false
      };

      mockDbService.getMergeRequestAnalytics.mockResolvedValue(existingAnalytics);
      mockDbService.saveMergeRequestAnalytics.mockResolvedValue(1);
      mockDbService.saveReviewFeedbackAnalytics.mockResolvedValue(undefined);

      await analyticsService.trackReviewCompleted(reviewData);

      expect(mockDbService.saveReviewFeedbackAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          category: FeedbackCategory.SECURITY,
          feedbackText: 'SQL injection vulnerability detected in user input handling.'
        })
      );
    });

    test('should categorize performance-related feedback correctly', async () => {
      const reviewData: ReviewCompletionData = {
        projectId: 123,
        mergeRequestIid: 456,
        reviewResult: '🔴 Performance bottleneck in database query optimization.',
        shouldApprove: false,
        criticalIssuesCount: 1,
        totalReviewComments: 1,
        reviewMode: 'direct',
        sequentialThinkingUsed: false,
        hasNotionContext: false,
        linesAdded: 30,
        linesRemoved: 10,
        filesChanged: 2,
        reviewTimeHours: 1.0,
        codeQualityScore: 70.0
      };

      const existingAnalytics = {
        id: 1,
        projectId: 123,
        mergeRequestIid: 456,
        developerId: 789,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt: new Date(),
        linesAdded: 0,
        linesRemoved: 0,
        filesChanged: 0,
        criticalIssuesCount: 0,
        totalReviewComments: 0,
        wasApproved: false,
        requiredRework: false,
        hasNotionContext: false,
        sequentialThinkingUsed: false
      };

      mockDbService.getMergeRequestAnalytics.mockResolvedValue(existingAnalytics);
      mockDbService.saveMergeRequestAnalytics.mockResolvedValue(1);
      mockDbService.saveReviewFeedbackAnalytics.mockResolvedValue(undefined);

      await analyticsService.trackReviewCompleted(reviewData);

      expect(mockDbService.saveReviewFeedbackAnalytics).toHaveBeenCalledWith(
        expect.objectContaining({
          category: FeedbackCategory.PERFORMANCE,
          feedbackText: 'Performance bottleneck in database query optimization.'
        })
      );
    });
  });
});
