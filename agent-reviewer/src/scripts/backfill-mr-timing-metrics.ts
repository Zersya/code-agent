#!/usr/bin/env bun
/**
 * Backfill script for MR Timing Metrics
 * 
 * This script processes historical merge requests to calculate and populate
 * timing metrics including time to first review, time to merge, approval times,
 * and updates existing records with missing timing data.
 * 
 * CLI options:
 *  --project-id <id>   Limit to a single project
 *  --date-from <date>  Start date (YYYY-MM-DD) for MR created_at
 *  --date-to <date>    End date (YYYY-MM-DD) for MR created_at
 *  --dry-run           Preview actions without writing
 *  --verbose           More detailed logging
 *  --force             Recalculate all timing data even if it exists
 *  --table <name>      Target specific table (mr_quality_metrics, user_mr_statistics, or all)
 */

import { dbService } from '../services/database.js';
import { gitlabService } from '../services/gitlab.js';

interface BackfillOptions {
  projectId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
  table?: string;
}

interface TimingData {
  project_id: number;
  merge_request_iid: number;
  merge_request_id: number;
  author_username: string;
  created_at: Date;
  merged_at: Date | null;
  approved_at: Date | null;
  first_review_at: Date | null;
  time_to_first_review_hours: number | null;
  time_to_merge_hours: number | null;
  time_to_approval_hours: number | null;
}

