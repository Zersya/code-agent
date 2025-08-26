<template>
  <div class="px-4 sm:px-0">
    <div class="mb-8 flex justify-between items-center">
      <div>
        <h1 class="text-2xl font-bold text-gray-900">Analytics</h1>
        <p class="mt-1 text-sm text-gray-600">
          Review trends and performance metrics
        </p>
      </div>
      <div class="flex space-x-3">
        <select
          v-model="selectedDateRange"
          @change="handleDateRangeChange"
          class="input"
        >
          <option value="7">Last 7 days</option>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="custom">Custom range</option>
        </select>
        <BaseButton
          @click="refreshAnalytics"
          :loading="analyticsStore.isLoading"
          size="sm"
        >
          Refresh
        </BaseButton>
      </div>
    </div>

    <!-- Custom Date Range -->
    <BaseCard v-if="selectedDateRange === 'custom'" class="mb-6">
      <div class="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
        <BaseInput
          v-model="customDateRange.from"
          type="date"
          label="From Date"
        />
        <BaseInput
          v-model="customDateRange.to"
          type="date"
          label="To Date"
        />
        <BaseButton
          @click="applyCustomDateRange"
          variant="primary"
          size="md"
        >
          Apply
        </BaseButton>
      </div>
    </BaseCard>

    <!-- Key Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-primary-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Total Reviews</p>
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.totalReviews.toLocaleString() }}</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-success-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-success-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Approval Rate</p>
            <p class="text-2xl font-semibold text-gray-900">{{ (analyticsStore.analytics.approvalRate || 0)?.toFixed(1) || '-' }}%</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-warning-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-warning-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Avg Review Time</p>
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.averageReviewTime }}m</p>
          </div>
        </div>
      </BaseCard>

      <BaseCard>
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <div class="w-8 h-8 bg-danger-100 rounded-lg flex items-center justify-center">
              <svg class="w-5 h-5 text-danger-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-600">Critical Issues</p>
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.criticalIssuesTotal.toLocaleString() }}</p>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Charts Row -->
    <div class="grid grid-cols-1 lg:grid-cols-1 gap-6 mb-8">
      <!-- Review Trends Chart -->
      <BaseCard title="Review Trends">
        <div class="h-64 flex items-center justify-center">
          <div v-if="analyticsStore.analytics.reviewTrends.length === 0" class="text-center text-gray-500">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No trend data available</p>
          </div>
          <div v-else class="w-full overflow-x-auto">
            <!-- GitHub-style contribution heatmap -->
            <div class="w-full">
              <!-- Month labels -->
              <div class="flex mb-2 ml-12">
                <div v-for="month in heatmapMonths" :key="month.name" class="text-xs text-gray-500" :style="{ width: month.width + 'px', marginLeft: month.offset + 'px' }">
                  {{ month.name }}
                </div>
              </div>
              
              <div class="flex">
                <!-- Day labels -->
                <div class="flex flex-col text-xs text-gray-500 mr-2 w-10">
                  <div class="h-3 mb-1 flex items-center">Sun</div>
                  <div class="h-3 mb-1 flex items-center">Mon</div>
                  <div class="h-3 mb-1 flex items-center">Tue</div>
                  <div class="h-3 mb-1 flex items-center">Wed</div>
                  <div class="h-3 mb-1 flex items-center">Thu</div>
                  <div class="h-3 mb-1 flex items-center">Fri</div>
                  <div class="h-3 mb-1 flex items-center">Sat</div>
                </div>
                
                <!-- Heatmap grid -->
                <div class="flex-1">
                  <div class="grid gap-1" :style="{ gridTemplateColumns: `repeat(${heatmapWeeks.length}, 12px)`, gridTemplateRows: 'repeat(7, 12px)' }">
                    <div 
                      v-for="(day, index) in heatmapData" 
                      :key="index"
                      class="w-3 h-3 rounded-sm cursor-pointer transition-all duration-200 hover:ring-2 hover:ring-primary-300"
                      :class="getHeatmapColor(day.reviews)"
                      :title="`${day.date}: ${day.reviews} reviews`"
                      @mouseenter="showTooltip($event, day)"
                      @mouseleave="hideTooltip"
                    ></div>
                  </div>
                </div>
              </div>
              
              <!-- Legend -->
              <div class="flex items-center justify-end mt-3 text-xs text-gray-500">
                <span class="mr-2">Less</span>
                <div class="flex space-x-1">
                  <div class="w-3 h-3 rounded-sm bg-gray-100"></div>
                  <div class="w-3 h-3 rounded-sm bg-green-200"></div>
                  <div class="w-3 h-3 rounded-sm bg-green-300"></div>
                  <div class="w-3 h-3 rounded-sm bg-green-500"></div>
                  <div class="w-3 h-3 rounded-sm bg-green-700"></div>
                </div>
                <span class="ml-2">More</span>
              </div>
            </div>
            
            <!-- Tooltip -->
            <div 
              v-if="tooltip.show"
              class="absolute z-10 px-2 py-1 text-xs text-white bg-gray-900 rounded shadow-lg pointer-events-none"
              :style="{ left: tooltip.x + 'px', top: tooltip.y + 'px' }"
            >
              {{ tooltip.content }}
            </div>
          </div>
        </div>
      </BaseCard>

      <!-- Top Projects -->
      <BaseCard title="Top Projects">
        <div class="space-y-3">
          <div v-if="analyticsStore.analytics.topProjects.length === 0" class="text-center text-gray-500 py-8">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <p>No project data available</p>
          </div>
          <div v-else>
            <div v-for="project in analyticsStore.analytics.topProjects.slice(0, 5)" :key="project.projectName" class="flex items-center justify-between">
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium text-gray-900 truncate">{{ project.projectName || 'Unknown Project' }}</p>
                <p class="text-xs text-gray-500">{{ (project.approvalRate || 0)?.toFixed(1) || '-' }}% approval rate</p>
              </div>
              <div class="ml-4 flex-shrink-0">
                <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800">
                  {{ project.reviewCount }} reviews
                </span>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Enhanced Productivity Metrics -->
    <div class="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
      <BaseCard title="Review Frequency">
        <div class="text-center">
          <p class="text-2xl font-bold text-primary-600">{{ (analyticsStore.analytics.reviewFrequency?.avgReviewsPerDay || 0)?.toFixed(1) || '-' }}</p>
          <p class="text-sm text-gray-600">Reviews per day</p>
          <p class="text-xs text-gray-500 mt-1">{{ analyticsStore.analytics.reviewFrequency?.activeDays || 0 }} active days</p>
        </div>
      </BaseCard>

      <BaseCard title="Today">
        <div class="text-center">
          <p class="text-2xl font-bold text-primary-600">{{ analyticsStore.analytics.reviewsToday }}</p>
          <p class="text-sm text-gray-600">Reviews completed</p>
        </div>
      </BaseCard>

      <BaseCard title="This Week">
        <div class="text-center">
          <p class="text-2xl font-bold text-primary-600">{{ analyticsStore.analytics.reviewsThisWeek }}</p>
          <p class="text-sm text-gray-600">Reviews completed</p>
        </div>
      </BaseCard>

      <BaseCard title="This Month">
        <div class="text-center">
          <p class="text-2xl font-bold text-primary-600">{{ analyticsStore.analytics.reviewsThisMonth }}</p>
          <p class="text-sm text-gray-600">Reviews completed</p>
        </div>
      </BaseCard>
    </div>

    <!-- Project Activity Details -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
      <BaseCard title="Project Performance">
        <div class="space-y-4">
          <div v-if="analyticsStore.analytics.projectActivity?.length === 0" class="text-center text-gray-500 py-8">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No project activity data available</p>
          </div>
          <div v-else>
            <div v-for="project in analyticsStore.analytics.projectActivity?.slice(0, 5)" :key="project.projectName" class="border-b border-gray-200 pb-3 last:border-b-0">
              <div class="flex items-center justify-between mb-2">
                <h4 class="text-sm font-medium text-gray-900 truncate">{{ project.projectName || 'Unknown Project' }}</h4>
                <span class="text-sm font-semibold text-primary-600">{{ project.reviewCount }} reviews</span>
              </div>
              <div class="grid grid-cols-2 gap-4 text-xs text-gray-600">
                <div>
                  <span class="font-medium">Avg Review Time:</span>
                  <span class="ml-1">{{ (project.avgReviewTime || 0)?.toFixed(1) || '-' }}m</span>
                </div>
                <div>
                  <span class="font-medium">Active Days:</span>
                  <span class="ml-1">{{ project.activeDays }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </BaseCard>

      <BaseCard title="Review Efficiency">
        <div class="space-y-4">
          <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-green-800">Average Review Time</p>
              <p class="text-2xl font-bold text-green-600">{{ analyticsStore.analytics.averageReviewTime }}m</p>
            </div>
            <div class="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-blue-800">Approval Rate</p>
              <p class="text-2xl font-bold text-blue-600">{{ (analyticsStore.analytics.approvalRate || 0)?.toFixed(1) || '-' }}%</p>
            </div>
            <div class="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
          </div>

          <div class="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
            <div>
              <p class="text-sm font-medium text-purple-800">Total Reviews</p>
              <p class="text-2xl font-bold text-purple-600">{{ analyticsStore.analytics.reviewFrequency?.totalReviews || 0 }}</p>
            </div>
            <div class="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg class="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
          </div>
        </div>
      </BaseCard>
    </div>

    <!-- Embedding System Metrics -->
    <div class="mb-8">
      <h2 class="text-xl font-bold text-gray-900 mb-6">Embedding System Analytics</h2>

      <!-- Embedding Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
        <BaseCard title="Code Embeddings">
          <div class="text-center">
            <p class="text-2xl font-bold text-blue-600">{{ analyticsStore.analytics.embeddingMetrics?.codeEmbeddings?.totalFiles?.toLocaleString() || '0' }}</p>
            <p class="text-sm text-gray-600">Files embedded</p>
            <p class="text-xs text-gray-500 mt-1">{{ analyticsStore.analytics.embeddingMetrics?.codeEmbeddings?.totalProjects || 0 }} projects</p>
          </div>
        </BaseCard>

        <BaseCard title="Documentation">
          <div class="text-center">
            <p class="text-2xl font-bold text-green-600">{{ analyticsStore.analytics.embeddingMetrics?.documentationEmbeddings?.totalSections?.toLocaleString() || '0' }}</p>
            <p class="text-sm text-gray-600">Doc sections</p>
            <p class="text-xs text-gray-500 mt-1">{{ analyticsStore.analytics.embeddingMetrics?.documentationEmbeddings?.totalSources || 0 }} sources</p>
          </div>
        </BaseCard>

        <BaseCard title="Processing Jobs">
          <div class="text-center">
            <p class="text-2xl font-bold text-purple-600">{{ analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.totalJobs?.toLocaleString() || '0' }}</p>
            <p class="text-sm text-gray-600">Total jobs</p>
            <p class="text-xs text-gray-500 mt-1">{{ analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.successRate || 0 }}% success rate</p>
          </div>
        </BaseCard>

        <BaseCard title="System Health">
          <div class="text-center">
            <p class="text-2xl font-bold text-orange-600">{{ analyticsStore.analytics.embeddingMetrics?.systemHealth?.processingEfficiency || 0 }}%</p>
            <p class="text-sm text-gray-600">Efficiency</p>
            <p class="text-xs text-gray-500 mt-1">{{ analyticsStore.analytics.embeddingMetrics?.systemHealth?.embeddingCoverage || 0 }}% coverage</p>
          </div>
        </BaseCard>
      </div>

      <!-- Embedding Details Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <!-- Language Distribution -->
        <BaseCard title="Language Distribution">
          <div class="space-y-3">
            <div v-if="analyticsStore.analytics.embeddingMetrics?.codeEmbeddings?.languageDistribution?.length === 0" class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No language data available</p>
            </div>
            <div v-else>
              <div v-for="lang in analyticsStore.analytics.embeddingMetrics?.codeEmbeddings?.languageDistribution?.slice(0, 8)" :key="lang.language" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-3 h-3 rounded-full" :class="getLanguageColor(lang.language)"></div>
                  <span class="text-sm font-medium text-gray-900">{{ lang.language }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <div class="w-20 bg-gray-200 rounded-full h-2">
                    <div
                      class="bg-blue-600 h-2 rounded-full"
                      :style="{ width: lang.percentage + '%' }"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600 w-12 text-right">{{ lang.fileCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Project Coverage -->
        <BaseCard title="Project Coverage">
          <div class="space-y-3">
            <div v-if="analyticsStore.analytics.embeddingMetrics?.codeEmbeddings?.coverageByProject?.length === 0" class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <p>No project coverage data available</p>
            </div>
            <div v-else>
              <div v-for="project in analyticsStore.analytics.embeddingMetrics?.codeEmbeddings?.coverageByProject?.slice(0, 6)" :key="project.projectName" class="border-b border-gray-200 pb-3 last:border-b-0">
                <div class="flex items-center justify-between mb-1">
                  <h4 class="text-sm font-medium text-gray-900 truncate">{{ project.projectName }}</h4>
                  <span class="text-sm font-semibold text-blue-600">{{ project.embeddedFiles }} files</span>
                </div>
                <div class="text-xs text-gray-500">
                  Last updated: {{ project.lastEmbedded ? formatDate(project.lastEmbedded) : 'Never' }}
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>

      <!-- Embedding Jobs Status -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Job Status Distribution -->
        <BaseCard title="Embedding Jobs Status">
          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-4">
              <div class="text-center p-3 bg-green-50 rounded-lg">
                <p class="text-lg font-bold text-green-600">{{ analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.jobsByStatus?.completed || 0 }}</p>
                <p class="text-xs text-green-800">Completed</p>
              </div>
              <div class="text-center p-3 bg-blue-50 rounded-lg">
                <p class="text-lg font-bold text-blue-600">{{ analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.jobsByStatus?.processing || 0 }}</p>
                <p class="text-xs text-blue-800">Processing</p>
              </div>
              <div class="text-center p-3 bg-yellow-50 rounded-lg">
                <p class="text-lg font-bold text-yellow-600">{{ analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.jobsByStatus?.pending || 0 }}</p>
                <p class="text-xs text-yellow-800">Pending</p>
              </div>
              <div class="text-center p-3 bg-red-50 rounded-lg">
                <p class="text-lg font-bold text-red-600">{{ analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.jobsByStatus?.failed || 0 }}</p>
                <p class="text-xs text-red-800">Failed</p>
              </div>
            </div>
            <div class="mt-4 p-3 bg-gray-50 rounded-lg">
              <div class="flex justify-between items-center">
                <span class="text-sm text-gray-600">Average Processing Time</span>
                <span class="text-sm font-semibold text-gray-900">{{ (analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.avgProcessingTime || 0)?.toFixed(1) || '-' }}m</span>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Documentation Frameworks -->
        <BaseCard title="Documentation Frameworks">
          <div class="space-y-3">
            <div v-if="analyticsStore.analytics.embeddingMetrics?.documentationEmbeddings?.frameworkDistribution?.length === 0" class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p>No documentation frameworks available</p>
            </div>
            <div v-else>
              <div v-for="framework in analyticsStore.analytics.embeddingMetrics?.documentationEmbeddings?.frameworkDistribution" :key="framework.framework" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span class="text-sm font-medium text-gray-900 capitalize">{{ framework.framework }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <div class="w-16 bg-gray-200 rounded-full h-2">
                    <div
                      class="bg-green-600 h-2 rounded-full"
                      :style="{ width: framework.percentage + '%' }"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600 w-8 text-right">{{ framework.sectionCount }}</span>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>

    <!-- Error Alert -->
    <BaseAlert
      v-if="analyticsStore.error"
      type="danger"
      :show="!!analyticsStore.error"
      title="Error"
      :message="analyticsStore.error"
      dismissible
      @dismiss="analyticsStore.clearError"
      class="mt-6"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { format, subDays, startOfWeek, addDays, getMonth } from 'date-fns'
import { useAnalyticsStore } from '@/stores/analytics'
import BaseCard from '@/components/BaseCard.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseAlert from '@/components/BaseAlert.vue'

const analyticsStore = useAnalyticsStore()
const selectedDateRange = ref('30')

const customDateRange = reactive({
  from: format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  to: format(new Date(), 'yyyy-MM-dd')
})

const tooltip = reactive({
  show: false,
  x: 0,
  y: 0,
  content: ''
})



// Heatmap computed properties
const heatmapData = computed(() => {
  const today = new Date()
  const startDate = subDays(today, 364) // Show last year
  const startWeek = startOfWeek(startDate, { weekStartsOn: 0 }) // Sunday start
  const endWeek = startOfWeek(today, { weekStartsOn: 0 }) // End on today's week
  
  // Calculate the actual number of weeks needed
  const totalDays = Math.ceil((endWeek.getTime() - startWeek.getTime()) / (1000 * 60 * 60 * 24)) + 7
  const totalWeeks = Math.ceil(totalDays / 7)
  
  // Create a map of existing trend data for quick lookup
  const trendMap = new Map()
  analyticsStore.analytics.reviewTrends.forEach(trend => {
    trendMap.set(trend.date, trend.reviews)
  })
  
  // Create a 2D array: 7 rows (days) x dynamic columns (weeks)
  const grid = Array(7).fill(null).map(() => Array(totalWeeks).fill(null))
  
  // Fill the grid with data up to today
  for (let week = 0; week < totalWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = addDays(startWeek, week * 7 + day)
      
      // Only include dates up to today
      if (date <= today) {
        const dateStr = format(date, 'yyyy-MM-dd')
        const reviews = trendMap.get(dateStr) || 0
        
        grid[day][week] = {
          date: format(date, 'MMM dd, yyyy'),
          dateStr,
          reviews,
          dayOfWeek: day
        }
      }
    }
  }
  
  // Flatten the grid week by week (CSS grid fills column by column, each column is a week)
  const data = []
  for (let week = 0; week < totalWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      if (grid[day][week]) {
        data.push(grid[day][week])
      }
    }
  }
  
  return data
})

const heatmapWeeks = computed(() => {
  const today = new Date()
  const startDate = subDays(today, 364)
  const startWeek = startOfWeek(startDate, { weekStartsOn: 0 }) // Sunday start
  const endWeek = startOfWeek(today, { weekStartsOn: 0 }) // End on today's week
  
  // Calculate the actual number of weeks needed
  const totalDays = Math.ceil((endWeek.getTime() - startWeek.getTime()) / (1000 * 60 * 60 * 24)) + 7
  const totalWeeks = Math.ceil(totalDays / 7)
  
  const weeks = []
  for (let i = 0; i < totalWeeks; i++) {
    weeks.push(addDays(startWeek, i * 7))
  }
  
  return weeks
})

const heatmapMonths = computed(() => {
  const months: Array<{ name: string; offset: number; width: number }> = []
  const today = new Date()
  const startDate = subDays(today, 364)
  
  let currentMonth = getMonth(startDate)
  let weekIndex = 0
  
  heatmapWeeks.value.forEach((week, index) => {
    const weekMonth = getMonth(week)
    if (weekMonth !== currentMonth && index > 0) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      months.push({
        name: monthNames[weekMonth],
        offset: weekIndex * 13, // 12px width + 1px gap
        width: 24
      })
      currentMonth = weekMonth
    }
    weekIndex++
  })
  
  return months
})

