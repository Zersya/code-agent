<template>
  <BaseCard title="Issue Tracking Metrics" class="mb-6">
    <div class="space-y-6">
      <!-- Issue Overview -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-blue-600">Total Issues</p>
              <p class="text-2xl font-bold text-blue-900">{{ totalIssues }}</p>
            </div>
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-green-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-green-600">Resolved Issues</p>
              <p class="text-2xl font-bold text-green-900">{{ resolvedIssues }}</p>
              <p class="text-xs text-green-600">{{ resolvedPercentage }}% resolved</p>
            </div>
            <div class="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-yellow-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-yellow-600">Avg Resolution Time</p>
              <p class="text-2xl font-bold text-yellow-900">{{ averageResolutionTime }}</p>
            </div>
            <div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-red-600">Bug Issues</p>
              <p class="text-2xl font-bold text-red-900">{{ bugIssues }}</p>
              <p class="text-xs text-red-600">{{ bugPercentage }}% are bugs</p>
            </div>
            <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Issue Status Distribution -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Issue Status Distribution</h4>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">Resolved</span>
              </div>
              <span class="text-sm font-medium text-gray-900">{{ resolvedIssues }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">In Progress</span>
              </div>
              <span class="text-sm font-medium text-gray-900">{{ inProgressIssues }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-gray-500 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">Open</span>
              </div>
              <span class="text-sm font-medium text-gray-900">{{ openIssues }}</span>
            </div>
          </div>
        </div>

        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="text-lg font-semibold text-gray-900 mb-4">Issue Priority Distribution</h4>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-red-500 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">High Priority</span>
              </div>
              <span class="text-sm font-medium text-gray-900">{{ highPriorityIssues }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-yellow-500 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">Medium Priority</span>
              </div>
              <span class="text-sm font-medium text-gray-900">{{ mediumPriorityIssues }}</span>
            </div>
            <div class="flex items-center justify-between">
              <div class="flex items-center">
                <div class="w-3 h-3 bg-green-500 rounded-full mr-2"></div>
                <span class="text-sm text-gray-600">Low Priority</span>
              </div>
              <span class="text-sm font-medium text-gray-900">{{ lowPriorityIssues }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Issues Table -->
      <div class="overflow-x-auto">
        <h4 class="text-lg font-semibold text-gray-900 mb-4">Recent Issues</h4>
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Issue ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Title
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Resolution Time
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="issue in recentIssues" :key="issue.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {{ issue.notion_issue_id }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ issue.title || 'Untitled Issue' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                  :class="getStatusColor(issue.status || 'unknown')"
                >
                  {{ issue.status || 'Unknown' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                  :class="getPriorityColor(issue.priority || 'medium')"
                >
                  {{ issue.priority || 'Medium' }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ issue.resolution_time_hours ? formatTime(issue.resolution_time_hours) : '-' }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ formatDate(issue.created_at) }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from './BaseCard.vue'
import type { IssueMetrics } from '@/types/performance'

interface Props {
  metrics: IssueMetrics[]
}

const props = defineProps<Props>()

const totalIssues = computed(() => props.metrics.length)

const resolvedIssues = computed(() => {
  return props.metrics.filter(issue => issue.status === 'resolved').length
})

const inProgressIssues = computed(() => {
  return props.metrics.filter(issue => issue.status === 'in_progress').length
})

const openIssues = computed(() => {
  return props.metrics.filter(issue => issue.status === 'open').length
})

const bugIssues = computed(() => {
  return props.metrics.filter(issue => issue.is_bug).length
})

const highPriorityIssues = computed(() => {
  return props.metrics.filter(issue => issue.priority === 'high').length
})

const mediumPriorityIssues = computed(() => {
  return props.metrics.filter(issue => issue.priority === 'medium').length
})

const lowPriorityIssues = computed(() => {
  return props.metrics.filter(issue => issue.priority === 'low').length
})

const resolvedPercentage = computed(() => {
  return totalIssues.value > 0 ? ((resolvedIssues.value / totalIssues.value) * 100).toFixed(1) : '0'
})

const bugPercentage = computed(() => {
  return totalIssues.value > 0 ? ((bugIssues.value / totalIssues.value) * 100).toFixed(1) : '0'
})

const averageResolutionTime = computed(() => {
  const resolvedWithTime = props.metrics.filter(issue => 
    issue.status === 'resolved' && issue.resolution_time_hours !== null
  )
  
  if (resolvedWithTime.length === 0) return '-'
  
  const totalTime = resolvedWithTime.reduce((sum, issue) => 
    sum + (issue.resolution_time_hours || 0), 0
  )
  
  return formatTime(totalTime / resolvedWithTime.length)
})

const recentIssues = computed(() => {
  return [...props.metrics]
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 10)
})

const formatTime = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`
  } else if (hours < 24) {
    return `${hours.toFixed(1)}h`
  } else {
    const days = Math.floor(hours / 24)
    const remainingHours = hours % 24
    return `${days}d ${remainingHours.toFixed(1)}h`
  }
}

const formatDate = (dateString: string): string => {
  return new Date(dateString).toLocaleDateString()
}

const getStatusColor = (status: string): string => {
  switch (status) {
    case 'resolved':
      return 'bg-green-100 text-green-800'
    case 'in_progress':
      return 'bg-yellow-100 text-yellow-800'
    case 'open':
      return 'bg-gray-100 text-gray-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getPriorityColor = (priority: string): string => {
  switch (priority) {
    case 'high':
      return 'bg-red-100 text-red-800'
    case 'medium':
      return 'bg-yellow-100 text-yellow-800'
    case 'low':
      return 'bg-green-100 text-green-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}
</script>