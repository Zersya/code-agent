import { hybridDbService } from './hybrid-database.js';
import { embeddingService } from './embedding.js';
import { repositoryService } from './repository.js';
import { gitlabService } from './gitlab.js';
import { queueService } from './queue.js';
import { enhancedContextService } from './enhanced-context.js';
import { documentationService } from './documentation.js';
import { CodeEmbedding, CodeFile, ProjectMetadata, DocumentationContext, DocumentationEmbedding } from '../models/embedding.js';
import { MergeRequestChange } from '../types/review.js';
import { EnhancedContextResult } from '../types/context.js';
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
  enhancedContext?: EnhancedContextResult;
  documentationContext?: DocumentationContext;
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
  async getProjectContext(projectId: number, changes: MergeRequestChange[]): Promise<ProjectContext> {
    try {
      console.log(`Getting context for project ${projectId}`);

      // Convert projectId to number if it's a string or ensure consistent ID generation


      // Get project metadata
      const projectMetadata = await hybridDbService.getProjectMetadata(projectId);

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
          projectId: projectId,
          name: project.name,
          description: project.description || '',
          url: project.web_url,
          defaultBranch: project.default_branch,
          lastProcessedCommit: '',
          lastProcessedAt: new Date(),
          lastReembeddingAt: undefined
        };

        // Save project metadata
        await dbService.saveProjectMetadata(newProjectMetadata);

        // Queue the project for embedding with high priority
        const processingId = uuidv4();
        await queueService.addJob(projectId, project.web_url, processingId, 10);

        console.log(`Project ${projectId} queued for embedding (processingId: ${processingId})`);

        // If we should wait for embeddings to be generated
        if (WAIT_FOR_EMBEDDINGS) {
          console.log(`Waiting for embedding process to complete for project ${projectId}`);

          // Wait for the embedding process to complete with a timeout
          const job = await queueService.waitForJobCompletion(processingId, EMBEDDING_WAIT_TIMEOUT);

          if (job && job.status === JobStatus.COMPLETED) {
            console.log(`Embedding process completed successfully for project ${projectId}`);

            // Now that embeddings are available, get relevant files
            const relevantFiles = await this.findRelevantFiles(projectId, changes);
            const contextSummary = this.generateContextSummary(relevantFiles);

            return {
              projectId: projectId,
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
          projectId: projectId,
          projectMetadata: newProjectMetadata,
          relevantFiles: [],
          contextSummary: 'Project context is being generated. This may take some time.'
        };
      }

      // Check if the project has any embeddings
      const hasEmbeddings = await hybridDbService.hasEmbeddings(projectId);

      if (!hasEmbeddings) {
        console.log(`Project ${projectId} exists but has no embeddings, triggering embedding process`);

        // Queue the project for embedding with high priority
        const processingId = uuidv4();
        await queueService.addJob(projectId, projectMetadata.url, processingId, 10);

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
        const embeddings = await dbService.getEmbeddingsByProject(projectId);

        if (embeddings.length === 0) {
          return {
            projectId: projectId,
            projectMetadata,
            relevantFiles: [],
            contextSummary: 'Project context is being generated. This may take some time.'
          };
        }
      }

      // Get relevant files based on the changes
      const relevantFiles = await this.findRelevantFiles(projectId, changes);

      // Check if we should use enhanced context for small changesets
      let enhancedContext: EnhancedContextResult | undefined;
      if (enhancedContextService.shouldUseEnhancedContext(changes)) {
        try {
          console.log(`Getting enhanced context for small changeset in project ${projectId}`);
          enhancedContext = await enhancedContextService.getEnhancedContext(changes);
          console.log(`Enhanced context gathering completed: ${enhancedContext.success ? 'success' : 'failed'}`);
        } catch (error) {
          console.warn(`Error getting enhanced context, continuing with standard context:`, error);
        }
      }

      // Get documentation context
      let documentationContext: DocumentationContext | undefined;
      try {
        console.log(`Getting documentation context for project ${projectId}`);
        documentationContext = await this.getDocumentationContext(projectId, changes);
        console.log(`Documentation context gathering completed: ${documentationContext.relevantSections.length} sections found`);
      } catch (error) {
        console.warn(`Error getting documentation context, continuing without it:`, error);
      }

      // Generate a summary of the context (including enhanced and documentation context if available)
      const contextSummary = this.generateContextSummary(relevantFiles, enhancedContext, documentationContext);

      return {
        projectId: projectId,
        projectMetadata,
        relevantFiles,
        contextSummary,
        enhancedContext,
        documentationContext
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
      const allEmbeddings = await hybridDbService.getEmbeddingsByProject(projectId);

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
          const similarFiles = await hybridDbService.searchSimilarCode(projectId, embedding, 3);

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
  private async isEmbeddingInProgress(projectId: number): Promise<boolean> {
    try {

      // Get project metadata to get the URL
      const projectMetadata = await hybridDbService.getProjectMetadata(projectId);

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
   * Get documentation context for the changes
   * @param projectId The ID of the project
   * @param changes The changes to review
   * @returns Documentation context
   */
  private async getDocumentationContext(projectId: number, changes: MergeRequestChange[]): Promise<DocumentationContext> {
    try {
      // Auto-detect frameworks and map to documentation if not already mapped
      await documentationService.autoMapProjectDocumentation(projectId, changes);

      // Get project documentation mappings
      const mappings = await hybridDbService.getProjectDocumentationMappings(projectId);

      if (mappings.length === 0) {
        console.log(`No documentation mappings found for project ${projectId}`);
        return {
          relevantSections: [],
          frameworks: [],
          totalSections: 0,
          averageRelevanceScore: 0,
          sources: []
        };
      }

      // Get documentation sources
      const sourceIds = mappings.map(m => m.sourceId);
      const sources = await Promise.all(
        sourceIds.map(id => hybridDbService.getDocumentationSource(id))
      );
      const validSources = sources.filter(s => s !== null);

      if (validSources.length === 0) {
        console.log(`No valid documentation sources found for project ${projectId}`);
        return {
          relevantSections: [],
          frameworks: [],
          totalSections: 0,
          averageRelevanceScore: 0,
          sources: []
        };
      }

      // Detect frameworks from changes
      const detectionResult = documentationService.detectFrameworks(changes);
      const frameworks = detectionResult.frameworks.length > 0
        ? detectionResult.frameworks
        : validSources.map(s => s.framework);

      // Generate embeddings for the changes to find relevant documentation
      const relevantSections: DocumentationEmbedding[] = [];
      let totalRelevanceScore = 0;

      for (const change of changes.slice(0, 3)) { // Limit to first 3 changes to avoid too many API calls
        if (!change.newContent || change.newContent.length > 5000) {
          continue;
        }

        try {
          const embedding = await embeddingService.generateEmbedding(change.newContent);
          const similarDocs = await hybridDbService.searchDocumentationEmbeddings(embedding, frameworks, 3);

          for (const doc of similarDocs) {
            if (!relevantSections.some(s => s.id === doc.id)) {
              relevantSections.push(doc);
              totalRelevanceScore += 0.8; // Assume good relevance for now
            }
          }
        } catch (error) {
          console.error(`Error finding documentation for change ${change.newPath}:`, error);
        }
      }

      const averageRelevanceScore = relevantSections.length > 0
        ? totalRelevanceScore / relevantSections.length
        : 0;

      return {
        relevantSections: relevantSections.slice(0, 10), // Limit to 10 sections
        frameworks,
        totalSections: relevantSections.length,
        averageRelevanceScore,
        sources: validSources
      };
    } catch (error) {
      console.error(`Error getting documentation context for project ${projectId}:`, error);
      return {
        relevantSections: [],
        frameworks: [],
        totalSections: 0,
        averageRelevanceScore: 0,
        sources: []
      };
    }
  }

  /**
   * Generate a summary of the context
   * @param relevantFiles The relevant files
   * @param enhancedContext Optional enhanced context for small changesets
   * @param documentationContext Optional documentation context
   * @returns A summary of the context
   */
  private generateContextSummary(
    relevantFiles: CodeEmbedding[],
    enhancedContext?: EnhancedContextResult,
    documentationContext?: DocumentationContext
  ): string {
    let summary = '';

    // Add enhanced context summary if available
    if (enhancedContext && enhancedContext.success) {
      summary += enhancedContext.contextSummary + '\n\n';
      summary += '---\n\n';
    }

    // Add documentation context if available
    if (documentationContext && documentationContext.relevantSections.length > 0) {
      summary += `Documentation Context (${documentationContext.frameworks.join(', ')} - ${documentationContext.relevantSections.length} relevant sections):\n\n`;

      const docSummary = documentationContext.relevantSections.map(section => {
        // Truncate content if it's too long
        const truncatedContent = section.content.length > 400
          ? section.content.substring(0, 400) + '...'
          : section.content;

        return `
**${section.title}** (${section.framework})
${section.url ? `URL: ${section.url}` : ''}
Keywords: ${section.keywords.join(', ')}

${truncatedContent}
`;
      }).join('\n');

      summary += docSummary + '\n\n---\n\n';
    }

    if (relevantFiles.length === 0) {
      summary += 'No relevant context files found from semantic search.';
      return summary;
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

    summary += `
Standard Project Context (${relevantFiles.length} relevant files from semantic search):

${filesSummary}
`;

    return summary;
  }
}

export const contextService = new ContextService();
