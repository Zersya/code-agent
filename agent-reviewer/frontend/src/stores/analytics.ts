import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { AnalyticsData } from '@/types'
import { analyticsApi, completionRateApi } from '@/services/api'
import type {
  CompletionRateResponse,
  TeamCompletionRateResponse,
  CompletionRateTrendsResponse,
  CompletionRateStatsResponse,
  CompletionRateFilters
} from '@/types/performance'

export const useAnalyticsStore = defineStore('analytics', () => {
  const analytics = ref<AnalyticsData>({
    // Basic metrics
    totalReviews: 0,
    approvalRate: 0,
    averageReviewTime: 0,
    reviewsToday: 0,
    reviewsThisWeek: 0,
    reviewsThisMonth: 0,
    criticalIssuesTotal: 0,

    // Enhanced productivity metrics
    reviewFrequency: {
      totalReviews: 0,
      activeDays: 0,
      avgReviewsPerDay: 0
    },

    // Project insights
    topProjects: [],
    projectActivity: [],

    // Trend analysis
    reviewTrends: [],

    // Issue categorization
    issueCategories: [],

    // Embedding system metrics
    embeddingMetrics: {
      codeEmbeddings: {
        totalFiles: 0,
        totalProjects: 0,
        languageDistribution: [],
        coverageByProject: [],
        recentActivity: [],
        avgFilesPerProject: 0,
        lastUpdated: null
      },
      documentationEmbeddings: {
        totalSections: 0,
        totalSources: 0,
        frameworkDistribution: [],
        sourceHealth: [],
        lastUpdated: null
      },
      embeddingJobs: {
        totalJobs: 0,
        successRate: 0,
        avgProcessingTime: 0,
        recentJobs: [],
        jobsByStatus: {
          pending: 0,
          processing: 0,
          completed: 0,
          failed: 0,
          retrying: 0
        }
      },
      systemHealth: {
        embeddingCoverage: 0,
        documentationCoverage: 0,
        processingEfficiency: 0,
        lastEmbeddingTime: null
      }
    },

    // Merge request metrics
    mergeRequestMetrics: {
      totalMRs: 0,
      mergedMRs: 0,
      closedMRs: 0,
      openMRs: 0,
      successRate: 0,
      avgMergeTime: 0,
      mrsByStatus: { opened: 0, merged: 0, closed: 0 },
      mrsByUser: [],
      mrsByProject: [],
      mergeTimeTrends: [],
      dailyMRCreation: [],
      repopoVsGitlab: { repopo_count: 0, gitlab_count: 0 }
    },

    // Queue statistics
    queueStats: {
      total: 0,
      pending: 0,
      processing: 0,
      completed: 0,
      failed: 0,
      retrying: 0
    }
  })

  // Completion Rate Data
  const completionRateData = ref<{
    teamRates?: TeamCompletionRateResponse;
    individualRates: Record<string, CompletionRateResponse>;
    trends: Record<string, CompletionRateTrendsResponse>;
    stats?: CompletionRateStatsResponse;
  }>({
    individualRates: {},
    trends: {}
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

  const fetchTeamCompletionRates = async (filters?: CompletionRateFilters) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await completionRateApi.getTeamCompletionRates(filters)

      if (response.success && response.data) {
        completionRateData.value.teamRates = response.data
      } else {
        error.value = response.message || 'Failed to fetch team completion rates'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch team completion rates'
    } finally {
      isLoading.value = false
    }
  }

  const fetchCompletionRateTrends = async (developerId: string, filters?: CompletionRateFilters) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await completionRateApi.getCompletionRateTrends(developerId, filters)

      if (response.success && response.data) {
        completionRateData.value.trends[developerId] = response.data
      } else {
        error.value = response.message || 'Failed to fetch completion rate trends'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch completion rate trends'
    } finally {
      isLoading.value = false
    }
  }

  const fetchCompletionRateStats = async (filters?: CompletionRateFilters) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await completionRateApi.getCompletionRateStats(filters)

      if (response.success && response.data) {
        completionRateData.value.stats = response.data
      } else {
        error.value = response.message || 'Failed to fetch completion rate stats'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch completion rate stats'
    } finally {
      isLoading.value = false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    analytics,
    completionRateData,
    isLoading,
    error,
    fetchAnalytics,
    fetchTeamCompletionRates,
    fetchCompletionRateTrends,
    fetchCompletionRateStats,
    clearError
  }
})
