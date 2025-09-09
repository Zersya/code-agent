<template>
  <div class="px-4 sm:px-0">
    <div class="mb-8">
      <h1 class="text-2xl font-bold text-gray-900">Completion Rate Debug</h1>
      <p class="mt-1 text-sm text-gray-600">
        Debug and test completion rate API endpoints
      </p>
    </div>

    <!-- Test Controls -->
    <div class="mb-6 p-4 bg-gray-50 rounded-lg">
      <h2 class="text-lg font-semibold mb-4">Test Controls</h2>
      <div class="flex space-x-4">
        <button
          @click="testTeamRates"
          :disabled="isLoading"
          class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          Test Team Rates
        </button>
        <button
          @click="testStats"
          :disabled="isLoading"
          class="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          Test Stats
        </button>
        <button
          @click="testDirectAPI"
          :disabled="isLoading"
          class="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          Test Direct API
        </button>
        <button
          @click="clearLogs"
          class="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600"
        >
          Clear Logs
        </button>
      </div>
    </div>

    <!-- Loading Indicator -->
    <div v-if="isLoading" class="mb-6 p-4 bg-blue-50 rounded-lg">
      <div class="flex items-center">
        <div class="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
        <span class="text-blue-800">Loading...</span>
      </div>
    </div>

    <!-- Error Display -->
    <div v-if="error" class="mb-6 p-4 bg-red-50 rounded-lg">
      <h3 class="text-red-800 font-semibold">Error:</h3>
      <pre class="text-red-700 text-sm mt-2">{{ error }}</pre>
    </div>

    <!-- Results Display -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <!-- Team Rates -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-4">Team Completion Rates</h3>
        <pre class="text-sm bg-gray-100 p-4 rounded overflow-auto max-h-64">{{ JSON.stringify(teamRates, null, 2) }}</pre>
      </div>

      <!-- Stats -->
      <div class="bg-white p-6 rounded-lg shadow">
        <h3 class="text-lg font-semibold mb-4">Completion Rate Stats</h3>
        <pre class="text-sm bg-gray-100 p-4 rounded overflow-auto max-h-64">{{ JSON.stringify(stats, null, 2) }}</pre>
      </div>

      <!-- API Response Logs -->
      <div class="bg-white p-6 rounded-lg shadow lg:col-span-2">
        <h3 class="text-lg font-semibold mb-4">API Response Logs</h3>
        <div class="space-y-2 max-h-96 overflow-auto">
          <div
            v-for="(log, index) in logs"
            :key="index"
            class="p-3 rounded text-sm"
            :class="log.type === 'error' ? 'bg-red-50 text-red-800' : 
                   log.type === 'success' ? 'bg-green-50 text-green-800' : 
                   'bg-blue-50 text-blue-800'"
          >
            <div class="font-semibold">{{ log.timestamp }} - {{ log.title }}</div>
            <pre class="mt-1 whitespace-pre-wrap">{{ log.message }}</pre>
          </div>
        </div>
      </div>

      <!-- Store Data -->
      <div class="bg-white p-6 rounded-lg shadow lg:col-span-2">
        <h3 class="text-lg font-semibold mb-4">Analytics Store Data</h3>
        <pre class="text-sm bg-gray-100 p-4 rounded overflow-auto max-h-64">{{ JSON.stringify(analyticsStore.completionRateData, null, 2) }}</pre>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useAnalyticsStore } from '@/stores/analytics'
import { completionRateApi } from '@/services/api'

const analyticsStore = useAnalyticsStore()

const isLoading = ref(false)
const error = ref<string | null>(null)
const teamRates = ref<any>(null)
const stats = ref<any>(null)
const logs = ref<Array<{ timestamp: string; title: string; message: string; type: 'info' | 'success' | 'error' }>>([])

const addLog = (title: string, message: string, type: 'info' | 'success' | 'error' = 'info') => {
  logs.value.unshift({
    timestamp: new Date().toLocaleTimeString(),
    title,
    message: typeof message === 'object' ? JSON.stringify(message, null, 2) : message,
    type
  })
}

const clearLogs = () => {
  logs.value = []
  error.value = null
}

const testTeamRates = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    addLog('Team Rates Test', 'Starting team completion rates test...', 'info')
    
    const filters = { month: '2024-01' }
    addLog('Filters', JSON.stringify(filters), 'info')
    
    await analyticsStore.fetchTeamCompletionRates(filters)
    
    teamRates.value = analyticsStore.completionRateData.teamRates
    addLog('Team Rates Success', 'Team rates fetched successfully', 'success')
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = errorMessage
    addLog('Team Rates Error', errorMessage, 'error')
  } finally {
    isLoading.value = false
  }
}

const testStats = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    addLog('Stats Test', 'Starting completion rate stats test...', 'info')
    
    const filters = { month: '2024-01' }
    addLog('Filters', JSON.stringify(filters), 'info')
    
    await analyticsStore.fetchCompletionRateStats(filters)
    
    stats.value = analyticsStore.completionRateData.stats
    addLog('Stats Success', 'Stats fetched successfully', 'success')
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = errorMessage
    addLog('Stats Error', errorMessage, 'error')
  } finally {
    isLoading.value = false
  }
}

const testDirectAPI = async () => {
  isLoading.value = true
  error.value = null
  
  try {
    addLog('Direct API Test', 'Testing direct API calls...', 'info')
    
    // Test team rates API directly
    addLog('API Call', 'Calling getTeamCompletionRates...', 'info')
    const teamResponse = await completionRateApi.getTeamCompletionRates({ month: '2024-01' })
    addLog('Team API Response', JSON.stringify(teamResponse), teamResponse.success ? 'success' : 'error')
    
    // Test stats API directly
    addLog('API Call', 'Calling getCompletionRateStats...', 'info')
    const statsResponse = await completionRateApi.getCompletionRateStats({ month: '2024-01' })
    addLog('Stats API Response', JSON.stringify(statsResponse), statsResponse.success ? 'success' : 'error')
    
    addLog('Direct API Test Complete', 'All direct API calls completed', 'success')
    
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown error'
    error.value = errorMessage
    addLog('Direct API Error', errorMessage, 'error')
  } finally {
    isLoading.value = false
  }
}
</script>
