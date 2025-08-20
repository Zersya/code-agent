import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AnalyticsData } from '@/types'
import { analyticsApi } from '@/services/api'

export const useAnalyticsStore = defineStore('analytics', () => {
  const analytics = ref<AnalyticsData>({
    totalReviews: 0,
    approvalRate: 0,
    averageReviewTime: 0,
    reviewsToday: 0,
    reviewsThisWeek: 0,
    reviewsThisMonth: 0,
    criticalIssuesTotal: 0,
    topProjects: [],
    reviewTrends: [],
    issueCategories: []
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchAnalytics = async (dateRange?: { from: string; to: string }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await analyticsApi.getAnalytics(dateRange)
      
      if (response.success && response.data) {
        analytics.value = response.data
      } else {
        error.value = response.message || 'Failed to fetch analytics'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch analytics'
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    analytics,
    isLoading,
    error,
    fetchAnalytics,
    clearError
  }
})
