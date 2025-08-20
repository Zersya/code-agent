<template>
  <div v-if="show" :class="alertClasses">
    <div class="flex">
      <div class="flex-shrink-0">
        <component :is="iconComponent" :class="iconClasses" />
      </div>
      <div class="ml-3 flex-1">
        <h3 v-if="title" :class="titleClasses">{{ title }}</h3>
        <div :class="messageClasses">
          <slot>{{ message }}</slot>
        </div>
      </div>
      <div v-if="dismissible" class="ml-auto pl-3">
        <div class="-mx-1.5 -my-1.5">
          <button
            @click="$emit('dismiss')"
            :class="dismissButtonClasses"
          >
            <span class="sr-only">Dismiss</span>
            <svg class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, h } from 'vue'

interface Props {
  show?: boolean
  type?: 'success' | 'warning' | 'danger' | 'info'
  title?: string
  message?: string
  dismissible?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  show: true,
  type: 'info',
  dismissible: false
})

defineEmits<{
  dismiss: []
}>()

const alertClasses = computed(() => {
  const baseClasses = 'rounded-md p-4'
  const typeClasses = {
    success: 'bg-success-50',
    warning: 'bg-warning-50',
    danger: 'bg-danger-50',
    info: 'bg-primary-50'
  }
  return `${baseClasses} ${typeClasses[props.type]}`
})

const iconClasses = computed(() => {
  const typeClasses = {
    success: 'text-success-400',
    warning: 'text-warning-400',
    danger: 'text-danger-400',
    info: 'text-primary-400'
  }
  return `h-5 w-5 ${typeClasses[props.type]}`
})

const titleClasses = computed(() => {
  const typeClasses = {
    success: 'text-success-800',
    warning: 'text-warning-800',
    danger: 'text-danger-800',
    info: 'text-primary-800'
  }
  return `text-sm font-medium ${typeClasses[props.type]}`
})

const messageClasses = computed(() => {
  const baseClasses = 'text-sm'
  const typeClasses = {
    success: 'text-success-700',
    warning: 'text-warning-700',
    danger: 'text-danger-700',
    info: 'text-primary-700'
  }
  const marginClass = props.title ? 'mt-2' : ''
  return `${baseClasses} ${typeClasses[props.type]} ${marginClass}`
})

const dismissButtonClasses = computed(() => {
  const typeClasses = {
    success: 'text-success-500 hover:bg-success-100 focus:ring-success-600',
    warning: 'text-warning-500 hover:bg-warning-100 focus:ring-warning-600',
    danger: 'text-danger-500 hover:bg-danger-100 focus:ring-danger-600',
    info: 'text-primary-500 hover:bg-primary-100 focus:ring-primary-600'
  }
  return `inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${typeClasses[props.type]}`
})

const iconComponent = computed(() => {
  const icons = {
    success: () => h('svg', {
      fill: 'currentColor',
      viewBox: '0 0 20 20'
    }, [
      h('path', {
        'fill-rule': 'evenodd',
        d: 'M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z',
        'clip-rule': 'evenodd'
      })
    ]),
    warning: () => h('svg', {
      fill: 'currentColor',
      viewBox: '0 0 20 20'
    }, [
      h('path', {
        'fill-rule': 'evenodd',
        d: 'M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z',
        'clip-rule': 'evenodd'
      })
    ]),
    danger: () => h('svg', {
      fill: 'currentColor',
      viewBox: '0 0 20 20'
    }, [
      h('path', {
        'fill-rule': 'evenodd',
        d: 'M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z',
        'clip-rule': 'evenodd'
      })
    ]),
    info: () => h('svg', {
      fill: 'currentColor',
      viewBox: '0 0 20 20'
    }, [
      h('path', {
        'fill-rule': 'evenodd',
        d: 'M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z',
        'clip-rule': 'evenodd'
      })
    ])
  }
  return icons[props.type]
})
</script>
