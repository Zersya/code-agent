<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">Repository Auto Review Settings</h1>
      <p class="mt-1 text-sm text-gray-600">
        Enable or disable automatic merge request reviews for each repository
      </p>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-md bg-danger-50 p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-danger-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-danger-800">Error loading repositories</h3>
          <div class="mt-2 text-sm text-danger-700">
            {{ error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Repository List -->
    <div v-else-if="projects.length > 0" class="space-y-4">
      <div v-for="project in projects" :key="project.projectId" class="bg-white shadow rounded-lg p-6">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3">
              <h3 class="text-lg font-medium text-gray-900">{{ project.name }}</h3>
              <div v-if="project.url" class="text-sm text-gray-500">
                <a :href="project.url" target="_blank" rel="noopener noreferrer" class="hover:text-gray-700">
                  <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path>
                  </svg>
                </a>
              </div>
            </div>
            <div class="mt-1 text-sm text-gray-600">
              <p v-if="project.description">{{ project.description }}</p>
              <p v-else>No description available</p>
              <p class="mt-1">Project ID: {{ project.projectId }}</p>
              <p v-if="project.defaultBranch" class="text-xs text-gray-500">Default branch: {{ project.defaultBranch }}</p>
              <p v-if="project.lastProcessedAt" class="text-xs text-gray-500">
                Last processed: {{ formatDate(project.lastProcessedAt) }}
              </p>
            </div>
          </div>
          
          <div class="flex items-center space-x-4">
            <!-- Auto Review Toggle -->
            <div class="flex items-center space-x-3">
              <label :for="`auto-review-${project.projectId}`" class="text-sm font-medium text-gray-700">
                Auto Review
              </label>
              <div class="relative">
                <input
                  :id="`auto-review-${project.projectId}`"
                  type="checkbox"
                  :checked="project.autoReviewEnabled !== false"
                  :disabled="updatingProject === project.projectId"
                  @change="toggleAutoReview(project.projectId, $event.target.checked)"
                  class="sr-only"
                />
                <div 
                  :class="[
                    'relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2',
                    project.autoReviewEnabled !== false ? 'bg-primary-600' : 'bg-gray-200',
                    updatingProject === project.projectId ? 'opacity-50 cursor-not-allowed' : ''
                  ]"
                  @click="toggleAutoReview(project.projectId, project.autoReviewEnabled === false)"
                >
                  <span
                    :class="[
                      'pointer-events-none relative inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                      project.autoReviewEnabled !== false ? 'translate-x-5' : 'translate-x-0'
                    ]"
                  >
                    <span
                      :class="[
                        'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity',
                        project.autoReviewEnabled !== false ? 'opacity-0 duration-100 ease-out' : 'opacity-100 duration-200 ease-in'
                      ]"
                      aria-hidden="true"
                    >
                      <svg class="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 12 12">
                        <path d="M4 8l2-2m0 0l2-2M6 6L4 4m2 2l2 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
                      </svg>
                    </span>
                    <span
                      :class="[
                        'absolute inset-0 flex h-full w-full items-center justify-center transition-opacity',
                        project.autoReviewEnabled !== false ? 'opacity-100 duration-200 ease-in' : 'opacity-0 duration-100 ease-out'
                      ]"
                      aria-hidden="true"
                    >
                      <svg class="h-3 w-3 text-primary-600" fill="currentColor" viewBox="0 0 12 12">
                        <path d="M3.707 5.293a1 1 0 00-1.414 1.414l1.414-1.414zM5 8l-.707.707a1 1 0 001.414 0L5 8zm4.707-4.293a1 1 0 00-1.414-1.414l1.414 1.414zm-7.414 2l2 2 1.414-1.414-2-2-1.414 1.414zm3.414 2l4-4-1.414-1.414-4 4 1.414 1.414z" />
                      </svg>
                    </span>
                  </span>
                </div>
              </div>
              <span 
                :class="[
                  'text-sm font-medium',
                  project.autoReviewEnabled !== false ? 'text-primary-600' : 'text-gray-500'
                ]"
              >
                {{ project.autoReviewEnabled !== false ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
            
            <!-- Loading indicator -->
            <div v-if="updatingProject === project.projectId" class="flex items-center">
              <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No repositories found</h3>
      <p class="mt-1 text-sm text-gray-500">
        No repositories have been embedded yet. Start by embedding a repository first.
      </p>
      <div class="mt-6">
        <router-link
          to="/repository-embedding"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
        >
          Embed Repository
        </router-link>
      </div>
    </div>

    <!-- Success/Error Messages -->
    <BaseAlert
      v-if="successMessage"
      type="success"
      :message="successMessage"
      @dismiss="successMessage = ''"
    />

    <BaseAlert
      v-if="errorMessage"
      type="danger"
      :message="errorMessage"
      @dismiss="errorMessage = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { format } from 'date-fns'
import BaseAlert from '@/components/BaseAlert.vue'
import { projectsApi } from '@/services/api'
import type { Project } from '@/types'

const projects = ref<Project[]>([])
const loading = ref(false)
const error = ref('')
const successMessage = ref('')
const errorMessage = ref('')
const updatingProject = ref<number | null>(null)

const fetchProjects = async () => {
  loading.value = true
  error.value = ''
  
  try {
    const response = await projectsApi.getProjects()
    
    // Handle both direct array response and wrapped response
    if (Array.isArray(response)) {
      projects.value = response
    } else if (response.success && response.data) {
      projects.value = response.data
    } else {
      throw new Error('Invalid response format')
    }
  } catch (err: any) {
    console.error('Error fetching projects:', err)
    error.value = err.message || 'Failed to fetch projects'
  } finally {
    loading.value = false
  }
}

const toggleAutoReview = async (projectId: number, enabled: boolean) => {
  if (updatingProject.value === projectId) return
  
  updatingProject.value = projectId
  errorMessage.value = ''
  
  try {
    const response = await projectsApi.updateAutoReview(projectId, enabled)
    
    if (response.success) {
      // Update the local state
      const project = projects.value.find(p => p.projectId === projectId)
      if (project) {
        project.autoReviewEnabled = enabled
      }
      
      successMessage.value = response.message || `Auto review ${enabled ? 'enabled' : 'disabled'} successfully`
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else {
      throw new Error(response.message || 'Failed to update auto review setting')
    }
  } catch (err: any) {
    console.error('Error updating auto review:', err)
    errorMessage.value = err.message || 'Failed to update auto review setting'
    
    // Clear error message after 5 seconds
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } finally {
    updatingProject.value = null
  }
}

const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
  } catch {
    return dateString
  }
}

onMounted(() => {
  fetchProjects()
})
</script>