#!/usr/bin/env bun
/**
 * Backfill script for Review Status Analytics
 * 
 * This script processes historical merge request reviews to calculate and populate
 * review status metrics including pending, reviewed, approved, rejected counts,
 * review response times, and reviewer performance statistics.
 * 
 * CLI options:
 *  --project-id <id>   Limit to a single project
 *  --date-from <date>  Start date (YYYY-MM-DD) for review created_at
 *  --date-to <date>    End date (YYYY-MM-DD) for review created_at
 *  --dry-run           Preview actions without writing
 *  --verbose           More detailed logging
 *  --force             Recalculate all statistics even if they exist
 */

import { dbService } from '../services/database.js';

interface BackfillOptions {
  projectId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
}

interface ReviewStatusData {
  project_id: number;
  merge_request_iid: number;
  total_reviews: number;
  pending_reviews: number;
  completed_reviews: number;
  approved_reviews: number;
  rejected_reviews: number;
  avg_review_time_hours: number;
  first_review_at: Date | null;
  last_review_at: Date | null;
  critical_issues_total: number;
  fixes_implemented_total: number;
}

interface ReviewerStats {
  reviewer_username: string;
  project_id: number;
  total_reviews_given: number;
  avg_review_time_hours: number;
  approval_rate: number;
  avg_critical_issues_found: number;
}

