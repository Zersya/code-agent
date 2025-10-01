import { Request, Response } from 'express';
import { dbService } from '../services/database.js';
import { monthlyReportService } from '../services/monthly-report.js';
import { MonthlyReportData } from '../models/monthly-report.js';

/**
 * Create a new monthly report
 */
export const createMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year, autoGenerate } = req.body;

    // Validate month and year
    if (!month || !year || month < 1 || month > 12 || year < 2020) {
      res.status(400).json({
        success: false,
        message: 'Invalid month or year. Month must be 1-12 and year must be >= 2020'
      });
      return;
    }

    // Check if report already exists
    const existing = await dbService.getMonthlyReport(month, year);
    if (existing) {
      res.status(409).json({
        success: false,
        message: `Monthly report for ${month}/${year} already exists`
      });
      return;
    }

    // Generate report data
    let reportData: MonthlyReportData;
    if (autoGenerate) {
      reportData = await monthlyReportService.generateMonthlyReportData(month, year);
    } else {
      // Create empty template
      reportData = {
        month,
        year,
        actionPoints: [],
        highlights: [],
        lowlights: [],
        techUpdate: {
          mergeRequestDashboard: {
            totalMRCreated: 0,
            totalMRMerged: 0,
            mergeRate: 0,
            topContributors: []
          },
          toolingChanges: []
        },
        lessonsLearned: [],
        productStrategy: {
          feedbackSummary: '',
          qualityMetrics: []
        },
        budgeting: {
          items: []
        },
        thankYouNote: ''
      };
    }

    // Get username from auth (if available)
    const createdBy = (req as any).user?.username || 'admin';

    // Save to database
    const record = await dbService.createMonthlyReport(month, year, reportData, createdBy);

    res.json({
      success: true,
      data: {
        id: record.id,
        month: record.month,
        year: record.year,
        reportData: typeof record.report_data === 'string' ? JSON.parse(record.report_data) : record.report_data,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        createdBy: record.created_by
      }
    });
  } catch (error) {
    console.error('Error creating monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create monthly report'
    });
  }
};

/**
 * Get a specific monthly report
 */
export const getMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.params;

    const record = await dbService.getMonthlyReport(parseInt(month), parseInt(year));

    if (!record) {
      res.status(404).json({
        success: false,
        message: 'Monthly report not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: record.id,
        month: record.month,
        year: record.year,
        reportData: typeof record.report_data === 'string' ? JSON.parse(record.report_data) : record.report_data,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        createdBy: record.created_by
      }
    });
  } catch (error) {
    console.error('Error getting monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get monthly report'
    });
  }
};

/**
 * List all monthly reports with optional filters
 */
export const listMonthlyReports = async (req: Request, res: Response): Promise<void> => {
  try {
    const { year, month, page, limit } = req.query;

    const filters = {
      year: year ? parseInt(year as string) : undefined,
      month: month ? parseInt(month as string) : undefined,
      page: page ? parseInt(page as string) : 1,
      limit: limit ? parseInt(limit as string) : 20
    };

    const { reports, total } = await dbService.listMonthlyReports(filters);

    const data = reports.map(record => ({
      id: record.id,
      month: record.month,
      year: record.year,
      reportData: typeof record.report_data === 'string' ? JSON.parse(record.report_data) : record.report_data,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
      createdBy: record.created_by
    }));

    res.json({
      success: true,
      data,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        totalPages: Math.ceil(total / filters.limit)
      }
    });
  } catch (error) {
    console.error('Error listing monthly reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list monthly reports'
    });
  }
};

/**
 * Update a monthly report
 */
export const updateMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { reportData } = req.body;

    if (!reportData) {
      res.status(400).json({
        success: false,
        message: 'Report data is required'
      });
      return;
    }

    const record = await dbService.updateMonthlyReport(parseInt(id), reportData);

    if (!record) {
      res.status(404).json({
        success: false,
        message: 'Monthly report not found'
      });
      return;
    }

    res.json({
      success: true,
      data: {
        id: record.id,
        month: record.month,
        year: record.year,
        reportData: typeof record.report_data === 'string' ? JSON.parse(record.report_data) : record.report_data,
        createdAt: record.created_at,
        updatedAt: record.updated_at,
        createdBy: record.created_by
      }
    });
  } catch (error) {
    console.error('Error updating monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update monthly report'
    });
  }
};

/**
 * Delete a monthly report
 */
export const deleteMonthlyReport = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const deleted = await dbService.deleteMonthlyReport(parseInt(id));

    if (!deleted) {
      res.status(404).json({
        success: false,
        message: 'Monthly report not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Monthly report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting monthly report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete monthly report'
    });
  }
};

/**
 * Get auto-generated data for a specific month (preview before creating)
 */
export const getAutoGeneratedData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { month, year } = req.params;

    const data = await monthlyReportService.getAutoGeneratedData(
      parseInt(month),
      parseInt(year)
    );

    res.json({
      success: true,
      data
    });
  } catch (error) {
    console.error('Error getting auto-generated data:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get auto-generated data'
    });
  }
};

