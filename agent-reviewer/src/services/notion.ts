import { Client } from '@notionhq/client';
import {
  NotionTaskContext,
  NotionPageContent,
  NotionConfiguration,
  NotionUrlExtractionResult,
  NotionApiError,
  CombinedNotionContext,
  NotionBlock,
  StructuredNotionContent,
  UserStoryBlock,
  AcceptanceCriteriaBlock,
  AcceptanceCriteriaItem,
  ScreenshotBlock,
  TodoListBlock,
  TodoListItem
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

    // console.log(`Extracting page ID from URL: ${cleanUrl}`);

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
        // console.log(`Extracted page ID: ${pageId}`);

        // Ensure we have at least 32 characters for a valid Notion page ID
        if (pageId.length >= 32) {
          // Take the last 32 characters if longer
          const finalPageId = pageId.length > 32 ? pageId.slice(-32) : pageId;
          // console.log(`Final page ID: ${finalPageId}`);
          return finalPageId;
        }
      }
    }

    // console.log('No valid page ID found in URL');
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

      // console.log(`Processing block type: ${block.type}, block data:`, JSON.stringify(block, null, 2));

      // Extract text content based on block type
      if (block.type && block[block.type]) {
        const blockData = block[block.type];

        // Handle specific block types with special formatting
        switch (block.type) {
          case 'heading_1':
          case 'heading_2':
          case 'heading_3':
            // For headings, add the # prefix to make it clear it's a heading
            if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
              const headingText = blockData.rich_text.map((text: any) => text.plain_text || '').join('');
              const prefix = '#'.repeat(parseInt(block.type.split('_')[1]));
              content = `${prefix} ${headingText}`;
            }
            break;
          case 'to_do':
            // For to-do items, include checkbox status
            if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
              const todoText = blockData.rich_text.map((text: any) => text.plain_text || '').join('');
              const checked = blockData.checked ? '[x]' : '[ ]';
              content = `- ${checked} ${todoText}`;
            }
            break;
          case 'bulleted_list_item':
            if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
              const bulletText = blockData.rich_text.map((text: any) => text.plain_text || '').join('');
              content = `- ${bulletText}`;
            }
            break;
          case 'numbered_list_item':
            if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
              const numberedText = blockData.rich_text.map((text: any) => text.plain_text || '').join('');
              content = `1. ${numberedText}`;
            }
            break;
          case 'image':
            // Handle image blocks
            if (blockData.file && blockData.file.url) {
              content = `[Image: ${blockData.file.url}]`;
            } else if (blockData.external && blockData.external.url) {
              content = `[Image: ${blockData.external.url}]`;
            } else {
              content = '[Image]';
            }
            // Add caption if available
            if (blockData.caption && Array.isArray(blockData.caption) && blockData.caption.length > 0) {
              const caption = blockData.caption.map((text: any) => text.plain_text || '').join('');
              content += ` - ${caption}`;
            }
            break;
          case 'file':
            // Handle file blocks
            if (blockData.file && blockData.file.url) {
              content = `[File: ${blockData.file.url}]`;
            } else if (blockData.external && blockData.external.url) {
              content = `[File: ${blockData.external.url}]`;
            } else {
              content = '[File]';
            }
            // Add caption if available
            if (blockData.caption && Array.isArray(blockData.caption) && blockData.caption.length > 0) {
              const caption = blockData.caption.map((text: any) => text.plain_text || '').join('');
              content += ` - ${caption}`;
            }
            break;
          case 'embed':
            // Handle embed blocks
            if (blockData.url) {
              content = `[Embed: ${blockData.url}]`;
            } else {
              content = '[Embed]';
            }
            // Add caption if available
            if (blockData.caption && Array.isArray(blockData.caption) && blockData.caption.length > 0) {
              const caption = blockData.caption.map((text: any) => text.plain_text || '').join('');
              content += ` - ${caption}`;
            }
            break;
          default:
            // Handle generic rich_text property (most common)
            if (blockData.rich_text && Array.isArray(blockData.rich_text)) {
              content = blockData.rich_text.map((text: any) => text.plain_text || '').join('');
            }
            // Handle text property (legacy)
            else if (blockData.text && Array.isArray(blockData.text)) {
              content = blockData.text.map((text: any) => text.plain_text || '').join('');
            }
            // Handle title property (for some block types)
            else if (blockData.title && Array.isArray(blockData.title)) {
              content = blockData.title.map((text: any) => text.plain_text || '').join('');
            }
            break;
        }
      }

      // console.log(`Extracted content for ${block.type}: "${content}"`);

      return {
        id: block.id,
        type: block.type || 'unknown',
        content: content.trim(),
      };
    }).filter(block => {
      // Keep blocks with content or important structural blocks (including images/files)
      return block.content.length > 0 ||
             ['heading_1', 'heading_2', 'heading_3', 'image', 'file', 'embed'].includes(block.type);
    });
  }

  /**
   * Parse User Story blocks from Notion content
   */
  private parseUserStoryBlock(blocks: NotionBlock[]): UserStoryBlock | undefined {
    let userStoryContent = '';
    let inUserStorySection = false;

    for (const block of blocks) {
      const content = block.content.trim();
      const contentLower = content.toLowerCase();

      // Check for User Story section headers
      if (contentLower.includes('user story') || contentLower.includes('user or job story')) {
        inUserStorySection = true;
        continue;
      }

      // Stop if we hit another section
      if (content.startsWith('#') && !contentLower.includes('user story')) {
        inUserStorySection = false;
        continue;
      }

      // Collect content in User Story section
      if (inUserStorySection && content) {
        userStoryContent += content + '\n';
      }
    }

    if (!userStoryContent.trim()) {
      return undefined;
    }

    // Extract summary (first line or sentence)
    const lines = userStoryContent.trim().split('\n').filter(line => line.trim());
    const summary = lines[0] || '';

    return {
      content: userStoryContent.trim(),
      description: userStoryContent.trim(),
      summary: summary.replace(/^[-*]\s*/, '').trim() // Remove bullet points from summary
    };
  }

  /**
   * Parse Acceptance Criteria blocks from Notion content
   */
  private parseAcceptanceCriteriaBlock(blocks: NotionBlock[]): AcceptanceCriteriaBlock | undefined {
    const items: AcceptanceCriteriaItem[] = [];
    let inAcceptanceCriteriaSection = false;

    for (const block of blocks) {
      const content = block.content.trim();
      const contentLower = content.toLowerCase();

      // Check for Acceptance Criteria section headers
      if (contentLower.includes('acceptance criteria') || contentLower.includes('acceptance criterion')) {
        inAcceptanceCriteriaSection = true;
        continue;
      }

      // Stop if we hit another section
      if (content.startsWith('#') && !contentLower.includes('acceptance criteria')) {
        inAcceptanceCriteriaSection = false;
        continue;
      }

      // Parse acceptance criteria items
      if (inAcceptanceCriteriaSection && content) {
        // Handle checkbox items
        if (content.match(/^-\s*\[[x\s]\]/)) {
          const completed = content.includes('[x]');
          const text = content.replace(/^-\s*\[[x\s]\]\s*/, '').trim();

          if (text) {
            items.push({
              text,
              completed,
              nested: [],
              priority: this.extractPriority(text)
            });
          }
        }
        // Handle nested checkbox items (indented)
        else if (content.match(/^\s+-\s*\[[x\s]\]/)) {
          const completed = content.includes('[x]');
          const text = content.replace(/^\s+-\s*\[[x\s]\]\s*/, '').trim();

          if (text && items.length > 0) {
            // Add as nested item to the last main item
            items[items.length - 1].nested.push({
              text,
              completed,
              nested: [],
              priority: this.extractPriority(text)
            });
          }
        }
        // Handle regular bullet points
        else if (content.startsWith('-') && !content.includes('[')) {
          const text = content.replace(/^-\s*/, '').trim();
          if (text) {
            items.push({
              text,
              completed: false,
              nested: [],
              priority: this.extractPriority(text)
            });
          }
        }
      }
    }

    if (items.length === 0) {
      return undefined;
    }

    const completedItems = items.reduce((count, item) => {
      return count + (item.completed ? 1 : 0) + item.nested.filter(nested => nested.completed).length;
    }, 0);

    return {
      items,
      totalItems: items.length + items.reduce((count, item) => count + item.nested.length, 0),
      completedItems
    };
  }

  /**
   * Parse Screenshot blocks from Notion content
   */
  private parseScreenshotBlock(blocks: NotionBlock[]): ScreenshotBlock | undefined {
    const images: ScreenshotBlock['images'] = [];
    let inScreenshotSection = false;

    for (const block of blocks) {
      const content = block.content.trim();
      const contentLower = content.toLowerCase();

      // Check for Screenshot section headers
      if (contentLower.includes('screenshot') || contentLower.includes('image') || contentLower.includes('mockup')) {
        inScreenshotSection = true;
        continue;
      }

      // Stop if we hit another section
      if (content.startsWith('#') && !contentLower.includes('screenshot') && !contentLower.includes('image')) {
        inScreenshotSection = false;
        continue;
      }

      // Parse image blocks
      if (inScreenshotSection || block.type === 'image' || block.type === 'file' || block.type === 'embed') {
        if (block.type === 'image' || block.type === 'file' || block.type === 'embed') {
          // Extract URL and caption from content
          const urlMatch = content.match(/\[(Image|File|Embed):\s*([^\]]+)\]/);
          const url = urlMatch ? urlMatch[2] : undefined;
          const captionMatch = content.match(/\]\s*-\s*(.+)$/);
          const caption = captionMatch ? captionMatch[1] : undefined;

          images.push({
            id: block.id,
            caption,
            url,
            type: block.type as 'image' | 'file' | 'embed'
          });
        }
      }
    }

    if (images.length === 0) {
      return undefined;
    }

    return {
      images,
      totalImages: images.length
    };
  }

  /**
   * Parse Todo List blocks from Notion content
   */
  private parseTodoListBlock(blocks: NotionBlock[]): TodoListBlock | undefined {
    const items: TodoListItem[] = [];
    let inTodoSection = false;

    for (const block of blocks) {
      const content = block.content.trim();
      const contentLower = content.toLowerCase();

      // Check for Todo section headers
      if (contentLower.includes('to-do') || contentLower.includes('todo') || contentLower.includes('task list')) {
        inTodoSection = true;
        continue;
      }

      // Stop if we hit another section
      if (content.startsWith('#') && !contentLower.includes('to-do') && !contentLower.includes('todo')) {
        inTodoSection = false;
        continue;
      }

      // Parse todo items
      if (inTodoSection && content) {
        // Handle checkbox items (from to_do blocks)
        if (content.match(/^-\s*\[[x\s]\]/)) {
          const completed = content.includes('[x]');
          const text = content.replace(/^-\s*\[[x\s]\]\s*/, '').trim();

          if (text) {
            items.push({
              text,
              completed,
              priority: this.extractPriority(text),
              assignee: this.extractAssignee(text)
            });
          }
        }
        // Handle regular bullet points as uncompleted todos
        else if (content.startsWith('-') && !content.includes('[')) {
          const text = content.replace(/^-\s*/, '').trim();
          if (text) {
            items.push({
              text,
              completed: false,
              priority: this.extractPriority(text),
              assignee: this.extractAssignee(text)
            });
          }
        }
      }
    }

    if (items.length === 0) {
      return undefined;
    }

    const completedItems = items.filter(item => item.completed).length;

    return {
      items,
      totalItems: items.length,
      completedItems,
      pendingItems: items.length - completedItems
    };
  }

  /**
   * Extract priority from text content
   */
  private extractPriority(text: string): 'high' | 'medium' | 'low' | undefined {
    const textLower = text.toLowerCase();
    if (textLower.includes('high priority') || textLower.includes('urgent') || textLower.includes('critical')) {
      return 'high';
    }
    if (textLower.includes('medium priority') || textLower.includes('important')) {
      return 'medium';
    }
    if (textLower.includes('low priority') || textLower.includes('nice to have') || textLower.includes('optional')) {
      return 'low';
    }
    return undefined;
  }

  /**
   * Extract assignee from text content
   */
  private extractAssignee(text: string): string | undefined {
    // Look for @mentions or assignee patterns
    const assigneeMatch = text.match(/@([a-zA-Z0-9_-]+)/);
    if (assigneeMatch) {
      return assigneeMatch[1];
    }

    const assignedMatch = text.match(/assigned to:?\s*([a-zA-Z0-9_\s-]+)/i);
    if (assignedMatch) {
      return assignedMatch[1].trim();
    }

    return undefined;
  }

  /**
   * Parse structured content from Notion blocks
   */
  private parseStructuredContent(blocks: NotionBlock[]): StructuredNotionContent {
    const userStory = this.parseUserStoryBlock(blocks);
    const acceptanceCriteria = this.parseAcceptanceCriteriaBlock(blocks);
    const screenshots = this.parseScreenshotBlock(blocks);
    const todoList = this.parseTodoListBlock(blocks);

    const hasStructuredContent = !!(userStory || acceptanceCriteria || screenshots || todoList);

    return {
      userStory,
      acceptanceCriteria,
      screenshots,
      todoList,
      hasStructuredContent
    };
  }

  /**
   * Parse Notion page content to extract task context
   */
  private parseNotionPage(pageContent: NotionPageContent, originalUrl: string): NotionTaskContext {
    const requirements: string[] = [];
    const acceptanceCriteria: string[] = [];
    let technicalSpecs = '';
    let description = '';

    // Parse structured content first
    const structuredContent = this.parseStructuredContent(pageContent.blocks);

    // Combine all block content for description
    const allContent = pageContent.blocks.map(block => block.content).join('\n');
    description = allContent.substring(0, 1000); // Limit description length

    // Parse content for specific sections based on Notion structure (backward compatibility)
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

    // If structured content has user story, use it to enhance description
    if (structuredContent.userStory && !userStoryContent.trim()) {
      description = structuredContent.userStory.description + '\n\n' + description;
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
      structuredContent: structuredContent.hasStructuredContent ? structuredContent : undefined,
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
   * Format structured content for display in reviews
   */
  formatStructuredContentForReview(structuredContent: StructuredNotionContent): string {
    if (!structuredContent.hasStructuredContent) {
      return '';
    }

    let formatted = '\n## 📋 Structured Task Context\n\n';

    // User Story
    if (structuredContent.userStory) {
      formatted += '### 👤 User Story\n';
      formatted += `**Summary:** ${structuredContent.userStory.summary}\n\n`;
      formatted += `${structuredContent.userStory.description}\n\n`;
    }

    // Acceptance Criteria
    if (structuredContent.acceptanceCriteria) {
      const { items, totalItems, completedItems } = structuredContent.acceptanceCriteria;
      formatted += '### ✅ Acceptance Criteria\n';
      formatted += `**Progress:** ${completedItems}/${totalItems} completed\n\n`;

      items.forEach((item, index) => {
        const status = item.completed ? '✅' : '⏳';
        const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
        formatted += `${index + 1}. ${status} ${item.text}${priority}\n`;

        // Add nested items
        item.nested.forEach((nested, nestedIndex) => {
          const nestedStatus = nested.completed ? '✅' : '⏳';
          const nestedPriority = nested.priority ? ` [${nested.priority.toUpperCase()}]` : '';
          formatted += `   ${nestedIndex + 1}.${index + 1}. ${nestedStatus} ${nested.text}${nestedPriority}\n`;
        });
      });
      formatted += '\n';
    }

    // Screenshots
    if (structuredContent.screenshots) {
      const { images, totalImages } = structuredContent.screenshots;
      formatted += '### 📸 Screenshots & Assets\n';
      formatted += `**Total:** ${totalImages} image(s)\n\n`;

      images.forEach((image, index) => {
        formatted += `${index + 1}. **${image.type.toUpperCase()}**`;
        if (image.caption) {
          formatted += `: ${image.caption}`;
        }
        if (image.url) {
          formatted += ` ([Link](${image.url}))`;
        }
        formatted += '\n';
      });
      formatted += '\n';
    }

    // Todo List
    if (structuredContent.todoList) {
      const { items, totalItems, completedItems, pendingItems } = structuredContent.todoList;
      formatted += '### 📝 Todo List\n';
      formatted += `**Progress:** ${completedItems}/${totalItems} completed (${pendingItems} pending)\n\n`;

      items.forEach((item, index) => {
        const status = item.completed ? '✅' : '⏳';
        const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
        const assignee = item.assignee ? ` (@${item.assignee})` : '';
        formatted += `${index + 1}. ${status} ${item.text}${priority}${assignee}\n`;
      });
      formatted += '\n';
    }

    return formatted;
  }

  /**
   * Extract key insights from structured content for AI analysis
   */
  extractStructuredInsights(structuredContent: StructuredNotionContent): {
    userStoryInsights: string;
    acceptanceCriteriaInsights: string;
    todoInsights: string;
    overallProgress: string;
  } {
    let userStoryInsights = '';
    let acceptanceCriteriaInsights = '';
    let todoInsights = '';
    let overallProgress = '';

    if (structuredContent.userStory) {
      userStoryInsights = `User Story: ${structuredContent.userStory.summary}`;
    }

    if (structuredContent.acceptanceCriteria) {
      const { totalItems, completedItems } = structuredContent.acceptanceCriteria;
      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      acceptanceCriteriaInsights = `Acceptance Criteria: ${completedItems}/${totalItems} completed (${progressPercent}%)`;

      // Identify high priority incomplete items
      const highPriorityIncomplete = structuredContent.acceptanceCriteria.items
        .filter(item => !item.completed && item.priority === 'high')
        .map(item => item.text);

      if (highPriorityIncomplete.length > 0) {
        acceptanceCriteriaInsights += `. High priority incomplete: ${highPriorityIncomplete.join(', ')}`;
      }
    }

    if (structuredContent.todoList) {
      const { totalItems, completedItems, pendingItems } = structuredContent.todoList;
      const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
      todoInsights = `Todo List: ${completedItems}/${totalItems} completed (${pendingItems} pending, ${progressPercent}%)`;
    }

    // Calculate overall progress
    const totalTasks = (structuredContent.acceptanceCriteria?.totalItems || 0) +
                      (structuredContent.todoList?.totalItems || 0);
    const completedTasks = (structuredContent.acceptanceCriteria?.completedItems || 0) +
                          (structuredContent.todoList?.completedItems || 0);

    if (totalTasks > 0) {
      const overallPercent = Math.round((completedTasks / totalTasks) * 100);
      overallProgress = `Overall Progress: ${completedTasks}/${totalTasks} tasks completed (${overallPercent}%)`;
    }

    return {
      userStoryInsights,
      acceptanceCriteriaInsights,
      todoInsights,
      overallProgress
    };
  }

  /**
   * Check if Notion integration is enabled and properly configured
   */
  isEnabled(): boolean {
    return this.config.enabled && !!this.client;
  }
}

export const notionService = new NotionService();
