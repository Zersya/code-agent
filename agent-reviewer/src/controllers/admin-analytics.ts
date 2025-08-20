import { Request, Response } from 'express';
import { dbService } from '../services/database.js';
import { queueService } from '../services/queue.js';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

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

    // Calculate average review time (placeholder - would need more data tracking)
    const averageReviewTime = 15; // minutes (placeholder)

    // Calculate approval rate (assuming all reviews are approved for now)
    const approvalRate = totalReviews > 0 ? 100 : 0;

    // Issue categories (placeholder data)
    const issueCategories = [
      { category: 'Code Quality', count: 0, percentage: 0 },
      { category: 'Security', count: 0, percentage: 0 },
      { category: 'Performance', count: 0, percentage: 0 },
      { category: 'Documentation', count: 0, percentage: 0 },
      { category: 'Testing', count: 0, percentage: 0 }
    ];

    const analyticsData = {
      totalReviews,
      approvalRate,
      averageReviewTime,
      reviewsToday,
      reviewsThisWeek,
      reviewsThisMonth,
      criticalIssuesTotal: 0, // Placeholder
      topProjects: topProjectsResult.rows,
      reviewTrends: reviewTrendsResult.rows.map(row => ({
        date: format(new Date(row.date), 'yyyy-MM-dd'),
        reviews: parseInt(row.reviews),
        approvals: parseInt(row.approvals),
        criticalIssues: parseInt(row.criticalIssues)
      })),
      issueCategories,
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
export const getSystemHealth = async (req: Request, res: Response): Promise<void> => {
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
