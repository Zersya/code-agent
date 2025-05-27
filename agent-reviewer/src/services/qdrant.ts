import { QdrantClient } from '@qdrant/js-client-rest';
import dotenv from 'dotenv';
import {
  QdrantPoint,
  QdrantSearchResult,
  QdrantCollectionInfo,
  CodeEmbeddingPayload,
  DocumentationEmbeddingPayload,
  CodeEmbeddingFilter,
  DocumentationEmbeddingFilter,
  QdrantConfig,
  CollectionCreateParams,
  BatchUpsertOperation,
  SearchParams,
  ScrollParams,
  ScrollResult
} from '../models/qdrant.js';
import { CodeEmbedding, DocumentationEmbedding } from '../models/embedding.js';

dotenv.config();

/**
 * QDrant Vector Database Service
 * Handles all vector database operations for code and documentation embeddings
 */
export class QdrantService {
  private client: QdrantClient;
  private config: QdrantConfig;

  constructor() {
    this.config = {
      url: process.env.QDRANT_URL || 'http://localhost:6333',
      apiKey: process.env.QDRANT_API_KEY,
      timeout: 30000,
      retries: 3,
      collections: {
        code: process.env.QDRANT_CODE_COLLECTION || 'code_embeddings',
        documentation: process.env.QDRANT_DOCS_COLLECTION || 'documentation_embeddings'
      }
    };

    this.client = new QdrantClient({
      url: this.config.url,
      apiKey: this.config.apiKey,
      timeout: this.config.timeout
    });
  }

  /**
   * Initialize QDrant collections
   */
  async initializeCollections(): Promise<void> {
    try {
      console.log('Initializing QDrant collections...');

      // Create code embeddings collection
      await this.createCollectionIfNotExists({
        name: this.config.collections.code,
        vectorSize: 1536,
        distance: 'Cosine',
        onDiskPayload: true,
        optimizersConfig: {
          deletedThreshold: 0.2,
          vacuumMinVectorNumber: 1000,
          defaultSegmentNumber: 0,
          maxSegmentSize: 20000,
          memmapThreshold: 1000,
          indexingThreshold: 20000,
          flushIntervalSec: 5,
          maxOptimizationThreads: 1
        }
      });

      // Create documentation embeddings collection
      await this.createCollectionIfNotExists({
        name: this.config.collections.documentation,
        vectorSize: 1536,
        distance: 'Cosine',
        onDiskPayload: true,
        optimizersConfig: {
          deletedThreshold: 0.2,
          vacuumMinVectorNumber: 1000,
          defaultSegmentNumber: 0,
          maxSegmentSize: 20000,
          memmapThreshold: 1000,
          indexingThreshold: 20000,
          flushIntervalSec: 5,
          maxOptimizationThreads: 1
        }
      });

      console.log('QDrant collections initialized successfully');
    } catch (error) {
      console.error('Error initializing QDrant collections:', error);
      throw error;
    }
  }

  /**
   * Create a collection if it doesn't exist
   */
  private async createCollectionIfNotExists(params: CollectionCreateParams): Promise<void> {
    try {
      const collections = await this.client.getCollections();
      const existingCollection = collections.collections?.find(c => c.name === params.name);

      if (existingCollection) {
        console.log(`Collection ${params.name} already exists`);
        return;
      }

      console.log(`Creating collection ${params.name}...`);
      await this.client.createCollection(params.name, {
        vectors: {
          size: params.vectorSize,
          distance: params.distance
        },
        on_disk_payload: params.onDiskPayload,
        optimizers_config: params.optimizersConfig,
        wal_config: params.walConfig,
        quantization_config: params.quantizationConfig
      });

      console.log(`Collection ${params.name} created successfully`);
    } catch (error) {
      console.error(`Error creating collection ${params.name}:`, error);
      throw error;
    }
  }

  /**
   * Get collection information
   */
  async getCollectionInfo(collectionName: string): Promise<QdrantCollectionInfo | null> {
    try {
      const info = await this.client.getCollection(collectionName);
      return {
        name: collectionName,
        vectorSize: info.config?.params?.vectors?.size || 0,
        distance: info.config?.params?.vectors?.distance || 'Cosine',
        status: info.status || 'unknown',
        pointsCount: info.points_count
      };
    } catch (error) {
      console.error(`Error getting collection info for ${collectionName}:`, error);
      return null;
    }
  }

