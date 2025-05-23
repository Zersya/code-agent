// Types for Notion integration functionality

/**
 * Interface for Notion task context extracted from a Notion page
 */
export interface NotionTaskContext {
  pageId: string;
  title: string;
  description: string;
  requirements: string[];
  acceptanceCriteria: string[];
  technicalSpecs: string;
  relatedContext: string;
  url: string;
  lastModified: Date;
  error?: string;
}

/**
 * Interface for Notion page content structure
 */
export interface NotionPageContent {
  id: string;
  title: string;
  properties: Record<string, any>;
  blocks: NotionBlock[];
  lastEditedTime: string;
  url: string;
}

/**
 * Interface for Notion block content
 */
export interface NotionBlock {
  id: string;
  type: string;
  content: string;
  children?: NotionBlock[];
}

/**
 * Interface for Notion configuration
 */
export interface NotionConfiguration {
  apiToken: string;
  enabled: boolean;
  timeout: number;
  enabledProjects?: number[];
}

/**
 * Interface for Notion URL extraction result
 */
export interface NotionUrlExtractionResult {
  urls: string[];
  extractedFromSection?: string;
  totalFound: number;
}

/**
 * Interface for Notion API error handling
 */
export interface NotionApiError {
  code: string;
  message: string;
  status: number;
  url?: string;
}

/**
 * Interface for combined Notion context from multiple pages
 */
export interface CombinedNotionContext {
  contexts: NotionTaskContext[];
  totalPages: number;
  successfulFetches: number;
  errors: NotionApiError[];
  summary: string;
}
