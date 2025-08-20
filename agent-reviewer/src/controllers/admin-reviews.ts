import { Request, Response } from 'express';
import { dbService } from '../services/database.js';
import { format } from 'date-fns';

interface ReviewFilters {
  projectId?: number;
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

// Map frontend camelCase field names to database snake_case column names with proper table prefixes
const SORTABLE_COLUMNS: Record<string, string> = {
  'reviewedAt': 'mrr.reviewed_at',
  'createdAt': 'mrr.created_at',
  'updatedAt': 'mrr.updated_at',
  'projectName': 'p.name',
  'mergeRequestIid': 'mrr.merge_request_iid',
  'lastReviewedCommitSha': 'mrr.last_reviewed_commit_sha',
  'status': 'status', // This is a computed field in SELECT
  'criticalIssuesCount': 'criticalIssuesCount', // This is a computed field in SELECT
  'reviewerType': 'reviewerType' // This is a computed field in SELECT
};

// Default sortable columns that are safe to use
const DEFAULT_SORT_COLUMN = 'mrr.reviewed_at';

/**
 * Get review history with pagination and filtering
 * Includes SQL injection protection through column name validation
 */
export const getReviewHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      page = 1,
      limit = 20,
      sortBy = 'reviewed_at',
      sortOrder = 'desc',
      projectId,
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

    const filters: ReviewFilters = {
      projectId: projectId ? parseInt(projectId as string) : undefined,
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
      whereClause += ` AND mrr.project_id = $${paramIndex}`;
      queryParams.push(filters.projectId);
      paramIndex++;
    }

    if (filters.dateFrom) {
      whereClause += ` AND mrr.reviewed_at >= $${paramIndex}`;
      queryParams.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereClause += ` AND mrr.reviewed_at <= $${paramIndex}`;
      queryParams.push(filters.dateTo);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR CAST(mrr.merge_request_iid AS TEXT) ILIKE $${paramIndex})`;
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM merge_request_reviews mrr
      LEFT JOIN projects p ON mrr.project_id = p.project_id
      ${whereClause}
    `;

    const countResult = await dbService.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].total);

    // Get paginated results
    const dataQuery = `
      SELECT 
        mrr.id,
        mrr.project_id as "projectId",
        p.name as "projectName",
        mrr.merge_request_iid as "mergeRequestIid",
        mrr.last_reviewed_commit_sha as "lastReviewedCommitSha",
        mrr.review_comment_id as "reviewCommentId",
        mrr.reviewed_at as "reviewedAt",
        mrr.created_at as "createdAt",
        mrr.updated_at as "updatedAt",
        'approved' as status,
        0 as "criticalIssuesCount",
        'auto' as "reviewerType"
      FROM merge_request_reviews mrr
      LEFT JOIN projects p ON mrr.project_id = p.project_id
      ${whereClause}
      ORDER BY ${pagination.sortBy} ${pagination?.sortOrder?.toUpperCase()}
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
        totalPages
      }
    });
  } catch (error) {
    console.error('Error getting review history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch review history',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};

/**
 * Export review history as CSV
 */
export const exportReviewHistory = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      projectId,
      status,
      dateFrom,
      dateTo,
      search
    } = req.query;

    const filters: ReviewFilters = {
      projectId: projectId ? parseInt(projectId as string) : undefined,
      status: status as string,
      dateFrom: dateFrom as string,
      dateTo: dateTo as string,
      search: search as string
    };

    // Build the query (similar to getReviewHistory but without pagination)
    let whereClause = 'WHERE 1=1';
    const queryParams: any[] = [];
    let paramIndex = 1;

    if (filters.projectId) {
      whereClause += ` AND mrr.project_id = $${paramIndex}`;
      queryParams.push(filters.projectId);
      paramIndex++;
    }

    if (filters.dateFrom) {
      whereClause += ` AND mrr.reviewed_at >= $${paramIndex}`;
      queryParams.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      whereClause += ` AND mrr.reviewed_at <= $${paramIndex}`;
      queryParams.push(filters.dateTo);
      paramIndex++;
    }

    if (filters.search) {
      whereClause += ` AND (p.name ILIKE $${paramIndex} OR CAST(mrr.merge_request_iid AS TEXT) ILIKE $${paramIndex})`;
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }

    const query = `
      SELECT 
        mrr.id,
        p.name as project_name,
        mrr.merge_request_iid,
        mrr.last_reviewed_commit_sha,
        mrr.reviewed_at,
        'approved' as status,
        'auto' as reviewer_type
      FROM merge_request_reviews mrr
      LEFT JOIN projects p ON mrr.project_id = p.project_id
      ${whereClause}
      ORDER BY mrr.reviewed_at DESC
    `;

    const result = await dbService.query(query, queryParams);

    // Generate CSV content
    const headers = ['ID', 'Project Name', 'MR ID', 'Commit SHA', 'Reviewed At', 'Status', 'Reviewer Type'];
    const csvContent = [
      headers.join(','),
      ...result.rows.map(row => [
        row.id,
        `"${row.project_name || ''}"`,
        row.merge_request_iid,
        row.last_reviewed_commit_sha,
        format(new Date(row.reviewed_at), 'yyyy-MM-dd HH:mm:ss'),
        row.status,
        row.reviewer_type
      ].join(','))
    ].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="reviews-export-${format(new Date(), 'yyyy-MM-dd')}.csv"`);
    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting review history:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to export review history',
      message: error instanceof Error ? error.message : String(error)
    });
  }
};
