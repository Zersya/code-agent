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
    <BaseCard class="bg-white shadow-sm">
      <div class="px-6 py-5">
        <div class="mb-4">
          <h3 class="text-lg font-medium text-gray-900">Filters</h3>
          <p class="mt-1 text-sm text-gray-500">Filter merge requests by project, author, status, or search terms</p>
        </div>
        
        <div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          <!-- Project Filter -->
          <div class="space-y-1">
            <label for="project" class="block text-sm font-medium text-gray-700">
              <svg class="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
              Project
            </label>
            <div class="relative">
              <select
                id="project"
                v-model="filters.projectId"
                @change="applyFilters"
                :disabled="projectsStore.isLoading"
                class="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm transition-colors duration-200 disabled:bg-gray-50 disabled:text-gray-500"
              >
                <option :value="undefined">All Projects</option>
                <option 
                  v-for="project in uniqueProjects" 
                  :key="project.projectId" 
                  :value="project.projectId"
                >
                  {{ project.name }}
                </option>
              </select>
              <div v-if="projectsStore.isLoading" class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg class="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
            <div v-if="projectsStore.error" class="flex items-center justify-between text-xs text-red-600 mt-1">
              <span>{{ projectsStore.error }}</span>
              <button 
                @click="retryFetchProjects" 
                class="ml-2 px-2 py-1 text-xs bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors duration-200"
                :disabled="projectsStore.isLoading"
              >
                {{ projectsStore.isLoading ? 'Retrying...' : 'Retry' }}
              </button>
            </div>
          </div>

          <!-- Author Filter -->
          <div class="space-y-1">
            <label for="author" class="block text-sm font-medium text-gray-700">
              <svg class="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Author
            </label>
            <div class="relative">
              <input
                id="author"
                v-model="filters.authorUsername"
                @input="debouncedApplyFilters"
                type="text"
                placeholder="Enter username..."
                class="block w-full pl-3 pr-3 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm transition-colors duration-200 placeholder-gray-400"
              />
              <div v-if="filters.authorUsername && mrStore.isLoading" class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                <svg class="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              </div>
            </div>
          </div>

          <!-- Status Filter -->
          <div class="space-y-1">
            <label for="status" class="block text-sm font-medium text-gray-700">
              <svg class="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Status
            </label>
            <select
              id="status"
              v-model="filters.status"
              @change="applyFilters"
              class="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm transition-colors duration-200"
            >
              <option value="">All Statuses</option>
              <option value="opened" class="text-blue-600">🔵 Open</option>
              <option value="merged" class="text-green-600">🟢 Merged</option>
              <option value="closed" class="text-red-600">🔴 Closed</option>
            </select>
          </div>

          <!-- Search Filter -->
          <div class="space-y-1">
            <label for="search" class="block text-sm font-medium text-gray-700">
              <svg class="inline w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              Search
            </label>
            <div class="relative">
              <input
                id="search"
                v-model="filters.search"
                @input="debouncedApplyFilters"
                type="text"
                placeholder="Title, MR ID, or description..."
                class="block w-full pl-3 pr-10 py-2.5 text-base border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg shadow-sm transition-colors duration-200 placeholder-gray-400"
              />
              <div v-if="filters.search" class="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  @click="clearSearch"
                  class="text-gray-400 hover:text-gray-600 focus:outline-none"
                  type="button"
                >
                  <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter Actions -->
        <div class="mt-6 flex items-center justify-between">
          <div class="flex items-center space-x-4">
            <button
              @click="clearAllFilters"
              :disabled="!hasActiveFilters"
              class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200"
            >
              <svg class="-ml-0.5 mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Clear Filters
            </button>
            <span v-if="hasActiveFilters" class="text-sm text-gray-500">
              {{ activeFiltersCount }} filter{{ activeFiltersCount !== 1 ? 's' : '' }} active
            </span>
          </div>
          <div class="text-sm text-gray-500">
            {{ mrStore.pagination.total || 0 }} merge request{{ (mrStore.pagination.total || 0) !== 1 ? 's' : '' }} found
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
            :current-page="currentPage"
            :total-pages="mrStore.pagination.totalPages"
            :total="mrStore.pagination.total"
            :per-page="mrStore.pagination.limit"
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
import { useProjectsStore } from '@/stores/projects'
import BaseCard from '@/components/BaseCard.vue'
import BaseAlert from '@/components/BaseAlert.vue'
import BasePagination from '@/components/BasePagination.vue'
import MROverviewCards from '@/components/MROverviewCards.vue'
import MRTable from '@/components/MRTable.vue'
import MRTrendChart from '@/components/MRTrendChart.vue'
import type { MergeRequestListParams } from '@/types'

const mrStore = useMergeRequestStore()
const analyticsStore = useAnalyticsStore()
const projectsStore = useProjectsStore()

const filters = ref<MergeRequestListParams>({
  page: 1,
  limit: 20,
  projectId: undefined,
  authorUsername: '',
  status: '',
  search: ''
})

const currentPage = ref(1)

// Filter helper computed properties
const hasActiveFilters = computed(() => {
  return !!(filters.value.projectId || 
           filters.value.authorUsername || 
           filters.value.status || 
           filters.value.search)
})

const activeFiltersCount = computed(() => {
  let count = 0
  if (filters.value.projectId) count++
  if (filters.value.authorUsername) count++
  if (filters.value.status) count++
  if (filters.value.search) count++
  return count
})

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
  return analyticsStore.analytics.mergeRequestMetrics?.mergeTimeTrends || []
})

const uniqueProjects = computed(() => {
  const projects = projectsStore.projects
  const seen = new Set()
  return projects.filter(project => {
    if (seen.has(project.projectId)) {
      return false
    }
    seen.add(project.projectId)
    return true
  })
})

let debounceTimer: ReturnType<typeof setTimeout> | null = null

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

// Filter action methods
const clearSearch = () => {
  filters.value.search = ''
  applyFilters()
}

const clearAllFilters = () => {
  filters.value = {
    page: 1,
    limit: 20,
    projectId: undefined,
    authorUsername: '',
    status: '',
    search: ''
  }
  currentPage.value = 1
  applyFilters()
}

const retryFetchProjects = () => {
  projectsStore.fetchProjects()
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
    projectsStore.fetchProjects(),
    mrStore.fetchMergeRequests(filters.value),
    analyticsStore.fetchAnalytics()
  ])
})
</script>
