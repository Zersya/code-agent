import axios, { type AxiosInstance, type AxiosResponse } from 'axios'
import type {
  LoginCredentials,
  AuthResponse,
  ReviewRecord,
  PaginationParams,
  FilterParams,
  ApiResponse,
  QueueStats,
  QueueJob,
  SystemHealth,
  AnalyticsData,
  Project,
  RepositoryEmbeddingRequest,
  RepositoryEmbeddingResponse,
  RepositoryEmbeddingStatus,
  DocumentationSourceRequest,
  DocumentationSourceResponse,
  ProjectDocumentationMapping,
  MergeRequestDetails,
  UserMRStatistics,
  MergeRequestListParams
} from '@/types'
import type {
  DeveloperPerformanceMetrics,
  MRQualityMetrics,
  IssueMetrics,
  PerformanceFilters
} from '@/types/performance'

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: '/api',
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Request interceptor to add auth token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('auth_token')
      if (token) {
        config.headers['Authorization'] = `Bearer ${token}`
      }
      return config
    })

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          localStorage.removeItem('auth_token')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  private async handleResponse<T>(response: AxiosResponse): Promise<ApiResponse<T>> {
    return response.data
  }

  private async handleError(error: any): Promise<ApiResponse<any>> {
    if (error.response?.data) {
      return error.response.data
    }
    return {
      success: false,
      error: error.message || 'An unexpected error occurred'
    }
  }

  async get<T>(url: string, params?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.get(url, { params })
      return this.handleResponse<T>(response)
    } catch (error) {
      return this.handleError(error)
    }
  }

  async post<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.post(url, data)
      return this.handleResponse<T>(response)
    } catch (error) {
      return this.handleError(error)
    }
  }

  async put<T>(url: string, data?: any): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.put(url, data)
      return this.handleResponse<T>(response)
    } catch (error) {
      return this.handleError(error)
    }
  }

  async delete<T>(url: string): Promise<ApiResponse<T>> {
    try {
      const response = await this.client.delete(url)
      return this.handleResponse<T>(response)
    } catch (error) {
      return this.handleError(error)
    }
  }

  async getRaw(url: string, params?: any, config?: any): Promise<any> {
    return this.client.get(url, { params, ...config })
  }
}

const apiClient = new ApiClient()

// Auth API
export const authApi = {
  login: (credentials: LoginCredentials): Promise<AuthResponse> =>
    apiClient.post<AuthResponse>('/auth/login', credentials),
  
  logout: (): Promise<ApiResponse<void>> =>
    apiClient.post<void>('/auth/logout'),
  
  me: (): Promise<ApiResponse<{ user: any }>> =>
    apiClient.get<{ user: any }>('/auth/me'),
}

// Reviews API
export const reviewsApi = {
  getReviews: (params: PaginationParams & FilterParams): Promise<ApiResponse<ReviewRecord[]>> =>
    apiClient.get<ReviewRecord[]>('/reviews', params),
  
  exportReviews: async (params: FilterParams): Promise<string> => {
    const response = await apiClient.getRaw('/reviews/export', params, {
      responseType: 'text'
    })
    return response.data
  },
}

// Status API
export const statusApi = {
  getQueueStatus: (): Promise<ApiResponse<{ stats: QueueStats; jobs: QueueJob[] }>> =>
    apiClient.get<{ stats: QueueStats; jobs: QueueJob[] }>('/queue/status'),
  
  getSystemHealth: (): Promise<ApiResponse<SystemHealth>> =>
    apiClient.get<SystemHealth>('/system/health'),
}

// Analytics API
export const analyticsApi = {
  getAnalytics: (dateRange?: { from: string; to: string }): Promise<ApiResponse<AnalyticsData>> =>
    apiClient.get<AnalyticsData>('/analytics', dateRange),
}

// Merge Request API
export const mergeRequestApi = {
  getMergeRequests: (params: MergeRequestListParams): Promise<ApiResponse<MergeRequestDetails[]>> =>
    apiClient.get<MergeRequestDetails[]>('/merge-requests', params),

  getMergeRequest: (id: number): Promise<ApiResponse<MergeRequestDetails>> =>
    apiClient.get<MergeRequestDetails>(`/merge-requests/${id}`),

  getUserStatistics: (username: string): Promise<ApiResponse<UserMRStatistics>> =>
    apiClient.get<UserMRStatistics>(`/users/${username}/mr-statistics`),

  exportMergeRequests: async (params: MergeRequestListParams): Promise<string> => {
    const response = await apiClient.getRaw('/merge-requests/export', params, {
      responseType: 'text'
    })
    return response.data
  },
}

