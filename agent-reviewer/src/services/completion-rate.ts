import { dbService } from './database.js';
import { taskMRMappingService } from './task-mr-mapping.js';
import {
  FeatureCompletionRate,
  CompletionRateResponse,
  TeamCompletionRateResponse,
  CompletionRateTrendsResponse,
  CompletionRateBreakdown,
  CompletionRateFilters
} from '../types/performance.js';

/**
 * Service for calculating feature completion rates
 */
export class CompletionRateService {
  private cache = new Map<string, { data: any; timestamp: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Calculate completion rate for a specific developer and month
   */
  async calculateCompletionRate(
    username: string,
    month: number,
    year: number,
    projectId?: number
  ): Promise<CompletionRateResponse> {
    try {
      console.log(`Calculating completion rate for ${username} - ${year}-${month.toString().padStart(2, '0')}`);

      // Get date range for the month
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Get all tasks assigned to the developer in the time period
      const tasks = await dbService.getNotionTasksByAssignee(
        username,
        startDate,
        endDate,
        projectId
      );

      console.log(`Found ${tasks.length} tasks for ${username} in ${year}-${month}`);

      // Calculate metrics
      const totalTasks = tasks.length;
      let tasksWithMRs = 0;
      let completedTasks = 0;
      const taskBreakdown: CompletionRateBreakdown[] = [];

      for (const task of tasks) {
        // Get MR mappings for this task
        const mrMappings = await taskMRMappingService.getMRMappingsForTask(task.id!);
        const hasAssociatedMR = mrMappings.length > 0;
        
        if (hasAssociatedMR) {
          tasksWithMRs++;
        }

        // Check if task is completed (has merged MR)
        const isCompleted = await taskMRMappingService.isTaskCompletedByMergedMRs(task.id!);
        if (isCompleted) {
          completedTasks++;
        }

        // Add to breakdown
        const mrMapping = mrMappings[0]; // Take first MR if multiple
        taskBreakdown.push({
          taskId: task.id!,
          taskTitle: task.title,
          taskStatus: task.status,
          hasAssociatedMR,
          mrStatus: mrMapping?.mr_status,
          mrMergedAt: mrMapping?.mr_merged_at,
          isCompleted
        });
      }

      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      // Store calculated rate in database
      await dbService.upsertFeatureCompletionRate({
        username,
        project_id: projectId || 0,
        month,
        year,
        total_tasks: totalTasks,
        tasks_with_mrs: tasksWithMRs,
        completed_tasks: completedTasks,
        completion_rate: completionRate,
        calculated_at: new Date()
      });

      return {
        username,
        month: `${year}-${month.toString().padStart(2, '0')}`,
        totalTasks,
        tasksWithMRs,
        completedTasks,
        completionRate: Math.round(completionRate * 100) / 100,
        taskBreakdown,
        projectId,
        projectName: projectId ? await this.getProjectName(projectId) : undefined
      };

    } catch (error) {
      console.error(`Error calculating completion rate for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Get team-wide completion rates for a month
   */
  async getTeamCompletionRates(
    month: number,
    year: number,
    projectId?: number
  ): Promise<TeamCompletionRateResponse> {
    try {
      console.log(`Getting team completion rates for ${year}-${month}`);

      // Get all developers who have tasks in the time period
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);

      // Query to get unique developers with tasks in the period
      let query = `
        SELECT DISTINCT assignee_username
        FROM notion_tasks
        WHERE assignee_username IS NOT NULL
          AND created_at BETWEEN $1 AND $2
      `;
      const params: any[] = [startDate, endDate];

      if (projectId) {
        query += ` AND project_id = $3`;
        params.push(projectId);
      }

      const result = await dbService.query(query, params);
      const developers = result.rows.map(row => row.assignee_username);

      console.log(`Found ${developers.length} developers with tasks in ${year}-${month}`);

      // Calculate completion rates for each developer
      const developerRates: CompletionRateResponse[] = [];
      let totalTasks = 0;
      let totalCompletedTasks = 0;

      for (const username of developers) {
        try {
          const rate = await this.calculateCompletionRate(username, month, year, projectId);
          developerRates.push(rate);
          totalTasks += rate.totalTasks;
          totalCompletedTasks += rate.completedTasks;
        } catch (error) {
          console.error(`Error calculating rate for developer ${username}:`, error);
        }
      }

      // Calculate team averages
      const avgCompletionRate = developerRates.length > 0
        ? developerRates.reduce((sum, dev) => sum + dev.completionRate, 0) / developerRates.length
        : 0;

      return {
        month: `${year}-${month.toString().padStart(2, '0')}`,
        teamStats: {
          avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
          totalDevelopers: developers.length,
          totalTasks,
          totalCompletedTasks
        },
        developers: developerRates.sort((a, b) => b.completionRate - a.completionRate)
      };

    } catch (error) {
      console.error(`Error getting team completion rates:`, error);
      throw error;
    }
  }

  /**
   * Get completion rate trends for a developer over time
   */
  async getCompletionRateTrends(
    username: string,
    months: number = 6,
    projectId?: number
  ): Promise<CompletionRateTrendsResponse> {
    try {
      console.log(`Getting completion rate trends for ${username} over ${months} months`);

      const trends = [];
      const currentDate = new Date();

      // Get data for the last N months
      for (let i = 0; i < months; i++) {
        const targetDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
        const month = targetDate.getMonth() + 1;
        const year = targetDate.getFullYear();

        try {
          const rate = await this.calculateCompletionRate(username, month, year, projectId);
          trends.unshift({
            month: rate.month,
            completionRate: rate.completionRate,
            totalTasks: rate.totalTasks,
            completedTasks: rate.completedTasks
          });
        } catch (error) {
          console.error(`Error getting trend data for ${username} ${year}-${month}:`, error);
          // Add empty data point for missing months
          trends.unshift({
            month: `${year}-${month.toString().padStart(2, '0')}`,
            completionRate: 0,
            totalTasks: 0,
            completedTasks: 0
          });
        }
      }

      return {
        username,
        trends
      };

    } catch (error) {
      console.error(`Error getting completion rate trends for ${username}:`, error);
      throw error;
    }
  }

  /**
   * Get cached completion rate or calculate if not cached
   */
  async getCachedCompletionRate(
    username: string,
    month: number,
    year: number,
    projectId?: number
  ): Promise<CompletionRateResponse> {
    const cacheKey = `completion-rate-${username}-${year}-${month}-${projectId || 'all'}`;
    const cached = this.cache.get(cacheKey);

    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      console.log(`Returning cached completion rate for ${username}`);
      return cached.data;
    }

    const data = await this.calculateCompletionRate(username, month, year, projectId);
    this.cache.set(cacheKey, { data, timestamp: Date.now() });

    return data;
  }

  /**
   * Clear cache for a specific developer or all cache
   */
  clearCache(username?: string): void {
    if (username) {
      // Clear cache entries for specific developer
      for (const [key] of this.cache) {
        if (key.includes(`-${username}-`)) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }

  /**
   * Get project name by ID
   */
  private async getProjectName(projectId: number): Promise<string | undefined> {
    try {
      const project = await dbService.getProjectMetadata(projectId);
      return project?.name;
    } catch (error) {
      console.error(`Error getting project name for ID ${projectId}:`, error);
      return undefined;
    }
  }

  /**
   * Recalculate completion rates for all developers in a time period
   */
  async recalculateCompletionRates(
    month: number,
    year: number,
    projectId?: number
  ): Promise<number> {
    try {
      console.log(`Recalculating completion rates for ${year}-${month}`);

      const teamRates = await this.getTeamCompletionRates(month, year, projectId);
      
      // Clear cache for this period
      this.clearCache();

      console.log(`Recalculated completion rates for ${teamRates.developers.length} developers`);
      return teamRates.developers.length;

    } catch (error) {
      console.error(`Error recalculating completion rates:`, error);
      throw error;
    }
  }

  /**
   * Get completion rates with filters
   */
  async getCompletionRatesWithFilters(filters: CompletionRateFilters): Promise<FeatureCompletionRate[]> {
    try {
      // Parse month if provided
      let month: number | undefined;
      let year: number | undefined;

      if (filters.month) {
        const [yearStr, monthStr] = filters.month.split('-');
        year = parseInt(yearStr);
        month = parseInt(monthStr);
      }

      const dbFilters = {
        username: filters.username,
        projectId: filters.projectId,
        month,
        year,
        dateFrom: filters.dateFrom ? new Date(filters.dateFrom) : undefined,
        dateTo: filters.dateTo ? new Date(filters.dateTo) : undefined
      };

      return await dbService.getFeatureCompletionRates(dbFilters);
    } catch (error) {
      console.error('Error getting completion rates with filters:', error);
      throw error;
    }
  }

  /**
   * Get completion rate for current month (default behavior)
   */
  async getCurrentMonthCompletionRate(
    username: string,
    projectId?: number
  ): Promise<CompletionRateResponse> {
    const now = new Date();
    return this.calculateCompletionRate(username, now.getMonth() + 1, now.getFullYear(), projectId);
  }

  /**
   * Get project-level completion rates
   */
  async getProjectCompletionRates(
    projectId: number,
    month: number,
    year: number
  ): Promise<{
    projectId: number;
    projectName?: string;
    month: string;
    developers: CompletionRateResponse[];
    projectStats: {
      avgCompletionRate: number;
      totalDevelopers: number;
      totalTasks: number;
      totalCompletedTasks: number;
    };
  }> {
    try {
      const teamRates = await this.getTeamCompletionRates(month, year, projectId);
      const projectName = await this.getProjectName(projectId);

      return {
        projectId,
        projectName,
        month: teamRates.month,
        developers: teamRates.developers,
        projectStats: teamRates.teamStats
      };
    } catch (error) {
      console.error(`Error getting project completion rates for project ${projectId}:`, error);
      throw error;
    }
  }

  /**
   * Trigger completion rate recalculation when MR is merged
   */
  async onMergeRequestMerged(
    projectId: number,
    mergeRequestIid: number,
    authorUsername: string
  ): Promise<void> {
    try {
      console.log(`Triggering completion rate recalculation for MR !${mergeRequestIid} merge`);

      // Get current month/year
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Clear cache for the author
      this.clearCache(authorUsername);

      // Recalculate completion rate for the author
      await this.calculateCompletionRate(authorUsername, month, year, projectId);

      console.log(`Recalculated completion rate for ${authorUsername} after MR merge`);
    } catch (error) {
      console.error(`Error recalculating completion rate after MR merge:`, error);
    }
  }

  /**
   * Get completion rate statistics summary
   */
  async getCompletionRateStats(
    projectId?: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<{
    totalDevelopers: number;
    avgCompletionRate: number;
    totalTasks: number;
    totalCompletedTasks: number;
    topPerformers: { username: string; completionRate: number }[];
    monthlyTrends: { month: string; avgCompletionRate: number }[];
  }> {
    try {
      const filters: any = { projectId };
      if (dateFrom) filters.dateFrom = dateFrom;
      if (dateTo) filters.dateTo = dateTo;

      const rates = await dbService.getFeatureCompletionRates(filters);

      if (rates.length === 0) {
        return {
          totalDevelopers: 0,
          avgCompletionRate: 0,
          totalTasks: 0,
          totalCompletedTasks: 0,
          topPerformers: [],
          monthlyTrends: []
        };
      }

      // Calculate aggregated stats
      const totalTasks = rates.reduce((sum, rate) => sum + rate.total_tasks, 0);
      const totalCompletedTasks = rates.reduce((sum, rate) => sum + rate.completed_tasks, 0);
      const avgCompletionRate = rates.reduce((sum, rate) => sum + rate.completion_rate, 0) / rates.length;

      // Get unique developers
      const uniqueDevelopers = new Set(rates.map(rate => rate.username));

      // Get top performers (latest month for each developer)
      const latestRates = new Map<string, FeatureCompletionRate>();
      rates.forEach(rate => {
        const key = rate.username;
        const existing = latestRates.get(key);
        if (!existing || (rate.year > existing.year) ||
            (rate.year === existing.year && rate.month > existing.month)) {
          latestRates.set(key, rate);
        }
      });

      const topPerformers = Array.from(latestRates.values())
        .sort((a, b) => b.completion_rate - a.completion_rate)
        .slice(0, 10)
        .map(rate => ({
          username: rate.username,
          completionRate: Math.round(rate.completion_rate * 100) / 100
        }));

      // Get monthly trends
      const monthlyData = new Map<string, { total: number; count: number }>();
      rates.forEach(rate => {
        const monthKey = `${rate.year}-${rate.month.toString().padStart(2, '0')}`;
        const existing = monthlyData.get(monthKey) || { total: 0, count: 0 };
        existing.total += rate.completion_rate;
        existing.count += 1;
        monthlyData.set(monthKey, existing);
      });

      const monthlyTrends = Array.from(monthlyData.entries())
        .map(([month, data]) => ({
          month,
          avgCompletionRate: Math.round((data.total / data.count) * 100) / 100
        }))
        .sort((a, b) => a.month.localeCompare(b.month));

      return {
        totalDevelopers: uniqueDevelopers.size,
        avgCompletionRate: Math.round(avgCompletionRate * 100) / 100,
        totalTasks,
        totalCompletedTasks,
        topPerformers,
        monthlyTrends
      };

    } catch (error) {
      console.error('Error getting completion rate stats:', error);
      throw error;
    }
  }
}

export const completionRateService = new CompletionRateService();
