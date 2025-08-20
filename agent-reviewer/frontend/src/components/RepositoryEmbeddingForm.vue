<template>
  <BaseCard title="Embed Repository">
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="projectId" class="block text-sm font-medium text-gray-700 mb-2">
          Project ID
        </label>
        <BaseInput
          id="projectId"
          v-model="form.projectId"
          type="number"
          placeholder="Enter project ID"
          :error="errors.projectId"
          required
        />
      </div>

      <div>
        <label for="repositoryUrl" class="block text-sm font-medium text-gray-700 mb-2">
          Repository URL
        </label>
        <BaseInput
          id="repositoryUrl"
          v-model="form.repositoryUrl"
          type="url"
          placeholder="https://gitlab.com/username/repository.git"
          :error="errors.repositoryUrl"
          required
        />
      </div>

      <div>
        <label for="priority" class="block text-sm font-medium text-gray-700 mb-2">
          Priority
        </label>
        <select
          id="priority"
          v-model="form.priority"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
        >
          <option value="normal">Normal</option>
          <option value="high">High</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div class="flex justify-end space-x-3">
        <BaseButton
          type="button"
          variant="secondary"
          @click="resetForm"
          :disabled="isSubmitting"
        >
          Reset
        </BaseButton>
        <BaseButton
          type="submit"
          variant="primary"
          :loading="isSubmitting"
          :disabled="!isFormValid"
        >
          Start Embedding
        </BaseButton>
      </div>
    </form>

    <BaseAlert
      v-if="successMessage"
      type="success"
      :message="successMessage"
      class="mt-4"
      @dismiss="successMessage = ''"
    />

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
import { ref, computed, reactive } from 'vue'
import BaseCard from './BaseCard.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'
import { repositoryApi } from '@/services/api'
import type { RepositoryEmbeddingRequest } from '@/types'

interface FormData {
  projectId: string
  repositoryUrl: string
  priority: 'high' | 'normal' | 'low'
}

const emit = defineEmits<{
  embeddingStarted: [processingId: string]
}>()

const form = reactive<FormData>({
  projectId: '',
  repositoryUrl: '',
  priority: 'normal'
})

const errors = reactive({
  projectId: '',
  repositoryUrl: ''
})

const isSubmitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const isFormValid = computed(() => {
  return form.projectId.trim() !== '' && 
         form.repositoryUrl.trim() !== '' &&
         !isNaN(Number(form.projectId))
})

const validateForm = (): boolean => {
  errors.projectId = ''
  errors.repositoryUrl = ''

  if (!form.projectId.trim()) {
    errors.projectId = 'Project ID is required'
    return false
  }

  if (isNaN(Number(form.projectId))) {
    errors.projectId = 'Project ID must be a valid number'
    return false
  }

  if (!form.repositoryUrl.trim()) {
    errors.repositoryUrl = 'Repository URL is required'
    return false
  }

  try {
    new URL(form.repositoryUrl)
  } catch {
    errors.repositoryUrl = 'Please enter a valid URL'
    return false
  }

  return true
}

const resetForm = () => {
  form.projectId = ''
  form.repositoryUrl = ''
  form.priority = 'normal'
  errors.projectId = ''
  errors.repositoryUrl = ''
  successMessage.value = ''
  errorMessage.value = ''
}

const handleSubmit = async () => {
  if (!validateForm()) return

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const requestData: RepositoryEmbeddingRequest = {
      projectId: Number(form.projectId),
      repositoryUrl: form.repositoryUrl,
      priority: form.priority
    }

    const response = await repositoryApi.embedRepository(requestData)
    
    if (response.data) {
      successMessage.value = `Repository embedding started successfully! Processing ID: ${response.data.processingId}`
      emit('embeddingStarted', response.data.processingId)
      resetForm()
    }
  } catch (error: any) {
    console.error('Error starting repository embedding:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to start repository embedding'
  } finally {
    isSubmitting.value = false
  }
}
</script>
