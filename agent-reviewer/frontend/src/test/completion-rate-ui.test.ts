// Test file for completion rate UI components
import { describe, test, expect, beforeEach, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import AnalyticsView from '../views/AnalyticsView.vue';
import { useAnalyticsStore } from '../stores/analytics';

// Mock the API
const mockCompletionRateApi = {
  getTeamCompletionRates: async () => ({
    success: true,
    data: {
      month: 1,
      year: 2024,
      teamStats: {
        totalDevelopers: 5,
        avgCompletionRate: 75.5,
        totalTasks: 100,
        totalCompletedTasks: 75
      },
      developers: [
        {
          username: 'john-doe',
          month: 1,
          year: 2024,
          totalTasks: 20,
          tasksWithMRs: 18,
          completedTasks: 15,
          completionRate: 75.0,
          calculatedAt: '2024-01-31T23:59:59Z'
        },
        {
          username: 'jane-smith',
          month: 1,
          year: 2024,
          totalTasks: 25,
          tasksWithMRs: 22,
          completedTasks: 20,
          completionRate: 80.0,
          calculatedAt: '2024-01-31T23:59:59Z'
        }
      ]
    }
  }),
  getCompletionRateStats: async () => ({
    success: true,
    data: {
      totalDevelopers: 5,
      totalTasks: 100,
      totalCompletedTasks: 75,
      overallCompletionRate: 75.0,
      topPerformers: [
        {
          username: 'jane-smith',
          completionRate: 80.0,
          totalTasks: 25
        },
        {
          username: 'john-doe',
          completionRate: 75.0,
          totalTasks: 20
        }
      ],
      monthlyTrends: [
        {
          month: 1,
          year: 2024,
          avgCompletionRate: 75.0,
          totalTasks: 100
        },
        {
          month: 12,
          year: 2023,
          avgCompletionRate: 70.0,
          totalTasks: 90
        }
      ]
    }
  })
};

// Mock the analytics API
const mockAnalyticsApi = {
  getAnalytics: async () => ({
    success: true,
    data: {
      totalReviews: 150,
      approvalRate: 85.5,
      averageReviewTime: 45.2,
      reviewsToday: 5,
      reviewsThisWeek: 25,
      reviewsThisMonth: 100,
      criticalIssuesTotal: 12,
      reviewFrequency: {
        totalReviews: 150,
        activeDays: 20,
        avgReviewsPerDay: 7.5
      },
      topProjects: [],
      projectActivity: [],
      reviewTrends: [],
      issueCategories: [],
      embeddingMetrics: {
        codeEmbeddings: {
          totalFiles: 0,
          totalProjects: 0,
          languageDistribution: [],
          coverageByProject: [],
          recentActivity: [],
          avgFilesPerProject: 0,
          lastUpdated: null
        },
        documentationEmbeddings: {
          totalSections: 0,
          totalSources: 0,
          frameworkDistribution: [],
          sourceHealth: [],
          lastUpdated: null
        },
        embeddingJobs: {
          totalJobs: 0,
          successRate: 0,
          avgProcessingTime: 0,
          recentJobs: [],
          jobsByStatus: {
            pending: 0,
            processing: 0,
            completed: 0,
            failed: 0,
            retrying: 0
          }
        },
        systemHealth: {
          embeddingCoverage: 0,
          documentationCoverage: 0,
          processingEfficiency: 0,
          lastEmbeddingTime: null
        }
      },
      mergeRequestMetrics: null,
      queueStats: {
        total: 0,
        pending: 0,
        processing: 0,
        completed: 0,
        failed: 0,
        retrying: 0
      }
    }
  })
};

// Mock the API modules
vi.mock('../services/api', () => ({
  analyticsApi: mockAnalyticsApi,
  completionRateApi: mockCompletionRateApi
}));

describe('Completion Rate UI Components', () => {
  let pinia: any;

  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });

  describe('Analytics Store Integration', () => {
    test('should initialize completion rate data structure', () => {
      const store = useAnalyticsStore();
      
      expect(store.completionRateData).toBeDefined();
      expect(store.completionRateData.individualRates).toEqual({});
      expect(store.completionRateData.trends).toEqual({});
      expect(store.completionRateData.teamRates).toBeUndefined();
      expect(store.completionRateData.stats).toBeUndefined();
    });

    test('should fetch team completion rates', async () => {
      const store = useAnalyticsStore();
      
      await store.fetchTeamCompletionRates({ month: '2024-01' });
      
      expect(store.completionRateData.teamRates).toBeDefined();
      expect(store.completionRateData.teamRates?.teamStats.totalDevelopers).toBe(5);
      expect(store.completionRateData.teamRates?.teamStats.avgCompletionRate).toBe(75.5);
      expect(store.completionRateData.teamRates?.developers).toHaveLength(2);
    });

    test('should fetch completion rate stats', async () => {
      const store = useAnalyticsStore();
      
      await store.fetchCompletionRateStats({ month: '2024-01' });
      
      expect(store.completionRateData.stats).toBeDefined();
      expect(store.completionRateData.stats?.overallCompletionRate).toBe(75.0);
      expect(store.completionRateData.stats?.topPerformers).toHaveLength(2);
      expect(store.completionRateData.stats?.monthlyTrends).toHaveLength(2);
    });
  });

  describe('UI Component Rendering', () => {
    test('should render completion rate section', async () => {
      const wrapper = mount(AnalyticsView, {
        global: {
          plugins: [pinia],
          stubs: {
            BaseCard: true,
            BaseButton: true,
            BaseInput: true,
            BaseAlert: true
          }
        }
      });

      // Check if the completion rate section is rendered
      expect(wrapper.text()).toContain('Feature Completion Rate Analytics');
    });

    test('should display completion rate metrics', async () => {
      const store = useAnalyticsStore();
      
      // Pre-populate store with test data
      await store.fetchTeamCompletionRates({ month: '2024-01' });
      await store.fetchCompletionRateStats({ month: '2024-01' });

      const wrapper = mount(AnalyticsView, {
        global: {
          plugins: [pinia],
          stubs: {
            BaseCard: true,
            BaseButton: true,
            BaseInput: true,
            BaseAlert: true
          }
        }
      });

      // Wait for component to update
      await wrapper.vm.$nextTick();

      // Check if metrics are displayed
      expect(wrapper.text()).toContain('Overall Completion Rate');
      expect(wrapper.text()).toContain('Total Tasks');
      expect(wrapper.text()).toContain('Team Performance');
      expect(wrapper.text()).toContain('Top Performer');
    });

    test('should render developer completion rates table', async () => {
      const store = useAnalyticsStore();
      
      // Pre-populate store with test data
      await store.fetchTeamCompletionRates({ month: '2024-01' });

      const wrapper = mount(AnalyticsView, {
        global: {
          plugins: [pinia],
          stubs: {
            BaseCard: true,
            BaseButton: true,
            BaseInput: true,
            BaseAlert: true
          }
        }
      });

      // Wait for component to update
      await wrapper.vm.$nextTick();

      // Check if table headers are present
      expect(wrapper.text()).toContain('Developer Completion Rates');
      expect(wrapper.text()).toContain('Developer');
      expect(wrapper.text()).toContain('Total Tasks');
      expect(wrapper.text()).toContain('Completed');
      expect(wrapper.text()).toContain('Completion Rate');
      expect(wrapper.text()).toContain('Tasks with MRs');
    });

    test('should render monthly trends and top performers', async () => {
      const store = useAnalyticsStore();
      
      // Pre-populate store with test data
      await store.fetchCompletionRateStats({ month: '2024-01' });

      const wrapper = mount(AnalyticsView, {
        global: {
          plugins: [pinia],
          stubs: {
            BaseCard: true,
            BaseButton: true,
            BaseInput: true,
            BaseAlert: true
          }
        }
      });

      // Wait for component to update
      await wrapper.vm.$nextTick();

      // Check if trends and performers sections are present
      expect(wrapper.text()).toContain('Monthly Completion Rate Trends');
      expect(wrapper.text()).toContain('Top Performers');
    });
  });

  describe('Helper Functions', () => {
    test('should format completion rate colors correctly', () => {
      const wrapper = mount(AnalyticsView, {
        global: {
          plugins: [pinia],
          stubs: {
            BaseCard: true,
            BaseButton: true,
            BaseInput: true,
            BaseAlert: true
          }
        }
      });

      const vm = wrapper.vm as any;

      // Test completion rate color function
      expect(vm.getCompletionRateColor(85)).toBe('text-green-600');
      expect(vm.getCompletionRateColor(65)).toBe('text-yellow-600');
      expect(vm.getCompletionRateColor(45)).toBe('text-orange-600');
      expect(vm.getCompletionRateColor(25)).toBe('text-red-600');
    });

    test('should format month and year correctly', () => {
      const wrapper = mount(AnalyticsView, {
        global: {
          plugins: [pinia],
          stubs: {
            BaseCard: true,
            BaseButton: true,
            BaseInput: true,
            BaseAlert: true
          }
        }
      });

      const vm = wrapper.vm as any;

      expect(vm.formatMonthYear(1, 2024)).toBe('Jan 2024');
      expect(vm.formatMonthYear(12, 2023)).toBe('Dec 2023');
    });

    test('should get top performer correctly', async () => {
      const store = useAnalyticsStore();
      await store.fetchCompletionRateStats({ month: '2024-01' });

      const wrapper = mount(AnalyticsView, {
        global: {
          plugins: [pinia],
          stubs: {
            BaseCard: true,
            BaseButton: true,
            BaseInput: true,
            BaseAlert: true
          }
        }
      });

      const vm = wrapper.vm as any;
      const topPerformer = vm.getTopPerformer();

      expect(topPerformer).toBeDefined();
      expect(topPerformer.username).toBe('jane-smith');
      expect(topPerformer.completionRate).toBe(80.0);
    });
  });
});

// Export test functions for manual testing
export async function testCompletionRateUI() {
  console.log('Testing completion rate UI components...');
  
  try {
    // Test data structure
    const pinia = createPinia();
    setActivePinia(pinia);
    
    const store = useAnalyticsStore();
    console.log('✓ Analytics store initialized');

    // Test API calls
    await store.fetchTeamCompletionRates({ month: '2024-01' });
    console.log('✓ Team completion rates fetched');

    await store.fetchCompletionRateStats({ month: '2024-01' });
    console.log('✓ Completion rate stats fetched');

    console.log('✓ Completion rate data:', store.completionRateData);
    
    console.log('All UI tests passed!');
    return true;
    
  } catch (error) {
    console.error('UI test failed:', error);
    return false;
  }
}