class ReviewStatusAnalyticsBackfillService {
  
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting Review Status Analytics backfill process...');
    
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be modified');
    }

    try {
      await dbService.initializeSchema();
      console.log('✓ Database schema verified');

      // Check if merge_request_reviews table exists
      const tableExists = await this.checkReviewsTableExists();
      if (!tableExists) {
        console.log('⚠️  merge_request_reviews table does not exist. Skipping review analytics.');
        return;
      }

      // Create review analytics tables if they don't exist
      await this.createAnalyticsTables(options);

      // Calculate MR review statistics
      await this.calculateMRReviewStatistics(options);

      // Calculate reviewer performance statistics
      await this.calculateReviewerStatistics(options);

      console.log('✅ Review Status Analytics backfill complete');

    } catch (error) {
      console.error('💥 Backfill failed:', error);
      throw error;
    }
  }

  private async checkReviewsTableExists(): Promise<boolean> {
    const result = await dbService.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'merge_request_reviews'
      )
    `);
    return result.rows[0].exists;
  }

  private async createAnalyticsTables(options: BackfillOptions): Promise<void> {
    if (!options.dryRun) {
      // Create MR review analytics table
      await dbService.query(`
        CREATE TABLE IF NOT EXISTS mr_review_analytics (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          total_reviews INTEGER DEFAULT 0,
          pending_reviews INTEGER DEFAULT 0,
          completed_reviews INTEGER DEFAULT 0,
          approved_reviews INTEGER DEFAULT 0,
          rejected_reviews INTEGER DEFAULT 0,
          avg_review_time_hours DECIMAL(10,2),
          first_review_at TIMESTAMP WITH TIME ZONE,
          last_review_at TIMESTAMP WITH TIME ZONE,
          critical_issues_total INTEGER DEFAULT 0,
          fixes_implemented_total INTEGER DEFAULT 0,
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(project_id, merge_request_iid)
        )
      `);

      // Create reviewer performance analytics table
      await dbService.query(`
        CREATE TABLE IF NOT EXISTS reviewer_performance_analytics (
          id SERIAL PRIMARY KEY,
          reviewer_username TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          total_reviews_given INTEGER DEFAULT 0,
          avg_review_time_hours DECIMAL(10,2),
          approval_rate DECIMAL(5,2),
          avg_critical_issues_found DECIMAL(5,2),
          last_review_at TIMESTAMP WITH TIME ZONE,
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(reviewer_username, project_id)
        )
      `);

      console.log('✓ Analytics tables created/verified');
    }
  }

  private async calculateMRReviewStatistics(options: BackfillOptions): Promise<void> {
    console.log('\n📊 Calculating MR review statistics...');

    // Get all MRs that have reviews
    const mrList = await this.getMRsWithReviews(options);
    console.log(`Found ${mrList.length} MRs with reviews to process`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const mr of mrList) {
      try {
        if (options.verbose) {
          console.log(`Processing MR ${mr.project_id}!${mr.merge_request_iid}`);
        }

        // Calculate review statistics for this MR
        const stats = await this.calculateMRReviewStats(mr.project_id, mr.merge_request_iid, options);
        
        if (stats) {
          // Check if record exists
          const existingRecord = await this.getExistingMRReviewStats(mr.project_id, mr.merge_request_iid);
          
          if (existingRecord && !options.force) {
            if (options.verbose) {
              console.log(`  ⏭️  Skipping existing record (use --force to recalculate)`);
            }
          } else {
            // Insert or update the statistics
            if (!options.dryRun) {
              await this.upsertMRReviewAnalytics(stats);
            }
            updated++;
            
            if (options.verbose) {
              console.log(`  ✓ ${existingRecord ? 'Updated' : 'Created'} review stats: ${stats.total_reviews} reviews, ${stats.approved_reviews} approved`);
            }
          }
        }

        processed++;

      } catch (error) {
        errors++;
        console.error(`❌ Error processing MR ${mr.project_id}!${mr.merge_request_iid}:`, error);
      }
    }

    console.log(`\n📈 MR Review Statistics Summary:`);
    console.log(`  MRs processed: ${processed}`);
    console.log(`  Records updated/created: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  private async calculateReviewerStatistics(options: BackfillOptions): Promise<void> {
    console.log('\n👥 Calculating reviewer performance statistics...');

    // Get all reviewers (assuming reviewer info is in a reviewer_username field or similar)
    const reviewers = await this.getReviewers(options);
    console.log(`Found ${reviewers.length} reviewers to process`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const reviewer of reviewers) {
      try {
        if (options.verbose) {
          console.log(`Processing reviewer ${reviewer.reviewer_username} in project ${reviewer.project_id}`);
        }

        // Calculate reviewer statistics
        const stats = await this.calculateReviewerStats(reviewer.reviewer_username, reviewer.project_id, options);
        
        if (stats) {
          // Check if record exists
          const existingRecord = await this.getExistingReviewerStats(reviewer.reviewer_username, reviewer.project_id);
          
          if (existingRecord && !options.force) {
            if (options.verbose) {
              console.log(`  ⏭️  Skipping existing record (use --force to recalculate)`);
            }
          } else {
            // Insert or update the statistics
            if (!options.dryRun) {
              await this.upsertReviewerPerformanceAnalytics(stats);
            }
            updated++;
            
            if (options.verbose) {
              console.log(`  ✓ ${existingRecord ? 'Updated' : 'Created'} reviewer stats: ${stats.total_reviews_given} reviews, ${stats.approval_rate}% approval rate`);
            }
          }
        }

        processed++;

      } catch (error) {
        errors++;
        console.error(`❌ Error processing reviewer ${reviewer.reviewer_username}:`, error);
      }
    }

    console.log(`\n📈 Reviewer Performance Summary:`);
    console.log(`  Reviewers processed: ${processed}`);
    console.log(`  Records updated/created: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  private async getMRsWithReviews(options: BackfillOptions): Promise<Array<{project_id: number, merge_request_iid: number}>> {
    let query = `
      SELECT DISTINCT project_id, merge_request_iid
      FROM merge_request_reviews
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (options.projectId) {
      query += ` AND project_id = $${paramIndex}`;
      params.push(options.projectId);
      paramIndex++;
    }

    if (options.dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.dateFrom);
      paramIndex++;
    }

    if (options.dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.dateTo);
      paramIndex++;
    }

    query += ` ORDER BY project_id, merge_request_iid`;

    const result = await dbService.query(query, params);
    return result.rows;
  }

  private async getReviewers(options: BackfillOptions): Promise<Array<{reviewer_username: string, project_id: number}>> {
    // Note: This assumes there's a reviewer_username field in merge_request_reviews
    // If the field name is different, adjust accordingly
    let query = `
      SELECT DISTINCT 
        COALESCE(reviewer_username, 'automated') as reviewer_username,
        project_id
      FROM merge_request_reviews
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (options.projectId) {
      query += ` AND project_id = $${paramIndex}`;
      params.push(options.projectId);
      paramIndex++;
    }

    if (options.dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.dateFrom);
      paramIndex++;
    }

    if (options.dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.dateTo);
      paramIndex++;
    }

    query += ` ORDER BY reviewer_username, project_id`;

    const result = await dbService.query(query, params);
    return result.rows;
  }

  private async calculateMRReviewStats(projectId: number, mergeRequestIid: number, options: BackfillOptions): Promise<ReviewStatusData | null> {
    let query = `
      SELECT 
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending_reviews,
        COUNT(CASE WHEN status IN ('reviewed', 'approved', 'rejected') THEN 1 END) as completed_reviews,
        COUNT(CASE WHEN status = 'approved' THEN 1 END) as approved_reviews,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected_reviews,
        MIN(reviewed_at) as first_review_at,
        MAX(reviewed_at) as last_review_at,
        SUM(critical_issues_count) as critical_issues_total,
        SUM(fixes_implemented_count) as fixes_implemented_total,
        AVG(
          CASE 
            WHEN reviewed_at IS NOT NULL AND created_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600.0
          END
        ) as avg_review_time_hours
      FROM merge_request_reviews
      WHERE project_id = $1 AND merge_request_iid = $2
    `;

    const params: any[] = [projectId, mergeRequestIid];
    let paramIndex = 3;

    if (options.dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.dateFrom);
      paramIndex++;
    }

    if (options.dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.dateTo);
      paramIndex++;
    }

    const result = await dbService.query(query, params);
    const row = result.rows[0];

    if (!row || row.total_reviews === 0) {
      return null;
    }

    return {
      project_id: projectId,
      merge_request_iid: mergeRequestIid,
      total_reviews: parseInt(row.total_reviews),
      pending_reviews: parseInt(row.pending_reviews),
      completed_reviews: parseInt(row.completed_reviews),
      approved_reviews: parseInt(row.approved_reviews),
      rejected_reviews: parseInt(row.rejected_reviews),
      avg_review_time_hours: parseFloat(row.avg_review_time_hours) || 0,
      first_review_at: row.first_review_at ? new Date(row.first_review_at) : null,
      last_review_at: row.last_review_at ? new Date(row.last_review_at) : null,
      critical_issues_total: parseInt(row.critical_issues_total) || 0,
      fixes_implemented_total: parseInt(row.fixes_implemented_total) || 0
    };
  }

  private async calculateReviewerStats(reviewerUsername: string, projectId: number, options: BackfillOptions): Promise<ReviewerStats | null> {
    let query = `
      SELECT 
        COUNT(*) as total_reviews_given,
        AVG(
          CASE 
            WHEN reviewed_at IS NOT NULL AND created_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (reviewed_at - created_at)) / 3600.0
          END
        ) as avg_review_time_hours,
        (COUNT(CASE WHEN status = 'approved' THEN 1 END)::float / NULLIF(COUNT(CASE WHEN status IN ('approved', 'rejected') THEN 1 END), 0) * 100) as approval_rate,
        AVG(critical_issues_count) as avg_critical_issues_found
      FROM merge_request_reviews
      WHERE COALESCE(reviewer_username, 'automated') = $1 AND project_id = $2
    `;

    const params: any[] = [reviewerUsername, projectId];
    let paramIndex = 3;

    if (options.dateFrom) {
      query += ` AND created_at >= $${paramIndex}`;
      params.push(options.dateFrom);
      paramIndex++;
    }

    if (options.dateTo) {
      query += ` AND created_at <= $${paramIndex}`;
      params.push(options.dateTo);
      paramIndex++;
    }

    const result = await dbService.query(query, params);
    const row = result.rows[0];

    if (!row || row.total_reviews_given === 0) {
      return null;
    }

    return {
      reviewer_username: reviewerUsername,
      project_id: projectId,
      total_reviews_given: parseInt(row.total_reviews_given),
      avg_review_time_hours: parseFloat(row.avg_review_time_hours) || 0,
      approval_rate: parseFloat(row.approval_rate) || 0,
      avg_critical_issues_found: parseFloat(row.avg_critical_issues_found) || 0
    };
  }

  private async getExistingMRReviewStats(projectId: number, mergeRequestIid: number): Promise<any> {
    const result = await dbService.query(
      'SELECT id FROM mr_review_analytics WHERE project_id = $1 AND merge_request_iid = $2',
      [projectId, mergeRequestIid]
    );
    return result.rows[0] || null;
  }

  private async getExistingReviewerStats(reviewerUsername: string, projectId: number): Promise<any> {
    const result = await dbService.query(
      'SELECT id FROM reviewer_performance_analytics WHERE reviewer_username = $1 AND project_id = $2',
      [reviewerUsername, projectId]
    );
    return result.rows[0] || null;
  }

  private async upsertMRReviewAnalytics(stats: ReviewStatusData): Promise<void> {
    await dbService.query(`
      INSERT INTO mr_review_analytics (
        project_id, merge_request_iid, total_reviews, pending_reviews, completed_reviews,
        approved_reviews, rejected_reviews, avg_review_time_hours, first_review_at,
        last_review_at, critical_issues_total, fixes_implemented_total, calculated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())
      ON CONFLICT (project_id, merge_request_iid)
      DO UPDATE SET
        total_reviews = EXCLUDED.total_reviews,
        pending_reviews = EXCLUDED.pending_reviews,
        completed_reviews = EXCLUDED.completed_reviews,
        approved_reviews = EXCLUDED.approved_reviews,
        rejected_reviews = EXCLUDED.rejected_reviews,
        avg_review_time_hours = EXCLUDED.avg_review_time_hours,
        first_review_at = EXCLUDED.first_review_at,
        last_review_at = EXCLUDED.last_review_at,
        critical_issues_total = EXCLUDED.critical_issues_total,
        fixes_implemented_total = EXCLUDED.fixes_implemented_total,
        calculated_at = NOW()
    `, [
      stats.project_id,
      stats.merge_request_iid,
      stats.total_reviews,
      stats.pending_reviews,
      stats.completed_reviews,
      stats.approved_reviews,
      stats.rejected_reviews,
      stats.avg_review_time_hours,
      stats.first_review_at,
      stats.last_review_at,
      stats.critical_issues_total,
      stats.fixes_implemented_total
    ]);
  }

  private async upsertReviewerPerformanceAnalytics(stats: ReviewerStats): Promise<void> {
    await dbService.query(`
      INSERT INTO reviewer_performance_analytics (
        reviewer_username, project_id, total_reviews_given, avg_review_time_hours,
        approval_rate, avg_critical_issues_found, calculated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, NOW())
      ON CONFLICT (reviewer_username, project_id)
      DO UPDATE SET
        total_reviews_given = EXCLUDED.total_reviews_given,
        avg_review_time_hours = EXCLUDED.avg_review_time_hours,
        approval_rate = EXCLUDED.approval_rate,
        avg_critical_issues_found = EXCLUDED.avg_critical_issues_found,
        calculated_at = NOW()
    `, [
      stats.reviewer_username,
      stats.project_id,
      stats.total_reviews_given,
      stats.avg_review_time_hours,
      stats.approval_rate,
      stats.avg_critical_issues_found
    ]);
  }

  async showSummary(): Promise<void> {
    try {
      // Show MR review analytics summary
      const mrAnalyticsResult = await dbService.query('SELECT COUNT(*) as count FROM mr_review_analytics');
      const mrAnalyticsCount = parseInt(mrAnalyticsResult.rows[0]?.count || 0);
      console.log(`✓ MR review analytics records: ${mrAnalyticsCount}`);

      // Show reviewer performance analytics summary
      const reviewerAnalyticsResult = await dbService.query('SELECT COUNT(*) as count FROM reviewer_performance_analytics');
      const reviewerAnalyticsCount = parseInt(reviewerAnalyticsResult.rows[0]?.count || 0);
      console.log(`✓ Reviewer performance analytics records: ${reviewerAnalyticsCount}`);

      // Show top reviewers by activity
      const topReviewersResult = await dbService.query(`
        SELECT reviewer_username, SUM(total_reviews_given) as total_reviews, 
               ROUND(AVG(approval_rate), 1) as avg_approval_rate
        FROM reviewer_performance_analytics 
        WHERE reviewer_username != 'automated'
        GROUP BY reviewer_username 
        ORDER BY total_reviews DESC 
        LIMIT 5
      `);

      if (topReviewersResult.rows.length > 0) {
        console.log('\n🏆 Top Reviewers by Activity:');
        topReviewersResult.rows.forEach((row, index) => {
          console.log(`  ${index + 1}. ${row.reviewer_username}: ${row.total_reviews} reviews (${row.avg_approval_rate}% approval rate)`);
        });
      }

    } catch (error) {
      console.error('Error showing summary:', error);
    }
  }
}

// CLI argument parsing
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--force') {
      options.force = true;
    } else if (arg === '--project-id' && i + 1 < args.length) {
      options.projectId = parseInt(args[++i]);
    } else if (arg === '--date-from' && i + 1 < args.length) {
      options.dateFrom = new Date(args[++i]);
    } else if (arg === '--date-to' && i + 1 < args.length) {
      options.dateTo = new Date(args[++i]);
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    await dbService.connect();
    
    const options = parseArgs();
    const service = new ReviewStatusAnalyticsBackfillService();
    
    await service.run(options);
    await service.showSummary();
    
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run if called directly
if (import.meta.main) {
  main();
}
