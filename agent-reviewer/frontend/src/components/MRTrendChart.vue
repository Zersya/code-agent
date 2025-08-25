<template>
  <BaseCard class="bg-white">
    <div class="px-4 py-5 sm:p-6">
      <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
        {{ title }}
      </h3>
      <div class="h-64">
        <Line
          v-if="chartData && chartData.datasets.length > 0"
          :data="chartData"
          :options="chartOptions"
        />
        <div v-else class="flex items-center justify-center h-full text-gray-500">
          No data available
        </div>
      </div>
    </div>
  </BaseCard>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  Title,
  Tooltip,
  Legend,
  LineElement,
  CategoryScale,
  LinearScale,
  PointElement
} from 'chart.js'
import BaseCard from './BaseCard.vue'
import type { TimeSeriesData } from '@/types'

ChartJS.register(Title, Tooltip, Legend, LineElement, CategoryScale, LinearScale, PointElement)

interface Props {
  data: TimeSeriesData[]
  title: string
  color?: string
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  color: '#3B82F6',
  label: 'Count'
})

const chartData = computed(() => {
  if (!props.data || props.data.length === 0) {
    return null
  }

  return {
    labels: props.data.map(item => {
      const date = new Date(item.date)
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }),
    datasets: [
      {
        label: props.label,
        data: props.data.map(item => item.value),
        borderColor: props.color,
        backgroundColor: props.color + '20',
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointBackgroundColor: props.color,
        pointBorderColor: '#ffffff',
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      mode: 'index' as const,
      intersect: false,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      titleColor: '#ffffff',
      bodyColor: '#ffffff',
      borderColor: props.color,
      borderWidth: 1,
      cornerRadius: 6,
      displayColors: false,
      callbacks: {
        title: (context: any) => {
          const dataIndex = context[0].dataIndex
          const date = new Date(props.data[dataIndex].date)
          return date.toLocaleDateString('en-US', { 
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        },
        label: (context: any) => {
          return `${props.label}: ${context.parsed.y}`
        }
      }
    }
  },
  scales: {
    x: {
      display: true,
      grid: {
        display: false
      },
      ticks: {
        color: '#6B7280',
        font: {
          size: 12
        }
      }
    },
    y: {
      display: true,
      beginAtZero: true,
      grid: {
        color: '#F3F4F6',
        borderDash: [2, 2]
      },
      ticks: {
        color: '#6B7280',
        font: {
          size: 12
        },
        callback: function(value: any) {
          return Number.isInteger(value) ? value : ''
        }
      }
    }
  },
  interaction: {
    mode: 'nearest' as const,
    axis: 'x' as const,
    intersect: false
  },
  elements: {
    point: {
      hoverBackgroundColor: props.color,
      hoverBorderColor: '#ffffff',
      hoverBorderWidth: 3
    }
  }
}))
</script>
