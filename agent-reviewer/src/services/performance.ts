import { dbService } from './database.js';
import { NotionService } from './notion.js';
import {
  DeveloperPerformanceMetrics,
  MRQualityMetrics,
  NotionIssue,
  IssueMetrics,
  PerformanceFilters,
  MRQualityFilters,
  IssueTrackingFilters,
  DeveloperPerformanceResponse,
  MRQualityResponse,
  IssueTrackingResponse
} from '../types/performance.js';

export class PerformanceService {
  private notionService: NotionService;

  constructor() {
    this.notionService = new NotionService();
  }

  /**
   * Get comprehensive developer performance metrics
   */
  async getDeveloperPerformance(
    filters: PerformanceFilters
  ): Promise<DeveloperPerformanceResponse> {
    const dateFrom = new Date(filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const dateTo = new Date(filters.dateTo || new Date());

    // Get performance metrics
    const developers = await dbService.getDeveloperPerformanceMetrics(
      dateFrom,
      dateTo,
      filters.developerId,
      filters.projectId
    );

    // Calculate summary statistics
    const summary = this.calculatePerformanceSummary(developers);

    return {
      developers,
      summary
    };
  }

  /**
   * Get MR quality and efficiency metrics
   */
  async getMRQualityMetrics(
    filters: MRQualityFilters
  ): Promise<MRQualityResponse> {
    const dateFrom = new Date(filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const dateTo = new Date(filters.dateTo || new Date());

    // Get quality metrics
    const qualityMetrics = await dbService.getMRQualityMetrics(
      dateFrom,
      dateTo,
      filters.authorId
    );

    // Calculate efficiency metrics
    const efficiencyMetrics = await this.calculateEfficiencyMetrics(
      dateFrom,
      dateTo,
      filters.authorId
    );

    return {
      qualityMetrics,
      efficiencyMetrics
    };
  }

  /**
   * Get issue tracking metrics from Notion
   */
  async getIssueTrackingMetrics(
    filters: IssueTrackingFilters
  ): Promise<IssueTrackingResponse> {
    const dateFrom = new Date(filters.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000));
    const dateTo = new Date(filters.dateTo || new Date());

    // Get Notion issues
    const issues = await dbService.getNotionIssues(
      dateFrom,
      dateTo,
      filters.issueType || 'Bug',
      filters.projectId
    );

    // Calculate resolution time metrics
    const resolutionTimes = await this.calculateResolutionTimeMetrics(
      dateFrom,
      dateTo,
      filters.projectId
    );

    return {
      issues,
      resolutionTimes
    };
  }

  /**
   * Process MR webhook for quality metrics calculation
   */
  async processMRForQualityMetrics(
    mergeRequestId: number,
    projectId: number,
    authorId: number
  ): Promise<void> {
    try {
      // Get MR details
      const mrQuery = `
        SELECT * FROM merge_request_tracking
        WHERE merge_request_id = $1 AND project_id = $2
      `;
      const mrResult = await dbService.query(mrQuery, [mergeRequestId, projectId]);
      
      if (mrResult.rows.length === 0) {
        return;
      }

      const mr = mrResult.rows[0];

      // Calculate quality metrics
      const qualityMetrics = await this.calculateMRQualityScore(mr);

      // Insert quality metrics
      await dbService.insertMRQualityMetrics({
        merge_request_id: mergeRequestId,
        developer_id: authorId,
        project_id: projectId,
        ...qualityMetrics
      });

      // Update developer performance
      await this.updateDeveloperPerformance(authorId, projectId);

    } catch (error) {
      console.error('Error processing MR for quality metrics:', error);
    }
  }

  /**
   * Process Notion issues from MR descriptions
   */
  async processNotionIssuesFromMR(
    mergeRequestId: number,
    description: string,
    projectId: number,
    authorId: number
  ): Promise<void> {
    try {
      // Extract Notion URLs from description
      const urlResult = this.notionService.extractNotionUrls(description);
      
      if (urlResult.urls.length === 0) {
        return;
      }

      // Fetch task contexts from Notion
      const contexts = await this.notionService.fetchMultipleTaskContexts(urlResult.urls);

      // Process each context for bug issues
      for (const context of contexts.contexts) {
        await this.extractAndStoreIssuesFromContext(
          context,
          mergeRequestId,
          projectId,
          authorId
        );
      }

    } catch (error) {
      console.error('Error processing Notion issues from MR:', error);
    }
  }

  /**
   * Calculate MR quality score based on various factors
   */
  private async calculateMRQualityScore(mr: any): Promise<Partial<MRQualityMetrics>> {
    // Get review data
    const reviewQuery = `
      SELECT 
        critical_issues_count,
        fixes_implemented_count,
        reviewed_at,
        created_at
      FROM merge_request_reviews
      WHERE project_id = $1 AND merge_request_iid = $2
    `;
    const reviewResult = await dbService.query(reviewQuery, [mr.project_id, mr.merge_request_iid]);

    let qualityScore = 10.0; // Start with perfect score
    let criticalIssues = 0;
    let fixesImplemented = 0;
    let timeToFirstReview = null;
    let timeToMerge = null;

    if (reviewResult.rows.length > 0) {
      const review = reviewResult.rows[0];
      criticalIssues = review.critical_issues_count || 0;
      fixesImplemented = review.fixes_implemented_count || 0;

      // Calculate time to first review
      if (review.reviewed_at && mr.created_at) {
        timeToFirstReview = (new Date(review.reviewed_at).getTime() - new Date(mr.created_at).getTime()) / (1000 * 60 * 60);
      }
    }

    // Calculate time to merge
    if (mr.merged_at && mr.created_at) {
      timeToMerge = (new Date(mr.merged_at).getTime() - new Date(mr.created_at).getTime()) / (1000 * 60 * 60);
    }

    // Adjust quality score based on factors
    qualityScore -= criticalIssues * 0.5; // Deduct 0.5 points per critical issue
    qualityScore += Math.min(fixesImplemented * 0.2, 2.0); // Add up to 2 points for fixes

    // Time-based adjustments
    if (timeToMerge) {
      if (timeToMerge < 24) qualityScore += 0.5; // Bonus for quick merges
      if (timeToMerge > 168) qualityScore -= 0.5; // Penalty for very slow merges
    }

    // Ensure score is between 0 and 10
    qualityScore = Math.max(0, Math.min(10, qualityScore));

    return {
      quality_score: Number(qualityScore.toFixed(1)),
      review_cycles: reviewResult.rows.length,
      critical_issues_count: criticalIssues,
      fixes_implemented_count: fixesImplemented,
      time_to_first_review_hours: timeToFirstReview,
      time_to_merge_hours: timeToMerge
    };
  }

  /**
   * Extract and store issues from Notion context
   */
  private async extractAndStoreIssuesFromContext(
    context: any,
    mergeRequestId: number,
    projectId: number,
    authorId: number
  ): Promise<void> {
    // Look for bug-related content in acceptance criteria or todo lists
    const bugKeywords = ['bug', 'issue', 'error', 'fix', 'problem', 'defect'];
    
    // Check acceptance criteria for bugs
    if (context.structuredContent?.acceptanceCriteria) {
      for (const item of context.structuredContent.acceptanceCriteria.items) {
        if (this.containsBugKeywords(item.text, bugKeywords)) {
          await this.createNotionIssue({
            id: `${context.pageId}-ac-${Date.now()}`,
            notion_page_id: context.pageId,
            title: item.text.substring(0, 100),
            description: context.description,
            issue_type: 'Bug',
            status: item.completed ? 'Resolved' : 'Open',
            priority_level: item.priority || 'Medium',
            creator_id: authorId,
            project_id: projectId,
            merge_request_id: mergeRequestId
          });
        }
      }
    }

    // Check todo lists for bugs
    if (context.structuredContent?.todoList) {
      for (const item of context.structuredContent.todoList.items) {
        if (this.containsBugKeywords(item.text, bugKeywords)) {
          await this.createNotionIssue({
            id: `${context.pageId}-todo-${Date.now()}`,
            notion_page_id: context.pageId,
            title: item.text.substring(0, 100),
            description: context.description,
            issue_type: 'Bug',
            status: item.completed ? 'Resolved' : 'Open',
            priority_level: item.priority || 'Medium',
            creator_id: authorId,
            project_id: projectId,
            merge_request_id: mergeRequestId
          });
        }
      }
    }
  }

  /**
   * Check if text contains bug-related keywords
   */
  private containsBugKeywords(text: string, keywords: string[]): boolean {
    const lowerText = text.toLowerCase();
    return keywords.some(keyword => lowerText.includes(keyword));
  }

  /**
   * Create Notion issue record
   */
  private async createNotionIssue(issue: NotionIssue): Promise<void> {
    await dbService.upsertNotionIssue(issue);
    
    // Create issue metrics record
    await this.createIssueMetrics({
      notion_issue_id: issue.id,
      developer_id: issue.creator_id!,
      project_id: issue.project_id!,
      action_type: 'created',
      action_date: new Date().toISOString(),
      priority_level: issue.priority_level
    });
  }

  /**
   * Create issue metrics record
   */
  private async createIssueMetrics(metrics: IssueMetrics): Promise<void> {
    const query = `
      INSERT INTO issue_metrics (
        notion_issue_id, developer_id, project_id,
        action_type, action_date, priority_level
      ) VALUES ($1, $2, $3, $4, $5, $6)
    `;
    
    await dbService.query(query, [
      metrics.notion_issue_id,
      metrics.developer_id,
      metrics.project_id,
      metrics.action_type,
      metrics.action_date,
      metrics.priority_level
    ]);
  }

  /**
   * Update developer performance metrics
   */
  private async updateDeveloperPerformance(
    developerId: number,
    projectId: number
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    
    // Calculate current day metrics
    const metricsQuery = `
      SELECT 
        COUNT(*) as total_mrs,
        COUNT(CASE WHEN status = 'merged' THEN 1 END) as merged_mrs,
        AVG(CASE 
          WHEN merged_at IS NOT NULL AND created_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600 
        END) as avg_merge_time_hours,
        AVG(mqm.quality_score) as avg_quality_score
      FROM merge_request_tracking mrt
      LEFT JOIN mr_quality_metrics mqm ON mrt.merge_request_id = mqm.merge_request_id
      WHERE mrt.author_id = $1 
        AND mrt.project_id = $2 
        AND DATE(mrt.created_at) = $3
    `;
    
    const metricsResult = await dbService.query(metricsQuery, [developerId, projectId, today]);
    const metrics = metricsResult.rows[0];
    
    // Get issue metrics
    const issueQuery = `
      SELECT 
        COUNT(CASE WHEN action_type = 'created' THEN 1 END) as issues_created,
        COUNT(CASE WHEN action_type = 'resolved' THEN 1 END) as issues_resolved,
        AVG(resolution_time_days) as avg_resolution_time
      FROM issue_metrics
      WHERE developer_id = $1 
        AND project_id = $2 
        AND DATE(action_date) = $3
    `;
    
    const issueResult = await dbService.query(issueQuery, [developerId, projectId, today]);
    const issueMetrics = issueResult.rows[0];
    
    // Calculate success rate
    const successRate = metrics.total_mrs > 0 
      ? (metrics.merged_mrs / metrics.total_mrs) * 100 
      : 0;
    
    // Upsert performance metrics
    await dbService.upsertDeveloperPerformance({
      developer_id: developerId,
      project_id: projectId,
      performance_date: today,
      total_mrs: parseInt(metrics.total_mrs) || 0,
      merged_mrs: parseInt(metrics.merged_mrs) || 0,
      success_rate: Number(successRate.toFixed(2)),
      avg_merge_time_hours: Number((metrics.avg_merge_time_hours || 0).toFixed(2)),
      quality_score: Number((metrics.avg_quality_score || 0).toFixed(1)),
      issues_created: parseInt(issueMetrics.issues_created) || 0,
      issues_resolved: parseInt(issueMetrics.issues_resolved) || 0,
      avg_resolution_time_days: Number((issueMetrics.avg_resolution_time || 0).toFixed(2))
    });
  }

  /**
   * Calculate performance summary statistics
   */
  private calculatePerformanceSummary(developers: DeveloperPerformanceMetrics[]) {
    if (developers.length === 0) {
      return {
        totalDevelopers: 0,
        avgSuccessRate: 0,
        avgQualityScore: 0,
        avgMergeTime: 0,
        totalMRs: 0,
        totalIssuesResolved: 0
      };
    }

    const totalMRs = developers.reduce((sum, dev) => sum + dev.total_mrs, 0);
    const totalIssuesResolved = developers.reduce((sum, dev) => sum + dev.issues_resolved, 0);
    const avgSuccessRate = developers.reduce((sum, dev) => sum + dev.success_rate, 0) / developers.length;
    const avgQualityScore = developers.reduce((sum, dev) => sum + dev.quality_score, 0) / developers.length;
    const avgMergeTime = developers.reduce((sum, dev) => sum + dev.avg_merge_time_hours, 0) / developers.length;

    return {
      totalDevelopers: developers.length,
      avgSuccessRate: Number(avgSuccessRate.toFixed(2)),
      avgQualityScore: Number(avgQualityScore.toFixed(1)),
      avgMergeTime: Number(avgMergeTime.toFixed(2)),
      totalMRs,
      totalIssuesResolved
    };
  }

  /**
   * Calculate efficiency metrics for developers
   */
  private async calculateEfficiencyMetrics(
    dateFrom: Date,
    dateTo: Date,
    authorId?: number
  ) {
    const conditions = ['mqm.created_at BETWEEN $1 AND $2'];
    const params: any[] = [dateFrom, dateTo];
    
    if (authorId) {
      conditions.push(`mqm.developer_id = $${params.length + 1}`);
      params.push(authorId);
    }
    
    const query = `
      SELECT 
        mqm.developer_id,
        u.username,
        AVG(mqm.time_to_first_review_hours) as avg_time_to_first_review,
        AVG(mqm.time_to_merge_hours) as avg_time_to_merge,
        AVG(mqm.review_cycles) as avg_review_cycles,
        AVG(mqm.quality_score) as efficiency_score
      FROM mr_quality_metrics mqm
      LEFT JOIN users u ON mqm.developer_id = u.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY mqm.developer_id, u.username
      ORDER BY efficiency_score DESC
    `;
    
    const result = await dbService.query(query, params);
    return result.rows.map(row => ({
      developer_id: row.developer_id,
      username: row.username,
      avg_time_to_first_review: Number((row.avg_time_to_first_review || 0).toFixed(2)),
      avg_time_to_merge: Number((row.avg_time_to_merge || 0).toFixed(2)),
      avg_review_cycles: Number((row.avg_review_cycles || 0).toFixed(1)),
      efficiency_score: Number((row.efficiency_score || 0).toFixed(1))
    }));
  }

  /**
   * Calculate resolution time metrics
   */
  private async calculateResolutionTimeMetrics(
    dateFrom: Date,
    dateTo: Date,
    projectId?: number
  ) {
    const conditions = ['im.action_date BETWEEN $1 AND $2', "im.action_type = 'resolved'"];
    const params: any[] = [dateFrom, dateTo];
    
    if (projectId) {
      conditions.push(`im.project_id = $${params.length + 1}`);
      params.push(projectId);
    }
    
    const query = `
      SELECT 
        im.developer_id,
        u.username,
        AVG(im.resolution_time_days) as avg_resolution_time,
        COUNT(*) as issues_resolved,
        CASE 
          WHEN AVG(im.resolution_time_days) <= 1 THEN 10
          WHEN AVG(im.resolution_time_days) <= 3 THEN 8
          WHEN AVG(im.resolution_time_days) <= 7 THEN 6
          ELSE 4
        END as resolution_efficiency
      FROM issue_metrics im
      LEFT JOIN users u ON im.developer_id = u.id
      WHERE ${conditions.join(' AND ')}
      GROUP BY im.developer_id, u.username
      ORDER BY resolution_efficiency DESC, avg_resolution_time ASC
    `;
    
    const result = await dbService.query(query, params);
    return result.rows.map(row => ({
      developer_id: row.developer_id,
      username: row.username,
      avg_resolution_time: Number((row.avg_resolution_time || 0).toFixed(2)),
      issues_resolved: parseInt(row.issues_resolved),
      resolution_efficiency: parseInt(row.resolution_efficiency)
    }));
  }
}

// Export singleton instance
export const performanceService = new PerformanceService();