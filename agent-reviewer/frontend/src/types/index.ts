export interface User {
  id: string
  username: string
  role: string
}

// Re-export performance types
export * from './performance'

export interface LoginCredentials {
  secretKey: string
}

export interface AuthResponse {
  success: boolean
  token?: string
  user?: User
  message?: string
}

export interface ReviewRecord {
  id: number
  projectId: number
  projectName: string
  mergeRequestIid: number
  mergeRequestTitle?: string
  lastReviewedCommitSha: string
  reviewCommentId?: number
  reviewedAt: string
  createdAt: string
  updatedAt: string
  status: 'pending' | 'reviewed' | 'approved' | 'rejected'
  criticalIssuesCount: number
  fixesImplementedCount: number
  reviewerType: 'automated' | 'manual'
}

export interface Project {
  projectId: number
  name: string
  description?: string
  url?: string
  defaultBranch?: string
  lastProcessedCommit?: string
  lastProcessedAt?: string
  lastReembeddingAt?: string
}

export interface QueueJob {
  id: string
  repositoryUrl: string
  processingId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  attempts: number
  maxAttempts: number
  error?: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  priority: number
  projectId: number
  isReembedding: boolean
}

export interface QueueStats {
  total: number
  pending: number
  processing: number
  completed: number
  failed: number
  retrying: number
}

export interface SystemHealth {
  database: 'healthy' | 'unhealthy'
  embeddingService: 'healthy' | 'unhealthy'
  webhookProcessing: 'healthy' | 'unhealthy'
  queueService: 'healthy' | 'unhealthy'
}

export interface AnalyticsData {
  // Basic metrics
  totalReviews: number
  approvalRate: number
  averageReviewTime: number
  reviewsToday: number
  reviewsThisWeek: number
  reviewsThisMonth: number
  criticalIssuesTotal: number

  // Enhanced productivity metrics
  reviewFrequency: {
    totalReviews: number
    activeDays: number
    avgReviewsPerDay: number
  }

  // Project insights
  topProjects: Array<{
    projectName: string
    reviewCount: number
    approvalRate: number
  }>
  projectActivity: Array<{
    projectName: string
    reviewCount: number
    avgReviewTime: number
    activeDays: number
  }>

  // Trend analysis
  reviewTrends: Array<{
    date: string
    reviews: number
    approvals: number
    criticalIssues: number
  }>

  // Issue categorization
  issueCategories: Array<{
    category: string
    count: number
    percentage: number
  }>

  // Embedding system metrics
  embeddingMetrics: {
    codeEmbeddings: {
      totalFiles: number
      totalProjects: number
      languageDistribution: Array<{
        language: string
        fileCount: number
        percentage: number
      }>
      coverageByProject: Array<{
        projectName: string
        embeddedFiles: number
        lastEmbedded: string | null
      }>
      recentActivity: Array<{
        date: string
        filesEmbedded: number
      }>
      avgFilesPerProject: number
      lastUpdated: string | null
    }
    documentationEmbeddings: {
      totalSections: number
      totalSources: number
      frameworkDistribution: Array<{
        framework: string
        sectionCount: number
        percentage: number
      }>
      sourceHealth: Array<{
        sourceName: string
        status: string
        lastUpdated: string | null
      }>
      lastUpdated: string | null
    }
    embeddingJobs: {
      totalJobs: number
      successRate: number
      avgProcessingTime: number
      recentJobs: Array<{
        id: string
        status: string
        createdAt: string
      }>
      jobsByStatus: {
        pending: number
        processing: number
        completed: number
        failed: number
        retrying: number
      }
    }
    systemHealth: {
      embeddingCoverage: number
      documentationCoverage: number
      processingEfficiency: number
      lastEmbeddingTime: string | null
    }
  }

  // Merge request metrics
  mergeRequestMetrics: {
    totalMRs: number
    mergedMRs: number
    closedMRs: number
    openMRs: number
    successRate: number
    avgMergeTime: number
    mrsByStatus: {
      opened: number
      merged: number
      closed: number
    }
    mrsByUser: Array<{
      username: string
      total_mrs: number
      merged_mrs: number
      success_rate: number
      avg_merge_time_hours: number
    }>
    mrsByProject: Array<{
      project_id: number
      project_name: string
      total_mrs: number
      merged_mrs: number
      success_rate: number
      avg_merge_time_hours: number
    }>
    mergeTimeTrends: TimeSeriesData[]
    dailyMRCreation: TimeSeriesData[]
    repopoVsGitlab: {
      repopo_count: number
      gitlab_count: number
    }
  }