// Projects API
export const projectsApi = {
  getProjects: (): Promise<ApiResponse<Project[]> | Project[]> =>
    apiClient.get<Project[]>('/projects'),

  updateAutoReview: (projectId: number, enabled: boolean): Promise<ApiResponse<{ success: boolean; message: string; autoReviewEnabled: boolean }>> =>
    apiClient.put<{ success: boolean; message: string; autoReviewEnabled: boolean }>(`/projects/${projectId}/auto-review`, { enabled }),

  updateAutoApprove: (projectId: number, enabled: boolean): Promise<ApiResponse<{ success: boolean; message: string; autoApproveEnabled: boolean }>> =>
    apiClient.put<{ success: boolean; message: string; autoApproveEnabled: boolean }>(`/projects/${projectId}/auto-approve`, { enabled }),

  getAutoReviewStatus: (projectId: number): Promise<ApiResponse<{ projectId: number; autoReviewEnabled: boolean }>> =>
    apiClient.get<{ projectId: number; autoReviewEnabled: boolean }>(`/projects/${projectId}/auto-review`),

  getAutoApproveStatus: (projectId: number): Promise<ApiResponse<{ projectId: number; autoApproveEnabled: boolean }>> =>
    apiClient.get<{ projectId: number; autoApproveEnabled: boolean }>(`/projects/${projectId}/auto-approve`),
}

// Repository Embedding API
export const repositoryApi = {
  embedRepository: (data: RepositoryEmbeddingRequest): Promise<ApiResponse<RepositoryEmbeddingResponse>> =>
    apiClient.post<RepositoryEmbeddingResponse>('/repositories/embed', data),

  getEmbeddingStatus: (processingId: string): Promise<ApiResponse<RepositoryEmbeddingStatus>> =>
    apiClient.get<RepositoryEmbeddingStatus>(`/repositories/status/${processingId}`),

  retryJob: (processingId: string): Promise<ApiResponse<{ processingId: string; status: string; updatedAt: string }>> =>
    apiClient.post<{ processingId: string; status: string; updatedAt: string }>(`/repositories/retry/${processingId}`),

  cancelJob: (processingId: string): Promise<ApiResponse<{ processingId: string; status: string; updatedAt: string }>> =>
    apiClient.post<{ processingId: string; status: string; updatedAt: string }>(`/repositories/cancel/${processingId}`),

  deleteJob: (processingId: string): Promise<ApiResponse<void>> =>
    apiClient.delete<void>(`/repositories/job/${processingId}`),

  reembedRepository: (repositoryUrl: string, priority?: 'high' | 'normal' | 'low'): Promise<ApiResponse<RepositoryEmbeddingResponse>> =>
    apiClient.post<RepositoryEmbeddingResponse>('/repositories/embed', {
      repositoryUrl,
      priority: priority || 'normal',
      isReembedding: true
    }),

  getQueueStatus: (params?: PaginationParams): Promise<ApiResponse<{ stats: QueueStats; jobs: QueueJob[] }>> =>
    apiClient.get<{ stats: QueueStats; jobs: QueueJob[] }>('/queue/status', params),
}

// Documentation API
export const documentationApi = {
  getSources: (params?: { framework?: string; active?: boolean }): Promise<DocumentationSourceResponse> =>
    apiClient.get<DocumentationSourceResponse>('/documentation/sources', params),

  getSource: (id: string): Promise<DocumentationSourceResponse> =>
    apiClient.get<DocumentationSourceResponse>(`/documentation/sources/${id}`),

  addSource: (data: DocumentationSourceRequest): Promise<DocumentationSourceResponse> =>
    apiClient.post<DocumentationSourceResponse>('/documentation/sources', data),

  updateSource: (id: string, data: Partial<DocumentationSourceRequest>): Promise<DocumentationSourceResponse> =>
    apiClient.put<DocumentationSourceResponse>(`/documentation/sources/${id}`, data),

  deleteSource: (id: string): Promise<ApiResponse<void>> =>
    apiClient.delete<void>(`/documentation/sources/${id}`),

  reembedSource: (id: string): Promise<ApiResponse<{ message: string }>> =>
    apiClient.post<{ message: string }>(`/documentation/sources/${id}/reembed`),

  getProjectMappings: (projectId: number): Promise<ApiResponse<ProjectDocumentationMapping[]>> =>
    apiClient.get<ProjectDocumentationMapping[]>(`/projects/${projectId}/documentation`),

  mapProjectToDocumentation: (projectId: number, data: { sourceId: string; priority: number; isEnabled: boolean }): Promise<ApiResponse<ProjectDocumentationMapping>> =>
    apiClient.post<ProjectDocumentationMapping>(`/projects/${projectId}/documentation`, data),
}

// Performance API
export const performanceApi = {
  getDeveloperPerformance: (filters?: PerformanceFilters): Promise<ApiResponse<DeveloperPerformanceMetrics[]>> =>
    apiClient.get<DeveloperPerformanceMetrics[]>('/analytics/developers', filters),

  getMRQualityMetrics: (filters?: PerformanceFilters): Promise<ApiResponse<MRQualityMetrics[]>> =>
    apiClient.get<MRQualityMetrics[]>('/analytics/merge-requests', filters),

  getIssueMetrics: (filters?: PerformanceFilters): Promise<ApiResponse<IssueMetrics[]>> =>
    apiClient.get<IssueMetrics[]>('/analytics/issues', filters),
}

export default apiClient
