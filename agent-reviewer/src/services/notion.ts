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
      // Standard Notion URLs with workspace and page title
      /https?:\/\/www\.notion\.so\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+[a-f0-9]{32,}/g,
      /https?:\/\/notion\.so\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+[a-f0-9]{32,}/g,
      // Standard Notion URLs (shorter format)
      /https?:\/\/www\.notion\.so\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/g,
      /https?:\/\/notion\.so\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/g,
      // Custom domain Notion URLs
      /https?:\/\/[a-zA-Z0-9-]+\.notion\.site\/[a-zA-Z0-9-]+[a-f0-9]{32,}/g,
      /https?:\/\/[a-zA-Z0-9-]+\.notion\.site\/[a-zA-Z0-9-]+/g,
      // Direct page URLs with page IDs
      /https?:\/\/www\.notion\.so\/[a-f0-9]{32,}/g,
      /https?:\/\/notion\.so\/[a-f0-9]{32,}/g,
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

    console.log(`Extracting page ID from URL: ${cleanUrl}`);

    // Extract page ID from various URL formats
    const patterns = [
      // Long format with title: https://www.notion.so/workspace/page-title-longpageid
      /\/([a-f0-9]{32,})$/,
      // Standard format: https://www.notion.so/workspace/page-title-32charId
      /\/([a-f0-9]{32})$/,
      // Direct page ID: https://www.notion.so/32charId
      /notion\.so\/([a-f0-9]{32,})/,
      // With dashes: https://www.notion.so/workspace/page-title-8char-4char-4char-4char-12char
      /([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/,
      // Any hex string at the end (32+ characters)
      /([a-f0-9]{32,})$/,
    ];

    for (const pattern of patterns) {
      const match = cleanUrl.match(pattern);
      if (match) {
        const pageId = match[1].replace(/-/g, '');
        console.log(`Extracted page ID: ${pageId}`);

        // Ensure we have at least 32 characters for a valid Notion page ID
        if (pageId.length >= 32) {
          // Take the last 32 characters if longer
          const finalPageId = pageId.length > 32 ? pageId.slice(-32) : pageId;
          console.log(`Final page ID: ${finalPageId}`);
          return finalPageId;
        }
      }
    }

    console.log('No valid page ID found in URL');
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

    // Parse content for specific sections based on Notion structure
    let currentSection = '';
    let userStoryContent = '';

    for (let i = 0; i < pageContent.blocks.length; i++) {
      const block = pageContent.blocks[i];
      const content = block.content.trim();
      const contentLower = content.toLowerCase();

      // Identify section headers
      if (contentLower.startsWith('# user story') || contentLower === 'user story') {
        currentSection = 'user_story';
        continue;
      } else if (contentLower.startsWith('# acceptance criteria') || contentLower === 'acceptance criteria') {
        currentSection = 'acceptance_criteria';
        continue;
      } else if (contentLower.startsWith('# to-do list') || contentLower === 'to-do list') {
        currentSection = 'todo';
        continue;
      } else if (contentLower.startsWith('# screenshots') || contentLower === 'screenshots') {
        currentSection = 'screenshots';
        continue;
      } else if (contentLower.startsWith('#')) {
        // Any other heading resets the section
        currentSection = 'other';
        continue;
      }

      // Skip empty content
      if (!content) continue;

      // Process content based on current section
      switch (currentSection) {
        case 'user_story':
          if (content.startsWith('-') || content.includes('task') || content.includes('feature')) {
            userStoryContent += content + '\n';
          }
          break;

        case 'acceptance_criteria':
          // Handle checkbox-style acceptance criteria (including nested items)
          if (content.startsWith('- [') || content.startsWith('- [ ]') || content.startsWith('- [x]')) {
            // Clean up the checkbox format and extract the criteria text
            const criteriaText = content.replace(/^- \[[x\s]\]\s*/, '').trim();
            if (criteriaText) {
              acceptanceCriteria.push(criteriaText);
            }
          } else if (content.match(/^\s+- \[/)) {
            // Handle nested checkbox items (indented)
            const nestedCriteriaText = content.replace(/^\s+- \[[x\s]\]\s*/, '').trim();
            if (nestedCriteriaText) {
              acceptanceCriteria.push(`  ${nestedCriteriaText}`); // Keep indentation for nested items
            }
          } else if (content.startsWith('-') && !content.startsWith('- [')) {
            // Handle regular bullet points in acceptance criteria
            const criteriaText = content.replace(/^-\s*/, '').trim();
            if (criteriaText) {
              acceptanceCriteria.push(criteriaText);
            }
          } else if (content.includes('criteria') || content.includes('must') || content.includes('should')) {
            acceptanceCriteria.push(content);
          }
          break;

        case 'todo':
          // Handle to-do items as requirements
          if (content.startsWith('- [') || content.startsWith('-')) {
            const todoText = content.replace(/^- \[[x\s]\]\s*/, '').replace(/^-\s*/, '').trim();
            if (todoText) {
              requirements.push(todoText);
            }
          }
          break;

        case 'other':
          // Look for technical specifications in other sections
          if (contentLower.includes('technical') || contentLower.includes('implementation') ||
              contentLower.includes('architecture') || contentLower.includes('specification')) {
            technicalSpecs += content + '\n';
          }
          break;
      }
    }

    // Use user story content as part of description if available
    if (userStoryContent.trim()) {
      description = userStoryContent.trim() + '\n\n' + description;
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
