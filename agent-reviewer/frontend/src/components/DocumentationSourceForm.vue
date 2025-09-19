<template>
  <BaseCard :title="isEditing ? 'Edit Documentation Source' : 'Add Documentation Source'">
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
          Name *
        </label>
        <BaseInput
          id="name"
          v-model="form.name"
          placeholder="e.g., Nuxt.js Official Documentation"
          :error="errors.name"
          required
        />
      </div>

      <div>
        <label for="description" class="block text-sm font-medium text-gray-700 mb-2">
          Description
        </label>
        <BaseInput
          id="description"
          v-model="form.description"
          placeholder="Brief description of the documentation source"
          :error="errors.description"
        />
      </div>

      <div>
        <label for="url" class="block text-sm font-medium text-gray-700 mb-2">
          URL *
        </label>
        <BaseInput
          id="url"
          v-model="form.url"
          type="url"
          placeholder="https://nuxt.com/llms-full.txt"
          :error="errors.url"
          required
        />
      </div>

      <div>
        <label for="framework" class="block text-sm font-medium text-gray-700 mb-2">
          Framework *
        </label>
        <select
          id="framework"
          v-model="form.framework"
          class="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
          required
        >
          <option value="">Select a framework</option>
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
        <p v-if="errors.framework" class="mt-1 text-sm text-red-600">{{ errors.framework }}</p>
      </div>

      <div>
        <label for="version" class="block text-sm font-medium text-gray-700 mb-2">
          Version
        </label>
        <BaseInput
          id="version"
          v-model="form.version"
          placeholder="e.g., 3.x, latest"
          :error="errors.version"
        />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label for="refreshIntervalDays" class="block text-sm font-medium text-gray-700 mb-2">
            Refresh Interval (days)
          </label>
          <BaseInput
            id="refreshIntervalDays"
            v-model="form.refreshIntervalDays"
            type="number"
            min="1"
            max="365"
            :error="errors.refreshIntervalDays"
          />
        </div>

        <div class="flex items-center">
          <input
            id="isActive"
            v-model="form.isActive"
            type="checkbox"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="isActive" class="ml-2 block text-sm text-gray-900">
            Active
          </label>
        </div>
      </div>

      <div class="flex justify-end space-x-3">
        <BaseButton
          type="button"
          variant="secondary"
          @click="resetForm"
          :disabled="isSubmitting"
        >
          {{ isEditing ? 'Cancel' : 'Reset' }}
        </BaseButton>
        <BaseButton
          type="submit"
          variant="primary"
          :loading="isSubmitting"
          :disabled="!isFormValid"
        >
          {{ isEditing ? 'Update Source' : 'Add Source' }}
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
import { ref, computed, reactive, watch } from 'vue'
import BaseCard from './BaseCard.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'
import { documentationApi } from '@/services/api'
import type { DocumentationSource, DocumentationSourceRequest } from '@/types'

interface Props {
  source?: DocumentationSource
  isEditing?: boolean
}

interface FormData {
  name: string
  description: string
  url: string
  framework: string
  version: string
  refreshIntervalDays: string
  isActive: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isEditing: false
})

const emit = defineEmits<{
  sourceAdded: [source: DocumentationSource]
  sourceUpdated: [source: DocumentationSource]
  cancel: []
}>()

const form = reactive<FormData>({
  name: '',
  description: '',
  url: '',
  framework: '',
  version: '',
  refreshIntervalDays: '7',
  isActive: true
})

const errors = reactive({
  name: '',
  description: '',
  url: '',
  framework: '',
  version: '',
  refreshIntervalDays: ''
})

const isSubmitting = ref(false)
const successMessage = ref('')
const errorMessage = ref('')

const isFormValid = computed(() => {
  return form.name.trim() !== '' && 
         form.url.trim() !== '' &&
         form.framework.trim() !== '' &&
         !isNaN(Number(form.refreshIntervalDays)) &&
         Number(form.refreshIntervalDays) > 0
})

const validateForm = (): boolean => {
  // Reset errors
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })

  let isValid = true

  if (!form.name.trim()) {
    errors.name = 'Name is required'
    isValid = false
  }

  if (!form.url.trim()) {
    errors.url = 'URL is required'
    isValid = false
  } else {
    try {
      new URL(form.url)
    } catch {
      errors.url = 'Please enter a valid URL'
      isValid = false
    }
  }

  if (!form.framework.trim()) {
    errors.framework = 'Framework is required'
    isValid = false
  }

  const refreshDays = Number(form.refreshIntervalDays)
  if (isNaN(refreshDays) || refreshDays < 1 || refreshDays > 365) {
    errors.refreshIntervalDays = 'Refresh interval must be between 1 and 365 days'
    isValid = false
  }

  return isValid
}

const resetForm = () => {
  if (props.isEditing) {
    emit('cancel')
    return
  }

  form.name = ''
  form.description = ''
  form.url = ''
  form.framework = ''
  form.version = ''
  form.refreshIntervalDays = '7'
  form.isActive = true
  
  Object.keys(errors).forEach(key => {
    errors[key as keyof typeof errors] = ''
  })
  
  successMessage.value = ''
  errorMessage.value = ''
}

const populateForm = (source: DocumentationSource) => {
  form.name = source.name
  form.description = source.description
  form.url = source.url
  form.framework = source.framework
  form.version = source.version || ''
  form.refreshIntervalDays = source.refreshIntervalDays.toString()
  form.isActive = source.isActive
}

const handleSubmit = async () => {
  if (!validateForm()) return

  isSubmitting.value = true
  errorMessage.value = ''
  successMessage.value = ''

  try {
    const requestData: DocumentationSourceRequest = {
      name: form.name.trim(),
      description: form.description.trim(),
      url: form.url.trim(),
      framework: form.framework,
      version: form.version.trim() || undefined,
      refreshIntervalDays: Number(form.refreshIntervalDays),
      isActive: form.isActive
    }

    let response
    if (props.isEditing && props.source) {
      response = await documentationApi.updateSource(props.source.id, requestData)
      successMessage.value = 'Documentation source updated successfully!'
    } else {
      response = await documentationApi.addSource(requestData)
      successMessage.value = 'Documentation source added successfully!'
    }
    
    if (response.source) {
      if (props.isEditing) {
        emit('sourceUpdated', response.source)
      } else {
        emit('sourceAdded', response.source)
        resetForm()
      }
    }
  } catch (error: any) {
    console.error('Error saving documentation source:', error)
    errorMessage.value = error.response?.data?.error || 'Failed to save documentation source'
  } finally {
    isSubmitting.value = false
  }
}

// Watch for source prop changes to populate form in edit mode
watch(() => props.source, (newSource) => {
  if (newSource && props.isEditing) {
    populateForm(newSource)
  }
}, { immediate: true })
</script>
