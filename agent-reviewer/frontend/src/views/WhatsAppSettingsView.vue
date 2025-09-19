<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div>
      <h1 class="text-2xl font-bold text-gray-900">WhatsApp Notification Settings</h1>
      <p class="mt-1 text-sm text-gray-600">
        Configure WhatsApp notifications for GitLab merge request events
      </p>
      <div v-if="serviceStatus" class="mt-2 flex items-center text-sm text-gray-500">
        <div
          :class="[
            'flex-shrink-0 mr-1.5 h-2.5 w-2.5 rounded-full',
            serviceStatus?.enabled ? 'bg-green-400' : 'bg-red-400'
          ]"
        ></div>
        WhatsApp Service: {{ serviceStatus?.enabled ? 'Enabled' : 'Disabled' }}
      </div>
    </div>

    <!-- Loading state -->
    <div v-if="loading" class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
    </div>

    <!-- Error state -->
    <div v-else-if="error" class="rounded-md bg-red-50 p-4 mb-6">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error loading WhatsApp configurations</h3>
          <div class="mt-2 text-sm text-red-700">
            {{ error }}
          </div>
        </div>
      </div>
    </div>

    <!-- Service Status Card -->
    <div v-else-if="serviceStatus" class="bg-white shadow rounded-lg p-6 mb-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Service Status</h3>
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-sm font-medium text-gray-500">Status</div>
          <div class="mt-1 text-lg font-semibold" :class="serviceStatus.enabled ? 'text-green-600' : 'text-red-600'">
            {{ serviceStatus.enabled ? 'Enabled' : 'Disabled' }}
          </div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-sm font-medium text-gray-500">Base URL</div>
          <div class="mt-1 text-sm text-gray-900 truncate">{{ serviceStatus.baseUrl || 'Not configured' }}</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-sm font-medium text-gray-500">Session</div>
          <div class="mt-1 text-sm text-gray-900">{{ serviceStatus.session || 'default' }}</div>
        </div>
        <div class="bg-gray-50 p-4 rounded-lg">
          <div class="text-sm font-medium text-gray-500">Timeout</div>
          <div class="mt-1 text-sm text-gray-900">{{ serviceStatus.timeout || 10000 }}ms</div>
        </div>
      </div>
    </div>

    <!-- Configuration Form -->
    <div v-if="showForm" class="mb-6">
      <WhatsAppConfigurationForm
        :configuration="editingConfiguration"
        :loading="formLoading"
        @submit="handleFormSubmit"
        @cancel="handleFormCancel"
      />
    </div>

    <!-- Configurations List -->
    <div v-else-if="configurations.length > 0" class="space-y-4">
      <div class="flex justify-between items-center">
        <h3 class="text-lg font-medium text-gray-900">WhatsApp Configurations</h3>
        <button
          @click="handleAdd"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Add Configuration
        </button>
      </div>

      <div v-for="config in configurations" :key="config.id" class="bg-white shadow rounded-lg p-6">
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="flex items-center space-x-3">
              <h4 class="text-lg font-medium text-gray-900">{{ config.gitlabUsername }}</h4>
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
            </div>
            <div class="mt-1 text-sm text-gray-600">
              <p>WhatsApp: {{ formatPhoneNumber(config.whatsappNumber) }}</p>
              <div class="flex flex-wrap gap-1 mt-1">
                <span
                  v-for="type in config.notificationTypes"
                  :key="type"
                  class="inline-flex px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-md"
                >
                  {{ formatNotificationType(type) }}
                </span>
              </div>
              <p v-if="config.createdAt" class="text-xs text-gray-500 mt-1">
                Created: {{ formatDate(config.createdAt) }}
              </p>
            </div>
          </div>

          <div class="flex items-center space-x-3">
            <button
              @click="sendTestMessage(config)"
              :disabled="testingConfig === config.gitlabUsername"
              class="text-blue-600 hover:text-blue-900 disabled:opacity-50 text-sm font-medium"
              title="Send test message"
            >
              <span v-if="testingConfig === config.gitlabUsername">Testing...</span>
              <span v-else>Test</span>
            </button>

            <button
              @click="handleEdit(config)"
              class="text-indigo-600 hover:text-indigo-900 text-sm font-medium"
              title="Edit configuration"
            >
              Edit
            </button>

            <button
              @click="handleDelete(config)"
              class="text-red-600 hover:text-red-900 text-sm font-medium"
              title="Delete configuration"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty state -->
    <div v-else class="text-center py-12">
      <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-3.582 8-8 8a8.955 8.955 0 01-4.126-.98L3 21l1.98-5.874A8.955 8.955 0 013 12c0-4.418 3.582-8 8-8s8 3.582 8 8z" />
      </svg>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No WhatsApp configurations</h3>
      <p class="mt-1 text-sm text-gray-500">
        Get started by adding a new WhatsApp configuration for merge request notifications.
      </p>
      <div class="mt-6">
        <button
          @click="handleAdd"
          class="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
        >
          Add Configuration
        </button>
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <BaseModal
      v-if="showDeleteModal"
      title="Delete WhatsApp Configuration"
      @close="showDeleteModal = false"
    >
      <div class="mt-2">
        <p class="text-sm text-gray-500">
          Are you sure you want to delete the WhatsApp configuration for
          <strong>{{ deletingConfiguration?.gitlabUsername }}</strong>?
          This action cannot be undone.
        </p>
      </div>

      <div class="mt-5 sm:mt-4 sm:flex sm:flex-row-reverse">
        <BaseButton
          @click="confirmDelete"
          variant="error"
          :loading="deleteLoading"
          class="w-full sm:ml-3 sm:w-auto"
        >
          Delete
        </BaseButton>
        <BaseButton
          @click="showDeleteModal = false"
          variant="secondary"
          class="mt-3 w-full sm:mt-0 sm:w-auto"
        >
          Cancel
        </BaseButton>
      </div>
    </BaseModal>

    <!-- Success/Error Messages -->
    <BaseAlert
      v-if="successMessage"
      type="success"
      :message="successMessage"
      @dismiss="successMessage = ''"
    />

    <BaseAlert
      v-if="errorMessage"
      type="error"
      :message="errorMessage"
      @dismiss="errorMessage = ''"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { format } from 'date-fns'
