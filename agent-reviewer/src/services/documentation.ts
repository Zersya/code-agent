import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { hybridDbService } from './hybrid-database.js';
import { dbService } from './database.js';
import { embeddingService } from './embedding.js';
import { queueService } from './queue.js';
import {
  DocumentationSource,
  DocumentationEmbedding,
  DocumentationSection,
  DocumentationBatch,
  ProjectDocumentationMapping,
  FrameworkDetectionResult,
  DocumentationContext
} from '../models/embedding.js';
import { MergeRequestChange } from '../types/review.js';

/**
 * Service for managing documentation embeddings and context
 */
export class DocumentationService {
  private readonly CHUNK_SIZE = 2000; // Characters per documentation chunk
  private readonly OVERLAP_SIZE = 200; // Overlap between chunks
  private readonly MAX_SECTIONS_PER_CONTEXT = 10;

  /**
   * Add a new documentation source
   */
  async addDocumentationSource(source: Omit<DocumentationSource, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentationSource> {
    const newSource: DocumentationSource = {
      ...source,
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await dbService.saveDocumentationSource(newSource);
    console.log(`Added documentation source: ${newSource.name} (${newSource.framework})`);

    // Queue for immediate embedding if active
    if (newSource.isActive) {
      await this.queueDocumentationEmbedding(newSource.id);
    }

    return newSource;
  }

  /**
   * Update an existing documentation source
   */
  async updateDocumentationSource(id: string, updates: Partial<DocumentationSource>): Promise<DocumentationSource | null> {
    const source = await dbService.getDocumentationSource(id);
    if (!source) {
      return null;
    }

    const updatedSource: DocumentationSource = {
      ...source,
      ...updates,
      updatedAt: new Date(),
    };

    await dbService.saveDocumentationSource(updatedSource);
    console.log(`Updated documentation source: ${updatedSource.name}`);

    // Re-queue for embedding if URL or active status changed
    if ((updates.url && updates.url !== source.url) ||
        (updates.isActive && !source.isActive)) {
      await this.queueDocumentationEmbedding(id);
    }

    return updatedSource;
  }

  /**
   * Delete a documentation source and its embeddings
   */
  async deleteDocumentationSource(id: string): Promise<boolean> {
    const source = await dbService.getDocumentationSource(id);
    if (!source) {
      return false;
    }

    // Delete embeddings first
    await dbService.deleteDocumentationEmbeddings(id);

    // Delete project mappings
    await dbService.deleteProjectDocumentationMappings(id);

    // Delete source
    await dbService.deleteDocumentationSource(id);

    console.log(`Deleted documentation source: ${source.name}`);
    return true;
  }

  /**
   * Map a project to documentation sources
   */
  async mapProjectToDocumentation(
    projectId: number,
    sourceId: string,
    priority: number = 1,
    isEnabled: boolean = true
  ): Promise<ProjectDocumentationMapping> {
    const mapping: ProjectDocumentationMapping = {
      projectId,
      sourceId,
      isEnabled,
      priority,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await hybridDbService.saveProjectDocumentationMapping(mapping);
    console.log(`Mapped project ${projectId} to documentation source ${sourceId}`);

    return mapping;
  }

  /**
   * Auto-detect frameworks from merge request changes and map to documentation
   */
  async autoMapProjectDocumentation(projectId: number, changes: MergeRequestChange[]): Promise<void> {
    const detectionResult = this.detectFrameworks(changes);

    if (detectionResult.frameworks.length === 0) {
      console.log(`No frameworks detected for project ${projectId}`);
      return;
    }

    console.log(`Detected frameworks for project ${projectId}: ${detectionResult.frameworks.join(', ')}`);

    // Get available documentation sources for detected frameworks
    const availableSources = await hybridDbService.getDocumentationSourcesByFrameworks(detectionResult.frameworks);

    // Map project to relevant documentation sources
    for (const source of availableSources) {
      const existingMapping = await hybridDbService.getProjectDocumentationMapping(projectId, source.id);

      if (!existingMapping) {
        // Priority based on framework confidence and source framework match
        const priority = detectionResult.frameworks.includes(source.framework) ? 10 : 5;
        await this.mapProjectToDocumentation(projectId, source.id, priority);
      }
    }
  }

  /**
   * Detect frameworks from merge request changes
   */
  detectFrameworks(changes: MergeRequestChange[]): FrameworkDetectionResult {
    const frameworks = new Set<string>();
    const detectedFrom = new Set<'fileExtensions' | 'imports' | 'dependencies' | 'config'>();
    let confidence = 0;

    for (const change of changes) {
      // Check file extensions
      const ext = change.newPath.split('.').pop()?.toLowerCase();
      if (ext === 'vue') {
        frameworks.add('vue');
        frameworks.add('nuxt'); // Vue files often indicate Nuxt
        detectedFrom.add('fileExtensions');
        confidence += 0.3;
      }

      if (ext === 'tsx' || ext === 'jsx') {
        frameworks.add('react');
        detectedFrom.add('fileExtensions');
        confidence += 0.3;
      }

      // Check imports and content
      if (change.newContent) {
        const content = change.newContent.toLowerCase();

        // Nuxt-specific patterns
        if (content.includes('nuxt') || content.includes('$nuxt') ||
            content.includes('nuxtjs') || content.includes('useNuxt')) {
          frameworks.add('nuxt');
          detectedFrom.add('imports');
          confidence += 0.4;
        }

        // Vue-specific patterns
        if (content.includes('vue') || content.includes('@vue') ||
            content.includes('composition-api') || content.includes('ref(')) {
          frameworks.add('vue');
          detectedFrom.add('imports');
          confidence += 0.3;
        }

        // React-specific patterns
        if (content.includes('react') || content.includes('useState') ||
            content.includes('useEffect') || content.includes('jsx')) {
          frameworks.add('react');
          detectedFrom.add('imports');
          confidence += 0.3;
        }
      }

      // Check config files
      if (change.newPath.includes('nuxt.config') || change.newPath.includes('nuxt.config.ts')) {
        frameworks.add('nuxt');
        detectedFrom.add('config');
        confidence += 0.5;
      }

      if (change.newPath.includes('package.json')) {
        // Would need to parse package.json for dependencies
        detectedFrom.add('dependencies');
      }
    }

    return {
      frameworks: Array.from(frameworks),
      confidence: Math.min(confidence, 1.0),
      detectedFrom: Array.from(detectedFrom),
    };
  }

  /**
   * Queue documentation for embedding
   */
  async queueDocumentationEmbedding(sourceId: string): Promise<void> {
    const source = await hybridDbService.getDocumentationSource(sourceId);
    if (!source || !source.isActive) {
      console.log(`Documentation source ${sourceId} not found or inactive`);
      return;
    }

    // Update fetch status
    await hybridDbService.updateDocumentationSourceStatus(sourceId, 'pending');

    // Add to queue with normal priority
    const processingId = uuidv4();
    await queueService.addDocumentationJob(sourceId, source.url, processingId, 5);

    console.log(`Queued documentation embedding for source: ${source.name}`);
  }

  /**
   * Fetch and process documentation from a URL
   */
  async fetchAndProcessDocumentation(sourceId: string): Promise<DocumentationBatch> {
    const source = await hybridDbService.getDocumentationSource(sourceId);
    if (!source) {
      throw new Error(`Documentation source ${sourceId} not found`);
    }

    console.log(`Fetching documentation from: ${source.url}`);

    try {
      // Fetch documentation content
      const response = await axios.get(source.url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'GitLab-Agent-Reviewer/1.0',
        },
      });

      const content = response.data;

      // Parse and chunk the documentation
      const sections = this.parseDocumentation(content, source);

      // Generate embeddings for each section
      const embeddings: DocumentationEmbedding[] = [];

      for (const section of sections) {
        try {
          const embedding = await embeddingService.generateEmbedding(section.content);

          const docEmbedding: DocumentationEmbedding = {
            id: uuidv4(),
            sourceId: source.id,
            section: section.section,
            title: section.title,
            content: section.content,
            embedding,
            url: section.url,
            framework: source.framework,
            version: source.version,
            keywords: section.keywords,
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          embeddings.push(docEmbedding);
        } catch (error) {
          console.error(`Error generating embedding for section ${section.section}:`, error);
        }
      }

      // Update source status
      await hybridDbService.updateDocumentationSourceStatus(sourceId, 'success', undefined, new Date());

      const batch: DocumentationBatch = {
        sourceId,
        sections,
        embeddings,
        createdAt: new Date(),
      };

      console.log(`Processed ${sections.length} sections, generated ${embeddings.length} embeddings`);

      // Save embeddings to database
      await hybridDbService.saveDocumentationEmbeddings(embeddings);

      // Update source last embedded timestamp
      await hybridDbService.updateDocumentationSourceStatus(sourceId, 'success', undefined, new Date());

      return batch;

    } catch (error) {
      console.error(`Error fetching documentation from ${source.url}:`, error);
      await hybridDbService.updateDocumentationSourceStatus(sourceId, 'failed', error instanceof Error ? error.message : String(error));
      throw error;
    }
  }

  /**
   * Parse documentation content into sections
   */
  private parseDocumentation(content: string, source: DocumentationSource): DocumentationSection[] {
    const sections: DocumentationSection[] = [];

    // For now, implement a simple chunking strategy
    // This can be enhanced to parse specific documentation formats (Markdown, HTML, etc.)

    const chunks = this.chunkText(content, this.CHUNK_SIZE, this.OVERLAP_SIZE);

    chunks.forEach((chunk, index) => {
      const section: DocumentationSection = {
        section: `section-${index + 1}`,
        title: this.extractTitle(chunk) || `${source.name} - Section ${index + 1}`,
        content: chunk,
        url: source.url,
        keywords: this.extractKeywords(chunk, source.framework),
      };

      sections.push(section);
    });

    return sections;
  }

  /**
   * Chunk text into smaller pieces with overlap
   */
  private chunkText(text: string, chunkSize: number, overlapSize: number): string[] {
    const chunks: string[] = [];
    let start = 0;

    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const chunk = text.slice(start, end);
      chunks.push(chunk);

      if (end >= text.length) break;
      start = end - overlapSize;
    }

    return chunks;
  }

  /**
   * Extract title from a text chunk
   */
  private extractTitle(chunk: string): string | null {
    // Look for markdown headers
    const headerMatch = chunk.match(/^#+\s+(.+)$/m);
    if (headerMatch) {
      return headerMatch[1].trim();
    }

    // Look for the first line that looks like a title
    const lines = chunk.split('\n');
    for (const line of lines.slice(0, 3)) {
      const trimmed = line.trim();
      if (trimmed.length > 0 && trimmed.length < 100) {
        return trimmed;
      }
    }

    return null;
  }

  /**
   * Extract keywords from content based on framework
   */
  private extractKeywords(content: string, framework: string): string[] {
    const keywords = new Set<string>();

    // Add framework-specific keywords
    keywords.add(framework);

    // Common programming keywords
    const commonKeywords = [
      'component', 'api', 'configuration', 'setup', 'install', 'usage',
      'example', 'props', 'event', 'method', 'function', 'class',
      'interface', 'type', 'import', 'export', 'async', 'await'
    ];

    const lowerContent = content.toLowerCase();
    commonKeywords.forEach(keyword => {
      if (lowerContent.includes(keyword)) {
        keywords.add(keyword);
      }
    });

    // Framework-specific keywords
    if (framework === 'nuxt') {
      const nuxtKeywords = ['pages', 'layouts', 'components', 'plugins', 'middleware', 'store', 'server', 'composables'];
      nuxtKeywords.forEach(keyword => {
        if (lowerContent.includes(keyword)) {
          keywords.add(keyword);
        }
      });
    }

    return Array.from(keywords);
  }
}

export const documentationService = new DocumentationService();
