/**
 * Types and interfaces for enhanced context gathering
 */

/**
 * Statistics about a changeset to determine if enhanced context should be used
 */
export interface ChangesetStats {
  totalFiles: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  totalLinesModified: number;
  isSmallChangeset: boolean;
  languages: string[];
  fileTypes: {
    source: number;
    test: number;
    config: number;
    documentation: number;
  };
}

/**
 * A query to be executed against the codebase-retrieval tool
 */
export interface ContextQuery {
  id: string;
  query: string;
  priority: number; // 1-10, higher is more important
  category: 'inheritance' | 'dependencies' | 'callers' | 'tests' | 'config' | 'documentation';
  relatedFile?: string;
  relatedElement?: string; // class name, function name, etc.
}

/**
 * Result from a single context query
 */
export interface ContextQueryResult {
  query: ContextQuery;
  success: boolean;
  results: string[];
  error?: string;
  executionTimeMs: number;
}

/**
 * Enhanced context gathered from multiple queries
 */
export interface EnhancedContextResult {
  changesetStats: ChangesetStats;
  queries: ContextQuery[];
  queryResults: ContextQueryResult[];
  enhancedFiles: string[];
  contextSummary: string;
  totalExecutionTimeMs: number;
  success: boolean;
  errors: string[];
}

/**
 * Code element extracted from changed files
 */
export interface CodeElement {
  type: 'class' | 'function' | 'interface' | 'constant' | 'import' | 'export';
  name: string;
  filePath: string;
  language: string;
  context?: string; // surrounding code context
}

/**
 * Configuration for enhanced context gathering
 */
export interface EnhancedContextConfig {
  enabled: boolean;
  maxLinesThreshold: number;
  maxFilesThreshold: number;
  maxQueries: number;
  timeoutMs: number;
  maxResultsPerQuery: number;
}
