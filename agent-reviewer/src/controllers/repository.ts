import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { queueService } from '../services/queue.js';
import { JobStatus } from '../models/queue.js';

/**
 * Process a repository for embedding
 *
 * This endpoint accepts a GitLab repository URL, clones the repository,
 * processes the code files to generate embeddings, and stores them in the database.
 *
 * The processing is done asynchronously through a queue system to prevent
 * overloading the GPU with too many simultaneous embedding requests.
 */
export const processRepository = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, repositoryUrl } = req.body;
    const { priority } = req.query;

    if (!projectId || !repositoryUrl) {
      res.status(400).json({ error: 'Project ID and repository URL are required' });
      return;
    }

    // Start processing and return a response immediately
    const processingId = uuidv4();

    // Add the job to the queue with optional priority
    const priorityLevel = priority === 'high' ? 10 : priority === 'low' ? 0 : 5;
    await queueService.addJob(projectId, repositoryUrl, processingId, priorityLevel);

    res.status(202).json({
      message: 'Repository processing queued',
      processingId,
      status: JobStatus.PENDING
    });
  } catch (error) {
    console.error('Error handling repository processing request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get the status of a repository processing job
 */
export const getRepositoryStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { processingId } = req.params;

    if (!processingId) {
      res.status(400).json({ error: 'Processing ID is required' });
      return;
    }

    // Get the job status from the queue service
    const job = await queueService.getJobByProcessingId(processingId);

    if (!job) {
      res.status(404).json({ error: 'Job not found' });
      return;
    }

    // Format the response based on job status
    const response = {
      processingId: job.processingId,
      status: job.status,
      repositoryUrl: job.repositoryUrl,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts
    };

    // Add additional information based on status
    if (job.status === JobStatus.FAILED || job.status === JobStatus.RETRYING) {
      Object.assign(response, { error: job.error });
    }

    res.status(200).json(response);
  } catch (error) {
    console.error('Error getting repository status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get queue status information
 */
export const getQueueStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const stats = await queueService.getQueueStats();

    // Get recent jobs with pagination
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;

    const recentJobs = await queueService.getRecentJobs(limit, offset);

    res.status(200).json({
      success: true,
      data: {
        stats,
        jobs: recentJobs
      },
      pagination: {
        page,
        limit,
        offset,
        total: stats.total
      }
    });
  } catch (error) {
    console.error('Error getting queue status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch queue status',
      message: error instanceof Error ? error.message : 'Internal server error'
    });
  }
};

/**
 * Retry a failed repository embedding job
 */
export const retryRepositoryJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { processingId } = req.params;

    if (!processingId) {
      res.status(400).json({
        success: false,
        error: 'Processing ID is required'
      });
      return;
    }

    // Attempt to retry the job
    const result = await queueService.retryJob(processingId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          processingId,
          status: result.job?.status,
          updatedAt: result.job?.updatedAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error retrying repository job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Cancel a repository embedding job
 */
export const cancelRepositoryJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { processingId } = req.params;

    if (!processingId) {
      res.status(400).json({
        success: false,
        error: 'Processing ID is required'
      });
      return;
    }

    // Attempt to cancel the job
    const result = await queueService.cancelJob(processingId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          processingId,
          status: result.job?.status,
          updatedAt: result.job?.updatedAt
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error cancelling repository job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};

/**
 * Delete a repository embedding job
 */
export const deleteRepositoryJob = async (req: Request, res: Response): Promise<void> => {
  try {
    const { processingId } = req.params;

    if (!processingId) {
      res.status(400).json({
        success: false,
        error: 'Processing ID is required'
      });
      return;
    }

    // Attempt to delete the job
    const result = await queueService.deleteJob(processingId);

    if (result.success) {
      res.status(200).json({
        success: true,
        message: result.message
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error deleting repository job:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error'
    });
  }
};