import { WhatsAppConfiguration, WhatsAppConfigurationRequest, NotificationType } from '@/types'
import BaseButton from '@/components/BaseButton.vue'
import BaseModal from '@/components/BaseModal.vue'
import BaseAlert from '@/components/BaseAlert.vue'
import WhatsAppConfigurationForm from '@/components/WhatsAppConfigurationForm.vue'
import { whatsappApi } from '@/services/api'

// State
const configurations = ref<WhatsAppConfiguration[]>([])
const serviceStatus = ref<any>(null)
const showForm = ref(false)
const showDeleteModal = ref(false)
const editingConfiguration = ref<WhatsAppConfiguration | undefined>(undefined)
const deletingConfiguration = ref<WhatsAppConfiguration | undefined>(undefined)

// Loading states
const loading = ref(false)
const formLoading = ref(false)
const deleteLoading = ref(false)
const testingConfig = ref<string | null>(null)

// Alert state
const error = ref('')
const successMessage = ref('')
const errorMessage = ref('')

// Methods
const fetchConfigurations = async () => {
  loading.value = true
  error.value = ''

  try {
    const response = await whatsappApi.getConfigurations()

    if (response.success && response.data) {
      configurations.value = response.data
    } else {
      throw new Error(response.error || 'Failed to fetch configurations')
    }
  } catch (err: any) {
    console.error('Error fetching configurations:', err)
    error.value = err.message || 'Failed to fetch configurations'
  } finally {
    loading.value = false
  }
}

const fetchServiceStatus = async () => {
  try {
    const response = await whatsappApi.getServiceStatus()

    if (response.success && response.data) {
      serviceStatus.value = response.data
    } else {
      console.error('Failed to fetch service status:', response.error)
    }
  } catch (err: any) {
    console.error('Error fetching service status:', err)
  }
}

const handleAdd = () => {
  editingConfiguration.value = undefined
  showForm.value = true
}

const handleEdit = (config: WhatsAppConfiguration) => {
  editingConfiguration.value = config
  showForm.value = true
}

const handleDelete = (config: WhatsAppConfiguration) => {
  deletingConfiguration.value = config
  showDeleteModal.value = true
}

const handleFormSubmit = async (data: WhatsAppConfigurationRequest) => {
  formLoading.value = true
  errorMessage.value = ''

  try {
    const response = editingConfiguration.value
      ? await whatsappApi.updateConfiguration(data)
      : await whatsappApi.createConfiguration(data)

    if (response.success) {
      successMessage.value = editingConfiguration.value
        ? 'Configuration updated successfully'
        : 'Configuration added successfully'

      await fetchConfigurations()
      handleFormCancel()

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else {
      throw new Error(response.error || 'Failed to save configuration')
    }
  } catch (err: any) {
    console.error('Error saving configuration:', err)
    errorMessage.value = err.message || 'Failed to save configuration'

    // Clear error message after 5 seconds
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } finally {
    formLoading.value = false
  }
}

const handleFormCancel = () => {
  showForm.value = false
  editingConfiguration.value = undefined
}

const confirmDelete = async () => {
  if (!deletingConfiguration.value) return

  deleteLoading.value = true
  errorMessage.value = ''

  try {
    const response = await whatsappApi.deleteConfiguration(deletingConfiguration.value.gitlabUsername)

    if (response.success) {
      successMessage.value = 'Configuration deleted successfully'
      await fetchConfigurations()

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else {
      throw new Error(response.error || 'Failed to delete configuration')
    }
  } catch (err: any) {
    console.error('Error deleting configuration:', err)
    errorMessage.value = err.message || 'Failed to delete configuration'

    // Clear error message after 5 seconds
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } finally {
    deleteLoading.value = false
    showDeleteModal.value = false
    deletingConfiguration.value = undefined
  }
}

const sendTestMessage = async (config: WhatsAppConfiguration) => {
  testingConfig.value = config.gitlabUsername
  errorMessage.value = ''

  try {
    const response = await whatsappApi.sendTestMessage({
      whatsappNumber: config.whatsappNumber,
      message: `Test message for ${config.gitlabUsername} 🤖\n\nYour WhatsApp notification setup is working correctly!`
    })

    if (response.success) {
      successMessage.value = `Test message sent successfully to ${config.gitlabUsername}!`

      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage.value = ''
      }, 3000)
    } else {
      throw new Error(response.error || 'Failed to send test message')
    }
  } catch (err: any) {
    console.error('Error sending test message:', err)
    errorMessage.value = err.message || 'Failed to send test message'

    // Clear error message after 5 seconds
    setTimeout(() => {
      errorMessage.value = ''
    }, 5000)
  } finally {
    testingConfig.value = null
  }
}

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

const formatDate = (dateString: string) => {
  try {
    return format(new Date(dateString), 'MMM dd, yyyy HH:mm')
  } catch {
    return dateString
  }
}

// Lifecycle
onMounted(() => {
  fetchConfigurations()
  fetchServiceStatus()
})
</script>
