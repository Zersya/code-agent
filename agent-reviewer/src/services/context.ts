import { dbService } from './database.js';
import { embeddingService } from './embedding.js';
import { repositoryService } from './repository.js';
import { gitlabService } from './gitlab.js';
import { queueService } from './queue.js';
import { CodeEmbedding, CodeFile, ProjectMetadata } from '../models/embedding.js';
import { MergeRequestChange } from '../types/review.js';
import { JobStatus } from '../models/queue.js';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';

dotenv.config();

// Environment variables
const WAIT_FOR_EMBEDDINGS = process.env.WAIT_FOR_EMBEDDINGS === 'true';
const EMBEDDING_WAIT_TIMEOUT = Number(process.env.EMBEDDING_WAIT_TIMEOUT) || 300; // 5 minutes default

/**
 * Interface for project context
 */
export interface ProjectContext {
  projectId: number;
  projectMetadata: ProjectMetadata | null;
  relevantFiles: CodeEmbedding[];
  contextSummary: string;
}

/**
 * Service for gathering project context for code reviews
 */
export class ContextService {
  /**
   * Get context for a project
   * @param projectId The ID of the project
   * @param changes The changes to review
   * @returns The project context
   */
  async getProjectContext(projectId: number | string, changes: MergeRequestChange[]): Promise<ProjectContext> {
    try {
      console.log(`Getting context for project ${projectId}`);

      // Convert projectId to number if it's a string or ensure consistent ID generation
      const numericProjectId = typeof projectId === 'string'
        ? isNaN(parseInt(projectId, 10))
          ? repositoryService.generateConsistentProjectId(projectId)
          : parseInt(projectId, 10)
        : projectId;

      // Get project metadata
      const projectMetadata = await dbService.getProjectMetadata(numericProjectId);

      // Check if project exists in the database
      if (!projectMetadata) {
        console.log(`Project ${projectId} not found in database, embedding project first`);

        // Get project details from GitLab
        const project = await gitlabService.getProject(projectId);

        if (!project) {
          throw new Error(`Could not find project ${projectId} in GitLab`);
        }

        // Create project metadata
        const newProjectMetadata: ProjectMetadata = {
          projectId: numericProjectId,
          name: project.name,
          description: project.description || '',
          url: project.web_url,
          defaultBranch: project.default_branch,
          lastProcessedCommit: '',
          lastProcessedAt: new Date()
        };

        // Save project metadata
        await dbService.saveProjectMetadata(newProjectMetadata);

        // Queue the project for embedding with high priority
        const processingId = uuidv4();
        await queueService.addJob(project.web_url, processingId, 10);

        console.log(`Project ${projectId} queued for embedding (processingId: ${processingId})`);

        // If we should wait for embeddings to be generated
        if (WAIT_FOR_EMBEDDINGS) {
          console.log(`Waiting for embedding process to complete for project ${projectId}`);

          // Wait for the embedding process to complete with a timeout
          const job = await queueService.waitForJobCompletion(processingId, EMBEDDING_WAIT_TIMEOUT);

          if (job && job.status === JobStatus.COMPLETED) {
            console.log(`Embedding process completed successfully for project ${projectId}`);

            // Now that embeddings are available, get relevant files
            const relevantFiles = await this.findRelevantFiles(numericProjectId, changes);
            const contextSummary = this.generateContextSummary(relevantFiles);

            return {
              projectId: numericProjectId,
              projectMetadata: newProjectMetadata,
              relevantFiles,
              contextSummary
            };
          } else {
            console.warn(`Embedding process did not complete successfully for project ${projectId}`);
          }
        }

        // Return empty context since embedding is in progress or failed
        return {
          projectId: numericProjectId,
          projectMetadata: newProjectMetadata,
          relevantFiles: [],
          contextSummary: 'Project context is being generated. This may take some time.'
        };
      }

      // Check if the project has any embeddings
      const hasEmbeddings = await dbService.hasEmbeddings(numericProjectId);

      if (!hasEmbeddings) {
        console.log(`Project ${projectId} exists but has no embeddings, triggering embedding process`);

        // Queue the project for embedding with high priority
        const processingId = uuidv4();
        await queueService.addJob(projectMetadata.url, processingId, 10);

        console.log(`Project ${projectId} queued for embedding (processingId: ${processingId})`);

        // If we should wait for embeddings to be generated
        if (WAIT_FOR_EMBEDDINGS) {
          console.log(`Waiting for embedding process to complete for project ${projectId}`);

          // Wait for the embedding process to complete with a timeout
          const job = await queueService.waitForJobCompletion(processingId, EMBEDDING_WAIT_TIMEOUT);

          if (!(job && job.status === JobStatus.COMPLETED)) {
            console.warn(`Embedding process did not complete successfully for project ${projectId}`);
          }
        }

        // Check again if embeddings are now available
        const embeddings = await dbService.getEmbeddingsByProject(numericProjectId);

        if (embeddings.length === 0) {
          return {
            projectId: numericProjectId,
            projectMetadata,
            relevantFiles: [],
            contextSummary: 'Project context is being generated. This may take some time.'
          };
        }
      }

      // Get relevant files based on the changes
      const relevantFiles = await this.findRelevantFiles(numericProjectId, changes);

      // Generate a summary of the context
      const contextSummary = this.generateContextSummary(relevantFiles);

      return {
        projectId: numericProjectId,
        projectMetadata,
        relevantFiles,
        contextSummary
      };
    } catch (error) {
      console.error(`Error getting project context for ${projectId}:`, error);

      // Return minimal context in case of error
      return {
        projectId: typeof projectId === 'string' ? parseInt(projectId, 10) : projectId,
        projectMetadata: null,
        relevantFiles: [],
        contextSummary: `Error getting project context: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Find files relevant to the changes being reviewed
   * @param projectId The ID of the project
   * @param changes The changes to review
   * @returns Array of relevant files with their embeddings
   */
  private async findRelevantFiles(projectId: number, changes: MergeRequestChange[]): Promise<CodeEmbedding[]> {
    try {
      // Get all embeddings for the project
      const allEmbeddings = await dbService.getEmbeddingsByProject(projectId);

      if (allEmbeddings.length === 0) {
        console.log(`No embeddings found for project ${projectId}`);

        // Check if embeddings are being generated
        const isEmbeddingInProgress = await this.isEmbeddingInProgress(projectId);

        if (isEmbeddingInProgress) {
          console.log(`Embedding process is in progress for project ${projectId}`);
        } else {
          console.log(`No embedding process found for project ${projectId}`);
        }

        return [];
      }

      console.log(`Found ${allEmbeddings.length} embeddings for project ${projectId}`);

      // Extract file paths from changes
      const changedFilePaths = changes.map(change => change.newPath);

      // Find directly related files (files that are being changed)
      const directlyRelatedFiles = allEmbeddings.filter(embedding =>
        changedFilePaths.some(path => embedding.filePath === path)
      );

      console.log(`Found ${directlyRelatedFiles.length} directly related files`);

      // If we have enough directly related files, return them
      if (directlyRelatedFiles.length >= 5) {
        return directlyRelatedFiles.slice(0, 10); // Limit to 10 files
      }

      // Otherwise, find semantically related files
      const semanticallyRelatedFiles: CodeEmbedding[] = [];

      // For each changed file, find related files using embeddings
      for (const change of changes) {
        // Skip if the file is too large or has no content
        if (!change.newContent || change.newContent.length > 10000) {
          continue;
        }

        try {
          // Generate embedding for the changed file
          const embedding = await embeddingService.generateEmbedding(change.newContent);

          // Search for similar code
          const similarFiles = await dbService.searchSimilarCode(projectId, embedding, 3);

          // Add to semantically related files if not already included
          for (const file of similarFiles) {
            if (!semanticallyRelatedFiles.some(f => f.filePath === file.filePath) &&
                !directlyRelatedFiles.some(f => f.filePath === file.filePath)) {
              semanticallyRelatedFiles.push(file);
            }
          }
        } catch (error) {
          console.error(`Error finding similar files for ${change.newPath}:`, error);
          // Continue with the next file
        }
      }

      console.log(`Found ${semanticallyRelatedFiles.length} semantically related files`);

      // Combine directly related and semantically related files
      const relevantFiles = [...directlyRelatedFiles, ...semanticallyRelatedFiles];

      // Limit to a reasonable number of files
      return relevantFiles.slice(0, 15);
    } catch (error) {
      console.error(`Error finding relevant files for project ${projectId}:`, error);
      return [];
    }
  }

  /**
   * Check if an embedding process is in progress for a project
   * @param projectId The ID of the project
   * @returns True if an embedding process is in progress, false otherwise
   */
  private async isEmbeddingInProgress(projectId: number | string): Promise<boolean> {
    try {
      // Convert projectId to number if it's a string or ensure consistent ID generation
      const numericProjectId = typeof projectId === 'string'
        ? isNaN(parseInt(projectId, 10))
          ? repositoryService.generateConsistentProjectId(projectId)
          : parseInt(projectId, 10)
        : projectId;

      // Get project metadata to get the URL
      const projectMetadata = await dbService.getProjectMetadata(numericProjectId);

      if (!projectMetadata || !projectMetadata.url) {
        return false;
      }

      // Get queue statistics
      const stats = await queueService.getQueueStats();

      // If there are no active or pending jobs, return false
      if (stats.processing === 0 && stats.pending === 0 && stats.retrying === 0) {
        return false;
      }

      // Get recent jobs
      const recentJobs = await queueService.getRecentJobs(20);

      // Check if any job is for this project's URL and is in progress
      return recentJobs.some(job =>
        job.repositoryUrl === projectMetadata.url &&
        (job.status === JobStatus.PENDING || job.status === JobStatus.PROCESSING || job.status === JobStatus.RETRYING)
      );
    } catch (error) {
      console.error(`Error checking if embedding is in progress for project ${projectId}:`, error);
      return false;
    }
  }

  /**
   * Generate a summary of the context
   * @param relevantFiles The relevant files
   * @returns A summary of the context
   */
  private generateContextSummary(relevantFiles: CodeEmbedding[]): string {
    if (relevantFiles.length === 0) {
      return 'No relevant context files found.';
    }

    // Generate a summary of the relevant files
    const filesSummary = relevantFiles.map(file => {
      // Truncate content if it's too long
      const truncatedContent = file.content.length > 500
        ? file.content.substring(0, 500) + '...'
        : file.content;

      return `
File: ${file.filePath} (${file.language})
\`\`\`${file.language}
${truncatedContent}
\`\`\`
`;
    }).join('\n');

    return `
Project Context (${relevantFiles.length} relevant files):

${filesSummary}
`;
  }
}

export const contextService = new ContextService();
