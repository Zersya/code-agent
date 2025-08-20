<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Repository Embedding Management</h1>
      <p class="mt-1 text-sm text-gray-600">
        Manage repository embeddings for code analysis and review automation
      </p>
    </div>

    <!-- Main Content Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Left Column: Embedding Form -->
      <div class="space-y-6">
        <RepositoryEmbeddingForm @embedding-started="handleEmbeddingStarted" />
        
        <!-- Current Embedding Status -->
        <RepositoryEmbeddingStatus
          v-if="currentProcessingId"
          :processing-id="currentProcessingId"
          :auto-refresh="true"
          @status-updated="handleStatusUpdated"
          @retry="handleRetry"
        />
      </div>

      <!-- Right Column: Queue Status -->
      <div>
        <QueueStatusCard
          @view-job="handleViewJob"
        />
      </div>
    </div>

    <!-- Recent Embeddings Section -->
    <div class="mt-8">
      <BaseCard title="Recent Embedding Jobs">
        <div v-if="recentJobs.length === 0" class="text-center py-8 text-gray-500">
          No recent embedding jobs
        </div>
        <div v-else class="space-y-4">
          <div
            v-for="job in recentJobs"
            :key="job.processingId"
            class="border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-gray-300 transition-colors"
            @click="selectJob(job.processingId)"
            :class="{ 'ring-2 ring-primary-500 border-primary-500': currentProcessingId === job.processingId }"
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
                  @click.stop="selectJob(job.processingId)"
                >
                  {{ currentProcessingId === job.processingId ? 'Selected' : 'Select' }}
                </BaseButton>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Job Details Modal -->
    <BaseModal
      :show="showJobModal"
      title="Embedding Job Details"
      @close="showJobModal = false"
    >
      <RepositoryEmbeddingStatus
        :processing-id="selectedJobId"
        :auto-refresh="false"
        @retry="handleRetry"
      />
    </BaseModal>

    <!-- Success/Error Messages -->
    <BaseAlert
      v-if="successMessage"
      type="success"
      :message="successMessage"
      @dismiss="successMessage = ''"
    />

    <BaseAlert
      v-if="errorMessage"
      type="danger"
      :message="errorMessage"
      @dismiss="errorMessage = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import BaseCard from '@/components/BaseCard.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import BaseAlert from '@/components/BaseAlert.vue'
import RepositoryEmbeddingForm from '@/components/RepositoryEmbeddingForm.vue'
import RepositoryEmbeddingStatus from '@/components/RepositoryEmbeddingStatus.vue'
import QueueStatusCard from '@/components/QueueStatusCard.vue'
import { repositoryApi } from '@/services/api'
import type { QueueJob, RepositoryEmbeddingStatus as EmbeddingStatus } from '@/types'

const currentProcessingId = ref<string>('')
const recentJobs = ref<QueueJob[]>([])
const showJobModal = ref(false)
const selectedJobId = ref('')
const successMessage = ref('')
const errorMessage = ref('')

const handleEmbeddingStarted = (processingId: string) => {
  currentProcessingId.value = processingId
  successMessage.value = `Repository embedding started! Processing ID: ${processingId}`
  
  // Refresh recent jobs to include the new one
  fetchRecentJobs()
}

const handleStatusUpdated = (status: EmbeddingStatus) => {
  // Update the job in recent jobs list if it exists
  const jobIndex = recentJobs.value.findIndex(job => job.processingId === status.processingId)
  if (jobIndex !== -1) {
    recentJobs.value[jobIndex] = {
      ...recentJobs.value[jobIndex],
      status: status.status,
      updatedAt: status.updatedAt
    }
  }

  // Show completion message
  if (status.status === 'completed') {
    successMessage.value = `Repository embedding completed successfully! Processing ID: ${status.processingId}`
  } else if (status.status === 'failed') {
    errorMessage.value = `Repository embedding failed. Processing ID: ${status.processingId}`
  }
}

const handleRetry = async (processingId: string) => {
  try {
    // Note: This would need to be implemented in the backend API
    // For now, we'll just show a message
    successMessage.value = `Retry requested for processing ID: ${processingId}`
  } catch (error: any) {
    console.error('Error retrying job:', error)
    errorMessage.value = 'Failed to retry the embedding job'
  }
}

const handleViewJob = (processingId: string) => {
  selectedJobId.value = processingId
  showJobModal.value = true
}

const selectJob = (processingId: string) => {
  currentProcessingId.value = processingId
}

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

const fetchRecentJobs = async () => {
  try {
    const response = await repositoryApi.getQueueStatus({ page: 1, limit: 10 })
    if (response.data?.jobs) {
      recentJobs.value = response.data.jobs
    }
  } catch (error: any) {
    console.error('Error fetching recent jobs:', error)
    errorMessage.value = 'Failed to fetch recent jobs'
  }
}

onMounted(() => {
  fetchRecentJobs()
})
</script>
