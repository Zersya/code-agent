<template>
  <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
    <!-- Total MRs Created -->
    <BaseCard class="bg-white">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-md">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
        </div>
        <div class="ml-5 w-0 flex-1">
          <dl>
            <dt class="text-sm font-medium text-gray-500 truncate">Total MRs Created</dt>
            <dd class="text-lg font-medium text-gray-900">{{ formatNumber(metrics.totalMRs) }}</dd>
          </dl>
        </div>
      </div>
    </BaseCard>

    <!-- MRs Merged -->
    <BaseCard class="bg-white">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="flex items-center justify-center w-8 h-8 bg-green-500 rounded-md">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        </div>
        <div class="ml-5 w-0 flex-1">
          <dl>
            <dt class="text-sm font-medium text-gray-500 truncate">MRs Merged</dt>
            <dd class="text-lg font-medium text-gray-900">{{ formatNumber(metrics.mergedMRs) }}</dd>
          </dl>
        </div>
      </div>
    </BaseCard>

    <!-- Success Rate -->
    <BaseCard class="bg-white">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="flex items-center justify-center w-8 h-8 bg-indigo-500 rounded-md">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
        </div>
        <div class="ml-5 w-0 flex-1">
          <dl>
            <dt class="text-sm font-medium text-gray-500 truncate">Success Rate</dt>
            <dd class="text-lg font-medium text-gray-900">{{ (metrics.successRate || 0).toFixed(1) }}%</dd>
          </dl>
        </div>
      </div>
    </BaseCard>

    <!-- Average Merge Time -->
    <BaseCard class="bg-white">
      <div class="flex items-center">
        <div class="flex-shrink-0">
          <div class="flex items-center justify-center w-8 h-8 bg-yellow-500 rounded-md">
            <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>
        <div class="ml-5 w-0 flex-1">
          <dl>
            <dt class="text-sm font-medium text-gray-500 truncate">Avg Merge Time</dt>
            <dd class="text-lg font-medium text-gray-900">{{ formatMergeTime(metrics.avgMergeTime) }}</dd>
          </dl>
        </div>
      </div>
    </BaseCard>
  </div>
</template>

<script setup lang="ts">
import BaseCard from './BaseCard.vue'

interface MRMetrics {
  totalMRs: number
  mergedMRs: number
  successRate: number
  avgMergeTime: number
}

interface Props {
  metrics: MRMetrics
}

defineProps<Props>()

const formatNumber = (num: number): string => {
  return new Intl.NumberFormat().format(num)
}

const formatMergeTime = (hours: number): string => {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`
  } else if (hours < 24) {
    return `${Math.round(hours * 10) / 10}h`
  } else {
    const days = Math.floor(hours / 24)
    const remainingHours = Math.round(hours % 24)
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`
  }
}
</script>