class MRTimingMetricsBackfillService {
  
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting MR Timing Metrics backfill process...');
    
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be modified');
    }

    try {
      await dbService.initializeSchema();
      console.log('✓ Database schema verified');

      const targetTable = options.table || 'all';
      console.log(`📋 Target table(s): ${targetTable}`);

      if (targetTable === 'all' || targetTable === 'mr_quality_metrics') {
        await this.updateMRQualityMetricsTiming(options);
      }

      if (targetTable === 'all' || targetTable === 'user_mr_statistics') {
        await this.updateUserMRStatisticsTiming(options);
      }

      if (targetTable === 'all' || targetTable === 'merge_request_tracking') {
        await this.updateMergeRequestTrackingTiming(options);
      }

      console.log('✅ MR Timing Metrics backfill complete');

    } catch (error) {
      console.error('💥 Backfill failed:', error);
      throw error;
    }
  }

  private async updateMRQualityMetricsTiming(options: BackfillOptions): Promise<void> {
    console.log('\n📊 Updating MR Quality Metrics timing data...');

    // Get MRs from mr_quality_metrics that need timing updates
    const query = `
      SELECT 
        mqm.project_id,
        mqm.merge_request_iid,
        mrt.merge_request_id,
        mrt.author_username,
        mrt.created_at,
        mrt.merged_at,
        mrt.approved_at,
        mqm.time_to_first_review_hours,
        mqm.time_to_merge_hours
      FROM mr_quality_metrics mqm
      JOIN merge_request_tracking mrt ON mqm.project_id = mrt.project_id 
        AND mqm.merge_request_iid = mrt.merge_request_iid
      WHERE (
        ${options.force ? 'TRUE' : `
        mqm.time_to_first_review_hours IS NULL 
        OR mqm.time_to_merge_hours IS NULL
        `}
      )
      ${options.projectId ? `AND mqm.project_id = ${options.projectId}` : ''}
      ${options.dateFrom ? `AND mrt.created_at >= '${options.dateFrom.toISOString()}'` : ''}
      ${options.dateTo ? `AND mrt.created_at <= '${options.dateTo.toISOString()}'` : ''}
      ORDER BY mrt.created_at DESC
    `;

    const result = await dbService.query(query);
    const records = result.rows;

    console.log(`Found ${records.length} MR quality metrics records to update`);

    let updated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        if (options.verbose) {
          console.log(`Processing MR ${record.project_id}!${record.merge_request_iid}`);
        }

        const timingData = await this.calculateTimingMetrics(record);
        
        if (!options.dryRun) {
          await this.updateMRQualityMetricsRecord(timingData);
        }
        
        updated++;
        
        if (options.verbose) {
          console.log(`  ✓ Updated timing: first review ${timingData.time_to_first_review_hours}h, merge ${timingData.time_to_merge_hours}h`);
        }

      } catch (error) {
        errors++;
        console.error(`❌ Error processing MR ${record.project_id}!${record.merge_request_iid}:`, error);
      }
    }

    console.log(`📈 MR Quality Metrics Timing Summary:`);
    console.log(`  Records updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  private async updateUserMRStatisticsTiming(options: BackfillOptions): Promise<void> {
    console.log('\n👥 Updating User MR Statistics timing data...');

    // Recalculate average merge times for all users
    const query = `
      SELECT DISTINCT user_id, username, project_id
      FROM user_mr_statistics
      ${options.projectId ? `WHERE project_id = ${options.projectId}` : ''}
      ORDER BY username, project_id
    `;

    const result = await dbService.query(query);
    const userProjects = result.rows;

    console.log(`Found ${userProjects.length} user-project combinations to update`);

    let updated = 0;
    let errors = 0;

    for (const userProject of userProjects) {
      try {
        if (options.verbose) {
          console.log(`Processing ${userProject.username} in project ${userProject.project_id}`);
        }

        const avgMergeTime = await this.calculateUserAverageMergeTime(
          userProject.user_id, 
          userProject.project_id, 
          options
        );
        
        if (!options.dryRun && avgMergeTime !== null) {
          await dbService.query(`
            UPDATE user_mr_statistics 
            SET avg_merge_time_hours = $1, updated_at = NOW()
            WHERE user_id = $2 AND project_id = $3
          `, [avgMergeTime, userProject.user_id, userProject.project_id]);
        }
        
        updated++;
        
        if (options.verbose) {
          console.log(`  ✓ Updated average merge time: ${avgMergeTime}h`);
        }

      } catch (error) {
        errors++;
        console.error(`❌ Error processing user ${userProject.username}:`, error);
      }
    }

    console.log(`📈 User MR Statistics Timing Summary:`);
    console.log(`  User-project combinations updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  private async updateMergeRequestTrackingTiming(options: BackfillOptions): Promise<void> {
    console.log('\n📋 Updating Merge Request Tracking approval times...');

    // Get MRs that need approval time updates
    let query = `
      SELECT project_id, merge_request_iid, created_at, approved_at
      FROM merge_request_tracking
      WHERE ${options.force ? 'TRUE' : 'approved_at IS NULL'}
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

    query += ` ORDER BY created_at DESC LIMIT 100`; // Process in batches

    const result = await dbService.query(query, params);
    const records = result.rows;

    console.log(`Found ${records.length} MR tracking records to update`);

    let updated = 0;
    let errors = 0;

    for (const record of records) {
      try {
        if (options.verbose) {
          console.log(`Processing MR ${record.project_id}!${record.merge_request_iid} for approval time`);
        }

        // Fetch approval time from GitLab API
        const approvalAt = await gitlabService.getMergeRequestApprovalAt(
          record.project_id, 
          record.merge_request_iid
        );
        
        if (approvalAt && !options.dryRun) {
          await dbService.query(`
            UPDATE merge_request_tracking 
            SET approved_at = $1, updated_at = NOW()
            WHERE project_id = $2 AND merge_request_iid = $3
          `, [approvalAt, record.project_id, record.merge_request_iid]);
          
          updated++;
          
          if (options.verbose) {
            console.log(`  ✓ Updated approval time: ${approvalAt.toISOString()}`);
          }
        } else if (options.verbose) {
          console.log(`  - No approval found`);
        }

        // Small delay to be polite to GitLab API
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        errors++;
        console.error(`❌ Error processing MR ${record.project_id}!${record.merge_request_iid}:`, error);
      }
    }

    console.log(`📈 MR Tracking Timing Summary:`);
    console.log(`  Records updated: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  private async calculateTimingMetrics(record: any): Promise<TimingData> {
    const createdAt = new Date(record.created_at);
    const mergedAt = record.merged_at ? new Date(record.merged_at) : null;
    const approvedAt = record.approved_at ? new Date(record.approved_at) : null;

    // Get first review time
    const firstReviewAt = await this.getFirstReviewTime(record.project_id, record.merge_request_iid);

    // Calculate timing metrics
    const timeToFirstReview = firstReviewAt 
      ? Math.round(((firstReviewAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)) * 100) / 100
      : null;

    const timeToMerge = mergedAt 
      ? Math.round(((mergedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)) * 100) / 100
      : null;

    const timeToApproval = approvedAt 
      ? Math.round(((approvedAt.getTime() - createdAt.getTime()) / (1000 * 60 * 60)) * 100) / 100
      : null;

    return {
      project_id: record.project_id,
      merge_request_iid: record.merge_request_iid,
      merge_request_id: record.merge_request_id,
      author_username: record.author_username,
      created_at: createdAt,
      merged_at: mergedAt,
      approved_at: approvedAt,
      first_review_at: firstReviewAt,
      time_to_first_review_hours: timeToFirstReview,
      time_to_merge_hours: timeToMerge,
      time_to_approval_hours: timeToApproval
    };
  }

  private async getFirstReviewTime(projectId: number, mergeRequestIid: number): Promise<Date | null> {
    // Check if merge_request_reviews table exists
    const tableExistsResult = await dbService.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'merge_request_reviews'
      )
    `);
    
    if (!tableExistsResult.rows[0].exists) {
      return null;
    }

    const result = await dbService.query(`
      SELECT MIN(reviewed_at) as first_review_at
      FROM merge_request_reviews
      WHERE project_id = $1 AND merge_request_iid = $2
        AND reviewed_at IS NOT NULL
    `, [projectId, mergeRequestIid]);

    const firstReviewAt = result.rows[0]?.first_review_at;
    return firstReviewAt ? new Date(firstReviewAt) : null;
  }

  private async calculateUserAverageMergeTime(userId: number, projectId: number, options: BackfillOptions): Promise<number | null> {
    let query = `
      SELECT AVG(
        CASE 
          WHEN merged_at IS NOT NULL AND created_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600.0
        END
      ) as avg_merge_time_hours
      FROM merge_request_tracking
      WHERE author_id = $1 AND project_id = $2 AND status = 'merged'
    `;

    const params: any[] = [userId, projectId];
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
    const avgTime = result.rows[0]?.avg_merge_time_hours;
    
    return avgTime ? Math.round(parseFloat(avgTime) * 100) / 100 : null;
  }

  private async updateMRQualityMetricsRecord(data: TimingData): Promise<void> {
    await dbService.query(`
      UPDATE mr_quality_metrics 
      SET 
        time_to_first_review_hours = $1,
        time_to_merge_hours = $2,
        calculated_at = NOW()
      WHERE project_id = $3 AND merge_request_iid = $4
    `, [
      data.time_to_first_review_hours,
      data.time_to_merge_hours,
      data.project_id,
      data.merge_request_iid
    ]);
  }

  async showSummary(): Promise<void> {
    try {
      // Show timing metrics summary
      const qualityMetricsResult = await dbService.query(`
        SELECT 
          COUNT(*) as total_records,
          COUNT(time_to_first_review_hours) as with_first_review_time,
          COUNT(time_to_merge_hours) as with_merge_time,
          ROUND(AVG(time_to_first_review_hours), 1) as avg_first_review_hours,
          ROUND(AVG(time_to_merge_hours), 1) as avg_merge_hours
        FROM mr_quality_metrics
      `);

      const qmStats = qualityMetricsResult.rows[0];
      console.log(`\n📊 MR Quality Metrics Timing Summary:`);
      console.log(`  Total records: ${qmStats.total_records}`);
      console.log(`  With first review time: ${qmStats.with_first_review_time}`);
      console.log(`  With merge time: ${qmStats.with_merge_time}`);
      console.log(`  Average time to first review: ${qmStats.avg_first_review_hours}h`);
      console.log(`  Average time to merge: ${qmStats.avg_merge_hours}h`);

      // Show user statistics timing summary
      const userStatsResult = await dbService.query(`
        SELECT 
          COUNT(*) as total_users,
          COUNT(avg_merge_time_hours) as with_avg_merge_time,
          ROUND(AVG(avg_merge_time_hours), 1) as overall_avg_merge_hours
        FROM user_mr_statistics
      `);

      const userStats = userStatsResult.rows[0];
      console.log(`\n👥 User MR Statistics Timing Summary:`);
      console.log(`  Total user-project combinations: ${userStats.total_users}`);
      console.log(`  With average merge time: ${userStats.with_avg_merge_time}`);
      console.log(`  Overall average merge time: ${userStats.overall_avg_merge_hours}h`);

      // Show approval timing summary
      const approvalResult = await dbService.query(`
        SELECT 
          COUNT(*) as total_mrs,
          COUNT(approved_at) as with_approval_time,
          ROUND(AVG(
            CASE 
              WHEN approved_at IS NOT NULL AND created_at IS NOT NULL 
              THEN EXTRACT(EPOCH FROM (approved_at - created_at)) / 3600.0
            END
          ), 1) as avg_approval_hours
        FROM merge_request_tracking
      `);

      const approvalStats = approvalResult.rows[0];
      console.log(`\n✅ MR Approval Timing Summary:`);
      console.log(`  Total MRs: ${approvalStats.total_mrs}`);
      console.log(`  With approval time: ${approvalStats.with_approval_time}`);
      console.log(`  Average time to approval: ${approvalStats.avg_approval_hours}h`);

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
    } else if (arg === '--table' && i + 1 < args.length) {
      options.table = args[++i];
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    await dbService.connect();
    
    const options = parseArgs();
    const service = new MRTimingMetricsBackfillService();
    
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
