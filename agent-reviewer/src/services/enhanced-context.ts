import { MergeRequestChange } from '../types/review.js';
import {
  ChangesetStats,
  ContextQuery,
  ContextQueryResult,
  EnhancedContextResult,
  CodeElement,
  EnhancedContextConfig
} from '../types/context.js';
import {
  extractJSElements,
  extractPythonElements,
  extractJavaElements,
  extractVueElements,
  extractGenericElements,
  getContext,
  generateQueriesForElement,
  generateQueriesForFile
} from './enhanced-context-methods.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables for enhanced context configuration
const ENHANCED_CONTEXT_ENABLED = process.env.ENHANCED_CONTEXT_ENABLED === 'true';
const ENHANCED_CONTEXT_MAX_LINES = Number(process.env.ENHANCED_CONTEXT_MAX_LINES) || 50;
const ENHANCED_CONTEXT_MAX_FILES = Number(process.env.ENHANCED_CONTEXT_MAX_FILES) || 5;
const ENHANCED_CONTEXT_MAX_QUERIES = Number(process.env.ENHANCED_CONTEXT_MAX_QUERIES) || 10;
const ENHANCED_CONTEXT_TIMEOUT_MS = Number(process.env.ENHANCED_CONTEXT_TIMEOUT_MS) || 30000;
const ENHANCED_CONTEXT_MAX_RESULTS_PER_QUERY = Number(process.env.ENHANCED_CONTEXT_MAX_RESULTS_PER_QUERY) || 5;

/**
 * Service for enhanced context gathering using codebase-retrieval tool
 */
export class EnhancedContextService {
  private config: EnhancedContextConfig;

  constructor() {
    this.config = {
      enabled: ENHANCED_CONTEXT_ENABLED,
      maxLinesThreshold: ENHANCED_CONTEXT_MAX_LINES,
      maxFilesThreshold: ENHANCED_CONTEXT_MAX_FILES,
      maxQueries: ENHANCED_CONTEXT_MAX_QUERIES,
      timeoutMs: ENHANCED_CONTEXT_TIMEOUT_MS,
      maxResultsPerQuery: ENHANCED_CONTEXT_MAX_RESULTS_PER_QUERY,
    };
  }

  /**
   * Check if enhanced context gathering is enabled and should be used for this changeset
   */
  shouldUseEnhancedContext(changes: MergeRequestChange[]): boolean {
    if (!this.config.enabled) {
      return false;
    }

    const stats = this.analyzeChangesetSize(changes);
    return stats.isSmallChangeset;
  }

  /**
   * Analyze changeset to determine if it qualifies for enhanced context gathering
   */
  analyzeChangesetSize(changes: MergeRequestChange[]): ChangesetStats {
    let totalLinesAdded = 0;
    let totalLinesRemoved = 0;
    const languages = new Set<string>();
    const fileTypes = {
      source: 0,
      test: 0,
      config: 0,
      documentation: 0,
    };

    for (const change of changes) {
      // Count lines from diff content
      if (change.diffContent) {
        const lines = change.diffContent.split('\n');
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) {
            totalLinesAdded++;
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            totalLinesRemoved++;
          }
        }
      }

      // Track languages
      if (change.language && change.language !== 'binary') {
        languages.add(change.language);
      }

