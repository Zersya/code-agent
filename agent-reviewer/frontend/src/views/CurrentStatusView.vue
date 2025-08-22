<template>
  <div class="px-4 sm:px-0">
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Current Status</h1>
        <p class="mt-1 text-sm text-gray-600">
          Real-time view of system status and ongoing reviews
        </p>
      </div>
      <BaseButton
        @click="refreshStatus"
        :loading="statusStore.isLoading"
        size="sm"
      >
        Refresh
      </BaseButton>
    </div>

    <!-- System Health Overview -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <BaseCard v-for="(status, service) in statusStore.systemHealth" :key="service">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div :class="[
              'w-8 h-8 rounded-lg flex items-center justify-center',
              status === 'healthy' ? 'bg-success-100' : 'bg-danger-100'
            ]">
              <svg v-if="status === 'healthy'" class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              <svg v-else class="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <h3 class="text-sm font-medium text-gray-900 capitalize">
              {{ formatServiceName(service) }}
            </h3>
            <p :class="[
              'text-sm font-medium',
              status === 'healthy' ? 'text-success-600' : 'text-danger-600'
            ]">
              {{ status }}
            </p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Queue Statistics -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <BaseCard title="Queue Statistics">
        <div class="space-y-4">
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">Total Jobs</span>
            <span class="text-lg font-semibold text-gray-900">{{ statusStore.queueStats.total }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">Pending</span>
            <span class="text-lg font-semibold text-warning-600">{{ statusStore.queueStats.pending }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">Processing</span>
            <span class="text-lg font-semibold text-primary-600">{{ statusStore.queueStats.processing }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">Completed</span>
            <span class="text-lg font-semibold text-success-600">{{ statusStore.queueStats.completed }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">Failed</span>
            <span class="text-lg font-semibold text-danger-600">{{ statusStore.queueStats.failed }}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-sm font-medium text-gray-600">Retrying</span>
            <span class="text-lg font-semibold text-warning-600">{{ statusStore.queueStats.retrying }}</span>
          </div>
        </div>
      </BaseCard>

      <BaseCard title="Queue Health">
        <div class="space-y-4">
          <!-- Queue health visualization -->
          <div class="relative pt-1">
            <div class="flex mb-2 items-center justify-between">
              <div>
                <span class="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-success-600 bg-success-200">
                  Success Rate
                </span>
              </div>
              <div class="text-right">
                <span class="text-xs font-semibold inline-block text-success-600">
                  {{ successRate }}%
                </span>
              </div>
            </div>
            <div class="overflow-hidden h-2 mb-4 text-xs flex rounded bg-success-200">
              <div 
                :style="{ width: successRate + '%' }" 
                class="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-success-500"
              ></div>
            </div>
          </div>

          <div class="text-sm text-gray-600">
            <p>Active processing capacity: <span class="font-medium">{{ statusStore.queueStats.processing }}/5</span></p>
            <p>Average processing time: <span class="font-medium">~15 minutes</span></p>
            <p>Last updated: <span class="font-medium">{{ lastUpdated }}</span></p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Recent Jobs -->
    <BaseCard title="Recent Jobs">
      <BaseTable
        :columns="jobColumns"
        :data="statusStore.queueJobs"
        :loading="statusStore.isLoading"
        empty-message="No recent jobs found"
      >
        <template #cell-repositoryUrl="{ value }">
          <a :href="value" target="_blank" class="text-primary-600 hover:text-primary-800 text-sm truncate max-w-xs block">
            {{ formatRepositoryUrl(value) }}
          </a>
        </template>

        <template #cell-status="{ value }">
          <span :class="[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            getStatusColor(value)
          ]">
            {{ value }}
          </span>
        </template>

        <template #cell-priority="{ value }">
          <span :class="[
            'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
            value <= 3 ? 'bg-danger-100 text-danger-800' :
            value <= 5 ? 'bg-warning-100 text-warning-800' :
            'bg-gray-100 text-gray-800'
          ]">
            {{ getPriorityLabel(value) }}
          </span>
        </template>

        <template #cell-attempts="{ value, item }">
          <span :class="[
            'text-sm',
            value >= item.maxAttempts ? 'text-danger-600 font-medium' : 'text-gray-600'
          ]">
            {{ value }}/{{ item.maxAttempts }}
          </span>
        </template>

        <template #cell-isReembedding="{ value }">
          <span v-if="value" class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
            Re-embedding
          </span>
          <span v-else class="text-gray-400 text-xs">Initial</span>
        </template>

        <template #cell-actions="{ item }">
          <div class="flex items-center space-x-1 flex-wrap gap-1">
            <!-- Cancel Button for pending/processing jobs -->
            <BaseButton
              v-if="item.status === 'pending' || item.status === 'processing'"
              @click="handleCancel(item.processingId)"
              :loading="cancelingJobs.has(item.processingId)"
              size="xs"
              variant="secondary"
              class="text-orange-600 border-orange-300 hover:bg-orange-50"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Cancel
            </BaseButton>

            <!-- Retry Button for failed jobs -->
            <BaseButton
              v-if="item.status === 'failed'"
              @click="handleRetry(item.processingId)"
              :loading="retryingJobs.has(item.processingId)"
              size="xs"
              variant="secondary"
              class="text-primary-600 border-primary-300 hover:bg-primary-50"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Retry
            </BaseButton>

            <!-- Re-embed Button for completed jobs -->
            <BaseButton
              v-if="item.status === 'completed'"
              @click="handleReembed(item.repositoryUrl, item.processingId)"
              :loading="reembeddingJobs.has(item.processingId)"
              size="xs"
              variant="secondary"
              class="text-green-600 border-green-300 hover:bg-green-50"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Re-embed
            </BaseButton>

            <!-- Delete Button for all jobs -->
            <BaseButton
              @click="confirmDelete(item.processingId)"
              :loading="deletingJobs.has(item.processingId)"
              size="xs"
              variant="secondary"
              class="text-red-600 border-red-300 hover:bg-red-50"
            >
              <svg class="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Delete
            </BaseButton>

            <!-- Show dash if no actions available -->
            <span v-if="item.status !== 'pending' && item.status !== 'processing' && item.status !== 'failed' && item.status !== 'completed'" class="text-gray-400 text-xs">-</span>
          </div>
        </template>
      </BaseTable>
    </BaseCard>

    <!-- Error Alert -->
    <BaseAlert
      v-if="statusStore.error"
      type="danger"
      :show="!!statusStore.error"
      title="Error"
      :message="statusStore.error"
      dismissible
      @dismiss="statusStore.clearError"
      class="mt-6"
    />

    <!-- Delete Confirmation Modal -->
    <BaseModal
      v-if="showDeleteConfirm"
      title="Confirm Delete"
      @close="cancelDelete"
    >
      <div class="p-6">
        <div class="flex items-center mb-4">
          <div class="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
            <svg class="h-6 w-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
        </div>
        <div class="text-center">
          <h3 class="text-lg font-medium text-gray-900 mb-2">Delete Job</h3>
          <p class="text-sm text-gray-500 mb-6">
            Are you sure you want to delete this job? This action cannot be undone and will permanently remove the job from the system.
          </p>
        </div>
        <div class="flex justify-end space-x-3">
          <BaseButton
            variant="secondary"
            @click="cancelDelete"
          >
            Cancel
          </BaseButton>
          <BaseButton
            variant="danger"
            @click="handleDelete"
            :loading="jobToDelete && deletingJobs.has(jobToDelete)"
          >
            Delete Job
          </BaseButton>
        </div>
      </div>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import { useStatusStore } from '@/stores/status'
import { repositoryApi } from '@/services/api'
import BaseCard from '@/components/BaseCard.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseTable from '@/components/BaseTable.vue'
import BaseAlert from '@/components/BaseAlert.vue'
import BaseModal from '@/components/BaseModal.vue'

const statusStore = useStatusStore()
const lastUpdated = ref(format(new Date(), 'HH:mm:ss'))
const retryingJobs = ref(new Set<string>())
const cancelingJobs = ref(new Set<string>())
const reembeddingJobs = ref(new Set<string>())
const deletingJobs = ref(new Set<string>())
const showDeleteConfirm = ref(false)
const jobToDelete = ref<string | null>(null)

let refreshInterval: NodeJS.Timeout

const jobColumns = [
  { key: 'repositoryUrl', label: 'Repository', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'priority', label: 'Priority', sortable: false },
  { key: 'attempts', label: 'Attempts', sortable: false },
  { key: 'isReembedding', label: 'Type', sortable: false },
  { key: 'createdAt', label: 'Created', sortable: false, type: 'date' as const, format: 'MMM dd, HH:mm' },
  { key: 'actions', label: 'Actions', sortable: false }
]

const successRate = computed(() => {
  const total = statusStore.queueStats.total
  if (total === 0) return 100
  const successful = statusStore.queueStats.completed
  return Math.round((successful / total) * 100)
})

const formatServiceName = (service: string) => {
  return service.replace(/([A-Z])/g, ' $1').trim()
}

const formatRepositoryUrl = (url: string) => {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.replace(/^\//, '').replace(/\.git$/, '')
  } catch {
    return url
  }
}

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-success-100 text-success-800'
    case 'processing':
      return 'bg-primary-100 text-primary-800'
    case 'pending':
      return 'bg-warning-100 text-warning-800'
    case 'failed':
      return 'bg-danger-100 text-danger-800'
    case 'retrying':
      return 'bg-warning-100 text-warning-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPriorityLabel = (priority: number) => {
  if (priority <= 3) return 'High'
  if (priority <= 5) return 'Medium'
  return 'Low'
}

