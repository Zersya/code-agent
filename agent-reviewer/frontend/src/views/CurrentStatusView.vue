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
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import { useStatusStore } from '@/stores/status'
import BaseCard from '@/components/BaseCard.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseTable from '@/components/BaseTable.vue'
import BaseAlert from '@/components/BaseAlert.vue'

const statusStore = useStatusStore()
const lastUpdated = ref(format(new Date(), 'HH:mm:ss'))

let refreshInterval: NodeJS.Timeout

const jobColumns = [
  { key: 'repositoryUrl', label: 'Repository', sortable: false },
  { key: 'status', label: 'Status', sortable: false },
  { key: 'priority', label: 'Priority', sortable: false },
  { key: 'attempts', label: 'Attempts', sortable: false },
  { key: 'isReembedding', label: 'Type', sortable: false },
  { key: 'createdAt', label: 'Created', sortable: false, type: 'date' as const, format: 'MMM dd, HH:mm' }
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
