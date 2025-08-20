<template>
  <div class="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
    <div class="max-w-md w-full space-y-8">
      <div>
        <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-primary-100">
          <svg class="h-8 w-8 text-primary-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h2 class="mt-6 text-center text-3xl font-extrabold text-gray-900">
          Agent Reviewer Dashboard
        </h2>
        <p class="mt-2 text-center text-sm text-gray-600">
          Sign in to access the admin dashboard
        </p>
      </div>
      
      <form class="mt-8 space-y-6" @submit.prevent="handleLogin">
        <div>
          <label for="secret-key" class="sr-only">Secret Key</label>
          <input
            id="secret-key"
            v-model="secretKey"
            name="secret-key"
            type="password"
            required
            class="input"
            placeholder="Enter admin secret key"
            :disabled="authStore.isLoading"
          />
        </div>

        <div v-if="authStore.error" class="rounded-md bg-danger-50 p-4">
          <div class="flex">
            <div class="flex-shrink-0">
              <svg class="h-5 w-5 text-danger-400" viewBox="0 0 20 20" fill="currentColor">
                <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
              </svg>
            </div>
            <div class="ml-3">
              <h3 class="text-sm font-medium text-danger-800">
                Authentication Failed
              </h3>
              <div class="mt-2 text-sm text-danger-700">
                {{ authStore.error }}
              </div>
            </div>
          </div>
        </div>

        <div>
          <button
            type="submit"
            :disabled="authStore.isLoading || !secretKey.trim()"
            class="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="authStore.isLoading" class="absolute left-0 inset-y-0 flex items-center pl-3">
              <svg class="h-5 w-5 text-primary-300 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </span>
            {{ authStore.isLoading ? 'Signing in...' : 'Sign in' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()
const secretKey = ref('')

const handleLogin = async () => {
  authStore.clearError()
  
  const success = await authStore.login({ secretKey: secretKey.value })
  
  if (success) {
    router.push('/')
  }
}

onMounted(() => {
  authStore.clearError()

  // If user is already authenticated, redirect to dashboard
  if (authStore.isAuthenticated) {
    router.push('/')
  }
})
</script>
