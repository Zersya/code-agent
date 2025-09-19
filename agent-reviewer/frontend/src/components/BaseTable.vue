<template>
  <div class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
    <div class="overflow-x-auto">
      <table class="min-w-full divide-y divide-gray-300">
        <thead class="bg-gray-50">
          <tr>
            <th
              v-for="column in props.columns"
              :key="column.key"
              scope="col"
              :class="[
                'px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider',
                column.sortable ? 'cursor-pointer hover:bg-gray-100' : ''
              ]"
              @click="column.sortable ? handleSort(column.key) : null"
            >
              <div class="flex items-center space-x-1">
                <span>{{ column.label }}</span>
                <template v-if="column.sortable">
                  <svg v-if="props.sortBy === column.key && props.sortOrder === 'asc'" class="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else-if="props.sortBy === column.key && props.sortOrder === 'desc'" class="w-4 h-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                  <svg v-else class="w-4 h-4 text-gray-300" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fill-rule="evenodd" d="M10 3a1 1 0 01.707.293l3 3a1 1 0 01-1.414 1.414L10 5.414 7.707 7.707a1 1 0 01-1.414-1.414l3-3A1 1 0 0110 3zm-3.707 9.293a1 1 0 011.414 0L10 14.586l2.293-2.293a1 1 0 011.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd" />
                  </svg>
                </template>
              </div>
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-gray-200 bg-white">
          <tr v-if="props.loading" class="animate-pulse">
            <td v-for="column in props.columns" :key="column.key" class="px-6 py-4 whitespace-nowrap">
              <div class="h-4 bg-gray-200 rounded"></div>
            </td>
          </tr>
          <template v-else-if="props.data.length > 0">
            <tr v-for="(item, index) in props.data" :key="index" class="hover:bg-gray-50">
              <td
                v-for="column in props.columns"
                :key="column.key"
                class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900"
              >
                <slot :name="`cell-${column.key}`" :item="item" :value="item[column.key]" :index="index">
                  {{ formatCellValue(item[column.key], column) }}
                </slot>
              </td>
            </tr>
          </template>
          <tr v-else>
            <td :colspan="props.columns.length" class="px-6 py-12 text-center text-sm text-gray-500">
              <div class="flex flex-col items-center">
                <svg class="w-12 h-12 text-gray-300 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p class="text-lg font-medium text-gray-900 mb-1">No data available</p>
                <p class="text-gray-500">{{ props.emptyMessage || 'No records found' }}</p>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { format } from 'date-fns'

interface Column {
  key: string
  label: string
  sortable?: boolean
  type?: 'text' | 'number' | 'date' | 'boolean'
  format?: string
}

interface Props {
  columns: Column[]
  data: any[]
  loading?: boolean
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  emptyMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  sortBy: '',
  sortOrder: 'asc',
  emptyMessage: 'No records found'
})

const emit = defineEmits<{
  sort: [column: string]
}>()

const handleSort = (column: string) => {
  emit('sort', column)
}

const formatCellValue = (value: any, column: Column) => {
  if (value === null || value === undefined) return '-'
  
  switch (column.type) {
    case 'date':
      return format(new Date(value), column.format || 'MMM dd, yyyy HH:mm')
    case 'number':
      return typeof value === 'number' ? value.toLocaleString() : value
    case 'boolean':
      return value ? 'Yes' : 'No'
    default:
      return value
  }
}
</script>
