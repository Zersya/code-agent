#!/usr/bin/env bun
/**
 * Backfill script for MR Status Analytics
 * 
 * This script processes historical merge requests to calculate and populate
 * user MR statistics including total MRs created, merged, closed, rejected,
 * success rates, and average merge times.
 * 
 * CLI options:
 *  --project-id <id>   Limit to a single project
 *  --date-from <date>  Start date (YYYY-MM-DD) for MR created_at
 *  --date-to <date>    End date (YYYY-MM-DD) for MR created_at
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

interface MRStatusData {
  user_id: number;
  username: string;
  project_id: number;
  total_mrs_created: number;
  total_mrs_merged: number;
  total_mrs_closed: number;
  total_mrs_rejected: number;
  avg_merge_time_hours: number;
  last_mr_created_at: Date;
  last_mr_merged_at: Date | null;
}

class MRStatusAnalyticsBackfillService {
  
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting MR Status Analytics backfill process...');
    
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be modified');
    }

    try {
      await dbService.initializeSchema();
      console.log('✓ Database schema verified');

      // Get existing MR data and calculate statistics
      await this.calculateMRStatistics(options);

      console.log('✅ MR Status Analytics backfill complete');

    } catch (error) {
      console.error('💥 Backfill failed:', error);
      throw error;
    }
  }

  private async calculateMRStatistics(options: BackfillOptions): Promise<void> {
    console.log('\n📊 Calculating MR statistics...');

    // Get all users and projects from merge_request_tracking
    const userProjectCombos = await this.getUserProjectCombinations(options);
    console.log(`Found ${userProjectCombos.length} user-project combinations to process`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const combo of userProjectCombos) {
      try {
        if (options.verbose) {
          console.log(`Processing ${combo.username} in project ${combo.project_id}`);
        }

        // Calculate statistics for this user-project combination
        const stats = await this.calculateUserProjectStats(combo.user_id, combo.username, combo.project_id, options);
        
        if (stats) {
          // Check if record exists
          const existingRecord = await this.getExistingUserStats(combo.user_id, combo.project_id);
          
          if (existingRecord && !options.force) {
            if (options.verbose) {
              console.log(`  ⏭️  Skipping existing record (use --force to recalculate)`);
            }
          } else {
            // Insert or update the statistics
            if (!options.dryRun) {
              await this.upsertUserMRStatistics(stats);
            }
            updated++;
            
            if (options.verbose) {
              console.log(`  ✓ ${existingRecord ? 'Updated' : 'Created'} stats: ${stats.total_mrs_created} MRs, ${stats.total_mrs_merged} merged (${((stats.total_mrs_merged / stats.total_mrs_created) * 100).toFixed(1)}% success rate)`);
            }
          }
        }

        processed++;

      } catch (error) {
        errors++;
        console.error(`❌ Error processing ${combo.username} in project ${combo.project_id}:`, error);
      }
    }

    console.log(`\n📈 MR Statistics Summary:`);
    console.log(`  User-project combinations processed: ${processed}`);
    console.log(`  Records updated/created: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  private async getUserProjectCombinations(options: BackfillOptions): Promise<Array<{user_id: number, username: string, project_id: number}>> {
    let query = `
      SELECT DISTINCT 
        author_id as user_id,
        author_username as username,
        project_id
      FROM merge_request_tracking
      WHERE author_id IS NOT NULL 
        AND author_username IS NOT NULL
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

    query += ` ORDER BY username, project_id`;

    const result = await dbService.query(query, params);
    return result.rows;
  }

  private async calculateUserProjectStats(userId: number, username: string, projectId: number, options: BackfillOptions): Promise<MRStatusData | null> {
    let query = `
      SELECT 
        COUNT(*) as total_mrs_created,
        COUNT(CASE WHEN status = 'merged' THEN 1 END) as total_mrs_merged,
        COUNT(CASE WHEN status = 'closed' AND merged_at IS NULL THEN 1 END) as total_mrs_closed,
        COUNT(CASE WHEN status = 'rejected' THEN 1 END) as total_mrs_rejected,
        MAX(created_at) as last_mr_created_at,
        MAX(merged_at) as last_mr_merged_at,
        AVG(
          CASE 
            WHEN merged_at IS NOT NULL AND created_at IS NOT NULL 
            THEN EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600.0
          END
        ) as avg_merge_time_hours
      FROM merge_request_tracking
      WHERE author_id = $1 AND project_id = $2
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
    const row = result.rows[0];

    if (!row || row.total_mrs_created === 0) {
      return null;
    }

    return {
      user_id: userId,
      username: username,
      project_id: projectId,
      total_mrs_created: parseInt(row.total_mrs_created),
      total_mrs_merged: parseInt(row.total_mrs_merged),
      total_mrs_closed: parseInt(row.total_mrs_closed),
      total_mrs_rejected: parseInt(row.total_mrs_rejected),
      avg_merge_time_hours: parseFloat(row.avg_merge_time_hours) || 0,
      last_mr_created_at: new Date(row.last_mr_created_at),
      last_mr_merged_at: row.last_mr_merged_at ? new Date(row.last_mr_merged_at) : null
    };
  }

  private async getExistingUserStats(userId: number, projectId: number): Promise<any> {
    const result = await dbService.query(
      'SELECT id FROM user_mr_statistics WHERE user_id = $1 AND project_id = $2',
      [userId, projectId]
    );
    return result.rows[0] || null;
  }

  private async upsertUserMRStatistics(stats: MRStatusData): Promise<void> {
    await dbService.query(`
      INSERT INTO user_mr_statistics (
        user_id, username, project_id, total_mrs_created, total_mrs_merged,
        total_mrs_closed, total_mrs_rejected, avg_merge_time_hours,
        last_mr_created_at, last_mr_merged_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      ON CONFLICT (user_id, project_id)
      DO UPDATE SET
        username = EXCLUDED.username,
        total_mrs_created = EXCLUDED.total_mrs_created,
        total_mrs_merged = EXCLUDED.total_mrs_merged,
        total_mrs_closed = EXCLUDED.total_mrs_closed,
        total_mrs_rejected = EXCLUDED.total_mrs_rejected,
        avg_merge_time_hours = EXCLUDED.avg_merge_time_hours,
        last_mr_created_at = EXCLUDED.last_mr_created_at,
        last_mr_merged_at = EXCLUDED.last_mr_merged_at,
        updated_at = NOW()
    `, [
      stats.user_id,
      stats.username,
      stats.project_id,
      stats.total_mrs_created,
      stats.total_mrs_merged,
      stats.total_mrs_closed,
      stats.total_mrs_rejected,
      stats.avg_merge_time_hours,
      stats.last_mr_created_at,
      stats.last_mr_merged_at
    ]);
  }

  async showSummary(): Promise<void> {
    try {
      // Show current statistics summary
      const statsResult = await dbService.query('SELECT COUNT(*) as count FROM user_mr_statistics');
      const statsCount = parseInt(statsResult.rows[0].count);
      console.log(`✓ User MR statistics records: ${statsCount}`);

      // Show top performers
      const topPerformersResult = await dbService.query(`
        SELECT username, SUM(total_mrs_created) as total_mrs, 
               ROUND(AVG(CASE WHEN total_mrs_created > 0 THEN (total_mrs_merged::float / total_mrs_created * 100) END), 1) as avg_success_rate
        FROM user_mr_statistics 
        GROUP BY username 
        ORDER BY total_mrs DESC 
        LIMIT 5
      `);

      if (topPerformersResult.rows.length > 0) {
        console.log('\n🏆 Top MR Contributors:');
        topPerformersResult.rows.forEach((row, index) => {
          console.log(`  ${index + 1}. ${row.username}: ${row.total_mrs} MRs (${row.avg_success_rate}% success rate)`);
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
    const service = new MRStatusAnalyticsBackfillService();
    
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
