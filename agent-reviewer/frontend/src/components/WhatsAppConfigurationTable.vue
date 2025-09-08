<template>
  <BaseCard title="WhatsApp Configurations">
    <template #actions>
      <BaseButton @click="$emit('add')" class="mb-4">
        Add Configuration
      </BaseButton>
    </template>

    <div v-if="loading" class="flex justify-center py-8">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
    </div>

    <div v-else-if="configurations.length === 0" class="text-center py-8">
      <div class="text-gray-500">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No WhatsApp configurations</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by adding a new WhatsApp configuration.</p>
      </div>
    </div>

    <div v-else class="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
      <table class="min-w-full divide-y divide-gray-300">
        <thead class="bg-gray-50">
          <tr>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              GitLab Username
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              WhatsApp Number
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Notification Types
            </th>
            <th scope="col" class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Created
            </th>
            <th scope="col" class="relative px-6 py-3">
              <span class="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody class="bg-white divide-y divide-gray-200">
          <tr v-for="config in configurations" :key="config.id" class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
              {{ config.gitlabUsername }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatPhoneNumber(config.whatsappNumber) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
              <span
                :class="[
                  'inline-flex px-2 py-1 text-xs font-semibold rounded-full',
                  config.isActive
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                ]"
              >
                {{ config.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
            <td class="px-6 py-4 text-sm text-gray-500">
              <div class="flex flex-wrap gap-1">
                <span
                  v-for="type in config.notificationTypes"
                  :key="type"
                  class="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md"
                >
                  {{ formatNotificationType(type) }}
                </span>
              </div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
              {{ formatDate(config.createdAt) }}
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
              <div class="flex justify-end space-x-2">
                <button
                  @click="sendTestMessage(config)"
                  :disabled="testingConfig === config.gitlabUsername"
                  class="text-blue-600 hover:text-blue-900 disabled:opacity-50"
                  title="Send test message"
                >
                  <svg v-if="testingConfig === config.gitlabUsername" class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <svg v-else class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
                  </svg>
                </button>
                
                <button
                  @click="$emit('edit', config)"
                  class="text-indigo-600 hover:text-indigo-900"
                  title="Edit configuration"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                
                <button
                  @click="$emit('delete', config)"
                  class="text-red-600 hover:text-red-900"
                  title="Delete configuration"
                >
                  <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Test Message Result -->
    <BaseAlert
      v-if="testResult"
      :type="testResult.success ? 'success' : 'danger'"
      :message="testResult.message"
      class="mt-4"
      @dismiss="testResult = null"
    />
  </BaseCard>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { WhatsAppConfiguration, NotificationType } from '../types'
import BaseCard from './BaseCard.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'

interface Props {
  configurations: WhatsAppConfiguration[]
  loading?: boolean
}

interface Emits {
  (e: 'add'): void
  (e: 'edit', config: WhatsAppConfiguration): void
  (e: 'delete', config: WhatsAppConfiguration): void
}

defineProps<Props>()
defineEmits<Emits>()

const testingConfig = ref<string | null>(null)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// Methods
const formatPhoneNumber = (phoneNumber: string): string => {
  // Remove all non-digit characters
  const cleaned = phoneNumber.replace(/\D/g, '')
  
  // Format as +62 XXX XXX XXXX
  if (cleaned.startsWith('62')) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 5)} ${cleaned.slice(5, 8)} ${cleaned.slice(8)}`
  }
  
  // Format as 0XXX XXX XXXX
  if (cleaned.startsWith('0')) {
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`
  }
  
  return phoneNumber
}

const formatNotificationType = (type: NotificationType): string => {
  const typeMap: Record<NotificationType, string> = {
    'merge_request_created': 'MR Created',
    'merge_request_assigned': 'MR Assigned',
    'merge_request_merged': 'MR Merged',
    'merge_request_closed': 'MR Closed',
    'review_completed': 'Review Done'
  }
  return typeMap[type] || type
}

const formatDate = (dateString?: string): string => {
  if (!dateString) return '-'
  
  const date = new Date(dateString)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
}

const sendTestMessage = async (config: WhatsAppConfiguration) => {
  testingConfig.value = config.gitlabUsername
  testResult.value = null

  try {
    const response = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        whatsappNumber: config.whatsappNumber,
        message: `Test message for ${config.gitlabUsername} 🤖\n\nYour WhatsApp notification setup is working correctly!`
      })
    })

    const result = await response.json()

    if (result.success) {
      testResult.value = {
        success: true,
        message: `Test message sent successfully to ${config.gitlabUsername}!`
      }
    } else {
      testResult.value = {
        success: false,
        message: result.error || 'Failed to send test message'
      }
    }
  } catch (error) {
    testResult.value = {
      success: false,
      message: 'Error sending test message. Please try again.'
    }
  } finally {
    testingConfig.value = null
  }
}
</script>
