<template>
  <BaseCard title="Documentation Sources">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-lg font-medium text-gray-900">Documentation Sources</h3>
        <BaseButton
          variant="primary"
          size="sm"
          @click="$emit('addNew')"
        >
          Add New Source
        </BaseButton>
      </div>
    </template>

    <!-- Filters -->
    <div class="mb-6 flex flex-wrap gap-4">
      <div class="flex-1 min-w-0">
        <BaseInput
          v-model="searchQuery"
          placeholder="Search sources..."
          class="w-full"
        />
      </div>
      <div>
        <select
          v-model="frameworkFilter"
          class="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="">All Frameworks</option>
          <option value="nuxt">Nuxt.js</option>
          <option value="vue">Vue.js</option>
          <option value="react">React</option>
          <option value="angular">Angular</option>
          <option value="svelte">Svelte</option>
          <option value="next">Next.js</option>
          <option value="express">Express.js</option>
          <option value="fastify">Fastify</option>
          <option value="custom">Custom</option>
        </select>
      </div>
      <div>
        <select
          v-model="statusFilter"
          class="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="flex justify-center py-8">
      <div class="animate-spin h-8 w-8 border-4 border-primary-600 border-t-transparent rounded-full"></div>
    </div>

    <!-- Empty State -->
    <div v-else-if="filteredSources.length === 0" class="text-center py-8">
      <div class="text-gray-500">
        <p v-if="sources.length === 0">No documentation sources found</p>
        <p v-else>No sources match your filters</p>
      </div>
    </div>

    <!-- Sources List -->
    <div v-else class="space-y-4">
      <div
        v-for="source in filteredSources"
        :key="source.id"
        class="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
      >
        <div class="flex items-start justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center space-x-3">
              <h4 class="text-lg font-medium text-gray-900 truncate">
                {{ source.name }}
              </h4>
              <div :class="getStatusClasses(source)" class="px-2 py-1 rounded-full text-xs font-medium">
                {{ source.isActive ? 'Active' : 'Inactive' }}
              </div>
              <div :class="getFetchStatusClasses(source.fetchStatus)" class="px-2 py-1 rounded-full text-xs font-medium">
                {{ getFetchStatusText(source.fetchStatus) }}
              </div>
            </div>
            
            <p v-if="source.description" class="mt-1 text-sm text-gray-600">
              {{ source.description }}
            </p>
            
            <div class="mt-2 flex flex-wrap gap-4 text-sm text-gray-500">
              <span class="flex items-center">
                <span class="font-medium">Framework:</span>
                <span class="ml-1 capitalize">{{ source.framework }}</span>
              </span>
              <span v-if="source.version" class="flex items-center">
                <span class="font-medium">Version:</span>
                <span class="ml-1">{{ source.version }}</span>
              </span>
              <span class="flex items-center">
                <span class="font-medium">Refresh:</span>
                <span class="ml-1">{{ source.refreshIntervalDays }} days</span>
              </span>
            </div>
            
            <div class="mt-2 flex flex-wrap gap-4 text-xs text-gray-400">
              <span v-if="source.lastFetchedAt">
                Last fetched: {{ formatRelativeTime(source.lastFetchedAt) }}
              </span>
              <span v-if="source.lastEmbeddedAt">
                Last embedded: {{ formatRelativeTime(source.lastEmbeddedAt) }}
              </span>
              <span>
                Created: {{ formatRelativeTime(source.createdAt) }}
              </span>
            </div>
            
            <div class="mt-2">
              <a
                :href="source.url"
                target="_blank"
                rel="noopener noreferrer"
                class="text-primary-600 hover:text-primary-800 underline text-sm break-all"
              >
                {{ source.url }}
              </a>
            </div>

            <!-- Error Message -->
            <BaseAlert
              v-if="source.fetchError"
              type="error"
              :message="source.fetchError"
              class="mt-3"
            />
          </div>
          
          <div class="ml-4 flex flex-col space-y-2">
            <BaseButton
              size="sm"
              variant="secondary"
              @click="$emit('edit', source)"
            >
              Edit
            </BaseButton>
            <BaseButton
              size="sm"
              variant="primary"
              @click="$emit('reembed', source.id)"
              :disabled="source.fetchStatus === 'fetching'"
            >
              Re-embed
            </BaseButton>
            <BaseButton
              size="sm"
              variant="danger"
              @click="$emit('delete', source.id)"
            >
              Delete
            </BaseButton>
          </div>
        </div>
      </div>
    </div>

    <!-- Refresh Button -->
    <div class="mt-6 flex justify-end">
      <BaseButton
        variant="secondary"
        @click="$emit('refresh')"
        :loading="isRefreshing"
      >
        Refresh
      </BaseButton>
    </div>

    <BaseAlert
      v-if="errorMessage"
      type="error"
      :message="errorMessage"
      class="mt-4"
      @dismiss="errorMessage = ''"
    />
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { formatDistanceToNow } from 'date-fns'
import BaseCard from './BaseCard.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'
import type { DocumentationSource } from '@/types'

interface Props {
  sources: DocumentationSource[]
  isLoading?: boolean
  isRefreshing?: boolean
  errorMessage?: string
}

const props = withDefaults(defineProps<Props>(), {
  isLoading: false,
  isRefreshing: false,
  errorMessage: ''
})

const emit = defineEmits<{
  addNew: []
  edit: [source: DocumentationSource]
  delete: [sourceId: string]
  reembed: [sourceId: string]
  refresh: []
}>()

const searchQuery = ref('')
const frameworkFilter = ref('')
const statusFilter = ref('')

const filteredSources = computed(() => {
  let filtered = props.sources

  // Search filter
  if (searchQuery.value.trim()) {
    const query = searchQuery.value.toLowerCase()
    filtered = filtered.filter(source =>
      source.name.toLowerCase().includes(query) ||
      source.description.toLowerCase().includes(query) ||
      source.framework.toLowerCase().includes(query) ||
      source.url.toLowerCase().includes(query)
    )
  }

  // Framework filter
  if (frameworkFilter.value) {
    filtered = filtered.filter(source => source.framework === frameworkFilter.value)
  }

  // Status filter
  if (statusFilter.value) {
    const isActive = statusFilter.value === 'active'
    filtered = filtered.filter(source => source.isActive === isActive)
  }

  return filtered
})

const getStatusClasses = (source: DocumentationSource): string => {
  return source.isActive
    ? 'bg-green-100 text-green-800'
    : 'bg-gray-100 text-gray-800'
}

const getFetchStatusClasses = (status: string): string => {
  const classMap: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    fetching: 'bg-blue-100 text-blue-800',
    completed: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800'
  }
  return classMap[status] || 'bg-gray-100 text-gray-800'
}

const getFetchStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending: 'Pending',
    fetching: 'Fetching',
    completed: 'Ready',
    failed: 'Failed'
  }
  return statusMap[status] || status
}

const formatRelativeTime = (dateString: string): string => {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true })
}
</script>
