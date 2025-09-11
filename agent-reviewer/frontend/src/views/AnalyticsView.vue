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
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.approvalRate?.toFixed(1) }}%</p>
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
            <p class="text-2xl font-semibold text-gray-900">{{ analyticsStore.analytics.averageReviewTime?.toFixed(1) || '0' }}m</p>
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
                      class="w-3 h-3 rounded-sm transition-all duration-200"
                      :class="getHeatmapColor(day.reviews)"
                      :title="day.reviews >= 0 ? `${day.date}: ${day.reviews} reviews` : ''"
                      @mouseenter="day.reviews >= 0 ? showTooltip($event, day) : null"
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
                <p class="text-xs text-gray-500">{{ project.approvalRate?.toFixed(1) }}% approval rate</p>
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
          <p class="text-2xl font-bold text-primary-600">{{ analyticsStore.analytics.reviewFrequency?.avgReviewsPerDay?.toFixed(1) || '0' }}</p>
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
                  <span class="ml-1">{{ project.avgReviewTime?.toFixed(1) || '0' }}m</span>
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
              <p class="text-2xl font-bold text-green-600">{{ analyticsStore.analytics.averageReviewTime?.toFixed(1) || '0' }}m</p>
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
              <p class="text-2xl font-bold text-blue-600">{{ analyticsStore.analytics.approvalRate?.toFixed(1) }}%</p>
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

    <!-- Issue Categories Section -->
    <div v-if="hasIssueCategories" class="mb-8">
      <h2 class="text-xl font-bold text-gray-900 mb-6">Issue Categories</h2>

      <BaseCard title="Issue Distribution">
        <div class="space-y-3">
          <div v-if="analyticsStore.analytics.issueCategories?.length === 0" class="text-center text-gray-500 py-8">
            <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <p>No issue data available</p>
          </div>
          <div v-else>
            <div v-for="category in analyticsStore.analytics.issueCategories" :key="category.category" class="flex items-center justify-between">
              <div class="flex items-center space-x-3">
                <div class="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span class="text-sm font-medium text-gray-900">{{ category.category }}</span>
              </div>
              <div class="flex items-center space-x-2">
                <div class="w-16 bg-gray-200 rounded-full h-2">
                  <div
                    class="bg-blue-600 h-2 rounded-full"
                    :style="{ width: category.percentage + '%' }"
                  ></div>
                </div>
                <span class="text-sm text-gray-600 w-8 text-right">{{ category.count }}</span>
              </div>
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
                <span class="text-sm font-semibold text-gray-900">{{ analyticsStore.analytics.embeddingMetrics?.embeddingJobs?.avgProcessingTime?.toFixed(1) || '0' }}m</span>
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

    <!-- Feature Completion Rate Analytics Section -->
    <div class="mt-8">
      <div class="flex justify-between items-center mb-6">
        <h2 class="text-xl font-bold text-gray-900">Feature Completion Rate Analytics</h2>
        <div class="flex space-x-3">

          <BaseButton
            @click="refreshCompletionRates"
            :loading="analyticsStore.isLoading"
            size="sm"
            variant="secondary"
          >
            Refresh
          </BaseButton>
        </div>
      </div>

      <!-- Completion Rate Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <BaseCard title="Overall Completion Rate">
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">
              {{ analyticsStore.derivedCompletionStats.overallCompletionRate?.toFixed(1) || '0' }}%
            </p>
            <p class="text-sm text-gray-600">Average completion rate</p>
            <p class="text-xs text-gray-500 mt-1">
              {{ analyticsStore.derivedCompletionStats.totalDevelopers || 0 }} developers
            </p>
          </div>
        </BaseCard>

        <BaseCard title="Total Tasks">
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">
              {{ analyticsStore.derivedCompletionStats.totalTasks?.toLocaleString() || '0' }}
            </p>
            <p class="text-sm text-gray-600">Tasks tracked</p>
            <p class="text-xs text-gray-500 mt-1">
              {{ analyticsStore.derivedCompletionStats.totalCompletedTasks || 0 }} completed
            </p>
          </div>
        </BaseCard>

        <BaseCard title="Team Performance">
          <div class="text-center">
            <p class="text-3xl font-bold text-purple-600">
              {{ analyticsStore.completionRateData.teamRates?.teamStats?.avgCompletionRate?.toFixed(1) || '0' }}%
            </p>
            <p class="text-sm text-gray-600">This month</p>
            <p class="text-xs text-gray-500 mt-1">
              {{ analyticsStore.completionRateData.teamRates?.teamStats?.totalTasks || 0 }} tasks
            </p>
          </div>
        </BaseCard>

        <BaseCard title="Top Performer">
          <div class="text-center">
            <p class="text-2xl font-bold text-orange-600">
              {{ analyticsStore.derivedCompletionStats.topPerformers?.[0]?.username || 'N/A' }}
            </p>
            <p class="text-sm text-gray-600">
              {{ analyticsStore.derivedCompletionStats.topPerformers?.[0]?.completionRate?.toFixed(1) || '0' }}% completion
            </p>
            <p class="text-xs text-gray-500 mt-1">
              {{ analyticsStore.derivedCompletionStats.topPerformers?.[0]?.totalTasks || 0 }} tasks
            </p>
          </div>
        </BaseCard>
      </div>

      <!-- Team Completion Rates Table -->
      <div class="mb-8">
        <BaseCard title="Developer Completion Rates">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Developer
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Tasks
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completed
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Completion Rate
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tasks with MRs
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr v-for="developer in analyticsStore.completionRateData.teamRates?.developers || []" :key="developer.username" class="hover:bg-gray-50 cursor-pointer" @click="openDevTasks(developer)">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-8 w-8">
                        <div class="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span class="text-sm font-medium text-gray-700">{{ getInitials(developer.username) }}</span>
                        </div>
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">{{ developer.username }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ getFilteredTotalTasks(developer) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ getFilteredCompletedTasks(developer) }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-1">
                        <div class="flex items-center justify-between mb-1">
                          <span class="text-sm font-medium" :class="getCompletionRateColor(developer.completionRate)">
                            {{ developer.completionRate?.toFixed(1) }}%
                          </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div
                            class="h-2 rounded-full transition-all duration-300"
                            :class="getCompletionRateBarColor(developer.completionRate)"
                            :style="{ width: developer.completionRate + '%' }"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ getFilteredTasksWithMRs(developer) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>
        <BaseModal :show="showDevModal" :title="devModalTitle" size="xl" @close="showDevModal = false">
          <BaseTable
            :columns="devTaskColumns"
            :data="devTaskRowsFiltered"
            :loading="analyticsStore.isLoading"
            empty-message="No tasks found for this period"
          >
            <template #cell-taskTitle="{ value }">
              <div class="max-w-xs truncate" :title="value">{{ value }}</div>
            </template>
            <template #cell-notionLink="{ item }">
              <div class="whitespace-nowrap">
                <a v-if="item.notionPageId" :href="`https://www.notion.so/${item.notionPageId.replace(/-/g, '')}`" target="_blank" rel="noopener noreferrer" :title="'Open in Notion'">
                  <BaseButton size="xs" variant="secondary">View Notion</BaseButton>
                </a>
                <span v-else class="text-gray-400">-</span>
              </div>
            </template>
            <template #cell-mrLink="{ item }">
              <div class="whitespace-nowrap">
                <a v-if="item.hasAssociatedMR && (item.mrWebUrl || (item.mrProjectId && item.mrIid))"
                   :href="item.mrWebUrl || `https://repopo.transtrack.id/projects/${item.mrProjectId}/merge_requests/${item.mrIid}`"
                   target="_blank" rel="noopener noreferrer" :title="'Open MR'">
                  <BaseButton size="xs" variant="primary">View MR</BaseButton>
                </a>
                <span v-else class="text-gray-400">-</span>
              </div>
            </template>

          </BaseTable>

        </BaseModal>

        <BaseModal :show="showMRListModal" :title="mrListTitle" size="xl" @close="showMRListModal = false">
          <MRTable :mergeRequests="mrList" :loading="mrListLoading" />
        </BaseModal>



      <!-- Completion Rate Trends -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Monthly Trends Chart -->
        <BaseCard title="Monthly Completion Rate Trends">
          <div class="space-y-4">
            <div v-if="!analyticsStore.derivedCompletionStats.monthlyTrends?.length" class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No trend data available</p>
            </div>
            <div v-else class="space-y-3">
              <div v-for="trend in analyticsStore.derivedCompletionStats.monthlyTrends?.slice(0, 6)" :key="`${trend.year}-${trend.month}`" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <span class="text-sm font-medium text-gray-900">{{ formatMonthYear(trend.month, trend.year) }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <div class="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      class="bg-green-600 h-2 rounded-full transition-all duration-300"
                      :style="{ width: trend.avgCompletionRate + '%' }"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600 w-12 text-right">{{ trend.avgCompletionRate?.toFixed(1) }}%</span>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Top Performers -->
        <BaseCard title="Top Performers">
          <div class="space-y-3">
            <div v-if="!analyticsStore.derivedCompletionStats.topPerformers?.length" class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <p>No performance data available</p>
            </div>
            <div v-else>
              <div v-for="(performer, index) in analyticsStore.derivedCompletionStats.topPerformers?.slice(0, 5)" :key="performer.username" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <div class="flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" :class="getPerformerRankColor(index)">
                    {{ index + 1 }}
                  </div>
                  <div>
                    <p class="text-sm font-medium text-gray-900">{{ performer.username }}</p>
                    <p class="text-xs text-gray-500">{{ performer.totalTasks }} tasks</p>
                  </div>
                </div>
                <div class="text-right">
                  <span class="text-sm font-semibold" :class="getCompletionRateColor(performer.completionRate)">
                    {{ performer.completionRate?.toFixed(1) }}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>

    <!-- Merge Request Analytics Section -->
    <div v-if="analyticsStore.analytics.mergeRequestMetrics" class="mt-8">
      <h2 class="text-xl font-bold text-gray-900 mb-6">Merge Request Analytics</h2>

      <!-- MR Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <BaseCard title="Total MRs">
          <div class="text-center">
            <p class="text-3xl font-bold text-blue-600">{{ analyticsStore.analytics.mergeRequestMetrics.totalMRs }}</p>
            <p class="text-sm text-gray-600">All merge requests</p>
            <div class="mt-2 text-xs text-gray-500">
              <span class="text-green-600">{{ analyticsStore.analytics.mergeRequestMetrics.mergedMRs }} merged</span> •
              <span class="text-yellow-600">{{ analyticsStore.analytics.mergeRequestMetrics.openMRs }} open</span> •
              <span class="text-red-600">{{ analyticsStore.analytics.mergeRequestMetrics.closedMRs }} closed</span>
            </div>
          </div>
        </BaseCard>

        <BaseCard title="Success Rate">
          <div class="text-center">
            <p class="text-3xl font-bold text-green-600">{{ analyticsStore.analytics.mergeRequestMetrics.successRate }}%</p>
            <p class="text-sm text-gray-600">Merge success rate</p>
            <div class="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                class="bg-green-600 h-2 rounded-full transition-all duration-300"
                :style="{ width: analyticsStore.analytics.mergeRequestMetrics.successRate + '%' }"
              ></div>
            </div>
          </div>
        </BaseCard>

        <BaseCard title="Avg Merge Time">
          <div class="text-center">
            <p class="text-3xl font-bold text-purple-600">{{ analyticsStore.analytics.mergeRequestMetrics.avgMergeTime?.toFixed(1) || '0' }}h</p>
            <p class="text-sm text-gray-600">Average time to merge</p>
            <p class="text-xs text-gray-500 mt-1">From creation to merge</p>
          </div>
        </BaseCard>

        <BaseCard title="Source Distribution">
          <div class="text-center">
            <p class="text-3xl font-bold text-orange-600">{{ analyticsStore.analytics.mergeRequestMetrics.repopoVsGitlab?.repopo_count || 0 }}</p>
            <p class="text-sm text-gray-600">Repopo events</p>
            <p class="text-xs text-gray-500 mt-1">{{ analyticsStore.analytics.mergeRequestMetrics.repopoVsGitlab?.gitlab_count || 0 }} GitLab direct</p>
          </div>
        </BaseCard>
      </div>

      <!-- Developer Performance Table -->
      <div class="mb-8">
        <BaseCard title="Developer Performance">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Developer
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total MRs
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merged
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Merge Time
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MRs
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="user in analyticsStore.analytics.mergeRequestMetrics.mrsByUser"
                  :key="user.username"
                  class="hover:bg-gray-50 cursor-pointer"
                  @click="openMRListForUser(user.username)"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-8 w-8">
                        <div class="h-8 w-8 rounded-full bg-gray-300 flex items-center justify-center">
                          <span class="text-sm font-medium text-gray-700">{{ getInitials(user.username) }}</span>
                        </div>
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">{{ user.username }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ user.total_mrs }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ user.merged_mrs }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-1">
                        <div class="flex items-center justify-between mb-1">
                          <span class="text-sm font-medium" :class="getSuccessRateColor(user.success_rate)">
                            {{ user.success_rate?.toFixed(1) }}%
                          </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div
                            class="h-2 rounded-full transition-all duration-300"
                            :class="getSuccessRateBarColor(user.success_rate)"
                            :style="{ width: user.success_rate + '%' }"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ user.avg_merge_time_hours?.toFixed(1) }}h
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <BaseButton size="sm" @click.stop="openMRListForUser(user.username)">View</BaseButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>

      <!-- Project Performance Table -->
      <div class="mb-8">
        <BaseCard title="Project Performance">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-gray-200">
              <thead class="bg-gray-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total MRs
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merged
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Success Rate
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Merge Time
                  </th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MRs
                  </th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-gray-200">
                <tr
                  v-for="project in analyticsStore.analytics.mergeRequestMetrics.mrsByProject"
                  :key="project.project_id"
                  class="hover:bg-gray-50 cursor-pointer"
                  @click="openMRListForProject(project.project_id, project.project_name)"
                >
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-shrink-0 h-8 w-8">
                        <div class="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                          <svg class="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                          </svg>
                        </div>
                      </div>
                      <div class="ml-4">
                        <div class="text-sm font-medium text-gray-900">{{ project.project_name }}</div>
                        <div class="text-sm text-gray-500">ID: {{ project.project_id }}</div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ project.total_mrs }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ project.merged_mrs }}
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="flex items-center">
                      <div class="flex-1">
                        <div class="flex items-center justify-between mb-1">
                          <span class="text-sm font-medium" :class="getSuccessRateColor(project.success_rate)">
                            {{ project.success_rate?.toFixed(1) }}%
                          </span>
                        </div>
                        <div class="w-full bg-gray-200 rounded-full h-2">
                          <div
                            class="h-2 rounded-full transition-all duration-300"
                            :class="getSuccessRateBarColor(project.success_rate)"
                            :style="{ width: project.success_rate + '%' }"
                          ></div>
                        </div>
                      </div>
                    </div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {{ project.avg_merge_time_hours?.toFixed(1) }}h
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <BaseButton size="sm" @click.stop="openMRListForProject(project.project_id, project.project_name)">View</BaseButton>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </BaseCard>
      </div>

      <!-- MR Trends Visualization -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <!-- Daily MR Creation Trend -->
        <BaseCard title="Daily MR Creation">
          <div class="space-y-4">
            <div v-if="analyticsStore.analytics.mergeRequestMetrics.dailyMRCreation?.length === 0" class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p>No MR creation data available</p>
            </div>
            <div v-else class="space-y-3">
              <div v-for="item in analyticsStore.analytics.mergeRequestMetrics.dailyMRCreation" :key="item.date" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <span class="text-sm font-medium text-gray-900">{{ formatDate(item.date) }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <div class="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      class="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      :style="{ width: (item.value / getMaxDailyMRs() * 100) + '%' }"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600 w-8 text-right">{{ item.value }}</span>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>

        <!-- Merge Time Trends -->
        <BaseCard title="Merge Time Trends">
          <div class="space-y-4">
            <div v-if="analyticsStore.analytics.mergeRequestMetrics.mergeTimeTrends?.length === 0" class="text-center text-gray-500 py-8">
              <svg class="w-12 h-12 mx-auto mb-4 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p>No merge time data available</p>
            </div>
            <div v-else class="space-y-3">
              <div v-for="item in analyticsStore.analytics.mergeRequestMetrics.mergeTimeTrends" :key="item.date" class="flex items-center justify-between">
                <div class="flex items-center space-x-3">
                  <span class="text-sm font-medium text-gray-900">{{ formatDate(item.date) }}</span>
                </div>
                <div class="flex items-center space-x-2">
                  <div class="w-24 bg-gray-200 rounded-full h-2">
                    <div
                      class="bg-purple-600 h-2 rounded-full transition-all duration-300"
                      :style="{ width: (item.value / getMaxMergeTime() * 100) + '%' }"
                    ></div>
                  </div>
                  <span class="text-sm text-gray-600 w-12 text-right">{{ item.value?.toFixed(1) }}h</span>
                </div>
              </div>
            </div>
          </div>
        </BaseCard>
      </div>
    </div>

    <!-- Debug Info (only in development) -->
    <div v-if="false" class="hidden">{{ debugAnalyticsData }}</div>

    <!-- Error Alerts -->
    <BaseAlert
      v-if="analyticsStore.error"
      type="danger"
      :show="!!analyticsStore.error"
      title="Analytics Error"
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
import type { CompletionRateResponse } from '@/types/performance'
import BaseModal from '@/components/BaseModal.vue'
import BaseTable from '@/components/BaseTable.vue'


// === Developer tasks modal state ===
const showDevModal = ref(false)
interface CompletionRateBreakdownLite {
  taskTitle: string
  taskStatus: string
  hasAssociatedMR: boolean
  mrStatus?: string
  mrMergedAt?: string | Date
  isCompleted: boolean
  estimationStart?: string | Date
  estimationEnd?: string | Date
  developerStart?: string | Date
  developerEnd?: string | Date
  completedAt?: string | Date
  // MR timing
  approvalAt?: string | Date
  // Derived analytics
  devLeadTimeHours?: number
  qaTimeHours?: number
  approvalTimeHours?: number
  estimationOverrunHours?: number
  isLate?: boolean
  // Links
  notionPageId?: string
  mrProjectId?: number
  mrIid?: number
  mrWebUrl?: string
}
type DevWithBreakdown = CompletionRateResponse & { taskBreakdown?: CompletionRateBreakdownLite[] }
const selectedDev = ref<DevWithBreakdown | null>(null)
const openDevTasks = (dev: DevWithBreakdown) => { selectedDev.value = dev; showDevModal.value = true }
const devModalTitle = computed(() => selectedDev.value ? `${selectedDev.value.username} — Tasks & MRs (${analyticsStore.completionRateData.teamRates?.month || currentCompletionMonth.value})` : 'Tasks & MRs')
type TableColumn = { key: string; label: string; sortable?: boolean; type?: 'text' | 'number' | 'date' | 'boolean'; format?: string }
const devTaskColumns: TableColumn[] = [
  { key: 'taskTitle', label: 'Task', type: 'text' },
  { key: 'taskStatus', label: 'Task Status', type: 'text' },
  { key: 'hasAssociatedMR', label: 'Has MR', type: 'boolean' },
  { key: 'mrStatus', label: 'MR Status', type: 'text' },
  { key: 'mrMergedAt', label: 'Merged At', type: 'date', format: 'MMM dd, yyyy HH:mm' },
  { key: 'approvalAt', label: 'Approval At', type: 'date', format: 'MMM dd, yyyy HH:mm' },
  { key: 'estimationStart', label: 'Est. Start', type: 'date', format: 'MMM dd, yyyy HH:mm' },
  { key: 'estimationEnd', label: 'Est. End', type: 'date', format: 'MMM dd, yyyy HH:mm' },
  { key: 'developerStart', label: 'Dev Start', type: 'date', format: 'MMM dd, yyyy HH:mm' },
  { key: 'developerEnd', label: 'Dev End', type: 'date', format: 'MMM dd, yyyy HH:mm' },
  { key: 'completedAt', label: 'Completed At', type: 'date', format: 'MMM dd, yyyy HH:mm' },
  { key: 'devLeadTimeHours', label: 'Dev Lead (h)', type: 'number' },
  { key: 'qaTimeHours', label: 'QA (h)', type: 'number' },
  { key: 'approvalTimeHours', label: 'Approval Time (h)', type: 'number' },
  { key: 'estimationOverrunHours', label: 'Overrun (h)', type: 'number' },
  { key: 'isLate', label: 'Late', type: 'boolean' },
  { key: 'notionLink', label: 'Notion', type: 'text' },
  { key: 'mrLink', label: 'MR', type: 'text' },
]

// Active date range derived from top-level filter
const activeDateRange = computed(() => {
  if (selectedDateRange.value === 'custom') {
    return { from: new Date(customDateRange.from), to: new Date(customDateRange.to) }
  }
  const days = parseInt(selectedDateRange.value || '30')
  return { from: subDays(new Date(), days), to: new Date() }
})

function parseMaybeDate(v?: string | Date): Date | undefined {
  if (!v) return undefined
  const d = typeof v === 'string' ? new Date(v) : v
  return isNaN(d.getTime()) ? undefined : d
}

function getRowReferenceDate(row: CompletionRateBreakdownLite): Date | undefined {
  // Mirror backend logic preference: estimationStart -> developerStart -> completedAt -> approvalAt -> mrMergedAt
  return (
    parseMaybeDate(row.estimationStart) ||
    parseMaybeDate(row.developerStart) ||
    parseMaybeDate(row.completedAt) ||
    parseMaybeDate(row.approvalAt) ||
    parseMaybeDate(row.mrMergedAt)
  )
}

const devTaskRowsFiltered = computed(() => {
  const rows = (selectedDev.value?.taskBreakdown || []) as CompletionRateBreakdownLite[]
  const { from, to } = activeDateRange.value
  if (!from || !to) return rows
  const fromMs = from.getTime()
  const toMs = to.getTime()
  return rows.filter(r => {
    const d = getRowReferenceDate(r)
    if (!d) return false
    const t = d.getTime()
    return t >= fromMs && t <= toMs
  })
})

// Helpers to filter a developer's breakdown by active date range
function filterBreakdownByDate(breakdown?: CompletionRateBreakdownLite[]): CompletionRateBreakdownLite[] {
  const items = breakdown || []
  const { from, to } = activeDateRange.value
  if (!from || !to) return items
  const fromMs = from.getTime(), toMs = to.getTime()
  return items.filter(r => {
    const d = getRowReferenceDate(r)
    return d ? (d.getTime() >= fromMs && d.getTime() <= toMs) : false
  })
}

function getFilteredTotalTasks(dev: DevWithBreakdown): number {
  return filterBreakdownByDate(dev.taskBreakdown).length
}
function getFilteredCompletedTasks(dev: DevWithBreakdown): number {
  return filterBreakdownByDate(dev.taskBreakdown).filter(r => r.isCompleted).length
}
function getFilteredTasksWithMRs(dev: DevWithBreakdown): number {
  return filterBreakdownByDate(dev.taskBreakdown).filter(r => r.hasAssociatedMR).length
}

// MR list modal (for Developer/Project Performance sections)
import { mergeRequestApi } from '@/services/api'
import MRTable from '@/components/MRTable.vue'
import type { MergeRequestDetails } from '@/types'

const showMRListModal = ref(false)
const mrListTitle = ref('')
const mrList = ref<MergeRequestDetails[]>([])
const mrListLoading = ref(false)

async function openMRListForUser(username: string) {
  const { from, to } = activeDateRange.value
  mrListTitle.value = `MRs by ${username}`
  mrListLoading.value = true
  try {
    const resp = await mergeRequestApi.getMergeRequests({
      authorUsername: username,
      from_date: format(from, 'yyyy-MM-dd'),
      to_date: format(to, 'yyyy-MM-dd'),
      limit: 100
    })
    mrList.value = (resp.success && resp.data) ? resp.data : []
  } finally {
    mrListLoading.value = false
    showMRListModal.value = true
  }
}

async function openMRListForProject(projectId: number, projectName?: string) {
  const { from, to } = activeDateRange.value
  mrListTitle.value = `MRs for ${projectName || 'Project ' + projectId}`
  mrListLoading.value = true
  try {
    const resp = await mergeRequestApi.getMergeRequests({
      projectId,
      from_date: format(from, 'yyyy-MM-dd'),
      to_date: format(to, 'yyyy-MM-dd'),
      limit: 100
    })
    mrList.value = (resp.success && resp.data) ? resp.data : []
  } finally {
    mrListLoading.value = false
    showMRListModal.value = true
  }
}

import BaseCard from '@/components/BaseCard.vue'
import BaseButton from '@/components/BaseButton.vue'
import BaseInput from '@/components/BaseInput.vue'
import BaseAlert from '@/components/BaseAlert.vue'

const analyticsStore = useAnalyticsStore()
const selectedDateRange = ref('30')
// Derive completion-rate month from the top-level date filter (use end date)
const currentCompletionMonth = computed(() => {
  const toStr = selectedDateRange.value === 'custom' ? customDateRange.to : format(new Date(), 'yyyy-MM-dd')
  const toDate = new Date(toStr)
  return format(toDate, 'yyyy-MM')
})

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



// Helper functions
const getInitials = (name: string): string => {
  return name
    .split(/[\s._-]+/)
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .substring(0, 2)
}

const getSuccessRateColor = (rate: number): string => {
  if (rate >= 90) return 'text-green-600'
  if (rate >= 70) return 'text-yellow-600'
  return 'text-red-600'
}

const getSuccessRateBarColor = (rate: number): string => {
  if (rate >= 90) return 'bg-green-500'
  if (rate >= 70) return 'bg-yellow-500'
  return 'bg-red-500'
}

const getCompletionRateColor = (rate: number): string => {
  if (rate >= 80) return 'text-green-600'
  if (rate >= 60) return 'text-yellow-600'
  if (rate >= 40) return 'text-orange-600'
  return 'text-red-600'
}

const getCompletionRateBarColor = (rate: number): string => {
  if (rate >= 80) return 'bg-green-500'
  if (rate >= 60) return 'bg-yellow-500'
  if (rate >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

const getPerformerRankColor = (index: number): string => {
  if (index === 0) return 'bg-yellow-500 text-white' // Gold
  if (index === 1) return 'bg-gray-400 text-white'   // Silver
  if (index === 2) return 'bg-orange-600 text-white' // Bronze
  return 'bg-blue-500 text-white'
}

const formatMonthYear = (month: number, year: number): string => {
  const date = new Date(year, month - 1, 1)
  return format(date, 'MMM yyyy')
}

const getMaxDailyMRs = (): number => {
  const dailyData = analyticsStore.analytics.mergeRequestMetrics?.dailyMRCreation || []
  return Math.max(...dailyData.map(item => item.value), 1)
}

const getMaxMergeTime = (): number => {
  const mergeTimeData = analyticsStore.analytics.mergeRequestMetrics?.mergeTimeTrends || []
  return Math.max(...mergeTimeData.map(item => item.value), 1)
}

// Debug computed property to check data structure
const debugAnalyticsData = computed(() => {
  console.log('Current analytics data structure:', {
    totalReviews: analyticsStore.analytics.totalReviews,
    approvalRate: analyticsStore.analytics.approvalRate,
    averageReviewTime: analyticsStore.analytics.averageReviewTime,
    reviewTrends: analyticsStore.analytics.reviewTrends?.length,
    projectActivity: analyticsStore.analytics.projectActivity?.length,
    embeddingMetrics: !!analyticsStore.analytics.embeddingMetrics,
    mergeRequestMetrics: !!analyticsStore.analytics.mergeRequestMetrics,
    queueStats: !!analyticsStore.analytics.queueStats,
    issueCategories: analyticsStore.analytics.issueCategories?.length
  })
  return analyticsStore.analytics
})

// Show Issue Categories only if data has meaningful values
const hasIssueCategories = computed(() => {
  const list = analyticsStore.analytics.issueCategories as Array<{ count?: number; percentage?: number }> | undefined
  return Array.isArray(list) && list.some(c => ((c?.count ?? 0) > 0) || ((c?.percentage ?? 0) > 0))
})


// Heatmap computed properties
const heatmapData = computed(() => {
  const today = new Date()
  const startDate = subDays(today, 364)
  const startDayOfGrid = startOfWeek(startDate, { weekStartsOn: 0 }) // The very first Sunday to show on the grid

  const totalWeeks = 53; // A year can span up to 53 weeks

  const trendMap = new Map()
  analyticsStore.analytics.reviewTrends.forEach(trend => {
    trendMap.set(trend.date, trend.reviews)
  })

  // Create a 2D array representing the grid: 7 rows (days) x 53 columns (weeks)
  const grid = Array(7).fill(null).map(() => Array(totalWeeks).fill(null))

  // Populate the 2D grid with data or placeholders
  for (let week = 0; week < totalWeeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = addDays(startDayOfGrid, week * 7 + day)

      // Only include dates from the last year up to today
      if (date >= startDate && date <= today) {
        const dateStr = format(date, 'yyyy-MM-dd')
        const reviews = trendMap.get(dateStr) || 0
        grid[day][week] = {
          date: format(date, 'MMM dd, yyyy'),
          dateStr,
          reviews,
          dayOfWeek: day
        }
      } else {
        // Use a placeholder for dates outside the range (future or too far past)
        // This ensures the grid structure is always complete
        grid[day][week] = {
          date: format(date, 'MMM dd, yyyy'),
          reviews: -1, // Use -1 to signify an invalid/placeholder cell
          placeholder: true
        }
      }
    }
  }

  // Flatten the grid row-by-row to match CSS grid's default filling order
  const data = []
  for (let day = 0; day < 7; day++) {
    for (let week = 0; week < totalWeeks; week++) {
      data.push(grid[day][week])
    }
  }

  return data
})


const heatmapWeeks = computed(() => {
  // Return a fixed array of 53 weeks for the grid columns
  const totalWeeks = 53;
  const startDate = subDays(new Date(), 364);
  const startDayOfGrid = startOfWeek(startDate, { weekStartsOn: 0 });

  const weeks = [];
  for (let i = 0; i < totalWeeks; i++) {
    weeks.push(addDays(startDayOfGrid, i * 7));
  }
  return weeks;
});

const heatmapMonths = computed(() => {
  const months: Array<{ name: string; offset: number; width: number }> = []
  let lastMonth = -1

  heatmapWeeks.value.forEach((week, index) => {
    const month = getMonth(addDays(week, 3)) // Check middle of the week for month
    if (month !== lastMonth) {
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
      if (index > 0) { // Don't add a label for the very first week
        months.push({
          name: monthNames[month],
          offset: 0, // We'll calculate this later
          width: index, // Temporarily store the week index
        })
      }
      lastMonth = month
    }
  })

  // Calculate offsets based on previous month's position
  for (let i = 0; i < months.length; i++) {
    const prevWidth = i > 0 ? months[i - 1].width : 0;
    months[i].offset = (months[i].width - prevWidth) * 13; // 12px width + 1px gap
  }

  // Clean up width property
  months.forEach(m => m.width = 24);

  return months.slice(0, 12) // Ensure we don't have too many labels
})

const maxHeatmapValue = computed(() => {
  return Math.max(...heatmapData.value.map(d => d.reviews), 1)
})

const getHeatmapColor = (value: number) => {
  // -1 indicates a placeholder cell that should be transparent
  if (value < 0) return 'bg-transparent'
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
    // Also update completion rates to match the top-level date filter
    refreshCompletionRates()
  }
}

const applyCustomDateRange = () => {
  analyticsStore.fetchAnalytics({
    from: customDateRange.from,
    to: customDateRange.to
  })
  // Also update completion rates to match the top-level date filter
  refreshCompletionRates()
}

const refreshAnalytics = async () => {
  try {
    const analyticsDateRange = selectedDateRange.value === 'custom'
      ? { from: customDateRange.from, to: customDateRange.to }
      : undefined

    await analyticsStore.fetchAnalytics(analyticsDateRange)

    // Debug: Log the analytics data to console
    console.log('Analytics data loaded:', analyticsStore.analytics)
    console.log('MR Metrics:', analyticsStore.analytics.mergeRequestMetrics)
  } catch (error) {
    console.error('Error refreshing analytics:', error)
  }
}


const refreshCompletionRates = async () => {
  try {
    console.log('🔄 Starting completion rate refresh...')
    const filters = {
      month: currentCompletionMonth.value
    }


    console.log('📅 Using filters:', filters)

    // Fetch team completion rates
    console.log('📊 Fetching team completion rates...')
    await analyticsStore.fetchTeamCompletionRates(filters)
    console.log('✅ Team completion rates fetched')

    console.log('🎉 Completion rate data loaded:', analyticsStore.completionRateData)
  } catch (error) {
    console.error('❌ Error refreshing completion rates:', error)
  }
}

onMounted(() => {
  handleDateRangeChange()
  refreshCompletionRates()
})
</script>
