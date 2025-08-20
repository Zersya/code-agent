import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { QueueJob, QueueStats, SystemHealth } from '@/types'
import { statusApi } from '@/services/api'

export const useStatusStore = defineStore('status', () => {
  const queueJobs = ref<QueueJob[]>([])
  const queueStats = ref<QueueStats>({
    total: 0,
    pending: 0,
    processing: 0,
    completed: 0,
    failed: 0,
    retrying: 0
  })
  const systemHealth = ref<SystemHealth>({
    database: 'healthy',
    embeddingService: 'healthy',
    webhookProcessing: 'healthy',
    queueService: 'healthy'
  })
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const fetchQueueStatus = async () => {
    isLoading.value = true
    error.value = null

    try {
      const response = await statusApi.getQueueStatus()
      
      if (response.success && response.data) {
        queueStats.value = response.data.stats
        queueJobs.value = response.data.jobs
      } else {
        error.value = response.message || 'Failed to fetch queue status'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch queue status'
    } finally {
      isLoading.value = false
    }
  }

  const fetchSystemHealth = async () => {
    try {
      const response = await statusApi.getSystemHealth()
      
      if (response.success && response.data) {
        systemHealth.value = response.data
      }
    } catch (err) {
      console.error('Failed to fetch system health:', err)
    }
  }

  const refreshStatus = async () => {
    await Promise.all([
      fetchQueueStatus(),
      fetchSystemHealth()
    ])
  }

  const clearError = () => {
    error.value = null
  }

  return {
    queueJobs,
    queueStats,
    systemHealth,
    isLoading,
    error,
    fetchQueueStatus,
    fetchSystemHealth,
    refreshStatus,
    clearError
  }
})
