export interface User {
  id: string
  username: string
  role: string
}

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
  status: 'approved' | 'rejected' | 'pending'
  criticalIssuesCount: number
  reviewerType: 'auto' | 'manual'
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
