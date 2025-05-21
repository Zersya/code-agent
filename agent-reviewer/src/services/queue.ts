import { v4 as uuidv4 } from 'uuid';
import { EmbeddingJob, JobStatus, JobResult, QueueConfig } from '../models/queue.js';
import { dbService } from './database.js';
import { repositoryService } from './repository.js';
import { embeddingService } from './embedding.js';
import { EmbeddingBatch, ProjectMetadata } from '../models/embedding.js';
import dotenv from 'dotenv';
import { GitLabPushEvent } from '../types/webhook.js';

dotenv.config();

/**
 * Default queue configuration
 */
const DEFAULT_QUEUE_CONFIG: QueueConfig = {
  concurrency: Number(process.env.QUEUE_CONCURRENCY) || 2,
  maxAttempts: Number(process.env.QUEUE_MAX_ATTEMPTS) || 3,
  retryDelay: Number(process.env.QUEUE_RETRY_DELAY) || 5000,
  priorityLevels: {
    LOW: 0,
    NORMAL: 5,
    HIGH: 10
  }
};

/**
 * Queue service for managing embedding jobs
 */
export class QueueService {
  private activeJobs: Map<string, EmbeddingJob>;
  private isProcessing: boolean;
  private config: QueueConfig;
  private processingPromise: Promise<void> | null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.activeJobs = new Map();
    this.isProcessing = false;
    this.config = { ...DEFAULT_QUEUE_CONFIG, ...config };
    this.processingPromise = null;

    // Initialize the database tables for the queue
    this.initializeQueueTables().catch(error => {
      console.error('Failed to initialize queue tables:', error);
    });

