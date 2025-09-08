<template>
  <BaseCard :title="isEditing ? 'Edit WhatsApp Configuration' : 'Add WhatsApp Configuration'">
    <form @submit.prevent="handleSubmit" class="space-y-6">
      <div>
        <label for="gitlabUsername" class="block text-sm font-medium text-gray-700 mb-2">
          GitLab Username *
        </label>
        <BaseInput
          id="gitlabUsername"
          v-model="form.gitlabUsername"
          placeholder="e.g., john.doe"
          :error="errors.gitlabUsername"
          :disabled="isEditing"
          required
        />
        <p class="mt-1 text-sm text-gray-500">
          The GitLab username that will receive WhatsApp notifications
        </p>
      </div>

      <div>
        <label for="whatsappNumber" class="block text-sm font-medium text-gray-700 mb-2">
          WhatsApp Number *
        </label>
        <BaseInput
          id="whatsappNumber"
          v-model="form.whatsappNumber"
          placeholder="e.g., +6281234567890 or 081234567890"
          :error="errors.whatsappNumber"
          required
        />
        <p class="mt-1 text-sm text-gray-500">
          Phone number with country code (Indonesia: +62 or 0)
        </p>
      </div>

      <div>
        <label class="block text-sm font-medium text-gray-700 mb-2">
          Notification Types *
        </label>
        <div class="space-y-2">
          <label
            v-for="type in availableNotificationTypes"
            :key="type.value"
            class="flex items-center"
          >
            <input
              type="checkbox"
              :value="type.value"
              v-model="form.notificationTypes"
              class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            />
            <span class="ml-2 text-sm text-gray-700">{{ type.label }}</span>
          </label>
        </div>
        <p v-if="errors.notificationTypes" class="mt-1 text-sm text-red-600">
          {{ errors.notificationTypes }}
        </p>
      </div>

      <div>
        <label class="flex items-center">
          <input
            type="checkbox"
            v-model="form.isActive"
            class="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
          />
          <span class="ml-2 text-sm text-gray-700">Enable notifications</span>
        </label>
        <p class="mt-1 text-sm text-gray-500">
          Uncheck to temporarily disable notifications for this user
        </p>
      </div>

      <div class="flex justify-between">
        <div class="flex space-x-3">
          <BaseButton
            type="submit"
            :loading="loading"
            :disabled="!isFormValid"
          >
            {{ isEditing ? 'Update Configuration' : 'Add Configuration' }}
          </BaseButton>
          
          <BaseButton
            type="button"
            variant="secondary"
            @click="$emit('cancel')"
          >
            Cancel
          </BaseButton>
        </div>

        <BaseButton
          v-if="form.whatsappNumber"
          type="button"
          variant="secondary"
          @click="sendTestMessage"
          :loading="testLoading"
          :disabled="!isValidPhoneNumber"
        >
          Send Test Message
        </BaseButton>
      </div>
    </form>

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
import { ref, computed, watch } from 'vue'
import { WhatsAppConfiguration, WhatsAppConfigurationRequest } from '../types'
import BaseCard from './BaseCard.vue'
import BaseInput from './BaseInput.vue'
import BaseButton from './BaseButton.vue'
import BaseAlert from './BaseAlert.vue'

interface Props {
  configuration?: WhatsAppConfiguration
  loading?: boolean
}

interface Emits {
  (e: 'submit', data: WhatsAppConfigurationRequest): void
  (e: 'cancel'): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false
})

const emit = defineEmits<Emits>()

// Form state
const form = ref<WhatsAppConfigurationRequest>({
  gitlabUsername: '',
  whatsappNumber: '',
  isActive: true,
  notificationTypes: ['merge_request_created', 'merge_request_assigned']
})

const errors = ref<Record<string, string>>({})
const testLoading = ref(false)
const testResult = ref<{ success: boolean; message: string } | null>(null)

// Available notification types
const availableNotificationTypes = [
  { value: 'merge_request_created', label: 'Merge Request Created' },
  { value: 'merge_request_assigned', label: 'Merge Request Assigned' },
  { value: 'merge_request_merged', label: 'Merge Request Merged' },
  { value: 'merge_request_closed', label: 'Merge Request Closed' },
  { value: 'review_completed', label: 'Review Completed' }
]

// Computed properties
const isEditing = computed(() => !!props.configuration)

const isFormValid = computed(() => {
  return form.value.gitlabUsername.trim() !== '' &&
         form.value.whatsappNumber.trim() !== '' &&
         form.value.notificationTypes.length > 0
})

const isValidPhoneNumber = computed(() => {
  const cleaned = form.value.whatsappNumber.replace(/\D/g, '')
  return cleaned.length >= 10 && /^(62|0)/.test(cleaned)
})

// Watch for configuration changes
watch(() => props.configuration, (newConfig) => {
  if (newConfig) {
    form.value = {
      gitlabUsername: newConfig.gitlabUsername,
      whatsappNumber: newConfig.whatsappNumber,
      isActive: newConfig.isActive,
      notificationTypes: [...newConfig.notificationTypes]
    }
  }
}, { immediate: true })

// Methods
const validateForm = (): boolean => {
  errors.value = {}

  if (!form.value.gitlabUsername.trim()) {
    errors.value.gitlabUsername = 'GitLab username is required'
  }

  if (!form.value.whatsappNumber.trim()) {
    errors.value.whatsappNumber = 'WhatsApp number is required'
  } else if (!isValidPhoneNumber.value) {
    errors.value.whatsappNumber = 'Invalid phone number format'
  }

  if (form.value.notificationTypes.length === 0) {
    errors.value.notificationTypes = 'At least one notification type must be selected'
  }

  return Object.keys(errors.value).length === 0
}

const handleSubmit = () => {
  if (validateForm()) {
    emit('submit', { ...form.value })
  }
}

const sendTestMessage = async () => {
  if (!isValidPhoneNumber.value) return

  testLoading.value = true
  testResult.value = null

  try {
    const response = await fetch('/api/whatsapp/test', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: JSON.stringify({
        whatsappNumber: form.value.whatsappNumber,
        message: `Test message for ${form.value.gitlabUsername} 🤖\n\nYour WhatsApp notification setup is working correctly!`
      })
    })

    const result = await response.json()

    if (result.success) {
      testResult.value = {
        success: true,
        message: 'Test message sent successfully! Check your WhatsApp.'
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
    testLoading.value = false
  }
}
</script>
