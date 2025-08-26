import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { DeveloperPerformanceMetrics, MRQualityMetrics, IssueMetrics, PerformanceFilters } from '@/types/performance'
import { performanceApi } from '@/services/api'

export const usePerformanceStore = defineStore('performance', () => {
  const developerMetrics = ref<DeveloperPerformanceMetrics[]>([])
  const mrQualityMetrics = ref<MRQualityMetrics[]>([])
  const issueMetrics = ref<IssueMetrics[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchDeveloperPerformance = async (filters?: PerformanceFilters) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await performanceApi.getDeveloperPerformance(filters)
      
      if (response.success && response.data) {
        developerMetrics.value = response.data
      } else {
        error.value = response.message || 'Failed to fetch developer performance'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch developer performance'
    } finally {
      isLoading.value = false
    }
  }

  const fetchMRQualityMetrics = async (filters?: PerformanceFilters) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await performanceApi.getMRQualityMetrics(filters)
      
      if (response.success && response.data) {
        mrQualityMetrics.value = response.data
      } else {
        error.value = response.message || 'Failed to fetch MR quality metrics'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch MR quality metrics'
    } finally {
      isLoading.value = false
    }
  }

  const fetchIssueMetrics = async (filters?: PerformanceFilters) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await performanceApi.getIssueMetrics(filters)
      
      if (response.success && response.data) {
        issueMetrics.value = response.data
      } else {
        error.value = response.message || 'Failed to fetch issue metrics'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch issue metrics'
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    developerMetrics,
    mrQualityMetrics,
    issueMetrics,
    isLoading,
    error,
    fetchDeveloperPerformance,
    fetchMRQualityMetrics,
    fetchIssueMetrics,
    clearError
  }
})