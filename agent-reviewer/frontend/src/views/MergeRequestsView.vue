<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="md:flex md:items-center md:justify-between">
      <div class="flex-1 min-w-0">
        <h2 class="text-2xl font-bold leading-7 text-gray-900 sm:text-3xl sm:truncate">
          Merge Request Tracking
        </h2>
        <p class="mt-1 text-sm text-gray-500">
          Track and analyze merge request activity across your projects
        </p>
      </div>
      <div class="mt-4 flex md:mt-0 md:ml-4">
        <button
          @click="exportData"
          :disabled="mrStore.isLoading"
          class="ml-3 inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
        >
          <svg class="-ml-1 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Export CSV
        </button>
      </div>
    </div>

    <!-- Error Alert -->
    <BaseAlert v-if="mrStore.error" type="error" @dismiss="mrStore.clearError">
      {{ mrStore.error }}
    </BaseAlert>

    <!-- Overview Cards -->
    <MROverviewCards :metrics="overviewMetrics" />

    <!-- Charts Section -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <MRTrendChart
        :data="analyticsStore.analytics.mergeRequestMetrics?.dailyMRCreation || []"
        title="Daily MR Creation"
        color="#3B82F6"
        label="MRs Created"
      />
      <MRTrendChart
        :data="mergeTimeTrends"
        title="Merge Time Trends"
        color="#10B981"
        label="Avg Hours"
      />
    </div>

    <!-- Filters -->
    <BaseCard class="bg-white">
      <div class="px-4 py-5 sm:p-6">
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label for="project" class="block text-sm font-medium text-gray-700">Project</label>
            <select
              id="project"
              v-model="filters.project_id"
              @change="applyFilters"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">All Projects</option>
              <!-- Projects would be loaded from store -->
            </select>
          </div>
          <div>
            <label for="author" class="block text-sm font-medium text-gray-700">Author</label>
            <input
              id="author"
              v-model="filters.author_username"
              @input="debouncedApplyFilters"
              type="text"
              placeholder="Username"
              class="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            />
          </div>
          <div>
            <label for="status" class="block text-sm font-medium text-gray-700">Status</label>
            <select
              id="status"
              v-model="filters.status"
              @change="applyFilters"
              class="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="opened">Open</option>
              <option value="merged">Merged</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label for="search" class="block text-sm font-medium text-gray-700">Search</label>
            <input
              id="search"
              v-model="filters.search"
              @input="debouncedApplyFilters"
              type="text"
              placeholder="Title or MR ID"
              class="mt-1 focus:ring-blue-500 focus:border-blue-500 block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
            />
          </div>
        </div>
      </div>
    </BaseCard>

    <!-- MR Table -->
    <BaseCard class="bg-white">
      <div class="px-4 py-5 sm:p-6">
        <MRTable
          :merge-requests="mrStore.mergeRequests"
          :loading="mrStore.isLoading"
          @sort="handleSort"
        />
        
        <!-- Pagination -->
        <div class="mt-6">
          <BasePagination
            v-model:page="currentPage"
            :total-pages="mrStore.pagination.totalPages"
            :has-next="mrStore.pagination.hasNext"
            :has-prev="mrStore.pagination.hasPrev"
            @page-change="handlePageChange"
          />
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMergeRequestStore } from '@/stores/merge-requests'
import { useAnalyticsStore } from '@/stores/analytics'
import BaseCard from '@/components/BaseCard.vue'
import BaseAlert from '@/components/BaseAlert.vue'
import BasePagination from '@/components/BasePagination.vue'
import MROverviewCards from '@/components/MROverviewCards.vue'
import MRTable from '@/components/MRTable.vue'
import MRTrendChart from '@/components/MRTrendChart.vue'
import type { MergeRequestListParams } from '@/types'

const mrStore = useMergeRequestStore()
const analyticsStore = useAnalyticsStore()

const filters = ref<MergeRequestListParams>({
  page: 1,
  limit: 20
})

const currentPage = ref(1)

const overviewMetrics = computed(() => {
  const mrMetrics = analyticsStore.analytics.mergeRequestMetrics
  return {
    totalMRs: mrMetrics?.totalMRs || 0,
    mergedMRs: mrMetrics?.mergedMRs || 0,
    successRate: mrMetrics?.successRate || 0,
    avgMergeTime: mrMetrics?.avgMergeTime || 0
  }
})

const mergeTimeTrends = computed(() => {
  // This would be implemented with actual merge time trend data
  return []
})

let debounceTimer: number | null = null

const debouncedApplyFilters = () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(() => {
    applyFilters()
  }, 500)
}

const applyFilters = () => {
  filters.value.page = 1
  currentPage.value = 1
  mrStore.updateFilters(filters.value)
  mrStore.fetchMergeRequests()
}

const handleSort = (field: string) => {
  // Implement sorting logic
  console.log('Sort by:', field)
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  filters.value.page = page
  mrStore.updateFilters(filters.value)
  mrStore.fetchMergeRequests()
}

const exportData = () => {
  mrStore.exportMergeRequests(filters.value)
}

// Watch for page changes from pagination component
watch(currentPage, (newPage) => {
  if (newPage !== filters.value.page) {
    handlePageChange(newPage)
  }
})

onMounted(async () => {
  // Load initial data
  await Promise.all([
    mrStore.fetchMergeRequests(filters.value),
    analyticsStore.fetchAnalytics()
  ])
})
</script>
