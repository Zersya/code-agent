#!/usr/bin/env bun
/**
 * Backfill script for MR Quality Metrics
 * 
 * This script processes historical merge requests to calculate and populate
 * quality metrics including quality scores, review cycles, critical issues counts,
 * time to first review, and time to merge.
 * 
 * CLI options:
 *  --project-id <id>   Limit to a single project
 *  --date-from <date>  Start date (YYYY-MM-DD) for MR created_at
 *  --date-to <date>    End date (YYYY-MM-DD) for MR created_at
 *  --dry-run           Preview actions without writing
 *  --verbose           More detailed logging
 *  --force             Recalculate all metrics even if they exist
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

interface MRQualityData {
  project_id: number;
  merge_request_iid: number;
  username: string;
  quality_score: number;
  review_cycles: number;
  critical_issues_count: number;
  fixes_implemented_count: number;
  time_to_first_review_hours: number | null;
  time_to_merge_hours: number | null;
}

interface MRData {
  project_id: number;
  merge_request_iid: number;
  merge_request_id: number;
  author_username: string;
  created_at: Date;
  merged_at: Date | null;
  status: string;
}

class MRQualityMetricsBackfillService {
  
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting MR Quality Metrics backfill process...');
    
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be modified');
    }

    try {
      await dbService.initializeSchema();
      console.log('✓ Database schema verified');

      // Calculate quality metrics for historical MRs
      await this.calculateQualityMetrics(options);

      console.log('✅ MR Quality Metrics backfill complete');

    } catch (error) {
      console.error('💥 Backfill failed:', error);
      throw error;
    }
  }

  private async calculateQualityMetrics(options: BackfillOptions): Promise<void> {
    console.log('\n📊 Calculating MR quality metrics...');

    // Get all MRs to process
    const mrList = await this.getMRsToProcess(options);
    console.log(`Found ${mrList.length} MRs to process`);

    let processed = 0;
    let updated = 0;
    let errors = 0;

    for (const mr of mrList) {
      try {
        if (options.verbose) {
          console.log(`Processing MR ${mr.project_id}!${mr.merge_request_iid} by ${mr.author_username}`);
        }

        // Calculate quality metrics for this MR
        const qualityData = await this.calculateMRQuality(mr, options);
        
        if (qualityData) {
          // Check if record exists
          const existingRecord = await this.getExistingQualityMetrics(mr.project_id, mr.merge_request_iid);
          
          if (existingRecord && !options.force) {
            if (options.verbose) {
              console.log(`  ⏭️  Skipping existing record (use --force to recalculate)`);
            }
          } else {
            // Insert or update the metrics
            if (!options.dryRun) {
              await this.upsertQualityMetrics(qualityData);
            }
            updated++;
            
            if (options.verbose) {
              console.log(`  ✓ ${existingRecord ? 'Updated' : 'Created'} quality metrics: score ${qualityData.quality_score}, ${qualityData.review_cycles} cycles, ${qualityData.critical_issues_count} issues`);
            }
          }
        }

        processed++;

      } catch (error) {
        errors++;
        console.error(`❌ Error processing MR ${mr.project_id}!${mr.merge_request_iid}:`, error);
      }
    }

    console.log(`\n📈 Quality Metrics Summary:`);
    console.log(`  MRs processed: ${processed}`);
    console.log(`  Records updated/created: ${updated}`);
    console.log(`  Errors: ${errors}`);
  }

  private async getMRsToProcess(options: BackfillOptions): Promise<MRData[]> {
    let query = `
      SELECT 
        project_id,
        merge_request_iid,
        merge_request_id,
        author_username,
        created_at,
        merged_at,
        status
      FROM merge_request_tracking
      WHERE author_username IS NOT NULL
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

    query += ` ORDER BY created_at DESC`;

    const result = await dbService.query(query, params);
    return result.rows.map(row => ({
      project_id: row.project_id,
      merge_request_iid: row.merge_request_iid,
      merge_request_id: row.merge_request_id,
      author_username: row.author_username,
      created_at: new Date(row.created_at),
      merged_at: row.merged_at ? new Date(row.merged_at) : null,
      status: row.status
    }));
  }

  private async calculateMRQuality(mr: MRData, options: BackfillOptions): Promise<MRQualityData | null> {
    try {
      // Get review data for this MR
      const reviewData = await this.getMRReviewData(mr.project_id, mr.merge_request_iid);
      
      // Calculate timing metrics
      const timeToFirstReview = await this.calculateTimeToFirstReview(mr);
      const timeToMerge = this.calculateTimeToMerge(mr);
      
      // Calculate review cycles (number of review iterations)
      const reviewCycles = Math.max(1, reviewData.total_reviews);
      
      // Get critical issues and fixes from reviews
      const criticalIssuesCount = reviewData.total_critical_issues || 0;
      const fixesImplementedCount = reviewData.total_fixes_implemented || 0;
      
      // Calculate quality score (0-100 scale)
      const qualityScore = this.calculateQualityScore({
        reviewCycles,
        criticalIssuesCount,
        fixesImplementedCount,
        timeToFirstReview,
        timeToMerge,
        status: mr.status
      });

      return {
        project_id: mr.project_id,
        merge_request_iid: mr.merge_request_iid,
        username: mr.author_username,
        quality_score: Math.round(qualityScore * 100) / 100,
        review_cycles: reviewCycles,
        critical_issues_count: criticalIssuesCount,
        fixes_implemented_count: fixesImplementedCount,
        time_to_first_review_hours: timeToFirstReview,
        time_to_merge_hours: timeToMerge
      };

    } catch (error) {
      console.error(`Error calculating quality for MR ${mr.project_id}!${mr.merge_request_iid}:`, error);
      return null;
    }
  }

  private async getMRReviewData(projectId: number, mergeRequestIid: number): Promise<any> {
    // Check if merge_request_reviews table exists
    const tableExistsResult = await dbService.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'merge_request_reviews'
      )
    `);
    
    if (!tableExistsResult.rows[0].exists) {
      return {
        total_reviews: 0,
        total_critical_issues: 0,
        total_fixes_implemented: 0,
        first_review_at: null
      };
    }

    const result = await dbService.query(`
      SELECT 
        COUNT(*) as total_reviews,
        SUM(critical_issues_count) as total_critical_issues,
        SUM(fixes_implemented_count) as total_fixes_implemented,
        MIN(reviewed_at) as first_review_at
      FROM merge_request_reviews
      WHERE project_id = $1 AND merge_request_iid = $2
    `, [projectId, mergeRequestIid]);

    return result.rows[0] || {
      total_reviews: 0,
      total_critical_issues: 0,
      total_fixes_implemented: 0,
      first_review_at: null
    };
  }

  private async calculateTimeToFirstReview(mr: MRData): Promise<number | null> {
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
    `, [mr.project_id, mr.merge_request_iid]);

    const firstReviewAt = result.rows[0]?.first_review_at;
    if (!firstReviewAt) {
      return null;
    }

    const diffMs = new Date(firstReviewAt).getTime() - mr.created_at.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Hours with 2 decimal places
  }

  private calculateTimeToMerge(mr: MRData): number | null {
    if (!mr.merged_at || mr.status !== 'merged') {
      return null;
    }

    const diffMs = mr.merged_at.getTime() - mr.created_at.getTime();
    return Math.round((diffMs / (1000 * 60 * 60)) * 100) / 100; // Hours with 2 decimal places
  }

  private calculateQualityScore(metrics: {
    reviewCycles: number;
    criticalIssuesCount: number;
    fixesImplementedCount: number;
    timeToFirstReview: number | null;
    timeToMerge: number | null;
    status: string;
  }): number {
    let score = 100; // Start with perfect score

    // Penalize for excessive review cycles (each cycle beyond 1 reduces score)
    if (metrics.reviewCycles > 1) {
      score -= Math.min(30, (metrics.reviewCycles - 1) * 10);
    }

    // Penalize for critical issues (each issue reduces score)
    score -= Math.min(40, metrics.criticalIssuesCount * 8);

    // Reward for implementing fixes (partial recovery)
    if (metrics.criticalIssuesCount > 0 && metrics.fixesImplementedCount > 0) {
      const fixRatio = Math.min(1, metrics.fixesImplementedCount / metrics.criticalIssuesCount);
      score += fixRatio * 15; // Recover up to 15 points for fixing issues
    }

    // Penalize for slow first review (if data available)
    if (metrics.timeToFirstReview !== null) {
      if (metrics.timeToFirstReview > 48) { // More than 2 days
        score -= 10;
      } else if (metrics.timeToFirstReview > 24) { // More than 1 day
        score -= 5;
      }
    }

    // Penalize for slow merge time (if data available)
    if (metrics.timeToMerge !== null) {
      if (metrics.timeToMerge > 168) { // More than 1 week
        score -= 15;
      } else if (metrics.timeToMerge > 72) { // More than 3 days
        score -= 8;
      }
    }

    // Bonus for merged MRs
    if (metrics.status === 'merged') {
      score += 5;
    }

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  private async getExistingQualityMetrics(projectId: number, mergeRequestIid: number): Promise<any> {
    const result = await dbService.query(
      'SELECT id FROM mr_quality_metrics WHERE project_id = $1 AND merge_request_iid = $2',
      [projectId, mergeRequestIid]
    );
    return result.rows[0] || null;
  }

  private async upsertQualityMetrics(data: MRQualityData): Promise<void> {
    await dbService.query(`
      INSERT INTO mr_quality_metrics (
        project_id, merge_request_iid, username, quality_score, review_cycles,
        critical_issues_count, fixes_implemented_count, time_to_first_review_hours,
        time_to_merge_hours, calculated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
      ON CONFLICT (project_id, merge_request_iid)
      DO UPDATE SET
        username = EXCLUDED.username,
        quality_score = EXCLUDED.quality_score,
        review_cycles = EXCLUDED.review_cycles,
        critical_issues_count = EXCLUDED.critical_issues_count,
        fixes_implemented_count = EXCLUDED.fixes_implemented_count,
        time_to_first_review_hours = EXCLUDED.time_to_first_review_hours,
        time_to_merge_hours = EXCLUDED.time_to_merge_hours,
        calculated_at = NOW()
    `, [
      data.project_id,
      data.merge_request_iid,
      data.username,
      data.quality_score,
      data.review_cycles,
      data.critical_issues_count,
      data.fixes_implemented_count,
      data.time_to_first_review_hours,
      data.time_to_merge_hours
    ]);
  }

  async showSummary(): Promise<void> {
    try {
      // Show quality metrics summary
      const metricsResult = await dbService.query('SELECT COUNT(*) as count FROM mr_quality_metrics');
      const metricsCount = parseInt(metricsResult.rows[0].count);
      console.log(`✓ MR quality metrics records: ${metricsCount}`);

      // Show quality score distribution
      const distributionResult = await dbService.query(`
        SELECT 
          CASE 
            WHEN quality_score >= 90 THEN 'Excellent (90-100)'
            WHEN quality_score >= 80 THEN 'Good (80-89)'
            WHEN quality_score >= 70 THEN 'Fair (70-79)'
            WHEN quality_score >= 60 THEN 'Poor (60-69)'
            ELSE 'Very Poor (<60)'
          END as quality_range,
          COUNT(*) as count,
          ROUND(AVG(quality_score), 1) as avg_score
        FROM mr_quality_metrics 
        GROUP BY 
          CASE 
            WHEN quality_score >= 90 THEN 'Excellent (90-100)'
            WHEN quality_score >= 80 THEN 'Good (80-89)'
            WHEN quality_score >= 70 THEN 'Fair (70-79)'
            WHEN quality_score >= 60 THEN 'Poor (60-69)'
            ELSE 'Very Poor (<60)'
          END
        ORDER BY avg_score DESC
      `);

      if (distributionResult.rows.length > 0) {
        console.log('\n📊 Quality Score Distribution:');
        distributionResult.rows.forEach(row => {
          console.log(`  ${row.quality_range}: ${row.count} MRs (avg: ${row.avg_score})`);
        });
      }

      // Show top performers by quality
      const topPerformersResult = await dbService.query(`
        SELECT username, COUNT(*) as total_mrs, 
               ROUND(AVG(quality_score), 1) as avg_quality_score,
               ROUND(AVG(review_cycles), 1) as avg_review_cycles
        FROM mr_quality_metrics 
        GROUP BY username 
        HAVING COUNT(*) >= 3
        ORDER BY avg_quality_score DESC 
        LIMIT 5
      `);

      if (topPerformersResult.rows.length > 0) {
        console.log('\n🏆 Top Performers by Quality Score:');
        topPerformersResult.rows.forEach((row, index) => {
          console.log(`  ${index + 1}. ${row.username}: ${row.avg_quality_score} avg score (${row.total_mrs} MRs, ${row.avg_review_cycles} avg cycles)`);
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
    const service = new MRQualityMetricsBackfillService();
    
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