  /**
   * Check if QDrant is healthy and accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      const collections = await this.client.getCollections();
      return collections !== null;
    } catch (error) {
      console.error('QDrant health check failed:', error);
      return false;
    }
  }

  /**
   * Upsert code embedding
   */
  async upsertCodeEmbedding(embedding: CodeEmbedding): Promise<void> {
    try {
      const point: QdrantPoint = {
        id: `${embedding.projectId}_${embedding.filePath}`,
        vector: embedding.embedding,
        payload: {
          projectId: embedding.projectId,
          repositoryUrl: embedding.repositoryUrl,
          filePath: embedding.filePath,
          content: embedding.content,
          language: embedding.language,
          commitId: embedding.commitId,
          branch: embedding.branch,
          createdAt: embedding.createdAt.toISOString(),
          updatedAt: embedding.updatedAt.toISOString()
        } as CodeEmbeddingPayload
      };

      await this.client.upsert(this.config.collections.code, {
        wait: true,
        points: [point]
      });
    } catch (error) {
      console.error('Error upserting code embedding:', error);
      throw error;
    }
  }

  /**
   * Batch upsert code embeddings
   */
  async batchUpsertCodeEmbeddings(embeddings: CodeEmbedding[]): Promise<void> {
    try {
      const points: QdrantPoint[] = embeddings.map(embedding => ({
        id: `${embedding.projectId}_${embedding.filePath}`,
        vector: embedding.embedding,
        payload: {
          projectId: embedding.projectId,
          repositoryUrl: embedding.repositoryUrl,
          filePath: embedding.filePath,
          content: embedding.content,
          language: embedding.language,
          commitId: embedding.commitId,
          branch: embedding.branch,
          createdAt: embedding.createdAt.toISOString(),
          updatedAt: embedding.updatedAt.toISOString()
        } as CodeEmbeddingPayload
      }));

      await this.client.upsert(this.config.collections.code, {
        wait: true,
        points
      });
    } catch (error) {
      console.error('Error batch upserting code embeddings:', error);
      throw error;
    }
  }

  /**
   * Search similar code embeddings
   */
  async searchSimilarCode(
    embedding: number[],
    limit: number = 10,
    filter?: CodeEmbeddingFilter,
    scoreThreshold?: number
  ): Promise<CodeEmbedding[]> {
    try {
      const searchFilter = this.buildCodeFilter(filter);

      const searchResult = await this.client.search(this.config.collections.code, {
        vector: embedding,
        limit,
        filter: searchFilter,
        with_payload: true,
        score_threshold: scoreThreshold
      });

      return searchResult.map(result => this.mapQdrantResultToCodeEmbedding(result));
    } catch (error) {
      console.error('Error searching similar code:', error);
      throw error;
    }
  }

  /**
   * Upsert documentation embedding
   */
  async upsertDocumentationEmbedding(embedding: DocumentationEmbedding): Promise<void> {
    try {
      const point: QdrantPoint = {
        id: embedding.id,
        vector: embedding.embedding,
        payload: {
          sourceId: embedding.sourceId,
          section: embedding.section,
          title: embedding.title,
          content: embedding.content,
          url: embedding.url,
          framework: embedding.framework,
          version: embedding.version,
          keywords: embedding.keywords,
          createdAt: embedding.createdAt.toISOString(),
          updatedAt: embedding.updatedAt.toISOString()
        } as DocumentationEmbeddingPayload
      };

      await this.client.upsert(this.config.collections.documentation, {
        wait: true,
        points: [point]
      });
    } catch (error) {
      console.error('Error upserting documentation embedding:', error);
      throw error;
    }
  }

  /**
   * Batch upsert documentation embeddings
   */
  async batchUpsertDocumentationEmbeddings(embeddings: DocumentationEmbedding[]): Promise<void> {
    try {
      const points: QdrantPoint[] = embeddings.map(embedding => ({
        id: embedding.id,
        vector: embedding.embedding,
        payload: {
          sourceId: embedding.sourceId,
          section: embedding.section,
          title: embedding.title,
          content: embedding.content,
          url: embedding.url,
          framework: embedding.framework,
          version: embedding.version,
          keywords: embedding.keywords,
          createdAt: embedding.createdAt.toISOString(),
          updatedAt: embedding.updatedAt.toISOString()
        } as DocumentationEmbeddingPayload
      }));

      await this.client.upsert(this.config.collections.documentation, {
        wait: true,
        points
      });
    } catch (error) {
      console.error('Error batch upserting documentation embeddings:', error);
      throw error;
    }
  }

