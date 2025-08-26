import { Request, Response } from 'express';
import { dbService } from '../services/database.js';
import { queueService } from '../services/queue.js';
import { format, subDays, startOfDay } from 'date-fns';

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

    // Issue categories (enhanced with actual data when available)
    const issueCategories = [
      { category: 'Code Quality', count: 0, percentage: 0 },
      { category: 'Security', count: 0, percentage: 0 },
      { category: 'Performance', count: 0, percentage: 0 },
      { category: 'Documentation', count: 0, percentage: 0 },
      { category: 'Testing', count: 0, percentage: 0 }
    ];

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
