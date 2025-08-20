<template>
  <div class="px-4 sm:px-0">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Review History</h1>
      <p class="mt-1 text-sm text-gray-600">
        Complete history of all merge request reviews
      </p>
    </div>

    <!-- Filters and Search -->
    <BaseCard class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <BaseInput
          v-model="filters.search"
          type="search"
          placeholder="Search by project or MR ID..."
          @input="debouncedSearch"
        />
        
        <select
          v-model="filters.projectId"
          class="input"
          @change="applyFilters"
        >
          <option value="">All Projects</option>
          <option v-for="project in projects" :key="project.projectId" :value="project.projectId">
            {{ project.name }}
          </option>
        </select>

        <BaseInput
          v-model="filters.dateFrom"
          type="date"
          label="From Date"
          @change="applyFilters"
        />

        <BaseInput
          v-model="filters.dateTo"
          type="date"
          label="To Date"
          @change="applyFilters"
        />
      </div>

      <div class="mt-4 flex justify-between items-center">
        <div class="flex space-x-2">
          <BaseButton
            variant="secondary"
            size="sm"
            @click="clearFilters"
          >
            Clear Filters
          </BaseButton>
          <BaseButton
            variant="primary"
            size="sm"
            @click="exportReviews"
            :loading="isExporting"
          >
            Export CSV
          </BaseButton>
        </div>
        
        <div class="text-sm text-gray-500">
          {{ reviewsStore.pagination.total }} total reviews
        </div>
      </div>
    </BaseCard>

    <!-- Reviews Table -->
    <BaseCard>
      <BaseTable
        :columns="columns"
        :data="reviewsStore.reviews"
        :loading="reviewsStore.isLoading"
        :sort-by="sortBy"
        :sort-order="sortOrder"
        empty-message="No reviews found matching your criteria"
        @sort="handleSort"
      >
        <template #cell-projectName="{ value }">
          <span class="font-medium text-gray-900">{{ value || 'Unknown Project' }}</span>
        </template>

        <template #cell-mergeRequestIid="{ value, item }">
          <a
            v-if="item.projectId"
            :href="`https://gitlab.com/project/${item.projectId}/-/merge_requests/${value}`"
            target="_blank"
            class="text-primary-600 hover:text-primary-800 font-medium"
          >
            !{{ value }}
          </a>
          <span v-else class="font-medium">!{{ value }}</span>
        </template>

        <template #cell-status="{ value }">
          <span :class="[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            value === 'approved' ? 'bg-success-100 text-success-800' :
            value === 'rejected' ? 'bg-danger-100 text-danger-800' :
            'bg-warning-100 text-warning-800'
          ]">
            {{ value }}
          </span>
        </template>

        <template #cell-reviewerType="{ value }">
          <span :class="[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            value === 'auto' ? 'bg-primary-100 text-primary-800' : 'bg-gray-100 text-gray-800'
          ]">
            {{ value === 'auto' ? 'Automated' : 'Manual' }}
          </span>
        </template>

        <template #cell-lastReviewedCommitSha="{ value }">
          <code class="text-xs bg-gray-100 px-2 py-1 rounded">{{ value.substring(0, 8) }}</code>
        </template>

        <template #cell-criticalIssuesCount="{ value }">
          <span v-if="value > 0" class="text-danger-600 font-medium">{{ value }}</span>
          <span v-else class="text-gray-400">0</span>
        </template>
      </BaseTable>

      <!-- Pagination -->
      <BasePagination
        v-if="reviewsStore.pagination.totalPages > 1"
        :current-page="reviewsStore.pagination.page"
        :total-pages="reviewsStore.pagination.totalPages"
        :total="reviewsStore.pagination.total"
        :per-page="reviewsStore.pagination.limit"
        @page-change="handlePageChange"
      />
    </BaseCard>

    <!-- Error Alert -->
    <BaseAlert
      v-if="reviewsStore.error"
      type="danger"
      :show="!!reviewsStore.error"
      title="Error"
      :message="reviewsStore.error"
      dismissible
      @dismiss="reviewsStore.clearError"
      class="mt-6"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useReviewsStore } from '@/stores/reviews'
import { projectsApi } from '@/services/api'
import type { Project } from '@/types'
import BaseCard from '@/components/BaseCard.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseTable from '@/components/BaseTable.vue'
import BasePagination from '@/components/BasePagination.vue'
import BaseAlert from '@/components/BaseAlert.vue'

const reviewsStore = useReviewsStore()
const projects = ref<Project[]>([])
const isExporting = ref(false)

const filters = reactive({
  search: '',
  projectId: '',
  dateFrom: '',
  dateTo: ''
})

const sortBy = ref('reviewedAt')
const sortOrder = ref<'asc' | 'desc'>('desc')

const columns = [
  { key: 'projectName', label: 'Project', sortable: true },
  { key: 'mergeRequestIid', label: 'MR', sortable: true },
  { key: 'lastReviewedCommitSha', label: 'Commit', sortable: false },
  { key: 'reviewedAt', label: 'Reviewed At', sortable: true, type: 'date' as const },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'criticalIssuesCount', label: 'Issues', sortable: true, type: 'number' as const },
  { key: 'reviewerType', label: 'Type', sortable: true }
]

// Debounced search
let searchTimeout: NodeJS.Timeout
const debouncedSearch = () => {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    applyFilters()
  }, 500)
}

const applyFilters = async () => {
  await reviewsStore.fetchReviews({
    page: 1,
    limit: reviewsStore.pagination.limit,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    ...filters as any
  })
}

const clearFilters = async () => {
  Object.assign(filters, {
    search: '',
    projectId: '',
    dateFrom: '',
    dateTo: ''
  })
  await applyFilters()
}

const handleSort = async (column: string) => {
  if (sortBy.value === column) {
    sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc'
  } else {
    sortBy.value = column
    sortOrder.value = 'asc'
  }
  await applyFilters()
}

const handlePageChange = async (page: number): Promise<void> => {
  await reviewsStore.fetchReviews({
    page,
    limit: reviewsStore.pagination.limit,
    sortBy: sortBy.value,
    sortOrder: sortOrder.value,
    ...filters as any
  })
}

const exportReviews = async () => {
  isExporting.value = true
  try {
    await reviewsStore.exportReviews(filters as any)
  } finally {
    isExporting.value = false
  }
}

const loadProjects = async () => {
  try {
    const response = await projectsApi.getProjects()
    if (response.success && response.data) {
      projects.value = response.data
    }
  } catch (error) {
    console.error('Failed to load projects:', error)
  }
}

onMounted(async () => {
  await Promise.all([
    loadProjects(),
    applyFilters()
  ])
})
</script>
