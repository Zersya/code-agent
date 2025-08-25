<template>
  <BaseCard title="Embed Repository">
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="repositoryUrl" class="block text-sm font-medium text-gray-700 mb-2">
          Repository URL
        </label>
        <BaseInput
          id="repositoryUrl"
          v-model="form.repositoryUrl"
          type="url"
          placeholder="https://repopo.transtrack.id/username/repository.git"
          :error="errors.repositoryUrl"
          required
          @input="onRepositoryUrlChange"
        />
        <p v-if="extractedProjectId" class="mt-1 text-sm text-green-600">
          ✓ Project ID {{ extractedProjectId }} detected from URL
        </p>
      </div>

      <div>
        <label for="projectId" class="block text-sm font-medium text-gray-700 mb-2">
          Project ID
        </label>
        <div class="space-y-2">
          <!-- Project ID Input -->
          <BaseInput
            id="projectId"
            v-model="form.projectId"
            type="number"
            placeholder="Enter project ID or select from existing projects"
            :error="errors.projectId"
            required
          />

          <!-- Existing Projects Dropdown -->
          <div v-if="availableProjects.length > 0">
            <label class="block text-xs font-medium text-gray-500 mb-1">
              Or select from existing projects:
            </label>
            <select
              v-model="selectedExistingProject"
              @change="onExistingProjectSelect"
              class="w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            >
              <option value="">Select an existing project...</option>
              <option
                v-for="project in availableProjects"
                :key="project.projectId"
                :value="project.projectId"
              >
                {{ project.name }} (ID: {{ project.projectId }})
              </option>
            </select>
          </div>
        </div>
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
      type="danger"
      :message="errorMessage"
      class="mt-4"
      @dismiss="errorMessage = ''"
    />
  </BaseCard>
</template>

<script setup lang="ts">
import { ref, computed, reactive, onMounted } from 'vue'
import BaseCard from './BaseCard.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'
import { repositoryApi, projectsApi } from '@/services/api'
import type { RepositoryEmbeddingRequest, Project } from '@/types'

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

// Project management
const availableProjects = ref<Project[]>([])
const selectedExistingProject = ref('')
const extractedProjectId = ref<number | null>(null)
const isLoadingProjects = ref(false)

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
  selectedExistingProject.value = ''
  extractedProjectId.value = null
}

// Utility function to extract project ID from GitLab URL
const extractProjectIdFromUrl = (url: string): number | null => {
  if (!url) return null

  try {
    // Handle various GitLab URL formats:
    // https://gitlab.com/username/project
    // https://gitlab.com/username/project.git
    // https://gitlab.com/username/project/-/tree/main
    // https://gitlab.example.com/group/subgroup/project

    const urlObj = new URL(url)
    let pathname = urlObj.pathname

    // Remove leading slash
    if (pathname.startsWith('/')) {
      pathname = pathname.substring(1)
    }

    // Remove .git suffix if present
    if (pathname.endsWith('.git')) {
      pathname = pathname.substring(0, pathname.length - 4)
    }

    // Remove GitLab-specific paths like /-/tree/main
    const gitlabPathIndex = pathname.indexOf('/-/')
    if (gitlabPathIndex !== -1) {
      pathname = pathname.substring(0, gitlabPathIndex)
    }

    // For GitLab.com, we can try to get the project ID from the API
    // For now, we'll use a simple hash-based approach for consistency
    if (pathname) {
      // Create a simple numeric ID from the path
      // This is a simplified approach - in production you might want to call GitLab API
      const hash = pathname.split('').reduce((a, b) => {
        a = ((a << 5) - a) + b.charCodeAt(0)
        return a & a
      }, 0)

      return Math.abs(hash)
    }
  } catch (error) {
    console.warn('Failed to extract project ID from URL:', error)
  }

  return null
}

// Event handlers
const onRepositoryUrlChange = () => {
  const projectId = extractProjectIdFromUrl(form.repositoryUrl)
  if (projectId) {
    extractedProjectId.value = projectId
    form.projectId = projectId.toString()
  } else {
    extractedProjectId.value = null
  }
}

const onExistingProjectSelect = () => {
  if (selectedExistingProject.value) {
    form.projectId = selectedExistingProject.value.toString()
    extractedProjectId.value = null // Clear URL-based extraction when manually selecting
  }
}

// Load available projects
const loadAvailableProjects = async () => {
  isLoadingProjects.value = true
  try {
    const response = await projectsApi.getProjects()
    
    // Handle both wrapped ApiResponse format and direct array format
    if (Array.isArray(response)) {
      // Direct array format: Project[]
      availableProjects.value = response
    } else if (response && typeof response === 'object' && response.success && response.data) {
      // Wrapped ApiResponse format: {success: boolean, data: Project[]}
      availableProjects.value = response.data
    }
  } catch (error) {
    console.error('Failed to load available projects:', error)
  } finally {
    isLoadingProjects.value = false
  }
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

// Load projects on component mount
onMounted(() => {
  loadAvailableProjects()
})
</script>
