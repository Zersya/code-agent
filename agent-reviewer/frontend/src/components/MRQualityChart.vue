<template>
  <BaseCard title="MR Quality Metrics" class="mb-6">
    <div class="space-y-6">
      <!-- Quality Overview -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div class="bg-green-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-green-600">High Quality MRs</p>
              <p class="text-2xl font-bold text-green-900">{{ highQualityCount }}</p>
              <p class="text-xs text-green-600">{{ highQualityPercentage }}% of total</p>
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
              <p class="text-sm font-medium text-yellow-600">Medium Quality MRs</p>
              <p class="text-2xl font-bold text-yellow-900">{{ mediumQualityCount }}</p>
              <p class="text-xs text-yellow-600">{{ mediumQualityPercentage }}% of total</p>
            </div>
            <div class="w-8 h-8 bg-yellow-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
        </div>

        <div class="bg-red-50 p-4 rounded-lg">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-sm font-medium text-red-600">Low Quality MRs</p>
              <p class="text-2xl font-bold text-red-900">{{ lowQualityCount }}</p>
              <p class="text-xs text-red-600">{{ lowQualityPercentage }}% of total</p>
            </div>
            <div class="w-8 h-8 bg-red-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          </div>
        </div>
      </div>

      <!-- Quality Distribution Chart -->
      <div class="bg-gray-50 p-4 rounded-lg">
        <h4 class="text-lg font-semibold text-gray-900 mb-4">Quality Score Distribution</h4>
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-600">Average Quality Score</span>
            <span class="text-lg font-semibold text-gray-900">{{ averageQualityScore.toFixed(1) }}</span>
          </div>
          <div class="w-full bg-gray-200 rounded-full h-2">
            <div 
              class="bg-gradient-to-r from-red-500 via-yellow-500 to-green-500 h-2 rounded-full transition-all duration-300"
              :style="{ width: `${(averageQualityScore / 10) * 100}%` }"
            ></div>
          </div>
        </div>
      </div>

      <!-- MR Quality Table -->
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                MR ID
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Author
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Quality Score
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Code Coverage
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Test Coverage
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Complexity
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="mr in sortedMRs" :key="mr.mr_id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                !{{ mr.mr_iid }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ mr.author_username }}
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="flex items-center">
                  <span class="text-sm font-medium text-gray-900 mr-2">{{ mr.quality_score.toFixed(1) }}</span>
                  <div 
                    class="w-2 h-2 rounded-full"
                    :class="getQualityColor(mr.quality_score)"
                  ></div>
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ (mr.code_coverage * 100).toFixed(1) }}%
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                {{ (mr.test_coverage * 100).toFixed(1) }}%
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                  :class="getComplexityColor(mr.complexity_score)"
                >
                  {{ getComplexityLabel(mr.complexity_score) }}
                </span>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <span 
                  class="inline-flex px-2 py-1 text-xs font-semibold rounded-full"
                  :class="getStatusColor(mr.quality_score)"
                >
                  {{ getQualityLabel(mr.quality_score) }}
                </span>
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
import type { MRQualityMetrics } from '@/types/performance'

interface Props {
  metrics: MRQualityMetrics[]
}

const props = defineProps<Props>()

const sortedMRs = computed(() => {
  return [...props.metrics].sort((a, b) => b.quality_score - a.quality_score)
})

const highQualityCount = computed(() => {
  return props.metrics.filter(mr => mr.quality_score >= 8).length
})

const mediumQualityCount = computed(() => {
  return props.metrics.filter(mr => mr.quality_score >= 5 && mr.quality_score < 8).length
})

const lowQualityCount = computed(() => {
  return props.metrics.filter(mr => mr.quality_score < 5).length
})

const totalMRs = computed(() => props.metrics.length)

const highQualityPercentage = computed(() => {
  return totalMRs.value > 0 ? ((highQualityCount.value / totalMRs.value) * 100).toFixed(1) : '0'
})

const mediumQualityPercentage = computed(() => {
  return totalMRs.value > 0 ? ((mediumQualityCount.value / totalMRs.value) * 100).toFixed(1) : '0'
})

const lowQualityPercentage = computed(() => {
  return totalMRs.value > 0 ? ((lowQualityCount.value / totalMRs.value) * 100).toFixed(1) : '0'
})

const averageQualityScore = computed(() => {
  if (props.metrics.length === 0) return 0
  const sum = props.metrics.reduce((acc, mr) => acc + mr.quality_score, 0)
  return sum / props.metrics.length
})

const getQualityColor = (score: number): string => {
  if (score >= 8) return 'bg-green-500'
  if (score >= 5) return 'bg-yellow-500'
  return 'bg-red-500'
}

const getQualityLabel = (score: number): string => {
  if (score >= 8) return 'High'
  if (score >= 5) return 'Medium'
  return 'Low'
}

const getStatusColor = (score: number): string => {
  if (score >= 8) return 'bg-green-100 text-green-800'
  if (score >= 5) return 'bg-yellow-100 text-yellow-800'
  return 'bg-red-100 text-red-800'
}

const getComplexityColor = (score: number): string => {
  if (score >= 7) return 'bg-red-100 text-red-800'
  if (score >= 4) return 'bg-yellow-100 text-yellow-800'
  return 'bg-green-100 text-green-800'
}

const getComplexityLabel = (score: number): string => {
  if (score >= 7) return 'High'
  if (score >= 4) return 'Medium'
  return 'Low'
}
</script>