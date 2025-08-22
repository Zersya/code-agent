<template>
  <BaseTable>
    <template #header>
      <tr>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            @click="$emit('sort', 'mergeRequestIid')">
          MR ID
          <span class="ml-1">↕</span>
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            @click="$emit('sort', 'title')">
          Title
          <span class="ml-1">↕</span>
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            @click="$emit('sort', 'authorUsername')">
          Author
          <span class="ml-1">↕</span>
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            @click="$emit('sort', 'status')">
          Status
          <span class="ml-1">↕</span>
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer"
            @click="$emit('sort', 'createdAt')">
          Created
          <span class="ml-1">↕</span>
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Merge Time
        </th>
        <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
          Source
        </th>
        <th class="relative px-6 py-3">
          <span class="sr-only">Actions</span>
        </th>
      </tr>
    </template>
    
    <template #body>
      <tr v-if="loading" class="bg-white">
        <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">
          <div class="flex items-center justify-center">
            <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <span class="ml-2">Loading merge requests...</span>
          </div>
        </td>
      </tr>
      
      <tr v-else-if="mergeRequests.length === 0" class="bg-white">
        <td colspan="8" class="px-6 py-4 text-center text-sm text-gray-500">
          No merge requests found
        </td>
      </tr>
      
      <tr v-else v-for="mr in mergeRequests" :key="mr.id" class="bg-white hover:bg-gray-50">
        <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
          !{{ mr.merge_request_iid }}
        </td>
        <td class="px-6 py-4 text-sm text-gray-900">
          <div class="max-w-xs truncate" :title="mr.title">
            {{ mr.title }}
          </div>
          <div class="text-xs text-gray-500">
            {{ mr.project_name || 'Unknown Project' }}
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
          <div class="flex items-center">
            <div>
              <div class="font-medium">{{ mr.author.username }}</div>
              <div class="text-xs text-gray-500">{{ mr.author.name }}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4 whitespace-nowrap">
          <span :class="getStatusBadgeClass(mr.status)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
            {{ getStatusLabel(mr.status) }}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ formatDate(mr.created_at) }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          {{ mr.merge_time_hours ? formatMergeTime(mr.merge_time_hours) : '-' }}
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
          <span :class="mr.is_repopo_event ? 'text-purple-600' : 'text-blue-600'" class="font-medium">
            {{ mr.is_repopo_event ? 'Repopo' : 'GitLab' }}
          </span>
        </td>
        <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
          <a :href="mr.web_url" target="_blank" rel="noopener noreferrer" 
             class="text-blue-600 hover:text-blue-900">
            View
          </a>
        </td>
      </tr>
    </template>
  </BaseTable>
</template>

<script setup lang="ts">
import { format } from 'date-fns'
import BaseTable from './BaseTable.vue'
import type { MergeRequestDetails } from '@/types'

interface Props {
  mergeRequests: MergeRequestDetails[]
  loading?: boolean
}

interface Emits {
  (e: 'sort', field: string): void
}

defineProps<Props>()
defineEmits<Emits>()

const getStatusBadgeClass = (status: string): string => {
  switch (status) {
    case 'opened':
      return 'bg-blue-100 text-blue-800'
    case 'merged':
      return 'bg-green-100 text-green-800'
    case 'closed':
      return 'bg-gray-100 text-gray-800'
    case 'locked':
      return 'bg-red-100 text-red-800'
    default:
      return 'bg-gray-100 text-gray-800'
  }
}

const getStatusLabel = (status: string): string => {
  switch (status) {
    case 'opened':
      return 'Open'
    case 'merged':
      return 'Merged'
    case 'closed':
      return 'Closed'
    case 'locked':
      return 'Locked'
    default:
      return status
  }
}

const formatDate = (dateString: string): string => {
  return format(new Date(dateString), 'MMM dd, yyyy')
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
