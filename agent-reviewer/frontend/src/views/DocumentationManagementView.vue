<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Documentation Management</h1>
      <p class="mt-1 text-sm text-gray-600">
        Manage documentation sources for enhanced code review context
      </p>
    </div>

    <!-- Add/Edit Form -->
    <div v-if="showForm">
      <DocumentationSourceForm
        :source="editingSource"
        :is-editing="isEditing"
        @source-added="handleSourceAdded"
        @source-updated="handleSourceUpdated"
        @cancel="handleFormCancel"
      />
    </div>

    <!-- Documentation Sources List -->
    <DocumentationSourceList
      :sources="sources"
      :is-loading="isLoading"
      :is-refreshing="isRefreshing"
      :error-message="errorMessage"
      @add-new="handleAddNew"
      @edit="handleEdit"
      @delete="handleDelete"
      @reembed="handleReembed"
      @refresh="fetchSources"
      @error-dismissed="errorMessage = ''"
    />

    <!-- Delete Confirmation Modal -->
    <BaseModal
      :show="showDeleteModal"
      title="Delete Documentation Source"
      @close="showDeleteModal = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          Are you sure you want to delete the documentation source "{{ sourceToDelete?.name }}"?
          This action cannot be undone and will remove all associated embeddings.
        </p>
        
        <div class="flex justify-end space-x-3">
          <BaseButton
            variant="secondary"
            @click="showDeleteModal = false"
            :disabled="isDeleting"
          >
            Cancel
          </BaseButton>
          <BaseButton
            variant="error"
            @click="confirmDelete"
            :loading="isDeleting"
          >
            Delete Source
          </BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Re-embed Confirmation Modal -->
    <BaseModal
      :show="showReembedModal"
      title="Re-embed Documentation Source"
      @close="showReembedModal = false"
    >
      <div class="space-y-4">
        <p class="text-sm text-gray-600">
          Are you sure you want to re-embed the documentation source "{{ sourceToReembed?.name }}"?
          This will fetch the latest documentation and regenerate all embeddings.
        </p>
        
        <div class="flex justify-end space-x-3">
          <BaseButton
            variant="secondary"
            @click="showReembedModal = false"
            :disabled="isReembedding"
          >
            Cancel
          </BaseButton>
          <BaseButton
            variant="primary"
            @click="confirmReembed"
            :loading="isReembedding"
          >
            Re-embed
          </BaseButton>
        </div>
      </div>
    </BaseModal>

    <!-- Success/Error Messages -->
    <BaseAlert
      v-if="successMessage"
      type="success"
      :message="successMessage"
      @dismiss="successMessage = ''"
    />

    <BaseAlert
      v-if="globalErrorMessage"
      type="error"
      :message="globalErrorMessage"
      @dismiss="globalErrorMessage = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import BaseModal from '@/components/BaseModal.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseAlert from '@/components/BaseAlert.vue'
import DocumentationSourceForm from '@/components/DocumentationSourceForm.vue'
import DocumentationSourceList from '@/components/DocumentationSourceList.vue'
import { documentationApi } from '@/services/api'
import type { DocumentationSource } from '@/types'

const sources = ref<DocumentationSource[]>([])
const isLoading = ref(false)
const isRefreshing = ref(false)
const errorMessage = ref('')
const globalErrorMessage = ref('')
const successMessage = ref('')

// Form state
const showForm = ref(false)
const isEditing = ref(false)
const editingSource = ref<DocumentationSource | undefined>()

// Delete modal state
const showDeleteModal = ref(false)
const sourceToDelete = ref<DocumentationSource | null>(null)
const isDeleting = ref(false)

// Re-embed modal state
const showReembedModal = ref(false)
const sourceToReembed = ref<DocumentationSource | null>(null)
const isReembedding = ref(false)

const fetchSources = async () => {
  const loadingRef = sources.value.length === 0 ? isLoading : isRefreshing
  loadingRef.value = true
  errorMessage.value = ''
  globalErrorMessage.value = ''

  try {
    const response = await documentationApi.getSources()
    if (response.sources) {
      sources.value = response.sources
    }
  } catch (error: any) {
    console.error('Error fetching documentation sources:', error)
    const message = error.response?.data?.error || 'Failed to fetch documentation sources'
    if (sources.value.length === 0) {
      errorMessage.value = message
    } else {
      globalErrorMessage.value = message
    }
  } finally {
    loadingRef.value = false
  }
}

const handleAddNew = () => {
  showForm.value = true
  isEditing.value = false
  editingSource.value = undefined
}

const handleEdit = (source: DocumentationSource) => {
  showForm.value = true
  isEditing.value = true
  editingSource.value = source
}

const handleFormCancel = () => {
  showForm.value = false
  isEditing.value = false
  editingSource.value = undefined
}

const handleSourceAdded = (source: DocumentationSource) => {
  sources.value.unshift(source)
  showForm.value = false
  successMessage.value = `Documentation source "${source.name}" added successfully!`
}

const handleSourceUpdated = (updatedSource: DocumentationSource) => {
  const index = sources.value.findIndex(s => s.id === updatedSource.id)
  if (index !== -1) {
    sources.value[index] = updatedSource
  }
  showForm.value = false
  isEditing.value = false
  editingSource.value = undefined
  successMessage.value = `Documentation source "${updatedSource.name}" updated successfully!`
}

const handleDelete = (sourceId: string) => {
  const source = sources.value.find(s => s.id === sourceId)
  if (source) {
    sourceToDelete.value = source
    showDeleteModal.value = true
  }
}

const confirmDelete = async () => {
  if (!sourceToDelete.value) return

  isDeleting.value = true
  try {
    await documentationApi.deleteSource(sourceToDelete.value.id)
    
    // Remove from local list
    sources.value = sources.value.filter(s => s.id !== sourceToDelete.value!.id)
    
    successMessage.value = `Documentation source "${sourceToDelete.value.name}" deleted successfully!`
    showDeleteModal.value = false
    sourceToDelete.value = null
  } catch (error: any) {
    console.error('Error deleting documentation source:', error)
    globalErrorMessage.value = error.response?.data?.error || 'Failed to delete documentation source'
  } finally {
    isDeleting.value = false
  }
}

const handleReembed = (sourceId: string) => {
  const source = sources.value.find(s => s.id === sourceId)
  if (source) {
    sourceToReembed.value = source
    showReembedModal.value = true
  }
}

const confirmReembed = async () => {
  if (!sourceToReembed.value) return

  isReembedding.value = true
  try {
    await documentationApi.reembedSource(sourceToReembed.value.id)
    
    // Update the source status to indicate re-embedding started
    const sourceIndex = sources.value.findIndex(s => s.id === sourceToReembed.value!.id)
    if (sourceIndex !== -1) {
      sources.value[sourceIndex] = {
        ...sources.value[sourceIndex],
        fetchStatus: 'fetching'
      }
    }
    
    successMessage.value = `Re-embedding started for "${sourceToReembed.value.name}"!`
    showReembedModal.value = false
    sourceToReembed.value = null
  } catch (error: any) {
    console.error('Error re-embedding documentation source:', error)
    globalErrorMessage.value = error.response?.data?.error || 'Failed to start re-embedding'
  } finally {
    isReembedding.value = false
  }
}

onMounted(() => {
  fetchSources()
})
</script>
