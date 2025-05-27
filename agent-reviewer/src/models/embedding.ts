// Embedding model for storing code embeddings

export interface CodeFile {
  path: string;
  content: string;
  language: string;
  lastModified: Date;
}

export interface CodeEmbedding {
  projectId: number;
  repositoryUrl: string;
  filePath: string;
  content: string;
  embedding: number[];
  language: string;
  commitId: string;
  branch: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectMetadata {
  projectId: number;
  name: string;
  description: string;
  url: string;
  defaultBranch: string;
  lastProcessedCommit: string;
  lastProcessedAt: Date;
  lastReembeddingAt?: Date;
}

export interface EmbeddingBatch {
  projectId: number;
  commitId: string;
  branch: string;
  files: CodeFile[];
  embeddings: CodeEmbedding[];
  createdAt: Date;
}

// Documentation embedding models

export interface DocumentationSource {
  id: string;
  name: string;
  description: string;
  url: string;
  framework: string; // e.g., 'nuxt', 'vue', 'react', 'general'
  version?: string;
  isActive: boolean;
  refreshIntervalDays: number;
  lastFetchedAt?: Date;
  lastEmbeddedAt?: Date;
  fetchStatus: 'pending' | 'success' | 'failed';
  fetchError?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentationEmbedding {
  id: string;
  sourceId: string;
  section: string; // e.g., 'components/button', 'api/configuration'
  title: string;
  content: string;
  embedding: number[];
  url?: string; // Direct link to this section
  framework: string;
  version?: string;
  keywords: string[]; // For additional matching
  createdAt: Date;
  updatedAt: Date;
}

export interface ProjectDocumentationMapping {
  projectId: number;
  sourceId: string;
  isEnabled: boolean;
  priority: number; // Higher number = higher priority
  createdAt: Date;
  updatedAt: Date;
}

export interface DocumentationBatch {
  sourceId: string;
  sections: DocumentationSection[];
  embeddings: DocumentationEmbedding[];
  createdAt: Date;
}

export interface DocumentationSection {
  section: string;
  title: string;
  content: string;
  url?: string;
  keywords: string[];
}

// Framework detection types
export interface FrameworkDetectionResult {
  frameworks: string[];
  confidence: number;
  detectedFrom: ('fileExtensions' | 'imports' | 'dependencies' | 'config')[];
}

// Documentation context types
export interface DocumentationContext {
  relevantSections: DocumentationEmbedding[];
  frameworks: string[];
  totalSections: number;
  averageRelevanceScore: number;
  sources: DocumentationSource[];
}
