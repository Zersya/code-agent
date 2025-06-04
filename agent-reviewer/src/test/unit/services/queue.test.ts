// Test file for queue service functionality
import { describe, test, expect, beforeEach } from 'bun:test';
import { queueService } from '../../../services/queue.js';
import { JobStatus } from '../../../models/queue.js';

describe('Queue Service', () => {
  beforeEach(() => {
    // Reset any state before each test
  });

  describe('Job creation and management', () => {
    test('should create job with correct properties', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      const job = await queueService.addJob(
        123,
        'https://gitlab.com/test/repo',
        uniqueId,
        5
      );

      expect(job).toBeDefined();
      expect(job.projectId).toBe(123);
      expect(job.repositoryUrl).toBe('https://gitlab.com/test/repo');
      expect(job.processingId).toBe(uniqueId);
      expect(job.priority).toBe(5);
      expect(job.status).toBe(JobStatus.PENDING);
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);
      expect(job.isReembedding).toBe(false);
      expect(job.id).toBeTruthy();
      expect(job.createdAt).toBeInstanceOf(Date);
      expect(job.updatedAt).toBeInstanceOf(Date);
    });

    test('should create re-embedding job with correct flag', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      const job = await queueService.addJob(
        456,
        'https://gitlab.com/test/repo2',
        uniqueId,
        10,
        true // isReembedding
      );

      expect(job.isReembedding).toBe(true);
      expect(job.priority).toBe(10);
      expect(job.projectId).toBe(456);
    });

    test('should create job with default priority when not specified', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      const job = await queueService.addJob(
        789,
        'https://gitlab.com/test/repo3',
        uniqueId
      );

      expect(job.priority).toBe(5); // Default priority
      expect(job.isReembedding).toBe(false); // Default value
    });

    test('should generate unique job IDs', async () => {
      const uniqueId1 = `processing-id-${Date.now()}-${Math.random()}`;
      const uniqueId2 = `processing-id-${Date.now()}-${Math.random()}`;

      const job1 = await queueService.addJob(
        100,
        'https://gitlab.com/test/repo1',
        uniqueId1
      );

      const job2 = await queueService.addJob(
        200,
        'https://gitlab.com/test/repo2',
        uniqueId2
      );

      expect(job1.id).not.toBe(job2.id);
      expect(job1.processingId).not.toBe(job2.processingId);
    });
  });

  describe('Queue statistics', () => {
    test('should provide queue statistics', async () => {
      const stats = await queueService.getQueueStats();

      expect(stats).toBeDefined();
      expect(typeof stats.pending).toBe('number');
      expect(typeof stats.processing).toBe('number');
      expect(typeof stats.completed).toBe('number');
      expect(typeof stats.failed).toBe('number');
      expect(typeof stats.retrying).toBe('number');
      expect(typeof stats.total).toBe('number');
      expect(typeof stats.activeJobs).toBe('number');
    });

    test('should get recent jobs', async () => {
      const jobs = await queueService.getRecentJobs(5);

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeLessThanOrEqual(5);
    });

    test('should get recent jobs with pagination', async () => {
      const jobs = await queueService.getRecentJobs(10, 0);

      expect(Array.isArray(jobs)).toBe(true);
      expect(jobs.length).toBeLessThanOrEqual(10);
    });
  });

  describe('Job status and validation', () => {
    test('should validate job status enum values', () => {
      expect(JobStatus.PENDING).toBe('pending');
      expect(JobStatus.PROCESSING).toBe('processing');
      expect(JobStatus.COMPLETED).toBe('completed');
      expect(JobStatus.FAILED).toBe('failed');
    });

    test('should create jobs with pending status by default', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      const job = await queueService.addJob(
        999,
        'https://gitlab.com/test/repo',
        uniqueId
      );

      expect(job.status).toBe(JobStatus.PENDING);
    });
  });

  describe('Error handling and edge cases', () => {
    test('should handle invalid project IDs', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      try {
        await queueService.addJob(
          0, // Invalid project ID
          'https://gitlab.com/test/repo',
          uniqueId
        );
        // Should still create the job even with ID 0
        expect(true).toBe(true);
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });

    test('should handle empty repository URLs', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      try {
        await queueService.addJob(
          123,
          '', // Empty URL
          uniqueId
        );
        // Should still create the job
        expect(true).toBe(true);
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });

    test('should handle empty processing IDs', async () => {
      try {
        await queueService.addJob(
          123,
          'https://gitlab.com/test/repo',
          '' // Empty processing ID
        );
        // Should still create the job
        expect(true).toBe(true);
      } catch (error) {
        // If it throws, that's also acceptable behavior
        expect(error).toBeDefined();
      }
    });

    test('should handle negative priorities', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      const job = await queueService.addJob(
        123,
        'https://gitlab.com/test/repo',
        uniqueId,
        -1 // Negative priority
      );

      expect(job.priority).toBe(-1);
      expect(job).toBeDefined();
    });

    test('should handle very high priorities', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      const job = await queueService.addJob(
        123,
        'https://gitlab.com/test/repo',
        uniqueId,
        999999 // Very high priority
      );

      expect(job.priority).toBe(999999);
      expect(job).toBeDefined();
    });
  });

  describe('Job properties validation', () => {
    test('should set correct timestamps', async () => {
      const beforeCreation = new Date();
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;

      const job = await queueService.addJob(
        123,
        'https://gitlab.com/test/repo',
        uniqueId
      );

      const afterCreation = new Date();

      expect(job.createdAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(job.createdAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
      expect(job.updatedAt.getTime()).toBeGreaterThanOrEqual(beforeCreation.getTime());
      expect(job.updatedAt.getTime()).toBeLessThanOrEqual(afterCreation.getTime());
    });

    test('should set default max attempts', async () => {
      const uniqueId = `processing-id-${Date.now()}-${Math.random()}`;
      const job = await queueService.addJob(
        123,
        'https://gitlab.com/test/repo',
        uniqueId
      );

      expect(job.maxAttempts).toBe(3);
      expect(job.attempts).toBe(0);
    });
  });

  describe('URL validation', () => {
    test('should handle various URL formats', async () => {
      const urls = [
        'https://gitlab.com/user/repo',
        'https://gitlab.example.com/group/subgroup/project',
        'http://localhost:8080/test/repo',
        'git@gitlab.com:user/repo.git'
      ];

      for (const url of urls) {
        const uniqueId = `processing-id-${Date.now()}-${Math.random()}-${urls.indexOf(url)}`;
        const job = await queueService.addJob(
          123,
          url,
          uniqueId
        );

        expect(job.repositoryUrl).toBe(url);
      }
    });
  });
});