  /**
   * Search similar documentation embeddings
   */
  async searchSimilarDocumentation(
    embedding: number[],
    limit: number = 10,
    filter?: DocumentationEmbeddingFilter,
    scoreThreshold?: number
  ): Promise<DocumentationEmbedding[]> {
    try {
      const searchFilter = this.buildDocumentationFilter(filter);

      const searchResult = await this.client.search(this.config.collections.documentation, {
        vector: embedding,
        limit,
        filter: searchFilter,
        with_payload: true,
        score_threshold: scoreThreshold
      });

      return searchResult.map(result => this.mapQdrantResultToDocumentationEmbedding(result));
    } catch (error) {
      console.error('Error searching similar documentation:', error);
      throw error;
    }
  }

  /**
   * Delete embeddings by project ID
   */
  async deleteCodeEmbeddingsByProject(projectId: number): Promise<void> {
    try {
      await this.client.delete(this.config.collections.code, {
        filter: {
          must: [
            {
              key: 'projectId',
              match: { value: projectId }
            }
          ]
        },
        wait: true
      });
    } catch (error) {
      console.error('Error deleting code embeddings by project:', error);
      throw error;
    }
  }

  /**
   * Delete documentation embeddings by source ID
   */
  async deleteDocumentationEmbeddingsBySource(sourceId: string): Promise<void> {
    try {
      await this.client.delete(this.config.collections.documentation, {
        filter: {
          must: [
            {
              key: 'sourceId',
              match: { value: sourceId }
            }
          ]
        },
        wait: true
      });
    } catch (error) {
      console.error('Error deleting documentation embeddings by source:', error);
      throw error;
    }
  }

