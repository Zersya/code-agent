import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { ReviewRecord, PaginationParams, FilterParams } from '@/types'
import { reviewsApi } from '@/services/api'

export const useReviewsStore = defineStore('reviews', () => {
  const reviews = ref<ReviewRecord[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  })

  const fetchReviews = async (params: PaginationParams & FilterParams = { page: 1, limit: 20 }) => {
    isLoading.value = true
    error.value = null

    try {
      const response = await reviewsApi.getReviews(params)
      
      if (response.success && response.data) {
        reviews.value = response.data
        if (response.pagination) {
          pagination.value = response.pagination
        }
      } else {
        error.value = response.message || 'Failed to fetch reviews'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch reviews'
    } finally {
      isLoading.value = false
    }
  }

  const exportReviews = async (params: FilterParams = {}) => {
    try {
      const response = await reviewsApi.exportReviews(params)
      
      // Create and trigger download
      const blob = new Blob([response], { type: 'text/csv' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `reviews-export-${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to export reviews'
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    reviews,
    isLoading,
    error,
    pagination,
    fetchReviews,
    exportReviews,
    clearError
  }
})
