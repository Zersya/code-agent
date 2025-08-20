import { v4 as uuidv4 } from 'uuid';
import { EmbeddingJob, DocumentationJob, JobStatus, JobResult, QueueConfig } from '../models/queue.js';
import { dbService } from './database.js';
import { repositoryService } from './repository.js';
import { embeddingService, UnrecoverableError, ServiceUnavailableError } from './embedding.js';
import { schedulingService, SchedulingOptions } from './scheduling.js';
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
  private activeDocumentationJobs: Map<string, DocumentationJob>;
  private isProcessing: boolean;
  private config: QueueConfig;
  private processingPromise: Promise<void> | null;

  constructor(config: Partial<QueueConfig> = {}) {
    this.activeJobs = new Map();
    this.activeDocumentationJobs = new Map();
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
            priority INTEGER NOT NULL DEFAULT 5,
            project_id INTEGER NOT NULL,
            is_reembedding BOOLEAN DEFAULT FALSE
          )
        `);

        // Add the is_reembedding column if it doesn't exist (migration)
        try {
          await client.query(`
            ALTER TABLE embedding_jobs
            ADD COLUMN IF NOT EXISTS is_reembedding BOOLEAN DEFAULT FALSE
          `);
        } catch (error) {
          // Column might already exist, ignore the error
          console.log('Column is_reembedding might already exist:', error);
        }

        // Create indexes
        await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_processing_id ON embedding_jobs(processing_id)');
        await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_project_id ON embedding_jobs(project_id)');

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
   * Add a job to the queue with optional scheduling
   */
  async addJob(
    projectId: number,
    repositoryUrl: string,
    processingId: string,
    priority: number = DEFAULT_QUEUE_CONFIG.priorityLevels.NORMAL,
    isReembedding: boolean = false,
    schedulingOptions?: SchedulingOptions
  ): Promise<EmbeddingJob> {
    try {
      // Determine scheduling if options provided
      let scheduledFor: Date | undefined;
      let actualStatus = JobStatus.PENDING;

      if (schedulingOptions) {
        const schedulingResult = schedulingService.shouldScheduleForMidnight(schedulingOptions);

        if (schedulingResult.shouldSchedule) {
          scheduledFor = schedulingResult.scheduledTime;
          actualStatus = JobStatus.DELAYED;
          console.log(`Job scheduled for midnight WIB: ${schedulingResult.reason}`);
        } else {
          console.log(`Job will be processed immediately: ${schedulingResult.reason}`);
        }
      }

      const job: EmbeddingJob = {
        id: uuidv4(),
        repositoryUrl,
        processingId,
        status: actualStatus,
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority,
        projectId,
        isReembedding,
        scheduledFor
      };

      // Save the job to the database
      await this.saveJob(job);

      if (scheduledFor) {
        console.log(`Added scheduled job ${job.id} to the queue for repository ${repositoryUrl} - scheduled for ${scheduledFor.toISOString()}`);
      } else {
        console.log(`Added job ${job.id} to the queue for repository ${repositoryUrl}`);
      }

      // Start processing if not already processing
      if (!this.isProcessing) {
        this.startProcessing();
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
          error, created_at, updated_at, started_at, completed_at, priority, project_id, is_reembedding
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id)
        DO UPDATE SET
          status = EXCLUDED.status,
          attempts = EXCLUDED.attempts,
          error = EXCLUDED.error,
          updated_at = EXCLUDED.updated_at,
          started_at = EXCLUDED.started_at,
          completed_at = EXCLUDED.completed_at,
          project_id = EXCLUDED.project_id,
          is_reembedding = EXCLUDED.is_reembedding
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
        job.priority,
        job.projectId,
        job.isReembedding || false
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
          started_at as "startedAt", completed_at as "completedAt", priority, project_id as "projectId",
          is_reembedding as "isReembedding"
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
      // Check if embedding_jobs table exists
      const tableExistsResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'embedding_jobs'
        );
      `);

      if (!tableExistsResult.rows[0].exists) {
        console.warn('embedding_jobs table does not exist, returning empty stats');
        return {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          retrying: 0,
          total: 0,
          activeJobs: this.activeJobs.size
        };
      }

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
      // Check if embedding_jobs table exists
      const tableExistsResult = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'embedding_jobs'
        );
      `);

      if (!tableExistsResult.rows[0].exists) {
        console.warn('embedding_jobs table does not exist, returning empty jobs list');
        return [];
      }

      const result = await client.query(`
        SELECT
          id, repository_url as "repositoryUrl", processing_id as "processingId",
          status, attempts, max_attempts as "maxAttempts", error,
          created_at as "createdAt", updated_at as "updatedAt",
          started_at as "startedAt", completed_at as "completedAt", priority, project_id as "projectId",
          is_reembedding as "isReembedding"
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
   * Get next pending jobs up to concurrency limit, including delayed jobs that are ready
   */
  private async getNextPendingJobs(): Promise<EmbeddingJob[]> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT
          id, repository_url as "repositoryUrl", processing_id as "processingId",
          status, attempts, max_attempts as "maxAttempts", error,
          created_at as "createdAt", updated_at as "updatedAt",
          started_at as "startedAt", completed_at as "completedAt",
          scheduled_for as "scheduledFor", priority, project_id as "projectId",
          is_reembedding as "isReembedding"
        FROM embedding_jobs
        WHERE (
          status = $1 OR
          (status = $2 AND updated_at < NOW() - INTERVAL '1 minute' * attempts) OR
          (status = $3 AND (scheduled_for IS NULL OR scheduled_for <= NOW()))
        )
        ORDER BY priority DESC, created_at ASC
        LIMIT $4
      `, [JobStatus.PENDING, JobStatus.RETRYING, JobStatus.DELAYED, this.config.concurrency - this.activeJobs.size]);

      return result.rows as EmbeddingJob[];
    } finally {
      client.release();
    }
  }

  /**
   * Start processing the queue
   */
  private startProcessing(): void {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    this.processingPromise = this.processQueue();
  }

  /**
   * Process the queue
   */
  private async processQueue(): Promise<void> {
    try {
      while (this.isProcessing) {
        const totalActiveJobs = this.activeJobs.size + this.activeDocumentationJobs.size;

        // Check if we can process more jobs
        if (totalActiveJobs < this.config.concurrency) {
          // Get next pending embedding jobs
          const pendingJobs = await this.getNextPendingJobs();

          // Get next pending documentation jobs
          const pendingDocJobs = await this.getNextPendingDocumentationJobs();

          if (pendingJobs.length === 0 && pendingDocJobs.length === 0) {
            // No pending jobs, wait a bit before checking again
            await new Promise(resolve => setTimeout(resolve, 1000));
            continue;
          }

          // Process embedding jobs
          for (const job of pendingJobs) {
            // Skip if we've reached concurrency limit
            if (this.activeJobs.size + this.activeDocumentationJobs.size >= this.config.concurrency) {
              break;
            }

            // Add to active jobs
            this.activeJobs.set(job.id, job);

            // Process the job
            this.processJob(job).catch(error => {
              console.error(`Error processing job ${job.id}:`, error);
            });
          }

          // Process documentation jobs
          for (const job of pendingDocJobs) {
            // Skip if we've reached concurrency limit
            if (this.activeJobs.size + this.activeDocumentationJobs.size >= this.config.concurrency) {
              break;
            }

            // Add to active documentation jobs
            this.activeDocumentationJobs.set(job.id, job);

            // Process the documentation job
            this.processDocumentationJob(job).catch(error => {
              console.error(`Error processing documentation job ${job.id}:`, error);
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
  private async processJob(job: EmbeddingJob): Promise<void> {
    try {
      console.log(`Processing job ${job.id} for repository ${job.repositoryUrl}`);

      // Update job status
      job.status = JobStatus.PROCESSING;
      job.attempts += 1;
      job.startedAt = job.startedAt || new Date();
      job.updatedAt = new Date();
      await this.saveJob(job);

      // If this is a re-embedding job, clear existing data first
      if (job.isReembedding) {
        console.log(`Re-embedding job for project ${job.projectId}, clearing existing data first`);
        const clearResult = await dbService.clearProjectEmbeddingData(job.projectId);
        console.log(`Cleared existing data for project ${job.projectId}: ${clearResult.deletedEmbeddings} embeddings, ${clearResult.deletedBatches} batches`);
      }

      // Process the repository
      const result = await this.processRepository(job.projectId, job.repositoryUrl, job.processingId);

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
  private async processRepository(projectId: number, repositoryUrl: string, processingId: string): Promise<JobResult> {
    let repoPath = '';

    try {
      console.log(`Processing repository ${repositoryUrl} (ID: ${processingId})`);

      // Clone the repository
      const { repoPath: clonedRepoPath } = await repositoryService.cloneRepository(projectId, repositoryUrl);
      repoPath = clonedRepoPath;

      // Get all files from the repository
      console.log(`Getting files from repository ${repositoryUrl}`);
      const files = await repositoryService.getFilesFromLocalRepo(repoPath);

      if (files.length === 0) {
        console.log('No files found, skipping');
        return { success: true };
      }

      console.log(`Found ${files.length} files, generating embeddings`);

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
          lastReembeddingAt: undefined
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

      // Log detailed information about the embeddings being saved
      if (embeddings.length > 0) {
        console.log(`Saving embeddings for project ${projectId}:`);
        console.log(`- Repository URL: ${repositoryUrl}`);
        console.log(`- Commit ID: ${commitId}`);
        console.log(`- Branch: ${branch}`);
        console.log(`- Sample file paths: ${embeddings.slice(0, 3).map(e => e.filePath).join(', ')}`);
      } else {
        console.warn(`No embeddings generated for project ${projectId}. This might indicate an issue with file processing or filtering.`);
      }

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
   * Generate embeddings with retry logic and improved error handling
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

        // Handle UnrecoverableError - don't retry
        if (error instanceof UnrecoverableError) {
          console.error(`Unrecoverable error in embedding generation: ${error.message}`);
          throw error;
        }

        // Handle ServiceUnavailableError - retry with backoff
        if (error instanceof ServiceUnavailableError) {
          console.error(`Service unavailable error (attempt ${retries + 1}/${maxRetries}): ${error.message}`);
        } else {
          console.error(`Error generating embeddings (attempt ${retries + 1}/${maxRetries}):`, error);
        }

        retries++;

        // Check if we should retry
        if (retries >= maxRetries) {
          if (error instanceof ServiceUnavailableError) {
            console.error(`Embedding service is unavailable after ${maxRetries} attempts: ${error.message}`);
            throw new ServiceUnavailableError(`Embedding service unavailable after ${maxRetries} attempts: ${error.message}. Please check if the Qodo embedding service is running and the model is properly loaded.`);
          } else {
            console.error(`Failed to generate embeddings after ${maxRetries} attempts:`, error);
            throw lastError;
          }
        }

        // Calculate delay based on error type
        let baseDelay: number;
        if (error instanceof ServiceUnavailableError) {
          baseDelay = Math.pow(2, retries) * 5000; // Longer delays for service issues
        } else {
          baseDelay = Math.pow(2, retries) * 1000; // Standard exponential backoff
        }

        console.log(`Retrying embedding generation in ${baseDelay}ms (attempt ${retries + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, baseDelay));
      }
    }

    // This should never be reached due to the throw in the catch block
    throw lastError || new ServiceUnavailableError('Failed to generate embeddings after multiple attempts');
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStatistics(): Promise<{
    pending: number;
    delayed: number;
    processing: number;
    completed: number;
    failed: number;
    retrying: number;
    oldestPendingJob?: Date;
    oldestProcessingJob?: Date;
  }> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT
          status,
          COUNT(*) as count,
          MIN(created_at) as oldest_created_at,
          MIN(started_at) as oldest_started_at
        FROM embedding_jobs
        GROUP BY status
      `);

      const stats = {
        pending: 0,
        delayed: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retrying: 0,
        oldestPendingJob: undefined as Date | undefined,
        oldestProcessingJob: undefined as Date | undefined
      };

      for (const row of result.rows) {
        const status = row.status;
        const count = parseInt(row.count);

        if (status in stats) {
          (stats as any)[status] = count;
        }

        // Track oldest jobs
        if (status === 'pending' && row.oldest_created_at) {
          stats.oldestPendingJob = new Date(row.oldest_created_at);
        }
        if (status === 'processing' && row.oldest_started_at) {
          stats.oldestProcessingJob = new Date(row.oldest_started_at);
        }
      }

      return stats;
    } finally {
      client.release();
    }
  }

  /**
   * Add a documentation job to the queue
   */
  async addDocumentationJob(
    sourceId: string,
    sourceUrl: string,
    processingId: string,
    priority: number = DEFAULT_QUEUE_CONFIG.priorityLevels.NORMAL
  ): Promise<DocumentationJob> {
    try {
      const job: DocumentationJob = {
        id: uuidv4(),
        sourceId,
        sourceUrl,
        processingId,
        status: JobStatus.PENDING,
        attempts: 0,
        maxAttempts: this.config.maxAttempts,
        createdAt: new Date(),
        updatedAt: new Date(),
        priority
      };

      // Save the job to the database
      await this.saveDocumentationJob(job);

      console.log(`Added documentation job ${job.id} to the queue for source ${sourceId}`);

      // Start processing if not already processing
      if (!this.isProcessing) {
        this.startProcessing();
      }

      return job;
    } catch (error) {
      console.error('Error adding documentation job to queue:', error);
      throw error;
    }
  }

  /**
   * Save a documentation job to the database
   */
  private async saveDocumentationJob(job: DocumentationJob): Promise<void> {
    const client = await dbService.getClient();

    try {
      // Create documentation_jobs table if it doesn't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS documentation_jobs (
          id TEXT PRIMARY KEY,
          source_id TEXT NOT NULL,
          source_url TEXT NOT NULL,
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

      // Create indexes if they don't exist
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_jobs_status ON documentation_jobs(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_jobs_processing_id ON documentation_jobs(processing_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_jobs_source_id ON documentation_jobs(source_id)');

      await client.query(`
        INSERT INTO documentation_jobs (
          id, source_id, source_url, processing_id, status, attempts, max_attempts,
          error, created_at, updated_at, started_at, completed_at, priority
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
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
        job.sourceId,
        job.sourceUrl,
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
   * Get a documentation job by processing ID
   */
  async getDocumentationJobByProcessingId(processingId: string): Promise<DocumentationJob | null> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT
          id, source_id as "sourceId", source_url as "sourceUrl", processing_id as "processingId",
          status, attempts, max_attempts as "maxAttempts", error,
          created_at as "createdAt", updated_at as "updatedAt",
          started_at as "startedAt", completed_at as "completedAt", priority
        FROM documentation_jobs
        WHERE processing_id = $1
      `, [processingId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as DocumentationJob;
    } finally {
      client.release();
    }
  }

  /**
   * Get next pending documentation jobs up to concurrency limit
   */
  private async getNextPendingDocumentationJobs(): Promise<DocumentationJob[]> {
    const client = await dbService.getClient();

    try {
      const result = await client.query(`
        SELECT
          id, source_id as "sourceId", source_url as "sourceUrl", processing_id as "processingId",
          status, attempts, max_attempts as "maxAttempts", error,
          created_at as "createdAt", updated_at as "updatedAt",
          started_at as "startedAt", completed_at as "completedAt", priority
        FROM documentation_jobs
        WHERE status = $1 OR (status = $2 AND updated_at < NOW() - INTERVAL '1 minute' * attempts)
        ORDER BY priority DESC, created_at ASC
        LIMIT $3
      `, [JobStatus.PENDING, JobStatus.RETRYING, this.config.concurrency - this.activeJobs.size - this.activeDocumentationJobs.size]);

      return result.rows as DocumentationJob[];
    } finally {
      client.release();
    }
  }

  /**
   * Process a single documentation job
   */
  private async processDocumentationJob(job: DocumentationJob): Promise<void> {
    try {
      console.log(`Processing documentation job ${job.id} for source ${job.sourceId}`);

      // Update job status
      job.status = JobStatus.PROCESSING;
      job.attempts += 1;
      job.startedAt = job.startedAt || new Date();
      job.updatedAt = new Date();
      await this.saveDocumentationJob(job);

      // Process the documentation source
      const result = await this.processDocumentationSource(job.sourceId, job.sourceUrl, job.processingId);

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
      await this.saveDocumentationJob(job);
    } catch (error) {
      console.error(`Error processing documentation job ${job.id}:`, error);

      // Update job status
      job.status = job.attempts >= job.maxAttempts ? JobStatus.FAILED : JobStatus.RETRYING;
      job.error = error instanceof Error ? error.message : String(error);
      job.updatedAt = new Date();
      await this.saveDocumentationJob(job);
    } finally {
      // Remove from active documentation jobs
      this.activeDocumentationJobs.delete(job.id);
    }
  }

  /**
   * Process a documentation source
   */
  private async processDocumentationSource(sourceId: string, sourceUrl: string, processingId: string): Promise<JobResult> {
    try {
      console.log(`Processing documentation source ${sourceUrl} (ID: ${processingId})`);

      // Import documentation service here to avoid circular dependency
      const { documentationService } = await import('./documentation.js');

      // Fetch and process documentation
      const batch = await documentationService.fetchAndProcessDocumentation(sourceId);

      console.log(`Successfully processed documentation source ${sourceId}: ${batch.embeddings.length} embeddings generated`);

      return {
        success: true,
        data: batch
      };
    } catch (error) {
      console.error(`Error processing documentation source ${sourceId}:`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      };
    }
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