const handleRetry = async (processingId: string) => {
  try {
    retryingJobs.value.add(processingId)

    const response = await repositoryApi.retryJob(processingId)

    if (response.success) {
      // Show success message
      statusStore.clearError()

      // Refresh the status to get updated job list
      await refreshStatus()
    } else {
      statusStore.error = response.message || 'Failed to retry job'
    }
  } catch (error: any) {
    console.error('Error retrying job:', error)
    statusStore.error = error.message || 'Failed to retry job'
  } finally {
    retryingJobs.value.delete(processingId)
  }
}

const handleCancel = async (processingId: string) => {
  try {
    cancelingJobs.value.add(processingId)

    const response = await repositoryApi.cancelJob(processingId)

    if (response.success) {
      // Show success message
      statusStore.clearError()

      // Refresh the status to get updated job list
      await refreshStatus()
    } else {
      statusStore.error = response.message || 'Failed to cancel job'
    }
  } catch (error: any) {
    console.error('Error canceling job:', error)
    statusStore.error = error.message || 'Failed to cancel job'
  } finally {
    cancelingJobs.value.delete(processingId)
  }
}

const handleReembed = async (repositoryUrl: string, processingId: string) => {
  try {
    reembeddingJobs.value.add(processingId)

    const response = await repositoryApi.reembedRepository(repositoryUrl, 'normal')

    if (response.success) {
      // Show success message
      statusStore.clearError()

      // Refresh the status to get updated job list
      await refreshStatus()
    } else {
      statusStore.error = response.message || 'Failed to start re-embedding'
    }
  } catch (error: any) {
    console.error('Error starting re-embedding:', error)
    statusStore.error = error.message || 'Failed to start re-embedding'
  } finally {
    reembeddingJobs.value.delete(processingId)
  }
}

