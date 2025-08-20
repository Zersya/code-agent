import { defineStore } from 'pinia'
import { ref, computed } from 'vue/dist/vue.js'
import type { User, LoginCredentials } from '@/types'
import { authApi } from '@/services/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(localStorage.getItem('auth_token'))
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  const login = async (credentials: LoginCredentials): Promise<boolean> => {
    isLoading.value = true
    error.value = null

    try {
      const response = await authApi.login(credentials)
      
      if (response.success && response.token && response.user) {
        token.value = response.token
        user.value = response.user
        localStorage.setItem('auth_token', response.token)
        return true
      } else {
        error.value = response.message || 'Login failed'
        return false
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Login failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout()
    } catch (err) {
      console.error('Logout error:', err)
    } finally {
      token.value = null
      user.value = null
      localStorage.removeItem('auth_token')
    }
  }

  const checkAuth = async (): Promise<boolean> => {
    if (!token.value) return false

    try {
      const response = await authApi.me()
      if (response.success && response.data?.user) {
        user.value = response.data.user
        return true
      } else {
        await logout()
        return false
      }
    } catch (err) {
      await logout()
      return false
    }
  }

  const clearError = () => {
    error.value = null
  }

  return {
    user,
    token,
    isLoading,
    error,
    isAuthenticated,
    login,
    logout,
    checkAuth,
    clearError
  }
})
