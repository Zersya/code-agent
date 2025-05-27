// QDrant-specific models and types for vector database operations

export interface QdrantPoint {
  id: string | number;
  vector: number[];
  payload: Record<string, any>;
}

export interface QdrantSearchResult {
  id: string | number;
  score: number;
  payload: Record<string, any>;
  vector?: number[];
}

export interface QdrantCollectionInfo {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  status: string;
  pointsCount?: number;
}

// Code embedding payload structure for QDrant
export interface CodeEmbeddingPayload {
  projectId: number;
  repositoryUrl: string;
  filePath: string;
  content: string;
  language: string;
  commitId: string;
  branch: string;
  createdAt: string;
  updatedAt: string;
}

// Documentation embedding payload structure for QDrant
export interface DocumentationEmbeddingPayload {
  sourceId: string;
  section: string;
  title: string;
  content: string;
  url?: string;
  framework: string;
  version?: string;
  keywords: string[];
  createdAt: string;
  updatedAt: string;
}

// Search filters for QDrant queries
export interface CodeEmbeddingFilter {
  projectId?: number;
  language?: string;
  commitId?: string;
  branch?: string;
  filePath?: string;
}

export interface DocumentationEmbeddingFilter {
  sourceId?: string;
  framework?: string | string[];
  version?: string;
  keywords?: string[];
}

// Migration-related types
export interface MigrationProgress {
  totalRecords: number;
  migratedRecords: number;
  failedRecords: number;
  currentBatch: number;
  totalBatches: number;
  startTime: Date;
  estimatedTimeRemaining?: number;
  errors: string[];
}

export interface MigrationOptions {
  batchSize: number;
  validateData: boolean;
  skipExisting: boolean;
  dryRun: boolean;
  continueOnError: boolean;
}

// QDrant configuration
export interface QdrantConfig {
  url: string;
  apiKey?: string;
  timeout?: number;
  retries?: number;
  collections: {
    code: string;
    documentation: string;
  };
}

// Collection creation parameters
export interface CollectionCreateParams {
  name: string;
  vectorSize: number;
  distance: 'Cosine' | 'Euclidean' | 'Dot';
  onDiskPayload?: boolean;
  optimizersConfig?: {
    deletedThreshold?: number;
    vacuumMinVectorNumber?: number;
    defaultSegmentNumber?: number;
    maxSegmentSize?: number;
    memmapThreshold?: number;
    indexingThreshold?: number;
    flushIntervalSec?: number;
    maxOptimizationThreads?: number;
  };
  walConfig?: {
    walCapacityMb?: number;
    walSegmentsAhead?: number;
  };
  quantizationConfig?: {
    scalar?: {
      type: 'int8';
      quantile?: number;
      alwaysRam?: boolean;
    };
  };
}

// Batch operation types
export interface BatchUpsertOperation {
  points: QdrantPoint[];
  wait?: boolean;
  ordering?: 'weak' | 'medium' | 'strong';
}

export interface BatchDeleteOperation {
  filter: Record<string, any>;
  wait?: boolean;
  ordering?: 'weak' | 'medium' | 'strong';
}

// Search parameters
export interface SearchParams {
  vector: number[];
  limit: number;
  offset?: number;
  filter?: Record<string, any>;
  params?: {
    hnsw_ef?: number;
    exact?: boolean;
  };
  withPayload?: boolean | string[];
  withVector?: boolean;
  scoreThreshold?: number;
}

// Scroll parameters for pagination
export interface ScrollParams {
  filter?: Record<string, any>;
  limit?: number;
  offset?: string | number;
  withPayload?: boolean | string[];
  withVector?: boolean;
  orderBy?: string;
}

export interface ScrollResult {
  points: QdrantPoint[];
  nextPageOffset?: string | number;
}
