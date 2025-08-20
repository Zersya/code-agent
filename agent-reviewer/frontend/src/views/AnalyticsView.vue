<template>
  <div class="px-4 sm:px-0">
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Analytics</h1>
        <p class="mt-1 text-sm text-gray-600">
          Review trends and performance metrics
        </p>
      </div>
      <div class="flex space-x-3">
        <select
          v-model="selectedDateRange"
          @change="handleDateRangeChange"
          class="input"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="custom">Custom range</option>
        </select>
        <BaseButton
          @click="refreshAnalytics"
          :loading="analyticsStore.isLoading"
          size="sm"
        >
          Refresh
        </BaseButton>
      </div>
    </div>

    <!-- Custom Date Range -->
    <BaseCard v-if="selectedDateRange === 'custom'" class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <BaseInput
          v-model="customDateRange.from"
          type="date"
          label="From Date"
        />
        <BaseInput
          v-model="customDateRange.to"
          type="date"
          label="To Date"
        />
        <BaseButton
          @click="applyCustomDateRange"
          variant="primary"
          size="md"
        >
          Apply
        </BaseButton>
      </div>
    </BaseCard>

    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Reviews</p>
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.totalReviews.toLocaleString() }}</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Approval Rate</p>
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.approvalRate.toFixed(1) }}%</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Avg Review Time</p>
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.averageReviewTime }}m</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Critical Issues</p>
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.criticalIssuesTotal.toLocaleString() }}</p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <!-- Review Trends Chart -->
      <BaseCard title="Review Trends">
        <div class="h-64 flex items-center justify-center">
          <div v-if="analyticsStore.analytics.reviewTrends.length === 0" class="text-center text-gray-500">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No trend data available</p>
          </div>
          <div v-else class="w-full">
            <!-- Simple trend visualization -->
            <div class="space-y-2">
              <div v-for="trend in recentTrends" :key="trend.date" class="flex items-center justify-between">
                <span class="text-sm text-gray-600">{{ formatTrendDate(trend.date) }}</span>
                <div class="flex items-center space-x-2">
                  <div class="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      class="bg-primary-600 h-2 rounded-full" 
                      :style="{ width: getTrendWidth(trend.reviews) + '%' }"
                    ></div>
                  </div>
                  <span class="text-sm font-medium text-gray-900">{{ trend.reviews }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- Top Projects -->
      <BaseCard title="Top Projects">
        <div class="space-y-3">
          <div v-if="analyticsStore.analytics.topProjects.length === 0" class="text-center text-gray-500 py-8">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>No project data available</p>
          </div>
          <div v-else>
            <div v-for="project in analyticsStore.analytics.topProjects.slice(0, 5)" :key="project.projectName" class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ project.projectName || 'Unknown Project' }}</p>
                <p class="text-xs text-gray-500">{{ project.approvalRate.toFixed(1) }}% approval rate</p>
              </div>
              <div class="ml-4 flex-shrink-0">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {{ project.reviewCount }} reviews
                </span>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Activity Summary -->
    <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <BaseCard title="Today">
        <div class="text-center">
          <p class="text-3xl font-bold text-primary-600">{{ analyticsStore.analytics.reviewsToday }}</p>
          <p class="text-sm text-gray-600">Reviews completed</p>
        </div>
      </BaseCard>

      <BaseCard title="This Week">
        <div class="text-center">
          <p class="text-3xl font-bold text-primary-600">{{ analyticsStore.analytics.reviewsThisWeek }}</p>
          <p class="text-sm text-gray-600">Reviews completed</p>
        </div>
      </BaseCard>

      <BaseCard title="This Month">
        <div class="text-center">
          <p class="text-3xl font-bold text-primary-600">{{ analyticsStore.analytics.reviewsThisMonth }}</p>
          <p class="text-sm text-gray-600">Reviews completed</p>
        </div>
      </BaseCard>
    </div>

    <!-- Error Alert -->
    <BaseAlert
      v-if="analyticsStore.error"
      type="danger"
      :show="!!analyticsStore.error"
      title="Error"
      :message="analyticsStore.error"
      dismissible
      @dismiss="analyticsStore.clearError"
      class="mt-6"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { format, subDays } from 'date-fns'
import { useAnalyticsStore } from '@/stores/analytics'
import BaseCard from '@/components/BaseCard.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseAlert from '@/components/BaseAlert.vue'

const analyticsStore = useAnalyticsStore()
const selectedDateRange = ref('30')

const customDateRange = reactive({
  from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  to: format(new Date(), 'yyyy-MM-dd')
})

const recentTrends = computed(() => {
  return analyticsStore.analytics.reviewTrends.slice(-7) // Last 7 data points
})

const maxTrendValue = computed(() => {
  return Math.max(...analyticsStore.analytics.reviewTrends.map(t => t.reviews), 1)
})

const getTrendWidth = (value: number) => {
  return (value / maxTrendValue.value) * 100
}

const formatTrendDate = (dateStr: string) => {
  return format(new Date(dateStr), 'MMM dd')
}

const handleDateRangeChange = () => {
  if (selectedDateRange.value !== 'custom') {
    const days = parseInt(selectedDateRange.value)
    const from = format(subDays(new Date(), days), 'yyyy-MM-dd')
    const to = format(new Date(), 'yyyy-MM-dd')
    
    analyticsStore.fetchAnalytics({ from, to })
  }
}

const applyCustomDateRange = () => {
  analyticsStore.fetchAnalytics({
    from: customDateRange.from,
    to: customDateRange.to
  })
}

const refreshAnalytics = () => {
  if (selectedDateRange.value === 'custom') {
    applyCustomDateRange()
  } else {
    handleDateRangeChange()
  }
}

onMounted(() => {
  handleDateRangeChange()
})
</script>
