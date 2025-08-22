<template>
  <BaseTable
    :columns="columns"
    :data="mergeRequests"
    :loading="loading"
    :sort-by="sortBy"
    :sort-order="sortOrder"
    empty-message="No merge requests found"
    @sort="$emit('sort', $event)"
  >
    <template #cell-merge_request_iid="{ value }">
      !{{ value }}
    </template>

    <template #cell-title="{ item }">
      <div class="max-w-xs truncate" :title="item.title">
        {{ item.title }}
      </div>
      <div class="text-xs text-gray-500">
        {{ item.project_name || 'Unknown Project' }}
      </div>
    </template>

    <template #cell-author="{ item }">
      <div class="flex items-center">
        <div>
          <div class="font-medium">{{ item.author?.username || item.author_username }}</div>
          <div class="text-xs text-gray-500">{{ item.author?.name || item.author_name }}</div>
        </div>
      </div>
    </template>

    <template #cell-status="{ value }">
      <span :class="getStatusBadgeClass(value)" class="inline-flex px-2 py-1 text-xs font-semibold rounded-full">
        {{ getStatusLabel(value) }}
      </span>
    </template>

    <template #cell-merge_time_hours="{ value }">
      {{ value ? formatMergeTime(value) : '-' }}
    </template>

    <template #cell-is_repopo_event="{ value }">
      <span :class="value ? 'text-purple-600' : 'text-blue-600'" class="font-medium">
        {{ value ? 'Repopo' : 'GitLab' }}
      </span>
    </template>

    <template #cell-actions="{ item }">
      <a :href="item.web_url" target="_blank" rel="noopener noreferrer"
         class="text-blue-600 hover:text-blue-900">
        View
      </a>
    </template>
  </BaseTable>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import BaseTable from './BaseTable.vue'
import type { MergeRequestDetails } from '@/types'

interface Props {
  mergeRequests: MergeRequestDetails[]
  loading?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

interface Emits {
  (e: 'sort', field: string): void
}

withDefaults(defineProps<Props>(), {
  loading: false,
  sortBy: '',
  sortOrder: 'asc'
})

defineEmits<Emits>()

const columns = computed(() => [
  { key: 'merge_request_iid', label: 'MR ID', sortable: true },
  { key: 'title', label: 'Title', sortable: true },
  { key: 'author', label: 'Author', sortable: false },
  { key: 'status', label: 'Status', sortable: true },
  { key: 'created_at', label: 'Created', sortable: true, type: 'date' as const },
  { key: 'merge_time_hours', label: 'Merge Time', sortable: false },
  { key: 'is_repopo_event', label: 'Source', sortable: false },
  { key: 'actions', label: '', sortable: false }
])

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