    // Start processing the queue
    this.startProcessing();
  }

  /**
   * Initialize queue tables in the database
   */
  private async initializeQueueTables(): Promise<void> {
    try {
      const client = await dbService.getClient();

      try {
        // Create embedding_jobs table
        await client.query(`
          CREATE TABLE IF NOT EXISTS embedding_jobs (
            id TEXT PRIMARY KEY,
            repository_url TEXT NOT NULL,
            processing_id TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL,
            error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            priority INTEGER NOT NULL DEFAULT 5
          )
        `);

        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_processing_id ON embedding_jobs(processing_id)');

        console.log('Queue tables initialized');
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Failed to initialize queue tables:', error);
      throw error;
    }
  }

  /**
   * Add a job to the queue
   */
  async addJob(projectId: number, repositoryUrl: string, processingId: string, priority: number = DEFAULT_QUEUE_CONFIG.priorityLevels.NORMAL): Promise<EmbeddingJob> {
    try {
      const job: EmbeddingJob = {
        id: uuidv4(),
        repositoryUrl,
        processingId,
        status: JobStatus.PENDING,
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority
      };

      // Save the job to the database
      await this.saveJob(job);

      console.log(`Added job ${job.id} to the queue for repository ${repositoryUrl}`);

      // Start processing if not already processing
      if (!this.isProcessing) {
        this.startProcessing({ project_id: projectId });
      }

      return job;
    } catch (error) {
      console.error('Error adding job to queue:', error);
      throw error;
    }
  }

  /**
   * Save a job to the database
   */
  private async saveJob(job: EmbeddingJob): Promise<void> {
    const client = await dbService.getClient();

    try {
      await client.query(`
        INSERT INTO embedding_jobs (
          id, repository_url, processing_id, status, attempts, max_attempts,
          error, created_at, updated_at, started_at, completed_at, priority
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          attempts = EXCLUDED.attempts,
          error = EXCLUDED.error,
          updated_at = EXCLUDED.updated_at,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at
      `, [
        job.id,
        job.repositoryUrl,
        job.processingId,
        job.status,
        job.attempts,
        job.maxAttempts,
        job.error,
        job.createdAt,
        job.updatedAt,
        job.startedAt,
        job.completedAt,
        job.priority
      ]);
    } finally {
      client.release();
    }
  }

  /**
   * Get a job by processing ID
   */
  async getJobByProcessingId(processingId: string): Promise<EmbeddingJob | null> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT
          id, repository_url as "repositoryUrl", processing_id as "processingId",
          status, attempts, max_attempts as "maxAttempts", error,
          created_at as "createdAt", updated_at as "updatedAt",
          started_at as "startedAt", completed_at as "completedAt", priority
        FROM embedding_jobs
        WHERE processing_id = $1
      `, [processingId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as EmbeddingJob;
    } finally {
      client.release();
    }
  }

  /**
   * Wait for a job to complete with a timeout
   * @param processingId The processing ID of the job
   * @param maxWaitSeconds Maximum time to wait in seconds
   * @param checkIntervalMs Interval between checks in milliseconds
   * @returns The completed job or null if timeout or error
   */
  async waitForJobCompletion(
    processingId: string,
    maxWaitSeconds: number = 300, // 5 minutes default
    checkIntervalMs: number = 2000 // 2 seconds default
  ): Promise<EmbeddingJob | null> {
    console.log(`Waiting for job ${processingId} to complete (timeout: ${maxWaitSeconds}s)`);

    const startTime = Date.now();
    const timeoutMs = maxWaitSeconds * 1000;

    while (Date.now() - startTime < timeoutMs) {
      try {
        // Get the current job status
        const job = await this.getJobByProcessingId(processingId);

        if (!job) {
          console.warn(`Job ${processingId} not found while waiting for completion`);
          return null;
        }

        // Check if the job is completed or failed
        if (job.status === JobStatus.COMPLETED) {
          console.log(`Job ${processingId} completed successfully`);
          return job;
        } else if (job.status === JobStatus.FAILED) {
          console.warn(`Job ${processingId} failed: ${job.error}`);
          return job;
        }

        // Log progress
        const elapsedSeconds = Math.round((Date.now() - startTime) / 1000);
        console.log(`Job ${processingId} status: ${job.status} (elapsed: ${elapsedSeconds}s)`);

        // Wait before checking again
        await new Promise(resolve => setTimeout(resolve, checkIntervalMs));
      } catch (error) {
        console.error(`Error waiting for job ${processingId}:`, error);
        // Continue waiting despite error
      }
    }

    console.warn(`Timeout waiting for job ${processingId} to complete after ${maxWaitSeconds}s`);
    return await this.getJobByProcessingId(processingId);
  }

  /**
   * Get queue statistics
   */
  async getQueueStats(): Promise<{
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    retrying: number;
    total: number;
    activeJobs: number;
  }> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT status, COUNT(*) as count
        FROM embedding_jobs
        GROUP BY status
      `);

      // Initialize counts
      const stats = {
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retrying: 0,
        total: 0,
        activeJobs: this.activeJobs.size
      };

      // Update counts from query results
      result.rows.forEach(row => {
        const status = row.status.toLowerCase();
        const count = parseInt(row.count);

        if (status === JobStatus.PENDING.toLowerCase()) {
          stats.pending = count;
        } else if (status === JobStatus.PROCESSING.toLowerCase()) {
          stats.processing = count;
        } else if (status === JobStatus.COMPLETED.toLowerCase()) {
          stats.completed = count;
        } else if (status === JobStatus.FAILED.toLowerCase()) {
          stats.failed = count;
        } else if (status === JobStatus.RETRYING.toLowerCase()) {
          stats.retrying = count;
        }

        stats.total += count;
      });

      return stats;
    } finally {
      client.release();
    }
  }

  /**
   * Get recent jobs with pagination
   */
  async getRecentJobs(limit: number = 10, offset: number = 0): Promise<EmbeddingJob[]> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT
          id, repository_url as "repositoryUrl", processing_id as "processingId",
          status, attempts, max_attempts as "maxAttempts", error,
          created_at as "createdAt", updated_at as "updatedAt",
          started_at as "startedAt", completed_at as "completedAt", priority
        FROM embedding_jobs
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
      `, [limit, offset]);

      return result.rows as EmbeddingJob[];
    } finally {
      client.release();
    }
  }

  /**
   * Get next pending jobs up to concurrency limit
   */
  private async getNextPendingJobs(): Promise<EmbeddingJob[]> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT
          id, repository_url as "repositoryUrl", processing_id as "processingId",
          status, attempts, max_attempts as "maxAttempts", error,
          created_at as "createdAt", updated_at as "updatedAt",
          started_at as "startedAt", completed_at as "completedAt", priority
        FROM embedding_jobs
        WHERE status = $1 OR (status = $2 AND updated_at < NOW() - INTERVAL '1 minute' * attempts)
        ORDER BY priority DESC, created_at ASC
        LIMIT $3
      `, [JobStatus.PENDING, JobStatus.RETRYING, this.config.concurrency - this.activeJobs.size]);

      return result.rows as EmbeddingJob[];
    } finally {
      client.release();
    }
  }

  /**
   * Start processing the queue
   */
  private startProcessing(event: { project_id: number }): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingPromise = this.processQueue(event);
  }

  /**
   * Process the queue
   */
  private async processQueue(event: { project_id: number }): Promise<void> {
    try {
      while (this.isProcessing) {
        // Check if we can process more jobs
        if (this.activeJobs.size < this.config.concurrency) {
          // Get next pending jobs
          const pendingJobs = await this.getNextPendingJobs();

          if (pendingJobs.length === 0) {
            // No pending jobs, wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          // Process each pending job
          for (const job of pendingJobs) {
            // Skip if we've reached concurrency limit
            if (this.activeJobs.size >= this.config.concurrency) {
              break;
            }

            // Add to active jobs
            this.activeJobs.set(job.id, job);

            // Process the job
            this.processJob(event, job).catch(error => {
              console.error(`Error processing job ${job.id}:`, error);
            });
          }
        }

        // Wait a bit before checking for more jobs
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    } catch (error) {
      console.error('Error processing queue:', error);
      this.isProcessing = false;

      // Restart processing after a delay
      setTimeout(() => this.startProcessing(), 5000);
    }
  }

  /**
   * Process a single job
   */
  private async processJob(event: { project_id: number }, job: EmbeddingJob): Promise<void> {
    try {
      console.log(`Processing job ${job.id} for repository ${job.repositoryUrl}`);

      // Update job status
      job.status = JobStatus.PROCESSING;
      job.attempts += 1;
      job.startedAt = job.startedAt || new Date();
      job.updatedAt = new Date();
      await this.saveJob(job);

      // Process the repository
      const result = await this.processRepository(event, job.repositoryUrl, job.processingId);

      if (result.success) {
        // Job completed successfully
        job.status = JobStatus.COMPLETED;
        job.completedAt = new Date();
      } else {
        // Job failed
        if (job.attempts >= job.maxAttempts) {
          job.status = JobStatus.FAILED;
          job.error = result.error;
        } else {
          job.status = JobStatus.RETRYING;
          job.error = result.error;
        }
      }

      job.updatedAt = new Date();
      await this.saveJob(job);
    } catch (error) {
      console.error(`Error processing job ${job.id}:`, error);

      // Update job status
      job.status = job.attempts >= job.maxAttempts ? JobStatus.FAILED : JobStatus.RETRYING;
      job.error = error instanceof Error ? error.message : String(error);
      job.updatedAt = new Date();
      await this.saveJob(job);
    } finally {
      // Remove from active jobs
      this.activeJobs.delete(job.id);
    }
  }

  /**
   * Process a repository
   */
  private async processRepository(event: { project_id: number }, repositoryUrl: string, processingId: string): Promise<JobResult> {
    let repoPath = '';

    try {
      console.log(`Processing repository ${repositoryUrl} (ID: ${processingId})`);

      // Clone the repository
      const { repoPath: clonedRepoPath } = await repositoryService.cloneRepository(event, repositoryUrl);
      repoPath = clonedRepoPath;

      // Get all files from the repository
      console.log(`Getting files from repository ${repositoryUrl}`);
      const files = await repositoryService.getFilesFromLocalRepo(repoPath);

      if (files.length === 0) {
        console.log('No files found, skipping');
        return { success: true };
      }

      console.log(`Found ${files.length} files, generating embeddings`);

      const projectId = event.project_id;

      // Generate a consistent project ID from the repository URL
      console.log(`Generated consistent project ID: ${projectId} from repository URL: ${repositoryUrl}`);

      // Get the actual repository information (branch and commit)
      const repoInfo = await repositoryService.getRepositoryInfo(repoPath);
      const { branch, commitId } = repoInfo;

      // Get or create project metadata
      let projectMetadata = await dbService.getProjectMetadata(projectId);

      if (!projectMetadata) {
        projectMetadata = {
          projectId: projectId,
          name: repositoryUrl.split('/').pop() || 'Unknown',
          description: '',
          url: repositoryUrl,
          defaultBranch: branch,
          lastProcessedCommit: '',
          lastProcessedAt: new Date(),
        };

        await dbService.saveProjectMetadata(projectMetadata);
      }

      // Generate embeddings for all files with retry logic
      const embeddings = await this.generateEmbeddingsWithRetry(
        files,
        projectId,
        commitId,
        branch
      );

      // Add repository URL to embeddings
      embeddings.forEach(embedding => {
        embedding.repositoryUrl = repositoryUrl;
      });

      console.log(`Generated ${embeddings.length} embeddings, saving to database`);

      // Save embeddings to database
      await dbService.saveEmbeddings(embeddings);

      // Save batch information
      const batch: EmbeddingBatch = {
        projectId: projectId,
        commitId,
        branch,
        files,
        embeddings,
        createdAt: new Date(),
      };

      await dbService.saveBatch(batch);

      // Update project metadata
      projectMetadata.lastProcessedCommit = commitId;
      projectMetadata.lastProcessedAt = new Date();
      await dbService.updateProjectMetadata(projectMetadata);

      console.log(`Successfully processed repository ${repositoryUrl} (ID: ${processingId})`);
      return { success: true };
    } catch (error) {
      console.error(`Error processing repository ${repositoryUrl} (ID: ${processingId}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    } finally {
      // Clean up the repository
      if (repoPath) {
        repositoryService.cleanupRepository(repoPath);
      }
    }
  }

  /**
   * Generate embeddings with retry logic
   */
  private async generateEmbeddingsWithRetry(
    files: any[],
    projectId: number,
    commitId: string,
    branch: string,
    maxRetries: number = 3
  ): Promise<any[]> {
    let retries = 0;
    let lastError: Error | null = null;

    while (retries < maxRetries) {
      try {
        return await embeddingService.generateEmbeddings(
          files,
          projectId,
          commitId,
          branch
        );
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        retries++;

        if (retries >= maxRetries) {
          console.error(`Failed to generate embeddings after ${maxRetries} attempts:`, error);
          throw lastError;
        }

        // Exponential backoff
        const delay = Math.pow(2, retries) * 1000;
        console.log(`Retrying embedding generation in ${delay}ms (attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    // This should never be reached due to the throw in the catch block
    throw lastError || new Error('Failed to generate embeddings');
  }



  /**
   * Stop processing the queue
   */
  async stop(): Promise<void> {
    this.isProcessing = false;

    if (this.processingPromise) {
      await this.processingPromise;
      this.processingPromise = null;
    }
  }
}

// Export a singleton instance
export const queueService = new QueueService();