const confirmDelete = (processingId: string) => {
  jobToDelete.value = processingId
  showDeleteConfirm.value = true
}

const handleDelete = async () => {
  if (!jobToDelete.value) return

  try {
    deletingJobs.value.add(jobToDelete.value)

    const response = await repositoryApi.deleteJob(jobToDelete.value)

    if (response.success) {
      // Show success message
      statusStore.clearError()

      // Refresh the status to get updated job list
      await refreshStatus()
    } else {
      statusStore.error = response.message || 'Failed to delete job'
    }
  } catch (error: any) {
    console.error('Error deleting job:', error)
    statusStore.error = error.message || 'Failed to delete job'
  } finally {
    if (jobToDelete.value) {
      deletingJobs.value.delete(jobToDelete.value)
    }
    showDeleteConfirm.value = false
    jobToDelete.value = null
  }
}

const cancelDelete = () => {
  showDeleteConfirm.value = false
  jobToDelete.value = null
}

const refreshStatus = async () => {
  await statusStore.refreshStatus()
  lastUpdated.value = format(new Date(), 'HH:mm:ss')
}

onMounted(async () => {
  await refreshStatus()
  
  // Auto-refresh every 30 seconds
  refreshInterval = setInterval(refreshStatus, 30000)
})

onUnmounted(() => {
  if (refreshInterval) {
    clearInterval(refreshInterval)
  }
})
</script>
