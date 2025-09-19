<template>
  <BaseCard title="Embedding Queue Status">
    <div v-if="isLoading" class="flex justify-center py-8">
      <div class="animate-spin h-8 w-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
    </div>

    <div v-else-if="queueData" class="space-y-6">
      <!-- Queue Statistics -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="text-center">
          <div class="text-2xl font-bold text-gray-900">{{ queueData.stats.total }}</div>
          <div class="text-sm text-gray-500">Total Jobs</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-blue-600">{{ queueData.stats.pending }}</div>
          <div class="text-sm text-gray-500">Pending</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-yellow-600">{{ queueData.stats.processing }}</div>
          <div class="text-sm text-gray-500">Processing</div>
        </div>
        <div class="text-center">
          <div class="text-2xl font-bold text-green-600">{{ queueData.stats.completed }}</div>
          <div class="text-sm text-gray-500">Completed</div>
        </div>
      </div>

      <!-- Recent Jobs -->
      <div>
        <h4 class="text-lg font-medium text-gray-900 mb-4">Recent Jobs</h4>
        <div v-if="queueData.jobs.length === 0" class="text-center py-4 text-gray-500">
          No recent jobs
        </div>
        <div v-else class="space-y-3">
          <div
            v-for="job in queueData.jobs"
            :key="job.id"
            class="border border-gray-200 rounded-lg p-4"
          >
            <div class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center space-x-3">
                  <div :class="getJobStatusClasses(job.status)" class="px-2 py-1 rounded-full text-xs font-medium">
                    {{ getJobStatusText(job.status) }}
                  </div>
                  <code class="text-sm font-mono text-gray-600 truncate">
                    {{ job.processingId }}
                  </code>
                </div>
                <div class="mt-2">
                  <p class="text-sm text-gray-600 truncate">
                    {{ job.repositoryUrl }}
                  </p>
                  <div class="flex items-center space-x-4 mt-1 text-xs text-gray-500">
                    <span>Attempts: {{ job.attempts }}</span>
                    <span>Created: {{ formatRelativeTime(job.createdAt) }}</span>
                    <span v-if="job.updatedAt !== job.createdAt">
                      Updated: {{ formatRelativeTime(job.updatedAt) }}
                    </span>
                  </div>
                </div>
              </div>
              <div class="ml-4">
                <BaseButton
                  size="sm"
                  variant="secondary"
                  @click="$emit('viewJob', job.processingId)"
                >
                  View
                </BaseButton>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Pagination -->
      <div v-if="pagination && pagination.totalPages > 1" class="flex justify-center">
        <BasePagination
          :current-page="pagination.page"
          :total-pages="pagination.totalPages"
          :total="pagination.total"
          :per-page="pagination.limit"
          @page-change="handlePageChange"
        />
      </div>

      <!-- Refresh Button -->
      <div class="flex justify-end">
        <BaseButton
          variant="secondary"
          @click="refreshData"
          :loading="isRefreshing"
        >
          Refresh
        </BaseButton>
      </div>
    </div>

    <BaseAlert
      v-if="errorMessage"
      type="error"
      :message="errorMessage"
      class="mt-4"
      @dismiss="errorMessage = ''"
    />
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import BaseCard from './BaseCard.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'
import BasePagination from './BasePagination.vue'
import { repositoryApi } from '@/services/api'
import type { QueueStats, QueueJob } from '@/types'

interface QueueData {
  stats: QueueStats
  jobs: QueueJob[]
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

const queueData = ref<QueueData | null>(null)
const pagination = ref<Pagination | null>(null)
const isLoading = ref(false)
const isRefreshing = ref(false)
const errorMessage = ref('')
const currentPage = ref(1)

const getJobStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    retrying: 'Retrying'
  }
  return statusMap[status] || status
}

const getJobStatusClasses = (status: string): string => {
  const classMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    retrying: 'bg-orange-100 text-orange-800'
  }
  return classMap[status] || 'bg-gray-100 text-gray-800'
}

const formatRelativeTime = (dateString: string): string => {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true })
}

const fetchQueueData = async (page: number = 1) => {
  const loadingRef = page === 1 ? isLoading : isRefreshing
  loadingRef.value = true
  errorMessage.value = ''

  try {
    const response = await repositoryApi.getQueueStatus({ page, limit: 10 })
    
    if (response.data) {
      queueData.value = response.data
      
      if (response.pagination) {
        pagination.value = {
          page: response.pagination.page,
          limit: response.pagination.limit,
          total: response.pagination.total,
          totalPages: Math.ceil(response.pagination.total / response.pagination.limit)
        }
      }
    }
  } catch (error: any) {
    console.error('Error fetching queue data:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to fetch queue data'
  } finally {
    loadingRef.value = false
  }
}

const refreshData = () => {
  fetchQueueData(currentPage.value)
}

const handlePageChange = (page: number) => {
  currentPage.value = page
  fetchQueueData(page)
}

onMounted(() => {
  fetchQueueData()
})
</script>
