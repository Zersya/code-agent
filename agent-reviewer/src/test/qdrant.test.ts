import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import { qdrantService } from '../services/qdrant.js';
import { hybridDbService } from '../services/hybrid-database.js';
import { CodeEmbedding, DocumentationEmbedding } from '../models/embedding.js';

// Mock data for testing
const mockCodeEmbedding: CodeEmbedding = {
  projectId: 1,
  repositoryUrl: 'https://gitlab.com/test/repo',
  filePath: 'src/test.ts',
  content: 'console.log("Hello, World!");',
  embedding: Array.from({ length: 1536 }, () => Math.random()),
  language: 'typescript',
  commitId: 'abc123',
  branch: 'main',
  createdAt: new Date(),
  updatedAt: new Date()
};

const mockDocumentationEmbedding: DocumentationEmbedding = {
  id: 'doc-1',
  sourceId: 'nuxt-docs',
  section: 'getting-started',
  title: 'Getting Started with Nuxt',
  content: 'Nuxt is a Vue.js framework...',
  embedding: Array.from({ length: 1536 }, () => Math.random()),
  url: 'https://nuxt.com/docs/getting-started',
  framework: 'nuxt',
  version: '3.0',
  keywords: ['nuxt', 'vue', 'framework'],
  createdAt: new Date(),
  updatedAt: new Date()
};

describe('QDrant Service', () => {
  beforeAll(async () => {
    // Skip tests if QDrant is not available
    const isHealthy = await qdrantService.healthCheck();
    if (!isHealthy) {
      console.log('QDrant not available, skipping tests');
      return;
    }

    // Initialize collections
    await qdrantService.initializeCollections();
  });

  afterAll(async () => {
    // Clean up test data
    try {
      const config = qdrantService.getConfig();
      await qdrantService.clearCollection(config.collections.code);
      await qdrantService.clearCollection(config.collections.documentation);
    } catch (error) {
      console.log('Cleanup failed (expected if QDrant not available):', error);
    }
  });

  it('should check QDrant health', async () => {
    const isHealthy = await qdrantService.healthCheck();
    // Test passes regardless of QDrant availability
    expect(typeof isHealthy).toBe('boolean');
  });

  it('should get collection info', async () => {
    const isHealthy = await qdrantService.healthCheck();
    if (!isHealthy) {
      console.log('Skipping test - QDrant not available');
      return;
    }

    const config = qdrantService.getConfig();
    const info = await qdrantService.getCollectionInfo(config.collections.code);
    
    expect(info).toBeDefined();
    expect(info?.name).toBe(config.collections.code);
    expect(info?.vectorSize).toBe(1536);
    expect(info?.distance).toBe('Cosine');
  });

  it('should upsert and search code embeddings', async () => {
    const isHealthy = await qdrantService.healthCheck();
    if (!isHealthy) {
      console.log('Skipping test - QDrant not available');
      return;
    }

    // Upsert embedding
    await qdrantService.upsertCodeEmbedding(mockCodeEmbedding);

    // Search for similar embeddings
    const results = await qdrantService.searchSimilarCode(
      mockCodeEmbedding.embedding,
      5,
      { projectId: mockCodeEmbedding.projectId }
    );

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].filePath).toBe(mockCodeEmbedding.filePath);
  });

  it('should upsert and search documentation embeddings', async () => {
    const isHealthy = await qdrantService.healthCheck();
    if (!isHealthy) {
      console.log('Skipping test - QDrant not available');
      return;
    }

    // Upsert embedding
    await qdrantService.upsertDocumentationEmbedding(mockDocumentationEmbedding);

    // Search for similar embeddings
    const results = await qdrantService.searchSimilarDocumentation(
      mockDocumentationEmbedding.embedding,
      5,
      { framework: [mockDocumentationEmbedding.framework] }
    );

    expect(results).toBeDefined();
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(mockDocumentationEmbedding.id);
  });

  it('should batch upsert embeddings', async () => {
    const isHealthy = await qdrantService.healthCheck();
    if (!isHealthy) {
      console.log('Skipping test - QDrant not available');
      return;
    }

    const embeddings = [
      { ...mockCodeEmbedding, filePath: 'src/test1.ts' },
      { ...mockCodeEmbedding, filePath: 'src/test2.ts' },
      { ...mockCodeEmbedding, filePath: 'src/test3.ts' }
    ];

    // Batch upsert
    await qdrantService.batchUpsertCodeEmbeddings(embeddings);

    // Verify all embeddings were stored
    const results = await qdrantService.searchSimilarCode(
      mockCodeEmbedding.embedding,
      10,
      { projectId: mockCodeEmbedding.projectId }
    );

    expect(results.length).toBeGreaterThanOrEqual(3);
  });

  it('should get collection statistics', async () => {
    const isHealthy = await qdrantService.healthCheck();
    if (!isHealthy) {
      console.log('Skipping test - QDrant not available');
      return;
    }

    const stats = await qdrantService.getCollectionStats();
    
    expect(stats).toBeDefined();
    expect(stats.codeEmbeddings).toBeDefined();
    expect(stats.documentationEmbeddings).toBeDefined();
    expect(typeof stats.codeEmbeddings.count).toBe('number');
    expect(typeof stats.documentationEmbeddings.count).toBe('number');
  });
});

describe('Hybrid Database Service', () => {
  beforeAll(async () => {
    // Initialize hybrid service
    await hybridDbService.initialize();
  });

  it('should get service status', async () => {
    const status = await hybridDbService.getStatus();
    
    expect(status).toBeDefined();
    expect(status.database).toBeDefined();
    expect(status.qdrant).toBeDefined();
    expect(typeof status.database.available).toBe('boolean');
    expect(typeof status.qdrant.available).toBe('boolean');
    expect(['database-only', 'qdrant-primary', 'hybrid']).toContain(status.mode);
  });

  it('should get configuration', async () => {
    const config = hybridDbService.getConfig();
    
    expect(config).toBeDefined();
    expect(typeof config.useQdrant).toBe('boolean');
    expect(typeof config.fallbackToDatabase).toBe('boolean');
  });

  it('should handle embedding operations with fallback', async () => {
    // This test verifies that the hybrid service can handle operations
    // regardless of QDrant availability
    
    try {
      const hasEmbeddings = await hybridDbService.hasEmbeddings(999); // Non-existent project
      expect(typeof hasEmbeddings).toBe('boolean');
      expect(hasEmbeddings).toBe(false);
    } catch (error) {
      // Should not throw errors due to fallback mechanisms
      expect(error).toBeUndefined();
    }
  });
});

describe('QDrant Configuration', () => {
  it('should have valid configuration', () => {
    const config = qdrantService.getConfig();
    
    expect(config).toBeDefined();
    expect(config.url).toBeDefined();
    expect(config.collections).toBeDefined();
    expect(config.collections.code).toBeDefined();
    expect(config.collections.documentation).toBeDefined();
    expect(typeof config.timeout).toBe('number');
    expect(typeof config.retries).toBe('number');
  });

  it('should validate collection names', () => {
    const config = qdrantService.getConfig();
    
    // Collection names should be valid
    expect(config.collections.code.length).toBeGreaterThan(0);
    expect(config.collections.documentation.length).toBeGreaterThan(0);
    
    // Should not contain invalid characters
    expect(config.collections.code).toMatch(/^[a-zA-Z0-9_-]+$/);
    expect(config.collections.documentation).toMatch(/^[a-zA-Z0-9_-]+$/);
  });
});
