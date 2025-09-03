<template>
  <div class="px-4 sm:px-0">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p class="mt-1 text-sm text-gray-600">
        Overview of GitLab merge request review automation system
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="analyticsStore.isLoading || statusStore.isLoading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>
    <!-- Error state -->
    <div v-else-if="analyticsStore.error || statusStore.error" class="rounded-md bg-danger-50 p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-danger-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-danger-800">Error loading dashboard data</h3>
          <div class="mt-2 text-sm text-danger-700">
            {{ analyticsStore.error || statusStore.error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Dashboard content -->
    <div v-else>
      <!-- Stats overview -->
      <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
        <div class="card p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Reviews</dt>
                <dd class="text-lg font-medium text-gray-900">{{ analyticsStore.analytics.totalReviews.toLocaleString() }}</dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Approval Rate</dt>
                <dd class="text-lg font-medium text-gray-900">{{ analyticsStore.analytics.approvalRate.toFixed(1) }}%</dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Avg Review Time</dt>
                <dd class="text-lg font-medium text-gray-900">{{ analyticsStore.analytics.averageReviewTime }}m</dd>
              </dl>
            </div>
          </div>
        </div>

        <div class="card p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <div class="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center">
                <svg class="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
              </div>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Queue Status</dt>
                <dd class="text-lg font-medium text-gray-900">{{ statusStore.queueStats.pending }} pending</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- System Health -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">System Health</h3>
          </div>
          <div class="p-6">
            <div class="space-y-4">
              <div v-for="(status, service) in statusStore.systemHealth" :key="service" class="flex items-center justify-between">
                <span class="text-sm font-medium text-gray-900 capitalize">{{ service.replace(/([A-Z])/g, ' $1').trim() }}</span>
                <span :class="[
                  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
                  status === 'healthy' ? 'bg-success-100 text-success-800' : 'bg-danger-100 text-danger-800'
                ]">
                  {{ status }}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Recent Activity</h3>
          </div>
          <div class="p-6">
            <div class="space-y-3">
              <div class="text-sm text-gray-600">
                <span class="font-medium">{{ analyticsStore.analytics.reviewsToday }}</span> reviews completed today
              </div>
              <div class="text-sm text-gray-600">
                <span class="font-medium">{{ analyticsStore.analytics.reviewsThisWeek }}</span> reviews this week
              </div>
              <div class="text-sm text-gray-600">
                <span class="font-medium">{{ analyticsStore.analytics.reviewsThisMonth }}</span> reviews this month
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Embedding System Overview -->
      <div v-if="analyticsStore.analytics.embeddingMetrics" class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Code Embeddings Card -->
        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Code Embeddings</h3>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center">
                <div class="text-2xl font-bold text-blue-600">
                  {{ analyticsStore.analytics.embeddingMetrics.codeEmbeddings.totalFiles.toLocaleString() }}
                </div>
                <div class="text-sm text-gray-500">Total Files</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-green-600">
                  {{ analyticsStore.analytics.embeddingMetrics.codeEmbeddings.totalProjects.toLocaleString() }}
                </div>
                <div class="text-sm text-gray-500">Projects</div>
              </div>
            </div>
            <div class="mt-4">
              <router-link
                to="/repository-embedding"
                class="text-primary-600 hover:text-primary-800 text-sm font-medium"
              >
                Manage Repository Embeddings →
              </router-link>
            </div>
          </div>
        </div>

        <!-- Documentation Embeddings Card -->
        <div class="card">
          <div class="px-6 py-4 border-b border-gray-200">
            <h3 class="text-lg font-medium text-gray-900">Documentation Embeddings</h3>
          </div>
          <div class="p-6">
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center">
                <div class="text-2xl font-bold text-purple-600">
                  {{ analyticsStore.analytics.embeddingMetrics.documentationEmbeddings.totalSections.toLocaleString() }}
                </div>
                <div class="text-sm text-gray-500">Total Sections</div>
              </div>
              <div class="text-center">
                <div class="text-2xl font-bold text-indigo-600">
                  {{ analyticsStore.analytics.embeddingMetrics.documentationEmbeddings.totalSources.toLocaleString() }}
                </div>
                <div class="text-sm text-gray-500">Sources</div>
              </div>
            </div>
            <div class="mt-4">
              <router-link
                to="/documentation"
                class="text-primary-600 hover:text-primary-800 text-sm font-medium"
              >
                Manage Documentation Sources →
              </router-link>
            </div>
          </div>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="card">
        <div class="px-6 py-4 border-b border-gray-200">
          <h3 class="text-lg font-medium text-gray-900">Quick Actions</h3>
        </div>
        <div class="p-6">
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
            <router-link
              to="/reviews"
              class="btn btn-secondary btn-md w-full justify-center"
            >
              View Review History
            </router-link>
            <router-link
              to="/status"
              class="btn btn-secondary btn-md w-full justify-center"
            >
              Check Current Status
            </router-link>
            <router-link
              to="/analytics"
              class="btn btn-secondary btn-md w-full justify-center"
            >
              View Analytics
            </router-link>
            <router-link
              to="/repository-embedding"
              class="btn btn-secondary btn-md w-full justify-center"
            >
              Repository Embedding
            </router-link>
            <router-link
              to="/documentation"
              class="btn btn-secondary btn-md w-full justify-center"
            >
              Documentation
            </router-link>
            <router-link
              to="/auto-review-settings"
              class="btn btn-secondary btn-md w-full justify-center"
            >
              Auto Review Settings
            </router-link>
            <button
              @click="refreshData"
              class="btn btn-primary btn-md w-full justify-center"
              :disabled="isRefreshing"
            >
              {{ isRefreshing ? 'Refreshing...' : 'Refresh Data' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { useStatusStore } from '@/stores/status'

const analyticsStore = useAnalyticsStore()
const statusStore = useStatusStore()
const isRefreshing = ref(false)

const refreshData = async () => {
  isRefreshing.value = true
  try {
    await Promise.all([
      analyticsStore.fetchAnalytics(),
      statusStore.refreshStatus()
    ])
  } finally {
    isRefreshing.value = false
  }
}

onMounted(async () => {
  await refreshData()
})
</script>
