import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { Project } from '@/types'
import { projectsApi } from '@/services/api'

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<Project[]>([])
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const lastFetched = ref<Date | null>(null)

  const fetchProjects = async (forceRefresh = false) => {
    // Skip if we have data and it's recent (less than 5 minutes old)
    if (!forceRefresh && projects.value.length > 0 && lastFetched.value) {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000)
      if (lastFetched.value > fiveMinutesAgo) {
        return
      }
    }

    isLoading.value = true
    error.value = null

    try {
      const response = await projectsApi.getProjects()
      
      if (response.success && response.data) {
        projects.value = response.data
        lastFetched.value = new Date()
      } else {
        error.value = response.message || 'Failed to fetch projects'
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Failed to fetch projects'
    } finally {
      isLoading.value = false
    }
  }

  const getProjectById = (id: number) => {
    return projects.value.find(project => project.projectId === id) || null
  }

  const getProjectByName = (name: string) => {
    return projects.value.find(project => project.name === name) || null
  }

  const clearError = () => {
    error.value = null
  }

  const refreshProjects = () => {
    return fetchProjects(true)
  }

  return {
    // State
    projects,
    isLoading,
    error,
    lastFetched,
    
    // Actions
    fetchProjects,
    refreshProjects,
    clearError,
    
    // Getters
    getProjectById,
    getProjectByName
  }
})