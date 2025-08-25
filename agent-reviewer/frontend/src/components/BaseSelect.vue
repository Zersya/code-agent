<template>
  <div class="relative">
    <select
      :id="id"
      :value="modelValue"
      :disabled="disabled"
      :class="selectClasses"
      @change="handleChange"
    >
      <option v-if="placeholder" value="" disabled>{{ placeholder }}</option>
      <slot />
    </select>
    <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
      <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
        <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"/>
      </svg>
    </div>
    <p v-if="error" class="mt-1 text-sm text-danger-600">{{ error }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  id?: string
  modelValue?: string | number
  placeholder?: string
  disabled?: boolean
  error?: string
  size?: 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md'
})

const emit = defineEmits<{
  'update:modelValue': [value: string | number]
}>()

const handleChange = (event: Event) => {
  const target = event.target as HTMLSelectElement
  emit('update:modelValue', target.value)
}

const selectClasses = computed(() => {
  const baseClasses = 'block w-full rounded-lg border bg-white px-3 py-2 text-sm focus:outline-none focus:ring-1 transition-colors appearance-none'
  
  const sizeClasses = {
    sm: 'px-2 py-1.5 text-xs',
    md: 'px-3 py-2 text-sm',
    lg: 'px-4 py-2.5 text-base'
  }
  
  const stateClasses = props.error
    ? 'border-danger-300 focus:border-danger-500 focus:ring-danger-500'
    : 'border-gray-300 focus:border-primary-500 focus:ring-primary-500'
  
  const disabledClasses = props.disabled
    ? 'bg-gray-50 text-gray-500 cursor-not-allowed'
    : 'bg-white'
  
  return [baseClasses, sizeClasses[props.size], stateClasses, disabledClasses].join(' ')
})
</script>