      // Categorize file types
      const filePath = change.newPath.toLowerCase();
      if (this.isTestFile(filePath)) {
        fileTypes.test++;
      } else if (this.isConfigFile(filePath)) {
        fileTypes.config++;
      } else if (this.isDocumentationFile(filePath)) {
        fileTypes.documentation++;
      } else {
        fileTypes.source++;
      }
    }

    const totalLinesModified = totalLinesAdded + totalLinesRemoved;
    const isSmallChangeset =
      changes.length <= this.config.maxFilesThreshold &&
      totalLinesModified <= this.config.maxLinesThreshold;

    return {
      totalFiles: changes.length,
      totalLinesAdded,
      totalLinesRemoved,
      totalLinesModified,
      isSmallChangeset,
      languages: Array.from(languages),
      fileTypes,
    };
  }

  /**
   * Extract code elements from changed files for context queries
   */
  extractCodeElements(changes: MergeRequestChange[]): CodeElement[] {
    const elements: CodeElement[] = [];

    for (const change of changes) {
      if (change.language === 'binary' || !change.newContent) {
        continue;
      }

      // Extract elements based on language
      const fileElements = this.extractElementsFromFile(
        change.newContent,
        change.newPath,
        change.language
      );
      elements.push(...fileElements);
    }

    return elements;
  }

  /**
   * Generate context queries based on code elements and changes
   */
  generateContextQueries(
    changes: MergeRequestChange[],
    codeElements: CodeElement[]
  ): ContextQuery[] {
    const queries: ContextQuery[] = [];
    const addedQueries = new Set<string>(); // Prevent duplicates

    // Generate queries for each code element
    for (const element of codeElements) {
      const elementQueries = this.generateQueriesForElement(element);
      for (const query of elementQueries) {
        if (!addedQueries.has(query.query)) {
          queries.push(query);
          addedQueries.add(query.query);
        }
      }
    }

    // Generate file-level queries
    for (const change of changes) {
      const fileQueries = this.generateQueriesForFile(change);
      for (const query of fileQueries) {
        if (!addedQueries.has(query.query)) {
          queries.push(query);
          addedQueries.add(query.query);
        }
      }
    }

    // Sort by priority and limit to max queries
    queries.sort((a, b) => b.priority - a.priority);
    return queries.slice(0, this.config.maxQueries);
  }

  /**
   * Execute context queries using codebase-retrieval tool
   */
  async executeContextQueries(queries: ContextQuery[]): Promise<ContextQueryResult[]> {
    const results: ContextQueryResult[] = [];
    const startTime = Date.now();

    for (const query of queries) {
      // Check timeout
      if (Date.now() - startTime > this.config.timeoutMs) {
        console.warn('Enhanced context gathering timeout reached, stopping query execution');
        break;
      }

      const queryResult = await this.executeQuery(query);
      results.push(queryResult);
    }

    return results;
  }

  /**
   * Get enhanced context for a changeset
   */
  async getEnhancedContext(changes: MergeRequestChange[]): Promise<EnhancedContextResult> {
    const startTime = Date.now();
    const errors: string[] = [];

    try {
      console.log('Starting enhanced context gathering for changeset');

      // Analyze changeset
      const changesetStats = this.analyzeChangesetSize(changes);
      console.log(`Changeset stats:`, changesetStats);

      if (!changesetStats.isSmallChangeset) {
        return {
          changesetStats,
          queries: [],
          queryResults: [],
          enhancedFiles: [],
          contextSummary: 'Changeset too large for enhanced context gathering',
          totalExecutionTimeMs: Date.now() - startTime,
          success: false,
          errors: ['Changeset exceeds thresholds for enhanced context'],
        };
      }

      // Extract code elements
      const codeElements = this.extractCodeElements(changes);
      console.log(`Extracted ${codeElements.length} code elements`);

      // Generate queries
      const queries = this.generateContextQueries(changes, codeElements);
      console.log(`Generated ${queries.length} context queries`);

      // Execute queries
      const queryResults = await this.executeContextQueries(queries);
      console.log(`Executed ${queryResults.length} queries`);

      // Aggregate results
      const enhancedFiles = this.aggregateEnhancedFiles(queryResults);
      const contextSummary = this.generateEnhancedContextSummary(queryResults, changesetStats);

      const totalExecutionTimeMs = Date.now() - startTime;
      const success = queryResults.some(r => r.success);

      console.log(`Enhanced context gathering completed in ${totalExecutionTimeMs}ms`);

      return {
        changesetStats,
        queries,
        queryResults,
        enhancedFiles,
        contextSummary,
        totalExecutionTimeMs,
        success,
        errors,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error in enhanced context gathering:', error);
      errors.push(errorMessage);

      return {
        changesetStats: this.analyzeChangesetSize(changes),
        queries: [],
        queryResults: [],
        enhancedFiles: [],
        contextSummary: 'Error occurred during enhanced context gathering',
        totalExecutionTimeMs: Date.now() - startTime,
        success: false,
        errors,
      };
    }
  }

  /**
   * Check if a file is a test file
   */
  private isTestFile(filePath: string): boolean {
    const testPatterns = [
      /\.test\./,
      /\.spec\./,
      /\/test\//,
      /\/tests\//,
      /\/spec\//,
      /\/specs\//,
      /__tests__/,
      /_test\./,
      /_spec\./,
    ];
    return testPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if a file is a configuration file
   */
  private isConfigFile(filePath: string): boolean {
    const configPatterns = [
      /\.config\./,
      /\.env/,
      /package\.json$/,
      /tsconfig\.json$/,
      /webpack\.config/,
      /vite\.config/,
      /nuxt\.config/,
      /\.yml$/,
      /\.yaml$/,
      /\.toml$/,
      /\.ini$/,
      /dockerfile/i,
    ];
    return configPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Check if a file is documentation
   */
  private isDocumentationFile(filePath: string): boolean {
    const docPatterns = [
      /\.md$/,
      /\.txt$/,
      /readme/i,
      /changelog/i,
      /license/i,
      /\/docs?\//,
      /\/documentation\//,
    ];
    return docPatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Extract code elements from a single file
   */
  private extractElementsFromFile(
    content: string,
    filePath: string,
    language: string
  ): CodeElement[] {
    const elements: CodeElement[] = [];

    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          elements.push(...extractJSElements(content, filePath, language));
          break;
        case 'python':
          elements.push(...extractPythonElements(content, filePath, language));
          break;
        case 'java':
          elements.push(...extractJavaElements(content, filePath, language));
          break;
        case 'vue':
          elements.push(...extractVueElements(content, filePath, language));
          break;
        default:
          // Generic extraction for other languages
          elements.push(...extractGenericElements(content, filePath, language));
      }
    } catch (error) {
      console.error(`Error extracting elements from ${filePath}:`, error);
    }

    return elements;
  }

  /**
   * Generate context queries for a code element
   */
  private generateQueriesForElement(element: CodeElement): ContextQuery[] {
    return generateQueriesForElement(element);
  }

  /**
   * Generate context queries for a file
   */
  private generateQueriesForFile(change: MergeRequestChange): ContextQuery[] {
    return generateQueriesForFile(change);
  }

  /**
   * Execute a single context query using codebase-retrieval tool
   */
  private async executeQuery(query: ContextQuery): Promise<ContextQueryResult> {
    const startTime = Date.now();

    try {
      console.log(`Executing context query: ${query.query}`);

      // Use the codebase-retrieval tool to search for relevant code
      // Note: This is a placeholder for the actual codebase-retrieval tool integration
      // In a real implementation, you would call the codebase-retrieval tool here

      // For now, we'll return a structured response that indicates the query was processed
      // but the actual codebase-retrieval integration needs to be implemented
      const results = [
        `Context query executed: "${query.query}"`,
        `Category: ${query.category}`,
        `Priority: ${query.priority}`,
        `Related file: ${query.relatedFile || 'N/A'}`,
        `Related element: ${query.relatedElement || 'N/A'}`,
        `Note: Actual codebase-retrieval integration pending - this is a placeholder result.`
      ];

      return {
        query,
        success: true,
        results,
        executionTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`Error executing query "${query.query}":`, error);

      return {
        query,
        success: false,
        results: [],
        error: errorMessage,
        executionTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Aggregate enhanced files from query results
   */
  private aggregateEnhancedFiles(queryResults: ContextQueryResult[]): string[] {
    const files = new Set<string>();

    for (const result of queryResults) {
      if (result.success) {
        for (const resultText of result.results) {
          // Extract file paths from result text
          // This is a simple implementation - in practice, the codebase-retrieval tool
          // would return structured data with file paths
          const fileMatches = resultText.match(/[\w\-_/.]+\.(js|ts|py|java|vue|jsx|tsx|php|rb|go|rs|cpp|c|h|hpp|css|scss|html|md|json|yml|yaml)/g);
          if (fileMatches) {
            fileMatches.forEach(file => files.add(file));
          }
        }
      }
    }

    return Array.from(files);
  }

  /**
   * Generate enhanced context summary
   */
  private generateEnhancedContextSummary(
    queryResults: ContextQueryResult[],
    changesetStats: ChangesetStats
  ): string {
    const successfulQueries = queryResults.filter(r => r.success);
    const failedQueries = queryResults.filter(r => !r.success);

    let summary = `Enhanced Context Analysis for Small Changeset:\n\n`;
    summary += `Changeset Statistics:\n`;
    summary += `- Files changed: ${changesetStats.totalFiles}\n`;
    summary += `- Lines modified: ${changesetStats.totalLinesModified} (+${changesetStats.totalLinesAdded}, -${changesetStats.totalLinesRemoved})\n`;
    summary += `- Languages: ${changesetStats.languages.join(', ')}\n`;
    summary += `- File types: ${changesetStats.fileTypes.source} source, ${changesetStats.fileTypes.test} test, ${changesetStats.fileTypes.config} config, ${changesetStats.fileTypes.documentation} docs\n\n`;

    if (successfulQueries.length > 0) {
      summary += `Enhanced Context Queries (${successfulQueries.length} successful):\n\n`;

      for (const result of successfulQueries) {
        summary += `**${result.query.category.toUpperCase()}**: ${result.query.query}\n`;
        if (result.results.length > 0) {
          summary += `Results:\n`;
          result.results.forEach(r => summary += `- ${r}\n`);
        }
        summary += `\n`;
      }
    }

    if (failedQueries.length > 0) {
      summary += `Failed Queries (${failedQueries.length}):\n`;
      failedQueries.forEach(r => summary += `- ${r.query.query}: ${r.error}\n`);
      summary += `\n`;
    }

    summary += `This enhanced context provides additional insights beyond the changed files to help with a more comprehensive code review.`;

    return summary;
  }
}

// Export singleton instance
export const enhancedContextService = new EnhancedContextService();