<template>
  <BaseCard title="Repository Embedding Status">
    <div v-if="!processingId" class="text-center py-8">
      <p class="text-gray-500">No embedding process to track</p>
    </div>

    <div v-else class="space-y-6">
      <!-- Processing ID -->
      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Processing ID
        </label>
        <div class="flex items-center space-x-2">
          <code class="bg-gray-100 px-2 py-1 rounded text-sm font-mono">
            {{ processingId }}
          </code>
          <BaseButton
            size="sm"
            variant="secondary"
            @click="copyToClipboard(processingId)"
          >
            Copy
          </BaseButton>
        </div>
      </div>

      <!-- Status Display -->
      <div v-if="status">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Current Status
        </label>
        <div class="flex items-center space-x-3">
          <div :class="statusClasses" class="px-3 py-1 rounded-full text-sm font-medium">
            {{ statusText }}
          </div>
          <div v-if="isProcessing" class="animate-spin h-4 w-4 border-2 border-primary-600 border-t-transparent rounded-full"></div>
        </div>
      </div>

      <!-- Repository URL -->
      <div v-if="status?.repositoryUrl">
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Repository URL
        </label>
        <a
          :href="status.repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary-600 hover:text-primary-800 underline break-all"
        >
          {{ status.repositoryUrl }}
        </a>
      </div>

      <!-- Progress Information -->
      <div v-if="status" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Created At
          </label>
          <p class="text-sm text-gray-600">
            {{ formatDate(status.createdAt) }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Last Updated
          </label>
          <p class="text-sm text-gray-600">
            {{ formatDate(status.updatedAt) }}
          </p>
        </div>

        <div v-if="status.startedAt">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Started At
          </label>
          <p class="text-sm text-gray-600">
            {{ formatDate(status.startedAt) }}
          </p>
        </div>

        <div v-if="status.completedAt">
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Completed At
          </label>
          <p class="text-sm text-gray-600">
            {{ formatDate(status.completedAt) }}
          </p>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">
            Attempts
          </label>
          <p class="text-sm text-gray-600">
            {{ status.attempts }} / {{ status.maxAttempts }}
          </p>
        </div>
      </div>

      <!-- Error Message -->
      <BaseAlert
        v-if="status?.error"
        type="danger"
        :message="status.error"
        class="mt-4"
      />

      <!-- Actions -->
      <div class="flex justify-end space-x-3">
        <BaseButton
          variant="secondary"
          @click="refreshStatus"
          :loading="isRefreshing"
        >
          Refresh Status
        </BaseButton>
        <BaseButton
          v-if="canRetry"
          variant="primary"
          @click="$emit('retry', processingId)"
        >
          Retry
        </BaseButton>
      </div>
    </div>

    <BaseAlert
      v-if="errorMessage"
      type="danger"
      :message="errorMessage"
      class="mt-4"
      @dismiss="errorMessage = ''"
    />
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { format } from 'date-fns'
import BaseCard from './BaseCard.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'
import { repositoryApi } from '@/services/api'
import type { RepositoryEmbeddingStatus } from '@/types'

interface Props {
  processingId?: string
  autoRefresh?: boolean
  refreshInterval?: number
}

const props = withDefaults(defineProps<Props>(), {
  autoRefresh: true,
  refreshInterval: 5000 // 5 seconds
})

const emit = defineEmits<{
  retry: [processingId: string]
  statusUpdated: [status: RepositoryEmbeddingStatus]
}>()

const status = ref<RepositoryEmbeddingStatus | null>(null)
const isRefreshing = ref(false)
const errorMessage = ref('')
let refreshTimer: NodeJS.Timeout | null = null

const statusText = computed(() => {
  if (!status.value) return ''
  
  const statusMap = {
    pending: 'Pending',
    processing: 'Processing',
    completed: 'Completed',
    failed: 'Failed',
    retrying: 'Retrying'
  }
  
  return statusMap[status.value.status] || status.value.status
})

const statusClasses = computed(() => {
  if (!status.value) return ''
  
  const classMap = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
    retrying: 'bg-orange-100 text-orange-800'
  }
  
  return classMap[status.value.status] || 'bg-gray-100 text-gray-800'
})

const isProcessing = computed(() => {
  return status.value?.status === 'processing' || status.value?.status === 'retrying'
})

const canRetry = computed(() => {
  return status.value?.status === 'failed'
})

const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM dd, yyyy HH:mm:ss')
}

const copyToClipboard = async (text: string) => {
  try {
    await navigator.clipboard.writeText(text)
  } catch (error) {
    console.error('Failed to copy to clipboard:', error)
  }
}

const refreshStatus = async () => {
  if (!props.processingId || isRefreshing.value) return

  isRefreshing.value = true
  errorMessage.value = ''

  try {
    const response = await repositoryApi.getEmbeddingStatus(props.processingId)
    if (response.data) {
      status.value = response.data
      emit('statusUpdated', response.data)
    }
  } catch (error: any) {
    console.error('Error fetching status:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to fetch status'
  } finally {
    isRefreshing.value = false
  }
}

const startAutoRefresh = () => {
  if (!props.autoRefresh || !props.processingId) return
  
  refreshTimer = setInterval(() => {
    if (isProcessing.value) {
      refreshStatus()
    }
  }, props.refreshInterval)
}

const stopAutoRefresh = () => {
  if (refreshTimer) {
    clearInterval(refreshTimer)
    refreshTimer = null
  }
}

watch(() => props.processingId, (newId) => {
  stopAutoRefresh()
  if (newId) {
    refreshStatus()
    startAutoRefresh()
  } else {
    status.value = null
  }
})

watch(isProcessing, (processing) => {
  if (processing && props.autoRefresh) {
    startAutoRefresh()
  } else {
    stopAutoRefresh()
  }
})

onMounted(() => {
  if (props.processingId) {
    refreshStatus()
    startAutoRefresh()
  }
})

onUnmounted(() => {
  stopAutoRefresh()
})
</script>