  /**
   * Build filter for code embeddings
   */
  private buildCodeFilter(filter?: CodeEmbeddingFilter): any {
    if (!filter) return undefined;

    const conditions: any[] = [];

    if (filter.projectId !== undefined) {
      conditions.push({
        key: 'projectId',
        match: { value: filter.projectId }
      });
    }

    if (filter.language) {
      conditions.push({
        key: 'language',
        match: { value: filter.language }
      });
    }

    if (filter.commitId) {
      conditions.push({
        key: 'commitId',
        match: { value: filter.commitId }
      });
    }

    if (filter.branch) {
      conditions.push({
        key: 'branch',
        match: { value: filter.branch }
      });
    }

    if (filter.filePath) {
      conditions.push({
        key: 'filePath',
        match: { value: filter.filePath }
      });
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  /**
   * Build filter for documentation embeddings
   */
  private buildDocumentationFilter(filter?: DocumentationEmbeddingFilter): any {
    if (!filter) return undefined;

    const conditions: any[] = [];

    if (filter.sourceId) {
      conditions.push({
        key: 'sourceId',
        match: { value: filter.sourceId }
      });
    }

    if (filter.framework) {
      if (Array.isArray(filter.framework)) {
        conditions.push({
          key: 'framework',
          match: { any: filter.framework }
        });
      } else {
        conditions.push({
          key: 'framework',
          match: { value: filter.framework }
        });
      }
    }

    if (filter.version) {
      conditions.push({
        key: 'version',
        match: { value: filter.version }
      });
    }

    if (filter.keywords && filter.keywords.length > 0) {
      conditions.push({
        key: 'keywords',
        match: { any: filter.keywords }
      });
    }

    return conditions.length > 0 ? { must: conditions } : undefined;
  }

  /**
   * Map QDrant search result to CodeEmbedding
   */
  private mapQdrantResultToCodeEmbedding(result: any): CodeEmbedding {
    const payload = result.payload as CodeEmbeddingPayload;
    return {
      projectId: payload.projectId,
      repositoryUrl: payload.repositoryUrl,
      filePath: payload.filePath,
      content: payload.content,
      embedding: result.vector || [],
      language: payload.language,
      commitId: payload.commitId,
      branch: payload.branch,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt)
    };
  }

  /**
   * Map QDrant search result to DocumentationEmbedding
   */
  private mapQdrantResultToDocumentationEmbedding(result: any): DocumentationEmbedding {
    const payload = result.payload as DocumentationEmbeddingPayload;
    return {
      id: result.id as string,
      sourceId: payload.sourceId,
      section: payload.section,
      title: payload.title,
      content: payload.content,
      embedding: result.vector || [],
      url: payload.url,
      framework: payload.framework,
      version: payload.version,
      keywords: payload.keywords,
      createdAt: new Date(payload.createdAt),
      updatedAt: new Date(payload.updatedAt)
    };
  }

  /**
   * Get embeddings by project ID with pagination
   */
  async getCodeEmbeddingsByProject(
    projectId: number,
    limit: number = 100,
    offset?: string | number
  ): Promise<{ embeddings: CodeEmbedding[]; nextOffset?: string | number }> {
    try {
      const scrollResult = await this.client.scroll(this.config.collections.code, {
        filter: {
          must: [
            {
              key: 'projectId',
              match: { value: projectId }
            }
          ]
        },
        limit,
        offset,
        with_payload: true,
        with_vector: true
      });

      const embeddings = scrollResult.points.map(point => this.mapQdrantResultToCodeEmbedding(point));

      return {
        embeddings,
        nextOffset: scrollResult.next_page_offset
      };
    } catch (error) {
      console.error('Error getting code embeddings by project:', error);
      throw error;
    }
  }

  /**
   * Get embeddings by commit ID
   */
  async getCodeEmbeddingsByCommit(
    projectId: number,
    commitId: string
  ): Promise<CodeEmbedding[]> {
    try {
      const scrollResult = await this.client.scroll(this.config.collections.code, {
        filter: {
          must: [
            {
              key: 'projectId',
              match: { value: projectId }
            },
            {
              key: 'commitId',
              match: { value: commitId }
            }
          ]
        },
        with_payload: true,
        with_vector: true
      });

      return scrollResult.points.map(point => this.mapQdrantResultToCodeEmbedding(point));
    } catch (error) {
      console.error('Error getting code embeddings by commit:', error);
      throw error;
    }
  }

  /**
   * Check if project has embeddings
   */
  async hasCodeEmbeddings(projectId: number): Promise<boolean> {
    try {
      const result = await this.client.scroll(this.config.collections.code, {
        filter: {
          must: [
            {
              key: 'projectId',
              match: { value: projectId }
            }
          ]
        },
        limit: 1,
        with_payload: false,
        with_vector: false
      });

      return result.points.length > 0;
    } catch (error) {
      console.error('Error checking if project has embeddings:', error);
      return false;
    }
  }

  /**
   * Get collection statistics
   */
  async getCollectionStats(): Promise<{
    codeEmbeddings: { count: number; size: string };
    documentationEmbeddings: { count: number; size: string };
  }> {
    try {
      const [codeInfo, docsInfo] = await Promise.all([
        this.getCollectionInfo(this.config.collections.code),
        this.getCollectionInfo(this.config.collections.documentation)
      ]);

      return {
        codeEmbeddings: {
          count: codeInfo?.pointsCount || 0,
          size: this.formatBytes((codeInfo?.pointsCount || 0) * 1536 * 4) // Approximate size
        },
        documentationEmbeddings: {
          count: docsInfo?.pointsCount || 0,
          size: this.formatBytes((docsInfo?.pointsCount || 0) * 1536 * 4) // Approximate size
        }
      };
    } catch (error) {
      console.error('Error getting collection stats:', error);
      return {
        codeEmbeddings: { count: 0, size: '0 B' },
        documentationEmbeddings: { count: 0, size: '0 B' }
      };
    }
  }

  /**
   * Format bytes to human readable string
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Clear all embeddings from a collection
   */
  async clearCollection(collectionName: string): Promise<void> {
    try {
      await this.client.delete(collectionName, {
        filter: {},
        wait: true
      });
      console.log(`Cleared all embeddings from collection ${collectionName}`);
    } catch (error) {
      console.error(`Error clearing collection ${collectionName}:`, error);
      throw error;
    }
  }

  /**
   * Get QDrant client for advanced operations
   */
  getClient(): QdrantClient {
    return this.client;
  }

  /**
   * Get configuration
   */
  getConfig(): QdrantConfig {
    return this.config;
  }
}

export const qdrantService = new QdrantService();
