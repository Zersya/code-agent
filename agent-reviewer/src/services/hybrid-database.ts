import { dbService } from './database.js';
import { qdrantService } from './qdrant.js';
import { CodeEmbedding, DocumentationEmbedding } from '../models/embedding.js';
import { CodeEmbeddingFilter, DocumentationEmbeddingFilter } from '../models/qdrant.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Hybrid database service that can work with both PostgreSQL and QDrant
 * Provides a gradual migration path and fallback mechanisms
 */
export class HybridDatabaseService {
  private useQdrant: boolean;
  private fallbackToDatabase: boolean;

  constructor() {
    // Check if QDrant should be used
    this.useQdrant = process.env.USE_QDRANT === 'true';
    this.fallbackToDatabase = process.env.QDRANT_FALLBACK_TO_DB === 'true';

    console.log(`Hybrid Database Service initialized:`);
    console.log(`- Use QDrant: ${this.useQdrant}`);
    console.log(`- Fallback to DB: ${this.fallbackToDatabase}`);
  }

  /**
   * Initialize the hybrid service
   */
  async initialize(): Promise<void> {
    try {
      // Always initialize the database service
      await dbService.initialize();

      if (this.useQdrant) {
        // Check QDrant health and initialize if needed
        const isHealthy = await qdrantService.healthCheck();
        if (isHealthy) {
          await qdrantService.initializeCollections();
          console.log('QDrant service initialized successfully');
        } else {
          console.warn('QDrant is not healthy, falling back to database only');
          if (!this.fallbackToDatabase) {
            throw new Error('QDrant is not available and fallback is disabled');
          }
          this.useQdrant = false;
        }
      }
    } catch (error) {
      console.error('Error initializing hybrid database service:', error);
      if (this.fallbackToDatabase) {
        console.log('Falling back to database-only mode');
        this.useQdrant = false;
      } else {
        throw error;
      }
    }
  }

