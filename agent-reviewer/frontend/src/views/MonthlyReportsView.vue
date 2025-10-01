<template>
  <div class="px-4 sm:px-0">
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Monthly Reports</h1>
        <p class="mt-1 text-sm text-gray-600">
          Generate and manage monthly team reports
        </p>
      </div>
      <BaseButton @click="showCreateModal = true" size="sm">
        <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        New Report
      </BaseButton>
    </div>

    <!-- Error Alert -->
    <div v-if="monthlyReportStore.error" class="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
      <div class="flex">
        <div class="flex-shrink-0">
          <svg class="h-5 w-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div class="ml-3">
          <h3 class="text-sm font-medium text-red-800">Error</h3>
          <div class="mt-2 text-sm text-red-700">
            {{ monthlyReportStore.error }}
          </div>
        </div>
        <div class="ml-auto pl-3">
          <button @click="monthlyReportStore.clearError()" class="text-red-500 hover:text-red-700">
            <svg class="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>

    <!-- Filters -->
    <BaseCard class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select v-model="filters.year" @change="loadReports" class="input">
            <option :value="undefined">All Years</option>
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <select v-model="filters.month" @change="loadReports" class="input">
            <option :value="undefined">All Months</option>
            <option v-for="month in 12" :key="month" :value="month">{{ getMonthName(month) }}</option>
          </select>
        </div>
      </div>
    </BaseCard>

    <!-- Reports List -->
    <BaseCard v-if="!monthlyReportStore.isLoading && monthlyReportStore.reports.length > 0">
      <div class="overflow-x-auto">
        <table class="min-w-full divide-y divide-gray-200">
          <thead class="bg-gray-50">
            <tr>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created By
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created At
              </th>
              <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody class="bg-white divide-y divide-gray-200">
            <tr v-for="report in monthlyReportStore.reports" :key="report.id" class="hover:bg-gray-50">
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm font-medium text-gray-900">
                  {{ getMonthName(report.month) }} {{ report.year }}
                </div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-900">{{ report.createdBy || 'N/A' }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap">
                <div class="text-sm text-gray-500">{{ formatDate(report.createdAt) }}</div>
              </td>
              <td class="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                <button
                  @click="viewReport(report)"
                  class="text-blue-600 hover:text-blue-900"
                >
                  View
                </button>
                <button
                  @click="editReport(report)"
                  class="text-green-600 hover:text-green-900"
                >
                  Edit
                </button>
                <button
                  @click="confirmDelete(report)"
                  class="text-red-600 hover:text-red-900"
                >
                  Delete
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pagination -->
      <div v-if="monthlyReportStore.pagination.totalPages > 1" class="mt-4 flex justify-between items-center">
        <div class="text-sm text-gray-700">
          Showing {{ (monthlyReportStore.pagination.page - 1) * monthlyReportStore.pagination.limit + 1 }} to 
          {{ Math.min(monthlyReportStore.pagination.page * monthlyReportStore.pagination.limit, monthlyReportStore.pagination.total) }} of 
          {{ monthlyReportStore.pagination.total }} results
        </div>
        <div class="flex space-x-2">
          <BaseButton
            @click="changePage(monthlyReportStore.pagination.page - 1)"
            :disabled="monthlyReportStore.pagination.page === 1"
            size="sm"
            variant="secondary"
          >
            Previous
          </BaseButton>
          <BaseButton
            @click="changePage(monthlyReportStore.pagination.page + 1)"
            :disabled="monthlyReportStore.pagination.page === monthlyReportStore.pagination.totalPages"
            size="sm"
            variant="secondary"
          >
            Next
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- Empty State -->
    <BaseCard v-else-if="!monthlyReportStore.isLoading && monthlyReportStore.reports.length === 0">
      <div class="text-center py-12">
        <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        <h3 class="mt-2 text-sm font-medium text-gray-900">No monthly reports</h3>
        <p class="mt-1 text-sm text-gray-500">Get started by creating a new monthly report.</p>
        <div class="mt-6">
          <BaseButton @click="showCreateModal = true">
            <svg class="h-4 w-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
            New Report
          </BaseButton>
        </div>
      </div>
    </BaseCard>

    <!-- Loading State -->
    <BaseCard v-else-if="monthlyReportStore.isLoading">
      <div class="text-center py-12">
        <div class="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p class="mt-2 text-sm text-gray-500">Loading reports...</p>
      </div>
    </BaseCard>

    <!-- Create Modal -->
    <BaseModal v-if="showCreateModal" @close="showCreateModal = false" title="Create Monthly Report">
      <div class="space-y-4">
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Month</label>
          <select v-model="newReport.month" class="input">
            <option v-for="month in 12" :key="month" :value="month">{{ getMonthName(month) }}</option>
          </select>
        </div>
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1">Year</label>
          <select v-model="newReport.year" class="input">
            <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
          </select>
        </div>
        <div class="flex items-center">
          <input
            type="checkbox"
            id="autoGenerate"
            v-model="newReport.autoGenerate"
            class="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
          />
          <label for="autoGenerate" class="ml-2 block text-sm text-gray-900">
            Auto-generate from existing data
          </label>
        </div>
      </div>
      <template #footer>
        <BaseButton @click="showCreateModal = false" variant="secondary">Cancel</BaseButton>
        <BaseButton @click="createReport" :loading="isCreating">Create Report</BaseButton>
      </template>
    </BaseModal>

    <!-- View/Edit Modal -->
    <BaseModal
      v-if="showViewModal && selectedReport"
      @close="closeViewModal"
      :title="`${isEditing ? 'Edit' : 'View'} Monthly Report - ${getMonthName(selectedReport.month)} ${selectedReport.year}`"
      size="xl"
    >
      <MonthlyReportView
        :report="selectedReport"
        :editable="isEditing"
        @save="saveReport"
        @cancel="isEditing = false"
      />
      <template #footer v-if="!isEditing">
        <BaseButton @click="closeViewModal" variant="secondary">Close</BaseButton>
        <BaseButton @click="isEditing = true">Edit</BaseButton>
      </template>
    </BaseModal>

    <!-- Delete Confirmation Modal -->
    <BaseModal v-if="showDeleteModal" @close="showDeleteModal = false" title="Delete Monthly Report">
      <p class="text-sm text-gray-500">
        Are you sure you want to delete the report for {{ getMonthName(reportToDelete?.month || 1) }} {{ reportToDelete?.year }}?
        This action cannot be undone.
      </p>
      <template #footer>
        <BaseButton @click="showDeleteModal = false" variant="secondary">Cancel</BaseButton>
        <BaseButton @click="deleteReport" :loading="isDeleting" variant="error">Delete</BaseButton>
      </template>
    </BaseModal>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useMonthlyReportStore } from '@/stores/monthly-reports'
