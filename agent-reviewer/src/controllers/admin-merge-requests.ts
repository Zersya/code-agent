import { Request, Response } from 'express';
import { dbService } from '../services/database.js';
import { format } from 'date-fns';

interface MRFilters {
  projectId?: number;
  authorUsername?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Map frontend camelCase field names to database snake_case column names
const SORTABLE_COLUMNS: Record<string, string> = {
  'createdAt': 'mrt.created_at',
  'updatedAt': 'mrt.updated_at',
  'mergedAt': 'mrt.merged_at',
  'closedAt': 'mrt.closed_at',
  'projectName': 'p.name',
  'mergeRequestIid': 'mrt.merge_request_iid',
  'title': 'mrt.title',
  'authorUsername': 'mrt.author_username',
  'status': 'mrt.status',
  'sourceBranch': 'mrt.source_branch',
  'targetBranch': 'mrt.target_branch'
};

const DEFAULT_SORT_COLUMN = 'mrt.created_at';

/**
 * Get merge requests with pagination and filtering
 */
export const getMergeRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'created_at',
      sortOrder = 'desc',
      projectId,
      authorUsername,
      status,
      dateFrom,
      dateTo,
      search
    } = req.query;

    // Validate and map sortBy parameter to prevent SQL injection
    const requestedSortBy = sortBy as string;
    const mappedSortBy = SORTABLE_COLUMNS[requestedSortBy] || DEFAULT_SORT_COLUMN;

    // Validate sortOrder parameter
    const validSortOrder = (sortOrder as string)?.toLowerCase();
    const safeSortOrder = (validSortOrder === 'asc' || validSortOrder === 'desc') ? validSortOrder : 'desc';

    const pagination: PaginationParams = {
      page: parseInt(page as string),
      limit: Math.min(parseInt(limit as string), 100), // Max 100 items per page
      sortBy: mappedSortBy,
      sortOrder: safeSortOrder as 'asc' | 'desc'
    };

    const filters: MRFilters = {
      projectId: projectId ? parseInt(projectId as string) : undefined,
      authorUsername: authorUsername as string,
      status: status as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      search: search as string
    };

    const offset = (pagination.page - 1) * pagination.limit;

    // Build the query
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filters.projectId) {
      whereClause += ` AND mrt.project_id = $${paramIndex}`;
      queryParams.push(filters.projectId);
      paramIndex++;
    }

    if (filters.authorUsername) {
      whereClause += ` AND mrt.author_username = $${paramIndex}`;
      queryParams.push(filters.authorUsername);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND mrt.status = $${paramIndex}`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters.dateFrom) {
      whereClause += ` AND mrt.created_at >= $${paramIndex}`;
      queryParams.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereClause += ` AND mrt.created_at <= $${paramIndex}`;
      queryParams.push(filters.dateTo);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (mrt.title ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex} OR CAST(mrt.merge_request_iid AS TEXT) ILIKE $${paramIndex})`;
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM merge_request_tracking mrt
      LEFT JOIN projects p ON mrt.project_id = p.project_id
      ${whereClause}
    `;

    const countResult = await dbService.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const dataQuery = `
      SELECT 
        mrt.id,
        mrt.project_id,
        mrt.merge_request_iid,
        mrt.merge_request_id,
        mrt.title,
        mrt.description,
        mrt.author_id,
        mrt.author_username,
        mrt.author_name,
        mrt.source_branch,
        mrt.target_branch,
        mrt.status,
        mrt.action,
        mrt.created_at,
        mrt.updated_at,
        mrt.merged_at,
        mrt.closed_at,
        mrt.approved_at,
        mrt.merge_commit_sha,
        mrt.repository_url,
        mrt.web_url,
        mrt.is_repopo_event,
        p.name as project_name,
        CASE
          WHEN mrt.merged_at IS NOT NULL AND mrt.created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (mrt.merged_at - mrt.created_at)) / 3600
          ELSE NULL
        END as merge_time_hours,
        CASE
          WHEN mrt.approved_at IS NOT NULL AND mrt.created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (mrt.approved_at - mrt.created_at)) / 3600
          ELSE NULL
        END as approval_time_hours,
        mrr.status as review_status,
        mrr.reviewer_type,
        mrr.critical_issues_count,
        mrr.fixes_implemented_count,
        mrr.reviewed_at as last_reviewed_at,
        mrr.last_reviewed_commit_sha
      FROM merge_request_tracking mrt
      LEFT JOIN projects p ON mrt.project_id = p.project_id
      LEFT JOIN merge_request_reviews mrr ON mrt.project_id = mrr.project_id AND mrt.merge_request_iid = mrr.merge_request_iid
      ${whereClause}
      ORDER BY ${pagination.sortBy} ${pagination.sortOrder}
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(pagination.limit, offset);
    const dataResult = await dbService.query(dataQuery, queryParams);

    const totalPages = Math.ceil(total / pagination.limit);

    res.json({
      success: true,
      data: dataResult.rows,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages,
        hasNext: pagination.page < totalPages,
        hasPrev: pagination.page > 1
      }
    });
  } catch (error) {
    console.error('Error getting merge requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get merge requests'
    });
  }
};

