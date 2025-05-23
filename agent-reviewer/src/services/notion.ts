import { Client } from '@notionhq/client';
import { 
  NotionTaskContext, 
  NotionPageContent, 
  NotionConfiguration, 
  NotionUrlExtractionResult, 
  NotionApiError, 
  CombinedNotionContext,
  NotionBlock 
} from '../types/notion.js';
import dotenv from 'dotenv';

dotenv.config();

// Environment variables
const NOTION_API_TOKEN = process.env.NOTION_API_TOKEN || '';
const ENABLE_NOTION_INTEGRATION = process.env.ENABLE_NOTION_INTEGRATION === 'true';
const NOTION_API_TIMEOUT = parseInt(process.env.NOTION_API_TIMEOUT || '10000');

/**
 * Service for integrating with Notion API to fetch task context
 */
export class NotionService {
  private client: Client | null = null;
  private config: NotionConfiguration;

  constructor() {
    this.config = {
      apiToken: NOTION_API_TOKEN,
      enabled: ENABLE_NOTION_INTEGRATION,
      timeout: NOTION_API_TIMEOUT,
    };

    if (this.config.enabled && this.config.apiToken) {
      this.client = new Client({
        auth: this.config.apiToken,
        timeoutMs: this.config.timeout,
      });
    } else if (this.config.enabled) {
      console.warn('Notion integration is enabled but NOTION_API_TOKEN is not set');
    }
  }

  /**
   * Extract Notion URLs from merge request description
   */
  extractNotionUrls(description: string): NotionUrlExtractionResult {
    if (!description) {
      return { urls: [], totalFound: 0 };
    }

    // Regex patterns for various Notion URL formats
    const notionUrlPatterns = [
      // Standard Notion URLs
      /https?:\/\/www\.notion\.so\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/g,
      /https?:\/\/notion\.so\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/g,
      // Custom domain Notion URLs
      /https?:\/\/[a-zA-Z0-9-]+\.notion\.site\/[a-zA-Z0-9-]+/g,
      // Direct page URLs with page IDs
      /https?:\/\/www\.notion\.so\/[a-f0-9]{32}/g,
      /https?:\/\/notion\.so\/[a-f0-9]{32}/g,
    ];

    const urls: string[] = [];
    let extractedFromSection: string | undefined;

    // First, try to find URLs in "Related Links" section
    const relatedLinksMatch = description.match(/related\s+links?:?\s*(.*?)(?:\n\n|\n$|$)/is);
    if (relatedLinksMatch) {
      extractedFromSection = 'Related Links';
      const relatedLinksSection = relatedLinksMatch[1];
      
      for (const pattern of notionUrlPatterns) {
        const matches = relatedLinksSection.match(pattern);
        if (matches) {
          urls.push(...matches);
        }
      }
    }

    // If no URLs found in Related Links, search the entire description
    if (urls.length === 0) {
      for (const pattern of notionUrlPatterns) {
        const matches = description.match(pattern);
        if (matches) {
          urls.push(...matches);
        }
      }
    }

    // Remove duplicates and clean URLs
    const uniqueUrls = [...new Set(urls)].map(url => url.trim());

    return {
      urls: uniqueUrls,
      extractedFromSection,
      totalFound: uniqueUrls.length,
    };
  }

  /**
   * Fetch task context from a Notion URL
   */
  async fetchTaskContext(notionUrl: string): Promise<NotionTaskContext> {
    if (!this.config.enabled) {
      throw new Error('Notion integration is disabled');
    }

    if (!this.client) {
      throw new Error('Notion client is not initialized');
    }

    try {
      // Extract page ID from URL
      const pageId = this.extractPageIdFromUrl(notionUrl);
      if (!pageId) {
        throw new Error(`Invalid Notion URL format: ${notionUrl}`);
      }

      console.log(`Fetching Notion page content for page ID: ${pageId}`);

      // Fetch page content
      const pageContent = await this.fetchPageContent(pageId);
      
      // Parse the content to extract task context
      const taskContext = this.parseNotionPage(pageContent, notionUrl);

      console.log(`Successfully fetched Notion task context for: ${taskContext.title}`);
      return taskContext;

    } catch (error) {
      console.error(`Error fetching Notion task context from ${notionUrl}:`, error);
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return {
        pageId: '',
        title: 'Error fetching task',
        description: '',
        requirements: [],
        acceptanceCriteria: [],
        technicalSpecs: '',
        relatedContext: '',
        url: notionUrl,
        lastModified: new Date(),
        error: errorMessage,
      };
    }
  }

