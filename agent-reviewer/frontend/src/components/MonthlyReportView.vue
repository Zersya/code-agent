<template>
  <div class="space-y-6 max-h-[70vh] overflow-y-auto px-2">
    <!-- Header -->
    <div class="border-b pb-4">
      <h2 class="text-2xl font-bold text-gray-900">
        {{ getMonthName(report.month) }} {{ report.year }}
      </h2>
    </div>

    <!-- 1. Last-Month Action Points -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 mb-3">1. Last-Month Action Points</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 border text-xs">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">Date</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-32">Project</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase">Action</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-24">PIC</th>
              <th class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">Status</th>
              <th v-if="editable" class="px-2 py-2 text-left text-xs font-medium text-gray-500 uppercase w-20">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(point, index) in localData.actionPoints" :key="index" class="hover:bg-gray-50">
              <td class="px-2 py-1.5">
                <input v-if="editable" v-model="point.date" type="date" class="input text-xs w-full" />
                <span v-else class="text-xs">{{ formatDate(point.date) }}</span>
              </td>
              <td class="px-2 py-1.5">
                <input v-if="editable" v-model="point.project_name" class="input text-xs w-full" />
                <span v-else class="text-xs font-medium text-gray-700" :title="point.project_name">{{ point.project_name }}</span>
              </td>
              <td class="px-2 py-1.5">
                <input v-if="editable" v-model="point.action" class="input text-xs w-full" />
                <span v-else class="text-xs" :title="point.action">{{ point.action }}</span>
              </td>
              <td class="px-2 py-1.5">
                <input v-if="editable" v-model="point.pic" class="input text-xs w-full" />
                <span v-else class="text-xs">{{ point.pic }}</span>
              </td>
              <td class="px-2 py-1.5">
                <select v-if="editable" v-model="point.status" class="input text-xs w-full">
                  <option value="finish">✅ Finish</option>
                  <option value="ongoing">🔄 On-going</option>
                  <option value="drop">❌ Drop</option>
                </select>
                <span v-else class="text-xs">{{ getStatusEmoji(point.status) }}</span>
              </td>
              <td v-if="editable" class="px-2 py-1.5">
                <button @click="removeActionPoint(index)" class="text-red-600 hover:text-red-900 text-xs">Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
        <button v-if="editable" @click="addActionPoint" class="mt-2 text-sm text-blue-600 hover:text-blue-900">
          + Add Action Point
        </button>
      </div>
    </section>

    <!-- 2. Highlights -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 mb-3">2. Highlights 🚀</h3>
      <div class="space-y-2">
        <div v-for="(highlight, index) in localData.highlights" :key="index" class="flex items-start space-x-2">
          <input
            type="checkbox"
            v-model="highlight.completed"
            :disabled="!editable"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <input
            v-if="editable"
            v-model="highlight.description"
            class="input flex-1"
            placeholder="Highlight description"
          />
          <span v-else class="flex-1 text-sm">{{ highlight.description }}</span>
          <button v-if="editable" @click="removeHighlight(index)" class="text-red-600 hover:text-red-900 text-sm">Remove</button>
        </div>
        <button v-if="editable" @click="addHighlight" class="text-sm text-blue-600 hover:text-blue-900">
          + Add Highlight
        </button>
      </div>
    </section>

    <!-- 3. Lowlights -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 mb-3">3. Lowlights ⚠️</h3>
      <div class="space-y-2">
        <div v-for="(lowlight, index) in localData.lowlights" :key="index" class="flex items-start space-x-2">
          <input
            type="checkbox"
            v-model="lowlight.completed"
            :disabled="!editable"
            class="mt-1 h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <input
            v-if="editable"
            v-model="lowlight.description"
            class="input flex-1"
            placeholder="Lowlight description"
          />
          <span v-else class="flex-1 text-sm">{{ lowlight.description }}</span>
          <button v-if="editable" @click="removeLowlight(index)" class="text-red-600 hover:text-red-900 text-sm">Remove</button>
        </div>
        <button v-if="editable" @click="addLowlight" class="text-sm text-blue-600 hover:text-blue-900">
          + Add Lowlight
        </button>
      </div>
    </section>

    <!-- 4. Tech Update -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 mb-3">4. Tech Update 🔧</h3>
      
      <!-- 4.1 MR Dashboard -->
      <div class="mb-4">
        <h4 class="text-md font-medium text-gray-800 mb-2">4.1 Merge-Request Dashboard</h4>
        <table class="min-w-full divide-y divide-gray-200 border mb-3">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr>
              <td class="px-4 py-2 text-sm">Total MR Created</td>
              <td class="px-4 py-2 text-sm font-medium">{{ localData.techUpdate.mergeRequestDashboard.totalMRCreated }}</td>
            </tr>
            <tr>
              <td class="px-4 py-2 text-sm">Total MR Merged</td>
              <td class="px-4 py-2 text-sm font-medium">{{ localData.techUpdate.mergeRequestDashboard.totalMRMerged }}</td>
            </tr>
            <tr>
              <td class="px-4 py-2 text-sm">Merge-rate</td>
              <td class="px-4 py-2 text-sm font-medium">{{ localData.techUpdate.mergeRequestDashboard.mergeRate }}%</td>
            </tr>
          </tbody>
        </table>

        <div class="mb-2">
          <strong class="text-sm">Top-3 Contributors</strong>
          <ol class="list-decimal list-inside mt-1 space-y-1">
            <li v-for="(contributor, index) in localData.techUpdate.mergeRequestDashboard.topContributors" :key="index" class="text-sm">
              {{ contributor.username }} – {{ contributor.mrCount }} MRs
            </li>
          </ol>
        </div>
      </div>

      <!-- 4.2 Tooling Changes -->
      <div>
        <h4 class="text-md font-medium text-gray-800 mb-2">4.2 Tooling / Infra Changes</h4>
        <ul class="list-disc list-inside space-y-1">
          <li v-for="(change, index) in localData.techUpdate.toolingChanges" :key="index" class="text-sm">
            <input v-if="editable" v-model="change.description" class="input inline-block w-3/4" />
            <span v-else>{{ change.description }}</span>
            <button v-if="editable" @click="removeToolingChange(index)" class="ml-2 text-red-600 hover:text-red-900 text-sm">Remove</button>
          </li>
        </ul>
        <button v-if="editable" @click="addToolingChange" class="mt-2 text-sm text-blue-600 hover:text-blue-900">
          + Add Tooling Change
        </button>
      </div>
    </section>

    <!-- 5. Lessons Learned -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 mb-3">5. Lessons & Learned 📚</h3>
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200 border">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">What happened?</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Why it matters</th>
              <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Next action</th>
              <th v-if="editable" class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="(lesson, index) in localData.lessonsLearned" :key="index">
              <td class="px-4 py-2">
                <textarea v-if="editable" v-model="lesson.whatHappened" class="input text-sm" rows="2"></textarea>
                <span v-else class="text-sm">{{ lesson.whatHappened }}</span>
              </td>
              <td class="px-4 py-2">
                <textarea v-if="editable" v-model="lesson.whyItMatters" class="input text-sm" rows="2"></textarea>
                <span v-else class="text-sm">{{ lesson.whyItMatters }}</span>
              </td>
              <td class="px-4 py-2">
                <textarea v-if="editable" v-model="lesson.nextAction" class="input text-sm" rows="2"></textarea>
                <span v-else class="text-sm">{{ lesson.nextAction }}</span>
              </td>
              <td v-if="editable" class="px-4 py-2">
                <button @click="removeLesson(index)" class="text-red-600 hover:text-red-900 text-sm">Remove</button>
              </td>
            </tr>
          </tbody>
        </table>
        <button v-if="editable" @click="addLesson" class="mt-2 text-sm text-blue-600 hover:text-blue-900">
          + Add Lesson
        </button>
      </div>
    </section>

    <!-- 6. Product Development Strategy -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 mb-3">6. Product Development Strategy 🎯</h3>
      
      <div class="mb-4">
        <h4 class="text-md font-medium text-gray-800 mb-2">6.1 Feedback Snapshot</h4>
        <textarea
          v-if="editable"
          v-model="localData.productStrategy.feedbackSummary"
          class="input w-full"
          rows="3"
          placeholder="One-sentence summary of feedback"
        ></textarea>
        <p v-else class="text-sm">{{ localData.productStrategy.feedbackSummary }}</p>
        
        <div v-if="editable" class="mt-2">
          <label class="block text-sm font-medium text-gray-700 mb-1">Feedback Link (optional)</label>
          <input v-model="localData.productStrategy.feedbackLink" class="input" placeholder="https://..." />
        </div>
        <a v-else-if="localData.productStrategy.feedbackLink" :href="localData.productStrategy.feedbackLink" target="_blank" class="text-sm text-blue-600 hover:underline">
          View full survey/NPS
        </a>
      </div>

      <div>
        <h4 class="text-md font-medium text-gray-800 mb-2">6.2 Quality Metrics</h4>
        <div class="overflow-x-auto">
          <table class="min-w-full divide-y divide-gray-200 border">
            <thead class="bg-gray-50">
              <tr>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Metric</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Previous</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Current</th>
                <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Trend</th>
              </tr>
            </thead>
            <tbody class="bg-white divide-y divide-gray-200">
              <tr v-for="(metric, index) in localData.productStrategy.qualityMetrics" :key="index">
                <td class="px-4 py-2 text-sm">{{ metric.metric }}</td>
                <td class="px-4 py-2 text-sm">{{ metric.previousValue }} {{ metric.unit }}</td>
                <td class="px-4 py-2 text-sm">{{ metric.currentValue }} {{ metric.unit }}</td>
                <td class="px-4 py-2 text-sm">{{ getTrendEmoji(metric.trend) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </section>

    <!-- 7. Thank You Note -->
    <section>
      <h3 class="text-lg font-semibold text-gray-900 mb-3">8. Terima Kasih 👏</h3>
      <textarea
        v-if="editable"
        v-model="localData.thankYouNote"
        class="input w-full"
        rows="3"
        placeholder="Short thank-you note"
      ></textarea>
      <p v-else class="text-sm">{{ localData.thankYouNote }}</p>
    </section>

    <!-- Save/Cancel Buttons -->
    <div v-if="editable" class="flex justify-end space-x-2 pt-4 border-t">
      <BaseButton @click="$emit('cancel')" variant="secondary">Cancel</BaseButton>
      <BaseButton @click="save">Save Changes</BaseButton>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { MonthlyReport, MonthlyReportData } from '@/types'
import BaseButton from './BaseButton.vue'

const props = defineProps<{
  report: MonthlyReport
  editable?: boolean
}>()

const emit = defineEmits<{
  save: [data: MonthlyReportData]
  cancel: []
}>()

const localData = ref<MonthlyReportData>(JSON.parse(JSON.stringify(props.report.reportData)))

watch(() => props.report, (newReport) => {
  localData.value = JSON.parse(JSON.stringify(newReport.reportData))
}, { deep: true })

const getMonthName = (month: number) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return months[month - 1]
}

const getStatusEmoji = (status: string) => {
  const emojis: Record<string, string> = {
    finish: '✅',
    ongoing: '🔄',
    drop: '❌'
  }
  return emojis[status] || ''
}

const getTrendEmoji = (trend: string) => {
  const emojis: Record<string, string> = {
    up: '↗️',
    down: '↘️',
    stable: '→'
  }
  return emojis[trend] || ''
}

// Action Points
const addActionPoint = () => {
  localData.value.actionPoints.push({
    date: new Date().toISOString().split('T')[0],
    action: '',
    pic: '',
    status: 'ongoing',
    project_name: ''
  })
}

const formatDate = (dateStr: string) => {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const removeActionPoint = (index: number) => {
  localData.value.actionPoints.splice(index, 1)
}

// Highlights
const addHighlight = () => {
  localData.value.highlights.push({ description: '', completed: false })
}

const removeHighlight = (index: number) => {
  localData.value.highlights.splice(index, 1)
}

// Lowlights
const addLowlight = () => {
  localData.value.lowlights.push({ description: '', completed: false })
}

const removeLowlight = (index: number) => {
  localData.value.lowlights.splice(index, 1)
}

// Tooling Changes
const addToolingChange = () => {
  localData.value.techUpdate.toolingChanges.push({ description: '' })
}

const removeToolingChange = (index: number) => {
  localData.value.techUpdate.toolingChanges.splice(index, 1)
}

// Lessons
const addLesson = () => {
  localData.value.lessonsLearned.push({
    whatHappened: '',
    whyItMatters: '',
    nextAction: ''
  })
}

const removeLesson = (index: number) => {
  localData.value.lessonsLearned.splice(index, 1)
}

const save = () => {
  emit('save', localData.value)
}
</script>