import type { MonthlyReport } from '@/types'
import BaseButton from '@/components/BaseButton.vue'
import BaseCard from '@/components/BaseCard.vue'
import BaseModal from '@/components/BaseModal.vue'
import MonthlyReportView from '@/components/MonthlyReportView.vue'
import { format } from 'date-fns'

const monthlyReportStore = useMonthlyReportStore()

const showCreateModal = ref(false)
const showViewModal = ref(false)
const showDeleteModal = ref(false)
const selectedReport = ref<MonthlyReport | null>(null)
const reportToDelete = ref<MonthlyReport | null>(null)
const isEditing = ref(false)
const isCreating = ref(false)
const isDeleting = ref(false)

const filters = ref({
  year: undefined as number | undefined,
  month: undefined as number | undefined,
  page: 1,
  limit: 20
})

// Default to previous month
const getPreviousMonth = () => {
  const now = new Date()
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return {
    month: prevMonth.getMonth() + 1,
    year: prevMonth.getFullYear()
  }
}

const newReport = ref({
  ...getPreviousMonth(),
  autoGenerate: true
})

const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let i = currentYear; i >= 2020; i--) {
    years.push(i)
  }
  return years
})

const getMonthName = (month: number) => {
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
  return months[month - 1]
}

const formatDate = (date: string | undefined) => {
  if (!date) return 'N/A'
  return format(new Date(date), 'MMM dd, yyyy HH:mm')
}

const loadReports = async () => {
  await monthlyReportStore.fetchReports(filters.value)
}

const changePage = (page: number) => {
  filters.value.page = page
  loadReports()
}

const createReport = async () => {
  console.log('Creating report with data:', newReport.value)
  isCreating.value = true
  try {
    const result = await monthlyReportStore.createReport(newReport.value)
    console.log('Create report result:', result)
    console.log('Store error:', monthlyReportStore.error)

    if (result) {
      showCreateModal.value = false
      // Reset form to previous month
      newReport.value = {
        ...getPreviousMonth(),
        autoGenerate: true
      }
      // Reload the list to show the new report
      await loadReports()
    } else {
      // Show error to user
      alert(`Failed to create report: ${monthlyReportStore.error || 'Unknown error'}`)
    }
  } catch (error) {
    console.error('Error creating report:', error)
    alert(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
  } finally {
    isCreating.value = false
  }
}

const viewReport = (report: MonthlyReport) => {
  selectedReport.value = report
  isEditing.value = false
  showViewModal.value = true
}

const editReport = (report: MonthlyReport) => {
  selectedReport.value = report
  isEditing.value = true
  showViewModal.value = true
}

const closeViewModal = () => {
  showViewModal.value = false
  selectedReport.value = null
  isEditing.value = false
}

const saveReport = async (reportData: any) => {
  if (!selectedReport.value?.id) return
  
  const result = await monthlyReportStore.updateReport(selectedReport.value.id, reportData)
  if (result) {
    isEditing.value = false
    selectedReport.value = result
  }
}

const confirmDelete = (report: MonthlyReport) => {
  reportToDelete.value = report
  showDeleteModal.value = true
}

const deleteReport = async () => {
  if (!reportToDelete.value?.id) return
  
  isDeleting.value = true
  try {
    const success = await monthlyReportStore.deleteReport(reportToDelete.value.id)
    if (success) {
      showDeleteModal.value = false
      reportToDelete.value = null
    }
  } finally {
    isDeleting.value = false
  }
}

onMounted(() => {
  loadReports()
})
</script>

