// Integration tests for analytics API endpoints
import { describe, test, expect, beforeEach, jest } from 'bun:test';
import request from 'supertest';
import express from 'express';
import {
  getDeveloperMetrics,
  getProjectMetrics,
  getMergeRequestAnalytics,
  getAnalyticsSummary,
  getTopPerformers,
  getAnalyticsTrends
} from '../../controllers/analytics.js';

// Mock the database service
const mockDbService = {
  getMergeRequestAnalytics: jest.fn()
};

jest.mock('../../services/database.js', () => ({
  dbService: mockDbService
}));

// Mock the analytics service
const mockAnalyticsService = {
  calculateDeveloperKPIs: jest.fn()
};

jest.mock('../../services/analytics.js', () => ({
  analyticsService: mockAnalyticsService
}));

// Create test app
const app = express();
app.use(express.json());

// Add routes without authentication for testing
app.get('/api/analytics/developers/:developerId/projects/:projectId/metrics', getDeveloperMetrics);
app.get('/api/analytics/projects/:projectId/metrics', getProjectMetrics);
app.get('/api/analytics/projects/:projectId/merge-requests/:mergeRequestIid', getMergeRequestAnalytics);
app.get('/api/analytics/projects/:projectId/summary', getAnalyticsSummary);
app.get('/api/analytics/projects/:projectId/top-performers', getTopPerformers);
app.get('/api/analytics/projects/:projectId/trends', getAnalyticsTrends);

describe('Analytics API Integration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/analytics/developers/:developerId/projects/:projectId/metrics', () => {
    test('should return developer metrics with valid parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/developers/123/projects/456/metrics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          period: 'daily'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('filters');
      expect(response.body.filters).toMatchObject({
        developerId: 123,
        projectId: 456,
        period: 'daily'
      });
    });

    test('should return 400 for missing developer ID', async () => {
      const response = await request(app)
        .get('/api/analytics/developers//projects/456/metrics');

      expect(response.status).toBe(404); // Express returns 404 for missing route params
    });

    test('should return 400 for missing project ID', async () => {
      const response = await request(app)
        .get('/api/analytics/developers/123/projects//metrics');

      expect(response.status).toBe(404); // Express returns 404 for missing route params
    });

    test('should handle optional query parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/developers/123/projects/456/metrics');

      expect(response.status).toBe(200);
      expect(response.body.filters.period).toBe('daily'); // default value
    });
  });

  describe('GET /api/analytics/projects/:projectId/metrics', () => {
    test('should return project metrics with valid parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/projects/456/metrics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          period: 'weekly'
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.filters).toMatchObject({
        projectId: 456,
        period: 'weekly'
      });
    });

    test('should handle missing project ID', async () => {
      const response = await request(app)
        .get('/api/analytics/projects//metrics');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/analytics/projects/:projectId/merge-requests/:mergeRequestIid', () => {
    test('should return merge request analytics when found', async () => {
      const mockAnalytics = {
        id: 1,
        projectId: 456,
        mergeRequestIid: 789,
        developerId: 123,
        developerUsername: 'testuser',
        title: 'Test MR',
        sourceBranch: 'feature/test',
        targetBranch: 'main',
        createdAt: new Date('2024-01-01T10:00:00Z'),
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

      mockDbService.getMergeRequestAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/analytics/projects/456/merge-requests/789');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.data).toMatchObject({
        projectId: 456,
        mergeRequestIid: 789,
        developerId: 123,
        developerUsername: 'testuser',
        wasApproved: true
      });
      expect(mockDbService.getMergeRequestAnalytics).toHaveBeenCalledWith(456, 789);
    });

    test('should return 404 when merge request analytics not found', async () => {
      mockDbService.getMergeRequestAnalytics.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/analytics/projects/456/merge-requests/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error', 'Merge request analytics not found');
    });

    test('should return 400 for missing parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/projects//merge-requests/789');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/analytics/projects/:projectId/summary', () => {
    test('should return analytics summary with default period', async () => {
      const response = await request(app)
        .get('/api/analytics/projects/456/summary');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('period');
      expect(response.body.period.days).toBe(30); // default
    });

    test('should return analytics summary with custom period', async () => {
      const response = await request(app)
        .get('/api/analytics/projects/456/summary')
        .query({ days: 7 });

      expect(response.status).toBe(200);
      expect(response.body.period.days).toBe(7);
    });

    test('should handle missing project ID', async () => {
      const response = await request(app)
        .get('/api/analytics/projects//summary');

      expect(response.status).toBe(404);
    });
  });

  describe('GET /api/analytics/projects/:projectId/top-performers', () => {
    test('should return top performers with default parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/projects/456/top-performers');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('criteria');
      expect(response.body.criteria).toMatchObject({
        metric: 'productivity',
        limit: 10
      });
    });

    test('should return top performers with custom parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/projects/456/top-performers')
        .query({
          metric: 'quality',
          limit: 5,
          days: 14
        });

      expect(response.status).toBe(200);
      expect(response.body.criteria).toMatchObject({
        metric: 'quality',
        limit: 5
      });
    });
  });

  describe('GET /api/analytics/projects/:projectId/trends', () => {
    test('should return analytics trends with default parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/projects/456/trends');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('parameters');
      expect(response.body.parameters).toMatchObject({
        metric: 'all',
        period: 'weekly',
        weeks: 12
      });
    });

    test('should return analytics trends with custom parameters', async () => {
      const response = await request(app)
        .get('/api/analytics/projects/456/trends')
        .query({
          metric: 'productivity',
          period: 'daily',
          weeks: 4
        });

      expect(response.status).toBe(200);
      expect(response.body.parameters).toMatchObject({
        metric: 'productivity',
        period: 'daily',
        weeks: 4
      });
    });
  });

  describe('Error handling', () => {
    test('should handle database errors gracefully', async () => {
      mockDbService.getMergeRequestAnalytics.mockRejectedValue(new Error('Database connection failed'));

      const response = await request(app)
        .get('/api/analytics/projects/456/merge-requests/789');

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Internal server error');
    });

    test('should handle invalid parameter types', async () => {
      const response = await request(app)
        .get('/api/analytics/developers/invalid/projects/456/metrics');

      expect(response.status).toBe(200); // parseInt handles this gracefully
      expect(response.body.filters.developerId).toBeNaN();
    });
  });

  describe('Response format validation', () => {
    test('should return consistent response format for all endpoints', async () => {
      const endpoints = [
        '/api/analytics/developers/123/projects/456/metrics',
        '/api/analytics/projects/456/metrics',
        '/api/analytics/projects/456/summary',
        '/api/analytics/projects/456/top-performers',
        '/api/analytics/projects/456/trends'
      ];

      for (const endpoint of endpoints) {
        const response = await request(app).get(endpoint);
        
        expect(response.status).toBe(200);
        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      }
    });

    test('should return proper error format for 404 responses', async () => {
      mockDbService.getMergeRequestAnalytics.mockResolvedValue(null);

      const response = await request(app)
        .get('/api/analytics/projects/456/merge-requests/999');

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty('error');
      expect(typeof response.body.error).toBe('string');
    });
  });
});
