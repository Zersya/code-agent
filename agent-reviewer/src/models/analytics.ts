// Analytics models for developer performance tracking

/**
 * Interface for developer performance metrics (daily aggregates)
 */
export interface DeveloperMetrics {
  id?: number;
  developerId: number;
  developerUsername: string;
  developerEmail?: string;
  projectId: number;
  metricDate: Date;
  
  // Productivity metrics
  mrsCreated: number;
  mrsMerged: number;
  mrsClosed: number;
  totalLinesAdded: number;
  totalLinesRemoved: number;
  totalFilesChanged: number;
  avgCycleTimeHours?: number;
  avgReviewTimeHours?: number;
  
  // Quality metrics
  criticalIssuesCount: number;
  totalReviewComments: number;
  approvalRate?: number;
  reworkRate?: number;
  codeQualityScore?: number;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Interface for individual merge request analytics
 */
export interface MergeRequestAnalytics {
  id?: number;
  projectId: number;
  mergeRequestIid: number;
  developerId: number;
  developerUsername: string;
  
  // Basic MR info
  title: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: Date;
  mergedAt?: Date;
  closedAt?: Date;
  
  // Size metrics
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  complexityScore?: number;
  
  // Time metrics
  cycleTimeHours?: number;
  reviewTimeHours?: number;
  firstResponseTimeHours?: number;
  
  // Quality metrics
  criticalIssuesCount: number;
  totalReviewComments: number;
  wasApproved: boolean;
  requiredRework: boolean;
  codeQualityScore?: number;
  
  // Review context
  hasNotionContext: boolean;
  reviewMode?: string; // 'quick', 'standard', 'detailed'
  sequentialThinkingUsed: boolean;
}

/**
 * Interface for review feedback analytics
 */
export interface ReviewFeedbackAnalytics {
  id?: number;
  mergeRequestAnalyticsId: number;
  projectId: number;
  mergeRequestIid: number;
  
  // Feedback categorization
  feedbackType: 'critical' | 'suggestion' | 'praise' | 'question';
  category: 'security' | 'performance' | 'style' | 'logic' | 'documentation' | 'other';
  severity: 'high' | 'medium' | 'low';
  
  // Feedback content
  feedbackText: string;
  filePath?: string;
  lineNumber?: number;
  
  // Resolution tracking
  wasAddressed: boolean;
  resolutionTimeHours?: number;
  
  createdAt: Date;
}

/**
 * Interface for project performance aggregates
 */
export interface ProjectPerformanceMetrics {
  id?: number;
  projectId: number;
  metricDate: Date;
  
  // Aggregate metrics
  totalDevelopers: number;
  totalMrsCreated: number;
  totalMrsMerged: number;
  avgCycleTimeHours?: number;
  avgCodeQualityScore?: number;
  
  // Trend indicators
  productivityTrend?: number; // percentage change from previous period
  qualityTrend?: number;
  
  createdAt: Date;
}

/**
 * Interface for analytics data collection from webhook events
 */
export interface MergeRequestEventData {
  projectId: number;
  mergeRequestIid: number;
  developerId: number;
  developerUsername: string;
  developerEmail?: string;
  title: string;
  description?: string;
  sourceBranch: string;
  targetBranch: string;
  createdAt: Date;
  lastCommitId: string;
  action: string; // 'open', 'update', 'merge', 'close'
}

/**
 * Interface for analytics data from review completion
 */
export interface ReviewCompletionData {
  projectId: number;
  mergeRequestIid: number;
  reviewResult: string;
  shouldApprove: boolean;
  criticalIssuesCount: number;
  totalReviewComments: number;
  reviewMode: string;
  sequentialThinkingUsed: boolean;
  hasNotionContext: boolean;
  linesAdded: number;
  linesRemoved: number;
  filesChanged: number;
  reviewTimeHours: number;
  codeQualityScore?: number;
}

/**
 * Interface for KPI calculation results
 */
export interface DeveloperKPIs {
  developerId: number;
  projectId: number;
  period: 'daily' | 'weekly' | 'monthly';
  startDate: Date;
  endDate: Date;
  
  // Calculated KPIs
  productivityScore: number;
  codeQualityScore: number;
  
  // Supporting metrics
  avgCycleTime: number;
  approvalRate: number;
  criticalIssuesDensity: number;
  reworkRate: number;
}

/**
 * Interface for analytics query filters
 */
export interface AnalyticsFilters {
  projectId?: number;
  developerId?: number;
  startDate?: Date;
  endDate?: Date;
  period?: 'daily' | 'weekly' | 'monthly';
  limit?: number;
  offset?: number;
}

/**
 * Interface for analytics aggregation results
 */
export interface AnalyticsAggregation {
  period: string;
  totalMRs: number;
  avgCycleTime: number;
  avgQualityScore: number;
  approvalRate: number;
  criticalIssuesCount: number;
  activeDevelo pers: number;
}

/**
 * Enum for feedback categories
 */
export enum FeedbackCategory {
  SECURITY = 'security',
  PERFORMANCE = 'performance',
  STYLE = 'style',
  LOGIC = 'logic',
  DOCUMENTATION = 'documentation',
  OTHER = 'other'
}

/**
 * Enum for feedback types
 */
export enum FeedbackType {
  CRITICAL = 'critical',
  SUGGESTION = 'suggestion',
  PRAISE = 'praise',
  QUESTION = 'question'
}

/**
 * Enum for feedback severity
 */
export enum FeedbackSeverity {
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

/**
 * Interface for analytics service configuration
 */
export interface AnalyticsConfig {
  enableRealTimeProcessing: boolean;
  batchProcessingInterval: number; // minutes
  dataRetentionDays: number;
  enableDetailedFeedbackAnalysis: boolean;
}
