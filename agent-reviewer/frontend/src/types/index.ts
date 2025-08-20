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
  totalReviews: number
  approvalRate: number
  averageReviewTime: number
  reviewsToday: number
  reviewsThisWeek: number
  reviewsThisMonth: number
  criticalIssuesTotal: number
  topProjects: Array<{
    projectName: string
    reviewCount: number
    approvalRate: number
  }>
  reviewTrends: Array<{
    date: string
    reviews: number
    approvals: number
    criticalIssues: number
  }>
  issueCategories: Array<{
    category: string
    count: number
    percentage: number
  }>
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