  // Queue statistics
  queueStats: QueueStats
}

export interface PaginationParams {
  page: number
  limit: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

export interface FilterParams {
  projectId?: number
  status?: string
  dateFrom?: string
  dateTo?: string
  search?: string
}

export interface ApiResponse<T> {
  success: boolean
  data?: T
  message?: string
  error?: string
  pagination?: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

// Repository Embedding Types
export interface RepositoryEmbeddingRequest {
  projectId: number
  repositoryUrl: string
  priority?: 'high' | 'normal' | 'low'
}

export interface RepositoryEmbeddingResponse {
  message: string
  processingId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
}

export interface RepositoryEmbeddingStatus {
  processingId: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'retrying'
  repositoryUrl: string
  createdAt: string
  updatedAt: string
  startedAt?: string
  completedAt?: string
  attempts: number
  maxAttempts: number
  error?: string
}

// Documentation Management Types
export interface DocumentationSource {
  id: string
  name: string
  description: string
  url: string
  framework: string
  version?: string
  isActive: boolean
  refreshIntervalDays: number
  lastFetchedAt?: string
  lastEmbeddedAt?: string
  fetchStatus: 'pending' | 'fetching' | 'completed' | 'failed'
  fetchError?: string
  createdAt: string
  updatedAt: string
}

export interface DocumentationSourceRequest {
  name: string
  description?: string
  url: string
  framework: string
  version?: string
  isActive?: boolean
  refreshIntervalDays?: number
}

export interface DocumentationSourceResponse {
  success: boolean
  source?: DocumentationSource
  sources?: DocumentationSource[]
  total?: number
  message?: string
  error?: string
}

export interface DocumentationEmbeddingRequest {
  sourceId: string
}

export interface ProjectDocumentationMapping {
  projectId: number
  sourceId: string
  isEnabled: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

// Merge Request Types
export interface MergeRequestDetails {
  id: number
  project_id: number
  merge_request_iid: number
  merge_request_id: number
  title: string
  description: string
  author: {
    id: number
    username: string
    name: string
  }
  source_branch: string
  target_branch: string
  status: 'opened' | 'merged' | 'closed' | 'locked'
  action: 'open' | 'update' | 'close' | 'merge' | 'reopen'
  created_at: string
  updated_at: string
  merged_at?: string
  closed_at?: string
  merge_time_hours?: number
  repository_url: string
  web_url: string
  is_repopo_event: boolean
  project_name?: string
  // Review tracking fields
  review_status?: 'pending' | 'reviewed' | 'approved' | 'rejected'
  reviewer_type?: 'automated' | 'manual'
  critical_issues_count?: number
  fixes_implemented_count?: number
  last_reviewed_at?: string
  last_reviewed_commit_sha?: string
}

export interface UserMRStatistics {
  username: string
  user_id: number
  projects: ProjectMRStats[]
  overall: {
    total_mrs_created: number
    total_mrs_merged: number
    total_mrs_closed: number
    total_mrs_rejected: number
    success_rate: number
    avg_merge_time_hours: number
    last_mr_created_at?: string
    last_mr_merged_at?: string
  }
}

export interface ProjectMRStats {
  project_id: number
  project_name: string
  total_mrs_created: number
  total_mrs_merged: number
  success_rate: number
  avg_merge_time_hours: number
}

export interface MRAnalytics {
  total_mrs: number
  mrs_by_status: {
    opened: number
    merged: number
    closed: number
  }
  mrs_by_user: UserBreakdown[]
  mrs_by_project: ProjectBreakdown[]
  merge_time_trends: TimeSeriesData[]
  daily_mr_creation: TimeSeriesData[]
  repopo_vs_gitlab: {
    repopo_count: number
    gitlab_count: number
  }
}

export interface UserBreakdown {
  username: string
  total_mrs: number
  merged_mrs: number
  success_rate: number
  avg_merge_time_hours: number
}

export interface ProjectBreakdown {
  project_id: number
  project_name: string
  total_mrs: number
  merged_mrs: number
  success_rate: number
  avg_merge_time_hours: number
}

export interface TimeSeriesData {
  date: string
  value: number
  label?: string
}

export interface MergeRequestListParams {
  page?: number
  limit?: number
  projectId?: number
  authorUsername?: string
  status?: 'opened' | 'merged' | 'closed' | ''
  from_date?: string
  to_date?: string
  search?: string
}
