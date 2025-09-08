<template>
  <div class="space-y-6">
    <!-- Page Header -->
    <div class="bg-white shadow">
      <div class="px-4 sm:px-6 lg:max-w-6xl lg:mx-auto lg:px-8">
        <div class="py-6 md:flex md:items-center md:justify-between">
          <div class="flex-1 min-w-0">
            <div class="flex items-center">
              <div>
                <div class="flex items-center">
                  <h1 class="ml-3 text-2xl font-bold leading-7 text-gray-900 sm:leading-9 sm:truncate">
                    WhatsApp Settings
                  </h1>
                </div>
                <dl class="mt-6 flex flex-col sm:ml-3 sm:mt-1 sm:flex-row sm:flex-wrap">
                  <dt class="sr-only">WhatsApp service status</dt>
                  <dd class="flex items-center text-sm text-gray-500 font-medium capitalize sm:mr-6">
                    <div
                      :class="[
                        'flex-shrink-0 mr-1.5 h-2.5 w-2.5 rounded-full',
                        serviceStatus?.enabled ? 'bg-green-400' : 'bg-red-400'
                      ]"
                    ></div>
                    WhatsApp Service: {{ serviceStatus?.enabled ? 'Enabled' : 'Disabled' }}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Service Status Card -->
    <div class="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
      <BaseCard title="Service Status" class="mb-6">
        <div v-if="serviceStatusLoading" class="flex justify-center py-4">
          <div class="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
        </div>
        <div v-else-if="serviceStatus" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-sm font-medium text-gray-500">Status</div>
            <div class="mt-1 text-lg font-semibold" :class="serviceStatus.enabled ? 'text-green-600' : 'text-red-600'">
              {{ serviceStatus.enabled ? 'Enabled' : 'Disabled' }}
            </div>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-sm font-medium text-gray-500">Base URL</div>
            <div class="mt-1 text-sm text-gray-900 truncate">{{ serviceStatus.baseUrl }}</div>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-sm font-medium text-gray-500">Session</div>
            <div class="mt-1 text-sm text-gray-900">{{ serviceStatus.session }}</div>
          </div>
          <div class="bg-gray-50 p-4 rounded-lg">
            <div class="text-sm font-medium text-gray-500">Timeout</div>
            <div class="mt-1 text-sm text-gray-900">{{ serviceStatus.timeout }}ms</div>
          </div>
        </div>
      </BaseCard>

      <!-- Configuration Form -->
      <div v-if="showForm" class="mb-6">
        <WhatsAppConfigurationForm
          :configuration="editingConfiguration"
          :loading="formLoading"
          @submit="handleFormSubmit"
          @cancel="handleFormCancel"
        />
      </div>

      <!-- Configurations Table -->
      <WhatsAppConfigurationTable
        :configurations="configurations"
        :loading="tableLoading"
        @add="handleAdd"
        @edit="handleEdit"
        @delete="handleDelete"
      />

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
            variant="danger"
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
        v-if="alert"
        :type="alert.type"
        :message="alert.message"
        class="mt-4"
        @close="alert = null"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { WhatsAppConfiguration, WhatsAppConfigurationRequest } from '../types'
import BaseCard from '../components/BaseCard.vue'
import BaseButton from '../components/BaseButton.vue'
import BaseModal from '../components/BaseModal.vue'
import BaseAlert from '../components/BaseAlert.vue'
import WhatsAppConfigurationForm from '../components/WhatsAppConfigurationForm.vue'
import WhatsAppConfigurationTable from '../components/WhatsAppConfigurationTable.vue'

// State
const configurations = ref<WhatsAppConfiguration[]>([])
const serviceStatus = ref<any>(null)
const showForm = ref(false)
const showDeleteModal = ref(false)
const editingConfiguration = ref<WhatsAppConfiguration | undefined>(undefined)
const deletingConfiguration = ref<WhatsAppConfiguration | undefined>(undefined)

// Loading states
const tableLoading = ref(false)
const serviceStatusLoading = ref(false)
const formLoading = ref(false)
const deleteLoading = ref(false)

// Alert state
const alert = ref<{ type: 'success' | 'error'; message: string } | null>(null)

// Methods
const fetchConfigurations = async () => {
  tableLoading.value = true
  try {
    const response = await fetch('/api/whatsapp/configurations', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    const result = await response.json()

    if (result.success) {
      configurations.value = result.configurations || []
    } else {
      showAlert('error', result.error || 'Failed to fetch configurations')
    }
  } catch (error) {
    showAlert('error', 'Error fetching configurations')
  } finally {
    tableLoading.value = false
  }
}

const fetchServiceStatus = async () => {
  serviceStatusLoading.value = true
  try {
    const response = await fetch('/api/whatsapp/status', {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    const result = await response.json()

    if (result.success) {
      serviceStatus.value = result.status
    } else {
      showAlert('error', result.error || 'Failed to fetch service status')
    }
  } catch (error) {
    showAlert('error', 'Error fetching service status')
  } finally {
    serviceStatusLoading.value = false
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
  try {
    const response = await fetch('/api/whatsapp/configurations', {
      method: editingConfiguration.value ? 'PUT' : 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify(data)
    })

    const result = await response.json()

    if (result.success) {
      showAlert('success', editingConfiguration.value ? 'Configuration updated successfully' : 'Configuration added successfully')
      await fetchConfigurations()
      handleFormCancel()
    } else {
      showAlert('error', result.error || 'Failed to save configuration')
    }
  } catch (error) {
    showAlert('error', 'Error saving configuration')
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
  try {
    const response = await fetch(`/api/whatsapp/configurations/${deletingConfiguration.value.gitlabUsername}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      }
    })

    const result = await response.json()

    if (result.success) {
      showAlert('success', 'Configuration deleted successfully')
      await fetchConfigurations()
    } else {
      showAlert('error', result.error || 'Failed to delete configuration')
    }
  } catch (error) {
    showAlert('error', 'Error deleting configuration')
  } finally {
    deleteLoading.value = false
    showDeleteModal.value = false
    deletingConfiguration.value = undefined
  }
}

const showAlert = (type: 'success' | 'error', message: string) => {
  alert.value = { type, message }
  setTimeout(() => {
    alert.value = null
  }, 5000)
}

// Lifecycle
onMounted(() => {
  fetchConfigurations()
  fetchServiceStatus()
})
</script>