/**
 * Get a specific merge request by ID
 */
export const getMergeRequest = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const mrId = parseInt(id);

    if (isNaN(mrId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid merge request ID'
      });
      return;
    }

    const query = `
      SELECT 
        mrt.id,
        mrt.project_id,
        mrt.merge_request_iid,
        mrt.merge_request_id,
        mrt.title,
        mrt.description,
        mrt.author_id,
        mrt.author_username,
        mrt.author_name,
        mrt.source_branch,
        mrt.target_branch,
        mrt.status,
        mrt.action,
        mrt.created_at,
        mrt.updated_at,
        mrt.merged_at,
        mrt.closed_at,
        mrt.merge_commit_sha,
        mrt.repository_url,
        mrt.web_url,
        mrt.is_repopo_event,
        mrt.repopo_token,
        p.name as project_name,
        CASE 
          WHEN mrt.merged_at IS NOT NULL AND mrt.created_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (mrt.merged_at - mrt.created_at)) / 3600 
          ELSE NULL 
        END as merge_time_hours,
        mrr.status as review_status,
        mrr.reviewer_type,
        mrr.critical_issues_count,
        mrr.fixes_implemented_count,
        mrr.reviewed_at as last_reviewed_at,
        mrr.last_reviewed_commit_sha
      FROM merge_request_tracking mrt
      LEFT JOIN projects p ON mrt.project_id = p.project_id
      LEFT JOIN merge_request_reviews mrr ON mrt.project_id = mrr.project_id AND mrt.merge_request_iid = mrr.merge_request_iid
      WHERE mrt.id = $1
    `;

    const result = await dbService.query(query, [mrId]);

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        error: 'Merge request not found'
      });
      return;
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error getting merge request:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get merge request'
    });
  }
};

/**
 * Get user MR statistics
 */
