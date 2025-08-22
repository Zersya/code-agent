import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { MergeRequestDetails, UserMRStatistics, MergeRequestListParams } from '@/types'
import { mergeRequestApi } from '@/services/api'

export const useMergeRequestStore = defineStore('mergeRequests', () => {
  const mergeRequests = ref<MergeRequestDetails[]>([])
  const currentMergeRequest = ref<MergeRequestDetails | null>(null)
  const userStatistics = ref<Map<string, UserMRStatistics>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  
  // Pagination state
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
    hasNext: false,
    hasPrev: false
  })

  // Filters state
  const filters = ref<MergeRequestListParams>({
    page: 1,
    limit: 20
  })

  const fetchMergeRequests = async (params?: MergeRequestListParams) => {
    isLoading.value = true
    error.value = null

    try {
      const requestParams = { ...filters.value, ...params }
      const response = await mergeRequestApi.getMergeRequests(requestParams)
      
      if (response.success && response.data) {
        mergeRequests.value = response.data
        if (response.pagination) {
          pagination.value = response.pagination
        }
        // Update filters with the actual params used
        filters.value = requestParams
      } else {
        error.value = response.message || 'Failed to fetch merge requests'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch merge requests'
    } finally {
      isLoading.value = false
    }
  }

  const fetchMergeRequest = async (id: number) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await mergeRequestApi.getMergeRequest(id)
      
      if (response.success && response.data) {
        currentMergeRequest.value = response.data
      } else {
        error.value = response.message || 'Failed to fetch merge request'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch merge request'
    } finally {
      isLoading.value = false
    }
  }

  const fetchUserStatistics = async (username: string) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await mergeRequestApi.getUserStatistics(username)
      
      if (response.success && response.data) {
        userStatistics.value.set(username, response.data)
      } else {
        error.value = response.message || 'Failed to fetch user statistics'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch user statistics'
    } finally {
      isLoading.value = false
    }
  }

  const exportMergeRequests = async (params?: MergeRequestListParams) => {
    isLoading.value = true
    error.value = null

    try {
      const requestParams = { ...filters.value, ...params }
      const csvData = await mergeRequestApi.exportMergeRequests(requestParams)
      
      // Create and trigger download
      const blob = new Blob([csvData], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `merge-requests-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to export merge requests'
    } finally {
      isLoading.value = false
    }
  }

  const updateFilters = (newFilters: Partial<MergeRequestListParams>) => {
    filters.value = { ...filters.value, ...newFilters }
    // Reset to first page when filters change
    if (newFilters.page === undefined) {
      filters.value.page = 1
    }
  }

  const clearFilters = () => {
    filters.value = {
      page: 1,
      limit: 20
    }
  }

  const clearError = () => {
    error.value = null
  }

  const clearCurrentMergeRequest = () => {
    currentMergeRequest.value = null
  }

  // Computed getters
  const getUserStatistics = (username: string) => {
    return userStatistics.value.get(username) || null
  }

  const getMergeRequestById = (id: number) => {
    return mergeRequests.value.find(mr => mr.id === id) || null
  }

  return {
    // State
    mergeRequests,
    currentMergeRequest,
    userStatistics,
    isLoading,
    error,
    pagination,
    filters,
    
    // Actions
    fetchMergeRequests,
    fetchMergeRequest,
    fetchUserStatistics,
    exportMergeRequests,
    updateFilters,
    clearFilters,
    clearError,
    clearCurrentMergeRequest,
    
    // Getters
    getUserStatistics,
    getMergeRequestById
  }
})
