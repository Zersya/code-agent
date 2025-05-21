// Queue model for managing embedding jobs

/**
 * Job status enum
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

/**
 * Interface for embedding job
 */
export interface EmbeddingJob {
  id: string;
  repositoryUrl: string;
  processingId: string;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  priority: number;
}

/**
 * Interface for job result
 */
export interface JobResult {
  success: boolean;
  error?: string;
  data?: any;
}

/**
 * Interface for queue configuration
 */
export interface QueueConfig {
  concurrency: number;
  maxAttempts: number;
  retryDelay: number;
  priorityLevels: {
    LOW: number;
    NORMAL: number;
    HIGH: number;
  };
}

/**
 * Interface for job status response
 */
export interface JobStatusResponse {
  id: string;
  processingId: string;
  status: JobStatus;
  repositoryUrl: string;
  progress?: number;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
  startedAt?: Date;
  completedAt?: Date;
  attempts: number;
  maxAttempts: number;
}