export const getUserMRStatistics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username } = req.params;

    if (!username) {
      res.status(400).json({
        success: false,
        error: 'Username is required'
      });
      return;
    }

    // Get user statistics per project
    const projectStatsQuery = `
      SELECT 
        ums.project_id,
        p.name as project_name,
        ums.total_mrs_created,
        ums.total_mrs_merged,
        ums.total_mrs_closed,
        ums.total_mrs_rejected,
        ums.avg_merge_time_hours,
        ums.last_mr_created_at,
        ums.last_mr_merged_at,
        CASE 
          WHEN ums.total_mrs_created > 0 
          THEN ROUND((ums.total_mrs_merged::decimal / ums.total_mrs_created::decimal) * 100, 2)
          ELSE 0 
        END as success_rate
      FROM user_mr_statistics ums
      LEFT JOIN projects p ON ums.project_id = p.project_id
      WHERE ums.username = $1
      ORDER BY ums.total_mrs_created DESC
    `;

    const projectStatsResult = await dbService.query(projectStatsQuery, [username]);

    // Calculate overall statistics
    const overallStatsQuery = `
      SELECT 
        SUM(total_mrs_created) as total_created,
        SUM(total_mrs_merged) as total_merged,
        SUM(total_mrs_closed) as total_closed,
        SUM(total_mrs_rejected) as total_rejected,
        AVG(avg_merge_time_hours) as avg_merge_time,
        MAX(last_mr_created_at) as last_created,
        MAX(last_mr_merged_at) as last_merged
      FROM user_mr_statistics
      WHERE username = $1
    `;

    const overallStatsResult = await dbService.query(overallStatsQuery, [username]);
    const overallStats = overallStatsResult.rows[0];

    const totalCreated = parseInt(overallStats.total_created) || 0;
    const totalMerged = parseInt(overallStats.total_merged) || 0;
    const successRate = totalCreated > 0 ? Math.round((totalMerged / totalCreated) * 100 * 100) / 100 : 0;

    res.json({
      success: true,
      data: {
        username,
        projects: projectStatsResult.rows,
        overall: {
          total_mrs_created: totalCreated,
          total_mrs_merged: totalMerged,
          total_mrs_closed: parseInt(overallStats.total_closed) || 0,
          total_mrs_rejected: parseInt(overallStats.total_rejected) || 0,
          success_rate: successRate,
          avg_merge_time_hours: parseFloat(overallStats.avg_merge_time) || 0,
          last_mr_created_at: overallStats.last_created,
          last_mr_merged_at: overallStats.last_merged
        }
      }
    });
  } catch (error) {
    console.error('Error getting user MR statistics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get user MR statistics'
    });
  }
};

/**
 * Export merge requests as CSV
 */
/**
 * Update fixes implemented count for a merge request
 */
export const updateMergeRequestFixesCount = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, mergeRequestIid } = req.params;
    const { fixesImplementedCount } = req.body;

    const projectIdNum = parseInt(projectId);
    const mergeRequestIidNum = parseInt(mergeRequestIid);
    const fixesCount = parseInt(fixesImplementedCount);

    if (isNaN(projectIdNum) || isNaN(mergeRequestIidNum) || isNaN(fixesCount)) {
      res.status(400).json({
        success: false,
        error: 'Invalid parameters. Project ID, MR IID, and fixes count must be numbers.'
      });
      return;
    }

    if (fixesCount < 0) {
      res.status(400).json({
        success: false,
        error: 'Fixes count cannot be negative.'
      });
      return;
    }

    await dbService.updateMergeRequestFixesCount(projectIdNum, mergeRequestIidNum, fixesCount);

    res.json({
      success: true,
      message: `Updated fixes count to ${fixesCount} for MR !${mergeRequestIidNum} in project ${projectIdNum}`
    });
  } catch (error) {
    console.error('Error updating merge request fixes count:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update fixes count'
    });
  }
};

/**
 * Update review status for a merge request
 */
