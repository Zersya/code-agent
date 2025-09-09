#!/usr/bin/env bun
/**
 * Backfill script for completion rate data
 * This script processes existing merge requests to create task-MR mappings
 * and calculates historical completion rates
 */

import { dbService } from '../services/database.js';
import { taskMRMappingService } from '../services/task-mr-mapping.js';
import { completionRateService } from '../services/completion-rate.js';

interface BackfillOptions {
  projectId?: number;
  dateFrom?: Date;
  dateTo?: Date;
  dryRun?: boolean;
  verbose?: boolean;
}

class CompletionRateBackfillService {
  
  async backfillTaskMappings(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting completion rate backfill process...');
    
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be modified');
    }
    
    try {
      // Initialize database schema
      await dbService.initializeSchema();
      console.log('✓ Database schema verified');

      // Get existing merge requests with descriptions
      const mergeRequests = await this.getExistingMergeRequests(options);
      console.log(`📊 Found ${mergeRequests.length} merge requests to process`);

      if (mergeRequests.length === 0) {
        console.log('ℹ️  No merge requests found to process');
        return;
      }

      let processedCount = 0;
      let mappingsCreated = 0;
      let errorsCount = 0;

      // Process each merge request
      for (const mr of mergeRequests) {
        try {
          if (options.verbose) {
            console.log(`Processing MR !${mr.merge_request_iid} in project ${mr.project_id}`);
          }

          if (!options.dryRun) {
            const mappings = await taskMRMappingService.processMergeRequestForTaskMapping(
              mr.project_id,
              mr.merge_request_iid,
              mr.merge_request_id,
              mr.description,
              mr.author_username
            );

            mappingsCreated += mappings.length;
            
            if (mappings.length > 0 && options.verbose) {
              console.log(`  ✓ Created ${mappings.length} task mappings`);
            }
          } else {
            // In dry run, just check for Notion URLs
            const { notionService } = await import('../services/notion.js');
            const urlResult = notionService.extractNotionUrls(mr.description);
            if (urlResult.urls.length > 0) {
              console.log(`  🔍 Would process ${urlResult.urls.length} Notion URLs in MR !${mr.merge_request_iid}`);
              mappingsCreated += urlResult.urls.length;
            }
          }

          processedCount++;

          // Add small delay to avoid overwhelming APIs
          if (!options.dryRun) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }

        } catch (error) {
          errorsCount++;
          console.error(`❌ Error processing MR !${mr.merge_request_iid}:`, error);
        }
      }

      console.log('\n📈 Backfill Summary:');
      console.log(`  • Processed: ${processedCount} merge requests`);
      console.log(`  • Task mappings ${options.dryRun ? 'would be created' : 'created'}: ${mappingsCreated}`);
      console.log(`  • Errors: ${errorsCount}`);

      if (!options.dryRun && mappingsCreated > 0) {
        console.log('\n🔄 Calculating completion rates...');
        await this.calculateHistoricalRates(options);
      }

    } catch (error) {
      console.error('💥 Backfill process failed:', error);
      throw error;
    }
  }

  private async getExistingMergeRequests(options: BackfillOptions): Promise<any[]> {
    let query = `
      SELECT 
        project_id, 
        merge_request_iid, 
        merge_request_id, 
        description, 
        author_username,
        created_at
      FROM merge_request_tracking
      WHERE description IS NOT NULL 
        AND description != ''
        AND description ILIKE '%notion%'
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
    return result.rows;
  }

  private async calculateHistoricalRates(options: BackfillOptions): Promise<void> {
    try {
      // Get unique developers and time periods from the data
      const query = `
        SELECT DISTINCT 
          nt.assignee_username,
          EXTRACT(MONTH FROM nt.created_at) as month,
          EXTRACT(YEAR FROM nt.created_at) as year,
          nt.project_id
        FROM notion_tasks nt
        WHERE nt.assignee_username IS NOT NULL
        ORDER BY year DESC, month DESC
      `;

      const result = await dbService.query(query);
      const periods = result.rows;

      console.log(`📊 Calculating rates for ${periods.length} developer-month combinations`);

      let calculatedCount = 0;

      for (const period of periods) {
        try {
          if (options.verbose) {
            console.log(`Calculating rate for ${period.assignee_username} - ${period.year}-${period.month}`);
          }

          await completionRateService.calculateCompletionRate(
            period.assignee_username,
            parseInt(period.month),
            parseInt(period.year),
            period.project_id
          );

          calculatedCount++;

        } catch (error) {
          console.error(`Error calculating rate for ${period.assignee_username}:`, error);
        }
      }

      console.log(`✓ Calculated completion rates for ${calculatedCount} periods`);

    } catch (error) {
      console.error('Error calculating historical rates:', error);
    }
  }

  async validateBackfill(): Promise<void> {
    console.log('🔍 Validating backfill results...');

    try {
      // Check task mappings
      const mappingsResult = await dbService.query('SELECT COUNT(*) as count FROM task_mr_mappings');
      const mappingsCount = parseInt(mappingsResult.rows[0].count);
      console.log(`✓ Task mappings: ${mappingsCount}`);

      // Check notion tasks
      const tasksResult = await dbService.query('SELECT COUNT(*) as count FROM notion_tasks');
      const tasksCount = parseInt(tasksResult.rows[0].count);
      console.log(`✓ Notion tasks: ${tasksCount}`);

      // Check completion rates
      const ratesResult = await dbService.query('SELECT COUNT(*) as count FROM feature_completion_rates');
      const ratesCount = parseInt(ratesResult.rows[0].count);
      console.log(`✓ Completion rates: ${ratesCount}`);

      // Check for recent data
      const recentResult = await dbService.query(`
        SELECT COUNT(*) as count 
        FROM feature_completion_rates 
        WHERE calculated_at > NOW() - INTERVAL '1 hour'
      `);
      const recentCount = parseInt(recentResult.rows[0].count);
      console.log(`✓ Recent calculations: ${recentCount}`);

      console.log('✅ Validation complete');

    } catch (error) {
      console.error('❌ Validation failed:', error);
    }
  }
}

// CLI interface
async function main() {
  const args = process.argv.slice(2);
  const options: BackfillOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project-id':
        options.projectId = parseInt(args[++i]);
        break;
      case '--date-from':
        options.dateFrom = new Date(args[++i]);
        break;
      case '--date-to':
        options.dateTo = new Date(args[++i]);
        break;
      case '--dry-run':
        options.dryRun = true;
        break;
      case '--verbose':
        options.verbose = true;
        break;
      case '--validate':
        const service = new CompletionRateBackfillService();
        await service.validateBackfill();
        return;
      case '--help':
        console.log(`
Usage: bun run src/scripts/backfill-completion-rates.ts [options]

Options:
  --project-id <id>     Process only specific project
  --date-from <date>    Process MRs from this date (YYYY-MM-DD)
  --date-to <date>      Process MRs until this date (YYYY-MM-DD)
  --dry-run            Show what would be processed without making changes
  --verbose            Show detailed progress information
  --validate           Validate existing backfill data
  --help               Show this help message

Examples:
  bun run src/scripts/backfill-completion-rates.ts --dry-run --verbose
  bun run src/scripts/backfill-completion-rates.ts --project-id 123
  bun run src/scripts/backfill-completion-rates.ts --date-from 2024-01-01 --date-to 2024-12-31
        `);
        return;
    }
  }

  const service = new CompletionRateBackfillService();
  await service.backfillTaskMappings(options);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}

export { CompletionRateBackfillService };
