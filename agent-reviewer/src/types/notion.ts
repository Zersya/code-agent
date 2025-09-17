// Types for Notion integration functionality

/**
 * Interface for User Story block content
 */
export interface UserStoryBlock {
  content: string;
  description: string;
  summary: string;
}

/**
 * Interface for Acceptance Criteria item
 */
export interface AcceptanceCriteriaItem {
  text: string;
  completed: boolean;
  nested: AcceptanceCriteriaItem[];
  priority?: 'high' | 'medium' | 'low';
}

/**
 * Interface for Acceptance Criteria block content
 */
export interface AcceptanceCriteriaBlock {
  items: AcceptanceCriteriaItem[];
  totalItems: number;
  completedItems: number;
}

/**
 * Interface for Screenshot/Image block content
 */
export interface ScreenshotBlock {
  images: {
    id: string;
    caption?: string;
    url?: string;
    type: 'image' | 'file' | 'embed';
  }[];
  totalImages: number;
}

/**
 * Interface for Todo List item
 */
export interface TodoListItem {
  text: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
}

/**
 * Interface for Todo List block content
 */
export interface TodoListBlock {
  items: TodoListItem[];
  totalItems: number;
  completedItems: number;
  pendingItems: number;
}

/**
 * Interface for structured Notion content
 */
export interface StructuredNotionContent {
  userStory?: UserStoryBlock;
  acceptanceCriteria?: AcceptanceCriteriaBlock;
  screenshots?: ScreenshotBlock;
  todoList?: TodoListBlock;
  hasStructuredContent: boolean;
}

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
  structuredContent?: StructuredNotionContent;
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
  createdTime?: string;

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
