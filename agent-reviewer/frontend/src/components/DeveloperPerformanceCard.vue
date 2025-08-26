<template>
  <BaseCard :title="`Developer Performance - ${developer.username}`" class="mb-6">
    <div class="space-y-6">
      <!-- Performance Summary -->
      <div class="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div class="bg-blue-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-blue-600">Performance Score</p>
              <p class="text-2xl font-bold text-blue-900">{{ developer.performance_score.toFixed(1) }}</p>
            </div>
            <div class="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-green-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-green-600">Total MRs</p>
              <p class="text-2xl font-bold text-green-900">{{ developer.total_mrs }}</p>
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
              <p class="text-2xl font-bold text-yellow-900">{{ formatTime(developer.avg_resolution_time_hours) }}</p>
            </div>
            <div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-purple-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-purple-600">Efficiency Score</p>
              <p class="text-2xl font-bold text-purple-900">{{ developer.efficiency_score.toFixed(1) }}</p>
            </div>
            <div class="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Detailed Metrics -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <!-- Quality Metrics -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="text-lg font-semibold text-gray-900 mb-3">Quality Metrics</h4>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Bug Fix Rate</span>
              <span class="text-sm font-medium text-gray-900">{{ (developer.bug_fix_rate * 100).toFixed(1) }}%</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Code Review Score</span>
              <span class="text-sm font-medium text-gray-900">{{ developer.code_review_score.toFixed(1) }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Issues Resolved</span>
              <span class="text-sm font-medium text-gray-900">{{ developer.issues_resolved }}</span>
            </div>
          </div>
        </div>

        <!-- Productivity Metrics -->
        <div class="bg-gray-50 p-4 rounded-lg">
          <h4 class="text-lg font-semibold text-gray-900 mb-3">Productivity Metrics</h4>
          <div class="space-y-3">
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Lines of Code</span>
              <span class="text-sm font-medium text-gray-900">{{ developer.lines_of_code.toLocaleString() }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Commits</span>
              <span class="text-sm font-medium text-gray-900">{{ developer.commits_count }}</span>
            </div>
            <div class="flex justify-between items-center">
              <span class="text-sm text-gray-600">Active Days</span>
              <span class="text-sm font-medium text-gray-900">{{ developer.active_days }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Performance Trend -->
      <div class="bg-gray-50 p-4 rounded-lg">
        <h4 class="text-lg font-semibold text-gray-900 mb-3">Recent Activity</h4>
        <div class="text-sm text-gray-600">
          <p>Last updated: {{ formatDate(developer.last_updated) }}</p>
          <p>Period: {{ formatDate(developer.period_start) }} - {{ formatDate(developer.period_end) }}</p>
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseCard from './BaseCard.vue'
import type { DeveloperPerformanceMetrics } from '@/types/performance'

interface Props {
  developer: DeveloperPerformanceMetrics
}

defineProps<Props>()

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
</script>