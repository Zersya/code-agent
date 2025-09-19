import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
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

    // Bug Fix Lead Time metrics
    bugFixLeadTime: {
      avgByDeveloper: [],
      trend: [],
      distribution: []
    },

    // Feature Completion Lead Time metrics
    featureCompletionLeadTime: {
      avgByDeveloper: [],
      trend: [],
      distribution: []
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
  }>({
    individualRates: {},
    trends: {}
  })

  const completionRateStats = ref<CompletionRateStatsResponse | null>(null)

  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchAnalytics = async (dateRange?: { from: string; to: string }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await analyticsApi.getAnalytics(dateRange)

      if (response.success && response.data) {
        // Merge to preserve defaults like bugFixLeadTime when backend doesn't send it yet
        analytics.value = {
          ...analytics.value,
          ...response.data,
          bugFixLeadTime: (response.data as any).bugFixLeadTime ?? analytics.value.bugFixLeadTime,
          featureCompletionLeadTime: (response.data as any).featureCompletionLeadTime ?? analytics.value.featureCompletionLeadTime
        } as any
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
    console.log('🏪 Store: fetchTeamCompletionRates called with filters:', filters)
    isLoading.value = true
    error.value = null

    try {
      console.log('🌐 Store: Making API call to getTeamCompletionRates...')
      const response = await completionRateApi.getTeamCompletionRates(filters)
      console.log('📡 Store: API response received:', response)

      if (response.success && response.data) {
        completionRateData.value.teamRates = response.data
        console.log('✅ Store: Team rates updated:', completionRateData.value.teamRates)
      } else {
        error.value = response.message || 'Failed to fetch team completion rates'
        console.error('❌ Store: API response error:', response)
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch team completion rates'
      console.error('💥 Store: Exception caught:', err)
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

  const fetchCompletionRateStats = async (filters?: { month?: string; projectId?: number; dateFrom?: string; dateTo?: string }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await completionRateApi.getCompletionRateStats(filters)

      if (response.success && response.data) {
        completionRateStats.value = response.data
      } else {
        error.value = response.message || 'Failed to fetch completion rate stats'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch completion rate stats'
    } finally {
      isLoading.value = false
    }
  }

  // Derived stats computed from teamRates only (no /stats API)
  const derivedCompletionStats = computed(() => {
    const team = completionRateData.value.teamRates
    const developers = team?.developers || []

    const totalDevelopers = developers.length
    const totalTasks = developers.reduce((acc, d) => acc + (d.totalTasks || 0), 0)
    const totalCompletedTasks = developers.reduce((acc, d) => acc + (d.completedTasks || 0), 0)
    const overallCompletionRate = totalTasks > 0 ? (totalCompletedTasks / totalTasks) * 100 : 0

    const topPerformers = [...developers]
      .sort((a, b) => (b.completionRate - a.completionRate) || (b.totalTasks - a.totalTasks))
      .map(d => ({ username: d.username, completionRate: d.completionRate, totalTasks: d.totalTasks }))

    return {
      totalDevelopers,
      totalTasks,
      totalCompletedTasks,
      overallCompletionRate,
      topPerformers,
      monthlyTrends: completionRateStats.value?.monthlyTrends || []
    }
  })

  const clearError = () => {
    error.value = null
  }

  return {
    analytics,
    completionRateData,
    derivedCompletionStats,
    isLoading,
    error,
    fetchAnalytics,
    fetchTeamCompletionRates,
    fetchCompletionRateTrends,
    fetchCompletionRateStats,
    completionRateStats,
    clearError
  }
})