const maxHeatmapValue = computed(() => {
  return Math.max(...heatmapData.value.map(d => d.reviews), 1)
})

const getHeatmapColor = (value: number) => {
  if (value === 0) return 'bg-gray-100'
  
  const intensity = value / maxHeatmapValue.value
  
  if (intensity <= 0.25) return 'bg-green-200'
  if (intensity <= 0.5) return 'bg-green-300'
  if (intensity <= 0.75) return 'bg-green-500'
  return 'bg-green-700'
}

const showTooltip = (event: MouseEvent, day: any) => {
  tooltip.show = true
  tooltip.x = event.clientX + 10
  tooltip.y = event.clientY - 30
  tooltip.content = `${day.date}: ${day.reviews} reviews`
}

const hideTooltip = () => {
  tooltip.show = false
}



const formatDate = (dateStr: string) => {
  return format(new Date(dateStr), 'MMM dd, yyyy')
}

const getLanguageColor = (language: string) => {
  const colors: Record<string, string> = {
    'javascript': 'bg-yellow-500',
    'typescript': 'bg-blue-500',
    'python': 'bg-green-500',
    'java': 'bg-red-500',
    'go': 'bg-cyan-500',
    'rust': 'bg-orange-500',
    'php': 'bg-purple-500',
    'ruby': 'bg-red-400',
    'c++': 'bg-blue-600',
    'c#': 'bg-purple-600',
    'swift': 'bg-orange-400',
    'kotlin': 'bg-purple-400',
    'dart': 'bg-blue-400',
    'vue': 'bg-green-400',
    'html': 'bg-orange-300',
    'css': 'bg-blue-300',
    'scss': 'bg-pink-400',
    'json': 'bg-gray-500',
    'yaml': 'bg-red-300',
    'markdown': 'bg-gray-600'
  }
  return colors[language.toLowerCase()] || 'bg-gray-400'
}

const handleDateRangeChange = () => {
  if (selectedDateRange.value !== 'custom') {
    const days = parseInt(selectedDateRange.value)
    const from = format(subDays(new Date(), days), 'yyyy-MM-dd')
    const to = format(new Date(), 'yyyy-MM-dd')
    
    analyticsStore.fetchAnalytics({ from, to })
  }
}

const applyCustomDateRange = () => {
  analyticsStore.fetchAnalytics({
    from: customDateRange.from,
    to: customDateRange.to
  })
}

const refreshAnalytics = () => {
  if (selectedDateRange.value === 'custom') {
    applyCustomDateRange()
  } else {
    handleDateRangeChange()
  }
}

onMounted(() => {
  handleDateRangeChange()
})
</script>
