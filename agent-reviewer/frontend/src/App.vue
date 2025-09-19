<template>
  <div id="app">
    <div v-if="isInitializing" class="min-h-screen flex items-center justify-center bg-gray-50">
      <div class="text-center">
        <div class="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-blue-100 mb-4">
          <svg class="h-8 w-8 text-blue-600 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
        <p class="text-gray-600">Initializing...</p>
      </div>
    </div>
    <router-view v-else />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'

const authStore = useAuthStore()
const isInitializing = ref(true)

onMounted(async () => {
  // Initialize authentication state
  try {
    await authStore.initialize()
  } catch (error) {
    console.error('Authentication initialization failed:', error)
  }

  isInitializing.value = false
})
</script>

<style scoped>
#app {
  min-height: 100vh;
}
</style>
