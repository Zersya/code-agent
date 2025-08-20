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
  Project
} from '@/types'

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

// Projects API
export const projectsApi = {
  getProjects: (): Promise<ApiResponse<Project[]>> =>
    apiClient.get<Project[]>('/projects'),
}

export default apiClient