  /**
   * Save a code embedding
   */
  async saveEmbedding(embedding: CodeEmbedding): Promise<void> {
    const errors: Error[] = [];

    // Always save to database for backup/consistency
    try {
      await dbService.saveEmbedding(embedding);
    } catch (error) {
      console.error('Error saving embedding to database:', error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    // Save to QDrant if enabled
    if (this.useQdrant) {
      try {
        await qdrantService.upsertCodeEmbedding(embedding);
      } catch (error) {
        console.error('Error saving embedding to QDrant:', error);
        errors.push(error instanceof Error ? error : new Error(String(error)));

        if (!this.fallbackToDatabase) {
          throw error;
        }
      }
    }

    // If both failed and no fallback, throw the first error
    if (errors.length > 0 && (!this.fallbackToDatabase || errors.length === 2)) {
      throw errors[0];
    }
  }

  /**
   * Batch save embeddings
   */
  async saveEmbeddings(embeddings: CodeEmbedding[]): Promise<void> {
    const errors: Error[] = [];

    // Always save to database for backup/consistency
    try {
      await dbService.saveEmbeddings(embeddings);
    } catch (error) {
      console.error('Error batch saving embeddings to database:', error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    // Save to QDrant if enabled
    if (this.useQdrant) {
      try {
        await qdrantService.batchUpsertCodeEmbeddings(embeddings);
      } catch (error) {
        console.error('Error batch saving embeddings to QDrant:', error);
        errors.push(error instanceof Error ? error : new Error(String(error)));

        if (!this.fallbackToDatabase) {
          throw error;
        }
      }
    }

    // If both failed and no fallback, throw the first error
    if (errors.length > 0 && (!this.fallbackToDatabase || errors.length === 2)) {
      throw errors[0];
    }
  }

  /**
   * Search for similar code embeddings
   */
  async searchSimilarCode(
    projectId: number,
    embedding: number[],
    limit: number = 10,
    scoreThreshold?: number
  ): Promise<CodeEmbedding[]> {
    // Try QDrant first if enabled
    if (this.useQdrant) {
      try {
        const filter: CodeEmbeddingFilter = { projectId };
        return await qdrantService.searchSimilarCode(embedding, limit, filter, scoreThreshold);
      } catch (error) {
        console.error('Error searching with QDrant:', error);

        if (!this.fallbackToDatabase) {
          throw error;
        }

        console.log('Falling back to database search');
      }
    }

    // Fallback to database search
    return await dbService.searchSimilarCode(projectId, embedding, limit);
  }

  /**
   * Search for similar code across all projects
   */
  async searchSimilarCodeAcrossProjects(
    embedding: number[],
    limit: number = 10,
    scoreThreshold?: number
  ): Promise<CodeEmbedding[]> {
    // Try QDrant first if enabled
    if (this.useQdrant) {
      try {
        return await qdrantService.searchSimilarCode(embedding, limit, undefined, scoreThreshold);
      } catch (error) {
        console.error('Error searching across projects with QDrant:', error);

        if (!this.fallbackToDatabase) {
          throw error;
        }

        console.log('Falling back to database search');
      }
    }

    // Fallback to database search
    return await dbService.searchSimilarCodeAcrossProjects(embedding, limit);
  }

  /**
   * Get embeddings by project
   */
  async getEmbeddingsByProject(projectId: number): Promise<CodeEmbedding[]> {
    // Try QDrant first if enabled
    if (this.useQdrant) {
      try {
        const result = await qdrantService.getCodeEmbeddingsByProject(projectId);
        return result.embeddings;
      } catch (error) {
        console.error('Error getting embeddings by project from QDrant:', error);

        if (!this.fallbackToDatabase) {
          throw error;
        }

        console.log('Falling back to database query');
      }
    }

    // Fallback to database query
    return await dbService.getEmbeddingsByProject(projectId);
  }

  /**
   * Get embeddings by commit
   */
  async getEmbeddingsByCommit(projectId: number, commitId: string): Promise<CodeEmbedding[]> {
    // Try QDrant first if enabled
    if (this.useQdrant) {
      try {
        return await qdrantService.getCodeEmbeddingsByCommit(projectId, commitId);
      } catch (error) {
        console.error('Error getting embeddings by commit from QDrant:', error);

        if (!this.fallbackToDatabase) {
          throw error;
        }

        console.log('Falling back to database query');
      }
    }

    // Fallback to database query
    return await dbService.getEmbeddingsByCommit(projectId, commitId);
  }

  /**
   * Check if project has embeddings
   */
  async hasEmbeddings(projectId: number): Promise<boolean> {
    // Try QDrant first if enabled
    if (this.useQdrant) {
      try {
        return await qdrantService.hasCodeEmbeddings(projectId);
      } catch (error) {
        console.error('Error checking embeddings in QDrant:', error);

        if (!this.fallbackToDatabase) {
          throw error;
        }

        console.log('Falling back to database check');
      }
    }

    // Fallback to database check
    return await dbService.hasEmbeddings(projectId);
  }

  /**
   * Delete embeddings by project
   */
  async deleteEmbeddingsByProject(projectId: number): Promise<void> {
    const errors: Error[] = [];

    // Delete from database
    try {
      await dbService.clearProjectEmbeddingData(projectId);
    } catch (error) {
      console.error('Error deleting embeddings from database:', error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    // Delete from QDrant if enabled
    if (this.useQdrant) {
      try {
        await qdrantService.deleteCodeEmbeddingsByProject(projectId);
      } catch (error) {
        console.error('Error deleting embeddings from QDrant:', error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // If any errors occurred, throw the first one
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Save documentation embeddings
   */
  async saveDocumentationEmbeddings(embeddings: DocumentationEmbedding[]): Promise<void> {
    const errors: Error[] = [];

    // Always save to database for backup/consistency
    try {
      await dbService.saveDocumentationEmbeddings(embeddings);
    } catch (error) {
      console.error('Error saving documentation embeddings to database:', error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    // Save to QDrant if enabled
    if (this.useQdrant) {
      try {
        await qdrantService.batchUpsertDocumentationEmbeddings(embeddings);
      } catch (error) {
        console.error('Error saving documentation embeddings to QDrant:', error);
        errors.push(error instanceof Error ? error : new Error(String(error)));

        if (!this.fallbackToDatabase) {
          throw error;
        }
      }
    }

    // If both failed and no fallback, throw the first error
    if (errors.length > 0 && (!this.fallbackToDatabase || errors.length === 2)) {
      throw errors[0];
    }
  }

  /**
   * Search documentation embeddings
   */
  async searchDocumentationEmbeddings(
    embedding: number[],
    frameworks: string[],
    limit: number = 10,
    scoreThreshold?: number
  ): Promise<DocumentationEmbedding[]> {
    // Try QDrant first if enabled
    if (this.useQdrant) {
      try {
        const filter: DocumentationEmbeddingFilter = { framework: frameworks };
        return await qdrantService.searchSimilarDocumentation(embedding, limit, filter, scoreThreshold);
      } catch (error) {
        console.error('Error searching documentation with QDrant:', error);

        if (!this.fallbackToDatabase) {
          throw error;
        }

        console.log('Falling back to database search');
      }
    }

    // Fallback to database search
    return await dbService.searchSimilarDocumentation(frameworks, embedding, limit);
  }

  /**
   * Delete documentation embeddings by source
   */
  async deleteDocumentationEmbeddings(sourceId: string): Promise<void> {
    const errors: Error[] = [];

    // Delete from database
    try {
      await dbService.deleteDocumentationEmbeddings(sourceId);
    } catch (error) {
      console.error('Error deleting documentation embeddings from database:', error);
      errors.push(error instanceof Error ? error : new Error(String(error)));
    }

    // Delete from QDrant if enabled
    if (this.useQdrant) {
      try {
        await qdrantService.deleteDocumentationEmbeddingsBySource(sourceId);
      } catch (error) {
        console.error('Error deleting documentation embeddings from QDrant:', error);
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // If any errors occurred, throw the first one
    if (errors.length > 0) {
      throw errors[0];
    }
  }

  /**
   * Get service status
   */
  async getStatus(): Promise<{
    database: { available: boolean; error?: string };
    qdrant: { available: boolean; enabled: boolean; error?: string };
    mode: 'database-only' | 'qdrant-primary' | 'hybrid';
  }> {
    const status: {
      database: { available: boolean; error?: string };
      qdrant: { available: boolean; enabled: boolean; error?: string };
      mode: 'database-only' | 'qdrant-primary' | 'hybrid';
    } = {
      database: { available: false },
      qdrant: { available: false, enabled: this.useQdrant },
      mode: 'database-only'
    };

    // Check database
    try {
      const client = await dbService.getClient();
      client.release();
      status.database.available = true;
    } catch (error) {
      status.database.error = error instanceof Error ? error.message : String(error);
    }

    // Check QDrant if enabled
    if (this.useQdrant) {
      try {
        const isHealthy = await qdrantService.healthCheck();
        status.qdrant.available = isHealthy;

        if (isHealthy) {
          status.mode = this.fallbackToDatabase ? 'hybrid' : 'qdrant-primary';
        }
      } catch (error) {
        status.qdrant.error = error instanceof Error ? error.message : String(error);
      }
    }

    return status;
  }

  /**
   * Switch to QDrant mode
   */
  async enableQdrant(): Promise<void> {
    this.useQdrant = true;
    await qdrantService.initializeCollections();
    console.log('QDrant mode enabled');
  }

  /**
   * Switch to database-only mode
   */
  disableQdrant(): void {
    this.useQdrant = false;
    console.log('QDrant mode disabled, using database only');
  }

  /**
   * Get configuration
   */
  getConfig(): {
    useQdrant: boolean;
    fallbackToDatabase: boolean;
  } {
    return {
      useQdrant: this.useQdrant,
      fallbackToDatabase: this.fallbackToDatabase
    };
  }

  // Delegate other methods to the database service
  async getProjectMetadata(projectId: number) {
    return await dbService.getProjectMetadata(projectId);
  }

  async saveProjectMetadata(metadata: any) {
    return await dbService.saveProjectMetadata(metadata);
  }

  async getAllProjects() {
    return await dbService.getAllProjects();
  }

  async getAllDocumentationSources() {
    return await dbService.getAllDocumentationSources();
  }

  async getDocumentationEmbeddingsBySource(sourceId: string) {
    // This method doesn't exist in dbService, let's implement it
    try {
      const client = await dbService.getClient();
      try {
        const result = await client.query(`
          SELECT
            id,
            source_id as "sourceId",
            section,
            title,
            content,
            embedding,
            url,
            framework,
            version,
            keywords,
            created_at as "createdAt",
            updated_at as "updatedAt"
          FROM documentation_embeddings
          WHERE source_id = $1
        `, [sourceId]);

        return result.rows.map((row: any) => {
          if (typeof row.embedding === 'string') {
            row.embedding = JSON.parse(row.embedding);
          }
          return row;
        });
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Error getting documentation embeddings by source:', error);
      throw error;
    }
  }

  async saveDocumentationSource(source: any) {
    return await dbService.saveDocumentationSource(source);
  }

  async getProjectDocumentationMappings(projectId: number) {
    return await dbService.getProjectDocumentationMappings(projectId);
  }

  async createWebhookProcessing(record: any) {
    return await dbService.createWebhookProcessing(record);
  }

  async getActiveWebhookProcessing(key: string) {
    return await dbService.getActiveWebhookProcessing(key);
  }

  async updateWebhookProcessingStatus(processingId: string, status: any, completedAt?: Date, error?: string) {
    return await dbService.updateWebhookProcessingStatus(processingId, status, completedAt, error);
  }

  async cleanupStaleWebhookProcessing(cutoffTime: Date) {
    return await dbService.cleanupStaleWebhookProcessing(cutoffTime);
  }

  async getWebhookProcessingStats() {
    return await dbService.getWebhookProcessingStats();
  }

  // Additional methods that might be needed by services
  async updateLastReembeddingTimestamp(projectId: number, timestamp: Date) {
    return await dbService.updateLastReembeddingTimestamp(projectId, timestamp);
  }

  async getDocumentationSource(sourceId: string) {
    return await dbService.getDocumentationSource(sourceId);
  }

  async updateDocumentationSourceStatus(sourceId: string, status: 'pending' | 'success' | 'failed', error?: string, timestamp?: Date) {
    return await dbService.updateDocumentationSourceStatus(sourceId, status, error, timestamp);
  }

  async getDocumentationSourcesByFrameworks(frameworks: string[]) {
    return await dbService.getDocumentationSourcesByFrameworks(frameworks);
  }

  async getProjectDocumentationMapping(projectId: number, sourceId: string) {
    return await dbService.getProjectDocumentationMapping(projectId, sourceId);
  }

  async saveProjectDocumentationMapping(mapping: any) {
    return await dbService.saveProjectDocumentationMapping(mapping);
  }

  async healthCheck() {
    try {
      // Check database connection by getting a client
      const client = await dbService.getClient();
      client.release();
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }
}

export const hybridDbService = new HybridDatabaseService();