export const updateMergeRequestReviewStatus = async (req: Request, res: Response): Promise<void> => {
  try {
    const { projectId, mergeRequestIid } = req.params;
    const { status } = req.body;

    const projectIdNum = parseInt(projectId);
    const mergeRequestIidNum = parseInt(mergeRequestIid);

    if (isNaN(projectIdNum) || isNaN(mergeRequestIidNum)) {
      res.status(400).json({
        success: false,
        error: 'Invalid parameters. Project ID and MR IID must be numbers.'
      });
      return;
    }

    const validStatuses = ['pending', 'reviewed', 'approved', 'rejected'];
    if (!validStatuses.includes(status)) {
      res.status(400).json({
        success: false,
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
      return;
    }

    await dbService.updateMergeRequestReviewStatus(projectIdNum, mergeRequestIidNum, status);

    res.json({
      success: true,
      message: `Updated review status to '${status}' for MR !${mergeRequestIidNum} in project ${projectIdNum}`
    });
  } catch (error) {
    console.error('Error updating merge request review status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update review status'
    });
  }
};

export const exportMergeRequests = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectId,
      authorUsername,
      status,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const filters: MRFilters = {
      projectId: projectId ? parseInt(projectId as string) : undefined,
      authorUsername: authorUsername as string,
      status: status as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      search: search as string
    };

    // Build the query (similar to getMergeRequests but without pagination)
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filters.projectId) {
      whereClause += ` AND mrt.project_id = $${paramIndex}`;
      queryParams.push(filters.projectId);
      paramIndex++;
    }

    if (filters.authorUsername) {
      whereClause += ` AND mrt.author_username = $${paramIndex}`;
      queryParams.push(filters.authorUsername);
      paramIndex++;
    }

    if (filters.status) {
      whereClause += ` AND mrt.status = $${paramIndex}`;
      queryParams.push(filters.status);
      paramIndex++;
    }

    if (filters.dateFrom) {
      whereClause += ` AND mrt.created_at >= $${paramIndex}`;
      queryParams.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereClause += ` AND mrt.created_at <= $${paramIndex}`;
      queryParams.push(filters.dateTo);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (mrt.title ILIKE $${paramIndex} OR p.name ILIKE $${paramIndex} OR CAST(mrt.merge_request_iid AS TEXT) ILIKE $${paramIndex})`;
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    const query = `
      SELECT
        mrt.id,
        p.name as project_name,
        mrt.merge_request_iid,
        mrt.title,
        mrt.author_username,
        mrt.author_name,
        mrt.source_branch,
        mrt.target_branch,
        mrt.status,
        mrt.action,
        mrt.created_at,
        mrt.updated_at,
        mrt.merged_at,
        mrt.closed_at,
        mrt.is_repopo_event,
        CASE
          WHEN mrt.merged_at IS NOT NULL AND mrt.created_at IS NOT NULL
          THEN EXTRACT(EPOCH FROM (mrt.merged_at - mrt.created_at)) / 3600
          ELSE NULL
        END as merge_time_hours
      FROM merge_request_tracking mrt
      LEFT JOIN projects p ON mrt.project_id = p.project_id
      ${whereClause}
      ORDER BY mrt.created_at DESC
    `;

    const result = await dbService.query(query, queryParams);

    // Generate CSV content
    const headers = [
      'ID', 'Project Name', 'MR IID', 'Title', 'Author Username', 'Author Name',
      'Source Branch', 'Target Branch', 'Status', 'Action', 'Created At',
      'Updated At', 'Merged At', 'Closed At', 'Is Repopo Event', 'Merge Time (Hours)'
    ];

    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => [
        row.id,
        `"${row.project_name || ''}"`,
        row.merge_request_iid,
        `"${(row.title || '').replace(/"/g, '""')}"`,
        row.author_username,
        `"${row.author_name || ''}"`,
        row.source_branch,
        row.target_branch,
        row.status,
        row.action,
        row.created_at ? format(new Date(row.created_at), 'yyyy-MM-dd HH:mm:ss') : '',
        row.updated_at ? format(new Date(row.updated_at), 'yyyy-MM-dd HH:mm:ss') : '',
        row.merged_at ? format(new Date(row.merged_at), 'yyyy-MM-dd HH:mm:ss') : '',
        row.closed_at ? format(new Date(row.closed_at), 'yyyy-MM-dd HH:mm:ss') : '',
        row.is_repopo_event ? 'Yes' : 'No',
        row.merge_time_hours ? parseFloat(row.merge_time_hours).toFixed(2) : ''
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="merge-requests-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting merge requests:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export merge requests',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
