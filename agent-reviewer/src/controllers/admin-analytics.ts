import { Request, Response } from 'express';
import { dbService } from '../services/database.js';
import { queueService } from '../services/queue.js';
import { performanceService } from '../services/performance.js';
import { completionRateService } from '../services/completion-rate.js';
import { format, subDays, startOfDay } from 'date-fns';
import { gitlabService } from '../services/gitlab.js';

/**
 * Get comprehensive embedding system metrics
 */
async function getEmbeddingMetrics(dateFrom: Date, dateTo: Date) {
  try {
    // Check if tables exist first
    const tablesExistQuery = `
      SELECT
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'embeddings')) as embeddings_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'documentation_embeddings')) as doc_embeddings_exists,
        (SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'embedding_jobs')) as jobs_exists
    `;
    const tablesResult = await dbService.query(tablesExistQuery);
    const { embeddings_exists, doc_embeddings_exists, jobs_exists } = tablesResult.rows[0];

    // Initialize default metrics
    const metrics = {
      codeEmbeddings: {
        totalFiles: 0,
        totalProjects: 0,
        languageDistribution: [] as Array<{language: string, fileCount: number, percentage: number}>,
        coverageByProject: [] as Array<{projectName: string, embeddedFiles: number, lastEmbedded: string | null}>,
        recentActivity: [] as Array<{date: string, filesEmbedded: number}>,
        avgFilesPerProject: 0,
        lastUpdated: null as string | null
      },
      documentationEmbeddings: {
        totalSections: 0,
        totalSources: 0,
        frameworkDistribution: [] as Array<{framework: string, sectionCount: number, percentage: number}>,
        sourceHealth: [] as Array<{sourceName: string, status: string, lastUpdated: string | null}>,
        lastUpdated: null as string | null
      },
      embeddingJobs: {
        totalJobs: 0,
        successRate: 0,
        avgProcessingTime: 0,
        recentJobs: [] as Array<{id: string, status: string, createdAt: string}>,
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
        lastEmbeddingTime: null as string | null
      }
    };

    // Get code embeddings metrics if table exists
    if (embeddings_exists) {
      // Total files and projects
      const codeStatsQuery = `
        SELECT
          COUNT(*) as total_files,
          COUNT(DISTINCT project_id) as total_projects,
          MAX(updated_at) as last_updated
        FROM embeddings
      `;
      const codeStatsResult = await dbService.query(codeStatsQuery);
      const codeStats = codeStatsResult.rows[0];

      metrics.codeEmbeddings.totalFiles = parseInt(codeStats.total_files);
      metrics.codeEmbeddings.totalProjects = parseInt(codeStats.total_projects);
      metrics.codeEmbeddings.lastUpdated = codeStats.last_updated;
      metrics.codeEmbeddings.avgFilesPerProject = metrics.codeEmbeddings.totalProjects > 0
        ? Math.round(metrics.codeEmbeddings.totalFiles / metrics.codeEmbeddings.totalProjects)
        : 0;

      // Language distribution
      const languageDistQuery = `
        SELECT
          language,
          COUNT(*) as file_count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM embeddings
        WHERE language IS NOT NULL
        GROUP BY language
        ORDER BY file_count DESC
        LIMIT 10
      `;
      const languageResult = await dbService.query(languageDistQuery);
      metrics.codeEmbeddings.languageDistribution = languageResult.rows.map(row => ({
        language: row.language,
        fileCount: parseInt(row.file_count),
        percentage: parseFloat(row.percentage)
      }));

      // Coverage by project
      const projectCoverageQuery = `
        SELECT
          p.name as project_name,
          COUNT(e.id) as embedded_files,
          MAX(e.updated_at) as last_embedded
        FROM projects p
        LEFT JOIN embeddings e ON p.project_id = e.project_id
        GROUP BY p.project_id, p.name
        ORDER BY embedded_files DESC
        LIMIT 10
      `;
      const projectCoverageResult = await dbService.query(projectCoverageQuery);
      metrics.codeEmbeddings.coverageByProject = projectCoverageResult.rows.map(row => ({
        projectName: row.project_name || 'Unknown Project',
        embeddedFiles: parseInt(row.embedded_files),
        lastEmbedded: row.last_embedded
      }));

      // Recent embedding activity
      const recentActivityQuery = `
        SELECT
          DATE(updated_at) as date,
          COUNT(*) as files_embedded
        FROM embeddings
        WHERE updated_at BETWEEN $1 AND $2
        GROUP BY DATE(updated_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      const recentActivityResult = await dbService.query(recentActivityQuery, [dateFrom, dateTo]);
      metrics.codeEmbeddings.recentActivity = recentActivityResult.rows.map(row => ({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        filesEmbedded: parseInt(row.files_embedded)
      }));
    }

    // Get documentation embeddings metrics if table exists
    if (doc_embeddings_exists) {
      // Total sections and sources
      const docStatsQuery = `
        SELECT
          COUNT(*) as total_sections,
          COUNT(DISTINCT source_id) as total_sources,
          MAX(updated_at) as last_updated
        FROM documentation_embeddings
      `;
      const docStatsResult = await dbService.query(docStatsQuery);
      const docStats = docStatsResult.rows[0];

      metrics.documentationEmbeddings.totalSections = parseInt(docStats.total_sections);
      metrics.documentationEmbeddings.totalSources = parseInt(docStats.total_sources);
      metrics.documentationEmbeddings.lastUpdated = docStats.last_updated;

      // Framework distribution
      const frameworkDistQuery = `
        SELECT
          framework,
          COUNT(*) as section_count,
          ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
        FROM documentation_embeddings
        WHERE framework IS NOT NULL
        GROUP BY framework
        ORDER BY section_count DESC
      `;
      const frameworkResult = await dbService.query(frameworkDistQuery);
      metrics.documentationEmbeddings.frameworkDistribution = frameworkResult.rows.map(row => ({
        framework: row.framework,
        sectionCount: parseInt(row.section_count),
        percentage: parseFloat(row.percentage)
      }));
    }

    // Get embedding jobs metrics if table exists
    if (jobs_exists) {
      // Total jobs and success rate
      const jobStatsQuery = `
        SELECT
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_jobs,
          ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - started_at))/60), 2) as avg_processing_minutes
        FROM embedding_jobs
        WHERE created_at BETWEEN $1 AND $2
      `;
      const jobStatsResult = await dbService.query(jobStatsQuery, [dateFrom, dateTo]);
      const jobStats = jobStatsResult.rows[0];

      metrics.embeddingJobs.totalJobs = parseInt(jobStats.total_jobs);
      metrics.embeddingJobs.successRate = jobStats.total_jobs > 0
        ? Math.round((parseInt(jobStats.completed_jobs) / parseInt(jobStats.total_jobs)) * 100)
        : 0;
      metrics.embeddingJobs.avgProcessingTime = parseFloat(jobStats.avg_processing_minutes) || 0;

      // Jobs by status
      const jobStatusQuery = `
        SELECT status, COUNT(*) as count
        FROM embedding_jobs
        GROUP BY status
      `;
      const jobStatusResult = await dbService.query(jobStatusQuery);
      jobStatusResult.rows.forEach(row => {
        const status = row.status.toLowerCase();
        const count = parseInt(row.count);
        if (status in metrics.embeddingJobs.jobsByStatus) {
          (metrics.embeddingJobs.jobsByStatus as any)[status] = count;
        }
      });
    }

    // Calculate system health metrics
    if (embeddings_exists) {
      metrics.systemHealth.embeddingCoverage = metrics.codeEmbeddings.totalProjects > 0
        ? Math.round((metrics.codeEmbeddings.totalFiles / (metrics.codeEmbeddings.totalProjects * 100)) * 100)
        : 0;
    }

    if (doc_embeddings_exists) {
      metrics.systemHealth.documentationCoverage = metrics.documentationEmbeddings.totalSources > 0 ? 100 : 0;
    }

    if (jobs_exists) {
      metrics.systemHealth.processingEfficiency = metrics.embeddingJobs.successRate;
    }

    return metrics;
  } catch (error) {
    console.error('Error getting embedding metrics:', error);
    // Return default metrics on error
    return {
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
    };
  }
}

/**
 * Get merge request analytics metrics
 */
async function getMergeRequestMetrics(dateFrom: Date, dateTo: Date) {
  try {
    // Check if MR tracking table exists
    const tableExistsQuery = `
      SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'merge_request_tracking')
    `;
    const tableResult = await dbService.query(tableExistsQuery);
    const tableExists = tableResult.rows[0].exists;

    if (!tableExists) {
      return {
        totalMRs: 0,
        mergedMRs: 0,
        closedMRs: 0,
        openMRs: 0,
        successRate: 0,
        avgMergeTime: 0,
        mrsByStatus: { opened: 0, merged: 0, closed: 0 },
        mrsByUser: [],
        mrsByProject: [],
        mergeTimeTrends: [],
        dailyMRCreation: [],
        repopoVsGitlab: { repopo_count: 0, gitlab_count: 0 }
      };
    }

    // Get basic MR statistics
    const basicStatsQuery = `
      SELECT
        COUNT(*) as total_mrs,
        COUNT(CASE WHEN status = 'merged' THEN 1 END) as merged_mrs,
        COUNT(CASE WHEN status = 'closed' AND merged_at IS NULL THEN 1 END) as closed_mrs,
        COUNT(CASE WHEN status = 'opened' THEN 1 END) as open_mrs,
        AVG(CASE
          WHEN merged_at IS NOT NULL AND created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600
        END) as avg_merge_time_hours
      FROM merge_request_tracking
      WHERE created_at BETWEEN $1 AND $2
    `;
    const basicStatsResult = await dbService.query(basicStatsQuery, [dateFrom, dateTo]);
    const basicStats = basicStatsResult.rows[0];

    const totalMRs = parseInt(basicStats.total_mrs) || 0;
    const mergedMRs = parseInt(basicStats.merged_mrs) || 0;
    const successRate = totalMRs > 0 ? Math.round((mergedMRs / totalMRs) * 100) : 0;

    // Get MRs by status
    const statusQuery = `
      SELECT
        status,
        COUNT(*) as count
      FROM merge_request_tracking
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY status
    `;
    const statusResult = await dbService.query(statusQuery, [dateFrom, dateTo]);
    const mrsByStatus = statusResult.rows.reduce((acc, row) => {
      acc[row.status] = parseInt(row.count);
      return acc;
    }, { opened: 0, merged: 0, closed: 0 });

    // Get top users by MR activity
    const userStatsQuery = `
      SELECT
        author_username as username,
        COUNT(*) as total_mrs,
        COUNT(CASE WHEN status = 'merged' THEN 1 END) as merged_mrs,
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND((COUNT(CASE WHEN status = 'merged' THEN 1 END)::decimal / COUNT(*)::decimal) * 100, 2)
          ELSE 0
        END as success_rate,
        AVG(CASE
          WHEN merged_at IS NOT NULL AND created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600
        END) as avg_merge_time_hours
      FROM merge_request_tracking
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY author_username
      ORDER BY total_mrs DESC
      LIMIT 10
    `;
    const userStatsResult = await dbService.query(userStatsQuery, [dateFrom, dateTo]);

    // Get project statistics
    const projectStatsQuery = `
      SELECT
        p.name as project_name,
        mrt.project_id,
        COUNT(*) as total_mrs,
        COUNT(CASE WHEN mrt.status = 'merged' THEN 1 END) as merged_mrs,
        CASE
          WHEN COUNT(*) > 0
          THEN ROUND((COUNT(CASE WHEN mrt.status = 'merged' THEN 1 END)::decimal / COUNT(*)::decimal) * 100, 2)
          ELSE 0
        END as success_rate,
        AVG(CASE
          WHEN mrt.merged_at IS NOT NULL AND mrt.created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (mrt.merged_at - mrt.created_at)) / 3600
        END) as avg_merge_time_hours
      FROM merge_request_tracking mrt
      LEFT JOIN projects p ON mrt.project_id = p.project_id
      WHERE mrt.created_at BETWEEN $1 AND $2
      GROUP BY mrt.project_id, p.name
      ORDER BY total_mrs DESC
      LIMIT 10
    `;
    const projectStatsResult = await dbService.query(projectStatsQuery, [dateFrom, dateTo]);

    // Get daily MR creation trends
    const dailyTrendsQuery = `
      SELECT
        DATE(created_at) as date,
        COUNT(*) as value
      FROM merge_request_tracking
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY DATE(created_at)
      ORDER BY date
    `;
    const dailyTrendsResult = await dbService.query(dailyTrendsQuery, [dateFrom, dateTo]);

    // Get merge time trends (daily average merge times for merged MRs)
    const mergeTimeTrendsQuery = `
      SELECT
        DATE(merged_at) as date,
        AVG(CASE
          WHEN merged_at IS NOT NULL AND created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600
        END) as value
      FROM merge_request_tracking
      WHERE merged_at BETWEEN $1 AND $2
        AND status = 'merged'
        AND merged_at IS NOT NULL
        AND created_at IS NOT NULL
      GROUP BY DATE(merged_at)
      ORDER BY date
    `;
    const mergeTimeTrendsResult = await dbService.query(mergeTimeTrendsQuery, [dateFrom, dateTo]);

    // Get Repopo vs GitLab statistics
    const repopoStatsQuery = `
      SELECT
        is_repopo_event,
        COUNT(*) as count
      FROM merge_request_tracking
      WHERE created_at BETWEEN $1 AND $2
      GROUP BY is_repopo_event
    `;
    const repopoStatsResult = await dbService.query(repopoStatsQuery, [dateFrom, dateTo]);
    const repopoVsGitlab = repopoStatsResult.rows.reduce((acc, row) => {
      if (row.is_repopo_event) {
        acc.repopo_count = parseInt(row.count);
      } else {
        acc.gitlab_count = parseInt(row.count);
      }
      return acc;
    }, { repopo_count: 0, gitlab_count: 0 });

    return {
      totalMRs,
      mergedMRs: parseInt(basicStats.merged_mrs) || 0,
      closedMRs: parseInt(basicStats.closed_mrs) || 0,
      openMRs: parseInt(basicStats.open_mrs) || 0,
      successRate,
      avgMergeTime: parseFloat(basicStats.avg_merge_time_hours) || 0,
      mrsByStatus,
      mrsByUser: userStatsResult.rows.map(row => ({
        username: row.username,
        total_mrs: parseInt(row.total_mrs),
        merged_mrs: parseInt(row.merged_mrs),
        success_rate: parseFloat(row.success_rate),
        avg_merge_time_hours: parseFloat(row.avg_merge_time_hours) || 0
      })),
      mrsByProject: projectStatsResult.rows.map(row => ({
        project_id: row.project_id,
        project_name: row.project_name || 'Unknown Project',
        total_mrs: parseInt(row.total_mrs),
        merged_mrs: parseInt(row.merged_mrs),
        success_rate: parseFloat(row.success_rate),
        avg_merge_time_hours: parseFloat(row.avg_merge_time_hours) || 0
      })),
      mergeTimeTrends: mergeTimeTrendsResult.rows.map(row => ({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        value: parseFloat(row.value) || 0
      })),
      dailyMRCreation: dailyTrendsResult.rows.map(row => ({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        value: parseInt(row.value)
      })),
      repopoVsGitlab
    };
  } catch (error) {
    console.error('Error getting MR metrics:', error);
    return {
      totalMRs: 0,
      mergedMRs: 0,
      closedMRs: 0,
      openMRs: 0,
      successRate: 0,
      avgMergeTime: 0,
      mrsByStatus: { opened: 0, merged: 0, closed: 0 },
      mrsByUser: [],
      mrsByProject: [],
      mergeTimeTrends: [],
      dailyMRCreation: [],
      repopoVsGitlab: { repopo_count: 0, gitlab_count: 0 }
    };
  }
}

/**
 * Get analytics data for the dashboard
 */
export const getAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { from, to } = req.query;

    const dateFrom = from ? new Date(from as string) : subDays(new Date(), 30);
    const dateTo = to ? new Date(to as string) : new Date();

    // Get basic statistics
    const totalReviewsQuery = `
      SELECT COUNT(*) as total
      FROM merge_request_reviews
      WHERE reviewed_at BETWEEN $1 AND $2
    `;
    const totalReviewsResult = await dbService.query(totalReviewsQuery, [dateFrom, dateTo]);
    const totalReviews = parseInt(totalReviewsResult.rows[0].total);

    // Get reviews for different time periods
    const today = startOfDay(new Date());
    const weekAgo = subDays(today, 7);
    const monthAgo = subDays(today, 30);

    const reviewsTodayQuery = `
      SELECT COUNT(*) as total
      FROM merge_request_reviews
      WHERE reviewed_at >= $1
    `;
    const reviewsTodayResult = await dbService.query(reviewsTodayQuery, [today]);
    const reviewsToday = parseInt(reviewsTodayResult.rows[0].total);

    const reviewsThisWeekQuery = `
      SELECT COUNT(*) as total
      FROM merge_request_reviews
      WHERE reviewed_at >= $1
    `;
    const reviewsThisWeekResult = await dbService.query(reviewsThisWeekQuery, [weekAgo]);
    const reviewsThisWeek = parseInt(reviewsThisWeekResult.rows[0].total);

    const reviewsThisMonthQuery = `
      SELECT COUNT(*) as total
      FROM merge_request_reviews
      WHERE reviewed_at >= $1
    `;
    const reviewsThisMonthResult = await dbService.query(reviewsThisMonthQuery, [monthAgo]);
    const reviewsThisMonth = parseInt(reviewsThisMonthResult.rows[0].total);

    // Get top projects by review activity
    const topProjectsQuery = `
      SELECT
        p.name as "projectName",
        COUNT(mrr.id) as "reviewCount",
        100.0 as "approvalRate"
      FROM merge_request_reviews mrr
      LEFT JOIN projects p ON mrr.project_id = p.project_id
      WHERE mrr.reviewed_at BETWEEN $1 AND $2
      GROUP BY p.project_id, p.name
      ORDER BY "reviewCount" DESC
      LIMIT 10
    `;
    const topProjectsResult = await dbService.query(topProjectsQuery, [dateFrom, dateTo]);

    // Get review trends (daily data for the last 30 days)
    const reviewTrendsQuery = `
      SELECT
        DATE(reviewed_at) as date,
        COUNT(*) as reviews,
        COUNT(*) as approvals,
        0 as "criticalIssues"
      FROM merge_request_reviews
      WHERE reviewed_at BETWEEN $1 AND $2
      GROUP BY DATE(reviewed_at)
      ORDER BY date
    `;
    const reviewTrendsResult = await dbService.query(reviewTrendsQuery, [dateFrom, dateTo]);

    // Get queue statistics for current status
    const queueStats = await queueService.getQueueStats();

    // Calculate average review time based on created_at to reviewed_at difference
    const avgReviewTimeQuery = `
      SELECT AVG(EXTRACT(EPOCH FROM (reviewed_at - created_at))/60) as avg_minutes
      FROM merge_request_reviews
      WHERE reviewed_at BETWEEN $1 AND $2
        AND reviewed_at > created_at
    `;
    const avgReviewTimeResult = await dbService.query(avgReviewTimeQuery, [dateFrom, dateTo]);
    const averageReviewTime = Math.round(parseFloat(avgReviewTimeResult.rows[0].avg_minutes) || 15);

    // Calculate approval rate (currently all reviews are auto-approved)
    const approvalRate = totalReviews > 0 ? 100 : 0;

    // Get review frequency metrics
    const reviewFrequencyQuery = `
      SELECT
        COUNT(*) as total_reviews,
        COUNT(DISTINCT DATE(reviewed_at)) as active_days,
        ROUND(COUNT(*)::numeric / GREATEST(COUNT(DISTINCT DATE(reviewed_at)), 1), 2) as avg_reviews_per_day
      FROM merge_request_reviews
      WHERE reviewed_at BETWEEN $1 AND $2
    `;
    const reviewFrequencyResult = await dbService.query(reviewFrequencyQuery, [dateFrom, dateTo]);
    const reviewFrequency = reviewFrequencyResult.rows[0];

    // Get project activity distribution
    const projectActivityQuery = `
      SELECT
        p.name as project_name,
        COUNT(mrr.id) as review_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (mrr.reviewed_at - mrr.created_at))/60), 2) as avg_review_time_minutes,
        COUNT(DISTINCT DATE(mrr.reviewed_at)) as active_days
      FROM merge_request_reviews mrr
      LEFT JOIN projects p ON mrr.project_id = p.project_id
      WHERE mrr.reviewed_at BETWEEN $1 AND $2
      GROUP BY p.project_id, p.name
      ORDER BY review_count DESC
      LIMIT 10
    `;
    const projectActivityResult = await dbService.query(projectActivityQuery, [dateFrom, dateTo]);

    // Get embedding system metrics
    const embeddingMetrics = await getEmbeddingMetrics(dateFrom, dateTo);

    // Get merge request metrics
    const mrMetrics = await getMergeRequestMetrics(dateFrom, dateTo);

    // Compute Issue Categories from MR review comments within the date range
    const issueCategories = await computeIssueCategories(dateFrom, dateTo);

    const analyticsData = {
      // Basic metrics
      totalReviews,
      approvalRate,
      averageReviewTime,
      reviewsToday,
      reviewsThisWeek,
      reviewsThisMonth,
      criticalIssuesTotal: 0, // Placeholder - would need review content analysis

      // Enhanced productivity metrics
      reviewFrequency: {
        totalReviews: parseInt(reviewFrequency.total_reviews),
        activeDays: parseInt(reviewFrequency.active_days),
        avgReviewsPerDay: parseFloat(reviewFrequency.avg_reviews_per_day)
      },

      // Project insights
      topProjects: topProjectsResult.rows,
      projectActivity: projectActivityResult.rows.map(row => ({
        projectName: row.project_name || 'Unknown Project',
        reviewCount: parseInt(row.review_count),
        avgReviewTime: parseFloat(row.avg_review_time_minutes) || 0,
        activeDays: parseInt(row.active_days)
      })),

      // Trend analysis
      reviewTrends: reviewTrendsResult.rows.map(row => ({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        reviews: parseInt(row.reviews),
        approvals: parseInt(row.approvals),
        criticalIssues: parseInt(row.criticalIssues)
      })),

      // Issue categorization
      issueCategories,

      // Embedding system metrics
      embeddingMetrics,

      // Merge request metrics
      mergeRequestMetrics: mrMetrics,

      // System health
      queueStats
    };

    res.json({
      success: true,
      data: analyticsData
    });
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get system health status
 */
export const getSystemHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    // Check database health
    let databaseHealth: 'healthy' | 'unhealthy' = 'healthy';
    try {
      await dbService.query('SELECT 1');
    } catch (error) {
      databaseHealth = 'unhealthy';
    }

    // Check embedding service health (placeholder)
    const embeddingServiceHealth: 'healthy' | 'unhealthy' = 'healthy';

    // Check webhook processing health
    let webhookProcessingHealth: 'healthy' | 'unhealthy' = 'healthy';
    try {
      const recentWebhooksQuery = `
        SELECT COUNT(*) as failed_count
        FROM webhook_processing
        WHERE status = 'failed' AND started_at > NOW() - INTERVAL '1 hour'
      `;
      const result = await dbService.query(recentWebhooksQuery);
      const failedCount = parseInt(result.rows[0].failed_count);
      if (failedCount > 10) { // More than 10 failures in the last hour
        webhookProcessingHealth = 'unhealthy';
      }
    } catch (error) {
      webhookProcessingHealth = 'unhealthy';
    }

    // Check queue service health
    let queueServiceHealth: 'healthy' | 'unhealthy' = 'healthy';
    try {
      const queueStats = await queueService.getQueueStats();
      // Consider unhealthy if too many failed jobs
      if (queueStats.failed > queueStats.total * 0.1) { // More than 10% failure rate
        queueServiceHealth = 'unhealthy';
      }
    } catch (error) {
      queueServiceHealth = 'unhealthy';
    }

    const systemHealth = {
      database: databaseHealth,
      embeddingService: embeddingServiceHealth,
      webhookProcessing: webhookProcessingHealth,
      queueService: queueServiceHealth
    };

    res.json({
      success: true,
      data: systemHealth
    });
  } catch (error) {
    console.error('Error getting system health:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch system health',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Get developer performance analytics
 */
export async function getDeveloperPerformanceAnalytics(req: Request, res: Response) {
  try {
    const filters = {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
      developerId: req.query.developerId ? parseInt(req.query.developerId as string) : undefined
    };

    const result = await performanceService.getDeveloperPerformance(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting developer performance analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get developer performance analytics'
    });
  }
}

/**
 * Get MR quality analytics
 */
export async function getMRQualityAnalytics(req: Request, res: Response) {
  try {
    const filters = {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      authorId: req.query.authorId ? parseInt(req.query.authorId as string) : undefined,
      projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined
    };

    const result = await performanceService.getMRQualityMetrics(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting MR quality analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get MR quality analytics'
    });
  }
}

/**
 * Get issue tracking analytics
 */
export async function getIssueTrackingAnalytics(req: Request, res: Response) {
  try {
    const filters = {
      dateFrom: req.query.dateFrom as string,
      dateTo: req.query.dateTo as string,
      issueType: req.query.issueType as string || 'Bug',
      projectId: req.query.projectId ? parseInt(req.query.projectId as string) : undefined,
      status: req.query.status as string
    };

    const result = await performanceService.getIssueTrackingMetrics(filters);

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting issue tracking analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get issue tracking analytics'
    });
  }
}


// Simple in-memory cache for issue categories per date range
const issueCategoriesCache = new Map<string, { expires: number, data: Array<{ category: string, count: number, percentage: number }> }>();
const ISSUE_CATEGORIES_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function makeIssueCatCacheKey(dateFrom: Date, dateTo: Date): string {
  return `${dateFrom.toISOString()}__${dateTo.toISOString()}`;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length) as any;
  let idx = 0;
  const workers = new Array(Math.min(limit, items.length)).fill(0).map(async () => {
    while (true) {
      const current = idx++;
      if (current >= items.length) break;
      try {
        results[current] = await fn(items[current]);
      } catch (e) {
        // store undefined to keep index alignment
        results[current] = undefined as any;
      }
    }
  });
  await Promise.all(workers);
  return results;
}

// Compute Issue Categories by analyzing MR review comments within the given date range
async function computeIssueCategories(dateFrom: Date, dateTo: Date) {
  type Category = 'Code Quality' | 'Security' | 'Performance' | 'Documentation' | 'Testing'

  const categories: Category[] = [
    'Code Quality',
    'Security',
    'Performance',
    'Documentation',
    'Testing',
  ]

  // Keyword patterns for simple categorization
  const KEYWORDS: Record<Category, RegExp[]> = {
    'Security': [
      /\bxss\b/gi, /sql\s*injection/gi, /csrf/gi, /ssrf/gi, /\brce\b/gi, /secret(s)?/gi,
      /credential(s)?/gi, /auth(entication|orization)?/gi, /\bjwt\b/gi, /vulnerab(le|ility)/gi,
      /insecure/gi, /exploit/gi, /saniti[sz]e/gi, /escap(e|ing)/gi
    ],
    'Performance': [
      /\bn\+1\b/gi, /performance/gi, /\bperf\b/gi, /slow/gi, /latency/gi, /throughput/gi,
      /memory/gi, /leak/gi, /optimi[sz]e/gi, /complexity/gi, /big\s*o/gi, /cache/gi
    ],
    'Testing': [
      /test(s|ing)?/gi, /unit\s*test/gi, /integration\s*test/gi, /coverage/gi,
      /mock/gi, /assert/gi, /spec/gi, /\be2e\b/gi
    ],
    'Documentation': [
      /doc(s|umentation)?/gi, /comment(s)?/gi, /readme/gi, /guide/gi, /inline\s*doc/gi,
      /javadoc/gi, /tsdoc/gi
    ],
    'Code Quality': [
      /refactor/gi, /duplicate/gi, /naming/gi, /lint/gi, /eslint/gi, /prettier/gi,
      /format(ting)?/gi, /maintainab(le|ility)/gi, /dead\s*code/gi, /smell/gi,
      /complex(ity)?/gi
    ],
  }

  // Default zeroed result
  const zeroResult = categories.map(cat => ({ category: cat, count: 0, percentage: 0 }))

  try {
    // Fast path with cache + per-note fetching and concurrency limit
    const cacheKey = makeIssueCatCacheKey(dateFrom, dateTo);
    const cached = issueCategoriesCache.get(cacheKey);
    if (cached && Date.now() < cached.expires) {
      return cached.data;
    }

    // Fetch reviewed MRs with review_comment_id and dedupe note entries
    const fastReviewsRes = await dbService.query(
      `
      SELECT project_id, review_comment_id
      FROM merge_request_reviews
      WHERE reviewed_at BETWEEN $1 AND $2
        AND review_comment_id IS NOT NULL
      `,
      [dateFrom, dateTo]
    );

    if (!fastReviewsRes.rows || fastReviewsRes.rows.length === 0) {
      const zero = zeroResult;
      issueCategoriesCache.set(cacheKey, { expires: Date.now() + ISSUE_CATEGORIES_CACHE_TTL_MS, data: zero });
      return zero;
    }

    type Entry = { projectId: number, noteId: number };
    const seen = new Set<string>();
    const entries: Entry[] = [];
    for (const row of fastReviewsRes.rows) {
      const projectId = Number(row.project_id);
      const noteId = Number(row.review_comment_id);
      if (!Number.isFinite(projectId) || !Number.isFinite(noteId)) continue;
      const key = `${projectId}:${noteId}`;
      if (!seen.has(key)) { seen.add(key); entries.push({ projectId, noteId }); }
    }

    const fastCounts: Record<Category, number> = {
      'Code Quality': 0,
      'Security': 0,
      'Performance': 0,
      'Documentation': 0,
      'Testing': 0,
    };

    const CONCURRENCY = 8;
    const perNoteCounts = await mapWithConcurrency(entries, CONCURRENCY, async (e) => {
      try {
        const note = await gitlabService.getNote(e.projectId, e.noteId);
        const body: string = typeof note?.body === 'string' ? note.body : '';
        const text = body.toLowerCase();
        const local: Record<Category, number> = {
          'Code Quality': 0,
          'Security': 0,
          'Performance': 0,
          'Documentation': 0,
          'Testing': 0,
        };
        for (const cat of categories) {
          const patterns = KEYWORDS[cat];
          let matches = 0;
          for (const re of patterns) {
            const found = text.match(re);
            if (found) matches += found.length;
          }
          local[cat] += matches;
        }
        return local;
      } catch {
        return undefined as any;
      }
    });

    for (const local of perNoteCounts) {
      if (!local) continue;
      for (const cat of categories) fastCounts[cat] += local[cat];
    }

    const fastTotal = Object.values(fastCounts).reduce((a, b) => a + b, 0);
    const fastResult = categories.map(cat => ({
      category: cat,
      count: fastCounts[cat],
      percentage: fastTotal > 0 ? Math.round((fastCounts[cat] / fastTotal) * 100) : 0,
    }));

    issueCategoriesCache.set(cacheKey, { expires: Date.now() + ISSUE_CATEGORIES_CACHE_TTL_MS, data: fastResult });
    return fastResult;

    // Fetch reviewed MRs with recorded review comment IDs in the date range
    const reviewsRes = await dbService.query(
      `
      SELECT project_id, merge_request_iid, review_comment_id
      FROM merge_request_reviews
      WHERE reviewed_at BETWEEN $1 AND $2
        AND review_comment_id IS NOT NULL
      `,
      [dateFrom, dateTo]
    )

    if (!reviewsRes.rows || reviewsRes.rows.length === 0) {
      return zeroResult
    }

    // Group by MR to minimize API calls
    type Group = { projectId: number, mrIid: number, reviewCommentIds: number[] }
    const groupsMap = new Map<string, Group>()
    for (const row of reviewsRes.rows) {
      const key = `${row.project_id}:${row.merge_request_iid}`
      if (!groupsMap.has(key)) {
        groupsMap.set(key, {
          projectId: Number(row.project_id),
          mrIid: Number(row.merge_request_iid),
          reviewCommentIds: [],
        })
      }
      if (row.review_comment_id) {
        groupsMap.get(key)!.reviewCommentIds.push(Number(row.review_comment_id))
      }
    }

    const counts: Record<Category, number> = {
      'Code Quality': 0,
      'Security': 0,
      'Performance': 0,
      'Documentation': 0,
      'Testing': 0,
    }

    // Iterate groups, fetch comments once per MR, analyze matched notes
    for (const group of groupsMap.values()) {
      try {
        const comments = await gitlabService.getMergeRequestComments(group.projectId, group.mrIid)
        if (!Array.isArray(comments) || comments.length === 0) continue

        const bodyById = new Map<number, string>()
        for (const c of comments) {
          if (typeof c?.id === 'number' && typeof c?.body === 'string') {
            bodyById.set(c.id, c.body)
          }
        }

        for (const noteId of group.reviewCommentIds) {
          const body = bodyById.get(noteId);
          if (typeof body !== 'string') continue;
          const text = body!.toLowerCase();

          // Count occurrences per category
          for (const cat of categories) {
            const patterns = KEYWORDS[cat];
            let matches = 0;
            for (const re of patterns) {
              const count = (text.match(re) ?? []).length;
              matches += count;
            }
            counts[cat] += matches;
          }
        }
      } catch (err) {
        console.warn(`Skipping MR !${group.mrIid} in project ${group.projectId} due to error:`, err)
        continue
      }
    }

    const total = Object.values(counts).reduce((a, b) => a + b, 0)
    return categories.map(cat => ({
      category: cat,
      count: counts[cat],
      percentage: total > 0 ? Math.round((counts[cat] / total) * 100) : 0,
    }))
  } catch (error) {
    console.error('Error computing issue categories:', error)
    return zeroResult
  }
}

/**
 * Get completion rate for specific developer and month
 */
export async function getCompletionRate(req: Request, res: Response) {
  try {
    const { developerId } = req.params;
    const { month } = req.query;

    if (!developerId) {
      res.status(400).json({
        success: false,
        error: 'Developer ID is required'
      });
      return;
    }

    // Parse month parameter (YYYY-MM format)
    let targetMonth: number;
    let targetYear: number;

    if (month) {
      const [yearStr, monthStr] = (month as string).split('-');
      targetYear = parseInt(yearStr);
      targetMonth = parseInt(monthStr);
    } else {
      // Default to current month
      const now = new Date();
      targetMonth = now.getMonth() + 1;
      targetYear = now.getFullYear();
    }

    // Get developer username (assuming developerId is username for now)
    const username = developerId;

    const result = await completionRateService.calculateCompletionRate(
      username,
      targetMonth,
      targetYear
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting completion rate:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get completion rate'
    });
  }
}

/**
 * Get team-wide completion rates
 */
export async function getTeamCompletionRates(req: Request, res: Response) {
  try {
    const { month, projectId } = req.query;

    // Parse month parameter (YYYY-MM format)
    let targetMonth: number;
    let targetYear: number;

    if (month) {
      const [yearStr, monthStr] = (month as string).split('-');
      targetYear = parseInt(yearStr);
      targetMonth = parseInt(monthStr);
    } else {
      // Default to current month
      const now = new Date();
      targetMonth = now.getMonth() + 1;
      targetYear = now.getFullYear();
    }

    const result = await completionRateService.getTeamCompletionRates(
      targetMonth,
      targetYear,
      projectId ? parseInt(projectId as string) : undefined
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting team completion rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get team completion rates'
    });
  }
}

/**
 * Get completion rate trends for a developer
 */
export async function getCompletionRateTrends(req: Request, res: Response) {
  try {
    const { developerId } = req.params;
    const { months, projectId } = req.query;

    if (!developerId) {
      res.status(400).json({
        success: false,
        error: 'Developer ID is required'
      });
      return;
    }

    const username = developerId;
    const monthsCount = months ? parseInt(months as string) : 6;

    const result = await completionRateService.getCompletionRateTrends(
      username,
      monthsCount,
      projectId ? parseInt(projectId as string) : undefined
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting completion rate trends:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get completion rate trends'
    });
  }
}

/**
 * Get project completion rates
 */
export async function getProjectCompletionRates(req: Request, res: Response) {
  try {
    const { projectId } = req.params;
    const { month } = req.query;

    if (!projectId) {
      res.status(400).json({
        success: false,
        error: 'Project ID is required'
      });
      return;
    }

    // Parse month parameter (YYYY-MM format)
    let targetMonth: number;
    let targetYear: number;

    if (month) {
      const [yearStr, monthStr] = (month as string).split('-');
      targetYear = parseInt(yearStr);
      targetMonth = parseInt(monthStr);
    } else {
      // Default to current month
      const now = new Date();
      targetMonth = now.getMonth() + 1;
      targetYear = now.getFullYear();
    }

    // Use getTeamCompletionRates with projectId filter for project-specific data
    const result = await completionRateService.getTeamCompletionRates(
      targetMonth,
      targetYear,
      parseInt(projectId)
    );

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting project completion rates:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get project completion rates'
    });
  }
}

/**
 * Get completion rate statistics summary
 */
export async function getCompletionRateStats(req: Request, res: Response) {
  try {
    const { projectId, dateFrom, dateTo, month } = req.query as {
      projectId?: string;
      dateFrom?: string;
      dateTo?: string;
      month?: string; // YYYY-MM
    };

    // If month is provided, convert to date range; else use optional dateFrom/dateTo
    let fromDate: Date | undefined;
    let toDate: Date | undefined;

    if (month) {
      const [y, m] = month.split('-').map(Number);
      // from first day to last day of the month
      fromDate = new Date(y, (m - 1), 1);
      toDate = new Date(y, m, 0, 23, 59, 59);
    } else {
      fromDate = dateFrom ? new Date(dateFrom) : undefined;
      toDate = dateTo ? new Date(dateTo) : undefined;
    }

    const stats = await completionRateService.getCompletionRateStats(
      projectId ? parseInt(projectId) : undefined,
      fromDate,
      toDate
    );

    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting completion rate stats:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get completion rate stats'
    });
  }
}