  /**
   * Fetch task context from multiple Notion URLs
   */
  async fetchMultipleTaskContexts(notionUrls: string[]): Promise<CombinedNotionContext> {
    if (!this.config.enabled || notionUrls.length === 0) {
      return {
        contexts: [],
        totalPages: 0,
        successfulFetches: 0,
        errors: [],
        summary: 'Notion integration disabled or no URLs provided',
      };
    }

    console.log(`Fetching task context from ${notionUrls.length} Notion URLs`);

    const contexts: NotionTaskContext[] = [];
    const errors: NotionApiError[] = [];

    // Fetch contexts in parallel with error handling
    const promises = notionUrls.map(async (url) => {
      try {
        const context = await this.fetchTaskContext(url);
        if (context.error) {
          errors.push({
            code: 'FETCH_ERROR',
            message: context.error,
            status: 0,
            url,
          });
        } else {
          contexts.push(context);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        errors.push({
          code: 'FETCH_ERROR',
          message: errorMessage,
          status: 0,
          url,
        });
      }
    });

    await Promise.allSettled(promises);

    // Generate summary
    const summary = this.generateContextSummary(contexts);

    return {
      contexts,
      totalPages: notionUrls.length,
      successfulFetches: contexts.length,
      errors,
      summary,
    };
  }

  /**
   * Extract page ID from Notion URL
   */
  private extractPageIdFromUrl(url: string): string | null {
    // Remove query parameters and fragments
    const cleanUrl = url.split('?')[0].split('#')[0];
    
    // Extract page ID from various URL formats
    const patterns = [
      // Standard format: https://www.notion.so/workspace/page-title-32charId
      /\/([a-f0-9]{32})$/,
      // Direct page ID: https://www.notion.so/32charId
      /notion\.so\/([a-f0-9]{32})/,
      // With dashes: https://www.notion.so/workspace/page-title-8char-4char-4char-4char-12char
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match) {
        // Remove dashes if present to get clean 32-character ID
        return match[1].replace(/-/g, '');
      }
    }

    return null;
  }

  /**
   * Fetch page content from Notion API
   */
  private async fetchPageContent(pageId: string): Promise<NotionPageContent> {
    if (!this.client) {
      throw new Error('Notion client is not initialized');
    }

    try {
      // Fetch page properties
      const page = await this.client.pages.retrieve({ page_id: pageId });
      
      // Fetch page blocks (content)
      const blocks = await this.client.blocks.children.list({
        block_id: pageId,
        page_size: 100,
      });

      // Extract title from page properties
      let title = 'Untitled';
      if ('properties' in page && page.properties) {
        const titleProperty = Object.values(page.properties).find(
          (prop: any) => prop.type === 'title'
        ) as any;
        
        if (titleProperty && titleProperty.title && titleProperty.title.length > 0) {
          title = titleProperty.title[0].plain_text || 'Untitled';
        }
      }

      return {
        id: pageId,
        title,
        properties: 'properties' in page ? page.properties : {},
        blocks: this.parseBlocks(blocks.results),
        lastEditedTime: 'last_edited_time' in page ? page.last_edited_time : new Date().toISOString(),
        url: 'url' in page ? page.url : '',
      };

    } catch (error) {
      console.error(`Error fetching Notion page ${pageId}:`, error);
      throw error;
    }
  }

  /**
   * Parse Notion blocks into a simplified structure
   */
  private parseBlocks(blocks: any[]): NotionBlock[] {
    return blocks.map(block => {
      let content = '';
      
      // Extract text content based on block type
      if (block.type && block[block.type]) {
        const blockData = block[block.type];
        
        if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
          content = blockData.rich_text.map((text: any) => text.plain_text || '').join('');
        } else if (blockData.text && Array.isArray(blockData.text)) {
          content = blockData.text.map((text: any) => text.plain_text || '').join('');
        }
      }

      return {
        id: block.id,
        type: block.type || 'unknown',
        content: content.trim(),
      };
    }).filter(block => block.content.length > 0);
  }

  /**
   * Parse Notion page content to extract task context
   */
  private parseNotionPage(pageContent: NotionPageContent, originalUrl: string): NotionTaskContext {
    const requirements: string[] = [];
    const acceptanceCriteria: string[] = [];
    let technicalSpecs = '';
    let description = '';

    // Combine all block content for description
    const allContent = pageContent.blocks.map(block => block.content).join('\n');
    description = allContent.substring(0, 1000); // Limit description length

    // Parse content for specific sections
    for (const block of pageContent.blocks) {
      const content = block.content.toLowerCase();
      const originalContent = block.content;

      // Look for requirements
      if (content.includes('requirement') || content.includes('must') || content.includes('should')) {
        requirements.push(originalContent);
      }

      // Look for acceptance criteria
      if (content.includes('acceptance') || content.includes('criteria') || content.includes('done when')) {
        acceptanceCriteria.push(originalContent);
      }

      // Look for technical specifications
      if (content.includes('technical') || content.includes('implementation') || content.includes('architecture')) {
        technicalSpecs += originalContent + '\n';
      }
    }

    return {
      pageId: pageContent.id,
      title: pageContent.title,
      description: description.trim(),
      requirements,
      acceptanceCriteria,
      technicalSpecs: technicalSpecs.trim(),
      relatedContext: allContent.substring(1000, 2000), // Additional context
      url: originalUrl,
      lastModified: new Date(pageContent.lastEditedTime),
    };
  }

  /**
   * Generate a summary of combined task contexts
   */
  private generateContextSummary(contexts: NotionTaskContext[]): string {
    if (contexts.length === 0) {
      return 'No task contexts available';
    }

    const titles = contexts.map(ctx => ctx.title).join(', ');
    const totalRequirements = contexts.reduce((sum, ctx) => sum + ctx.requirements.length, 0);
    const totalCriteria = contexts.reduce((sum, ctx) => sum + ctx.acceptanceCriteria.length, 0);

    return `Found ${contexts.length} task(s): ${titles}. Total requirements: ${totalRequirements}, acceptance criteria: ${totalCriteria}`;
  }

  /**
   * Check if Notion integration is enabled and properly configured
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.client;
  }
}

export const notionService = new NotionService();
