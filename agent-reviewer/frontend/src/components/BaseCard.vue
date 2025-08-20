<template>
  <div :class="cardClasses">
    <div v-if="$slots.header || title" class="px-6 py-4 border-b border-gray-200">
      <slot name="header">
        <h3 v-if="title" class="text-lg font-medium text-gray-900">{{ title }}</h3>
      </slot>
    </div>
    <div :class="bodyClasses">
      <slot />
    </div>
    <div v-if="$slots.footer" class="px-6 py-4 border-t border-gray-200 bg-gray-50">
      <slot name="footer" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  title?: string
  padding?: boolean
  shadow?: 'none' | 'sm' | 'md' | 'lg'
}

const props = withDefaults(defineProps<Props>(), {
  padding: true,
  shadow: 'sm'
})

const cardClasses = computed(() => {
  const baseClasses = 'bg-white rounded-lg border border-gray-200'
  
  const shadowClasses = {
    none: '',
    sm: 'shadow-sm',
    md: 'shadow-md',
    lg: 'shadow-lg'
  }
  
  return [baseClasses, shadowClasses[props.shadow]].filter(Boolean).join(' ')
})

const bodyClasses = computed(() => {
  return props.padding ? 'p-6' : ''
})
</script>
