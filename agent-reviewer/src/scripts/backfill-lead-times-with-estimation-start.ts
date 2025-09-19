#!/usr/bin/env node
/**
 * Comprehensive backfill script for Lead Time metrics using estimation_start
 *
 * This script:
 * 1. Clears existing bug_fix_lead_times and feature_completion_lead_times tables
 * 2. Processes all merged MRs with Notion URLs
 * 3. Creates task-MR mappings if missing
 * 4. Inserts lead time records using estimation_start as the start time
 * 5. Falls back to notion_created_at if estimation_start is not available
 *
 * CLI options:
 *  --project-id <id>   Limit to a single project
 *  --date-from <date>  Start date (YYYY-MM-DD) for MR merged_at
 *  --date-to <date>    End date (YYYY-MM-DD) for MR merged_at
 *  --dry-run           Preview actions without writing
 *  --verbose           More detailed logging
 *  --clear-existing    Clear existing lead time data before backfill
 */

import { dbService } from '../services/database.js';
import { taskMRMappingService } from '../services/task-mr-mapping.js';

interface BackfillOptions {
  projectId?: number
  dateFrom?: Date
  dateTo?: Date
  dryRun?: boolean
  verbose?: boolean
  clearExisting?: boolean
}

interface MergeRequestRow {
  project_id: number
  merge_request_iid: number
  merge_request_id: number
  description: string | null
  author_username: string | null
  merged_at: string | null
}

class EstimationStartLeadTimeBackfillService {
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting Lead Time Backfill with Estimation Start...')
    if (options.dryRun) console.log('🔍 DRY RUN MODE - No data will be modified')

    try {
      await dbService.initializeSchema()
      console.log('✓ Database schema verified')

      // Clear existing data if requested
      if (options.clearExisting && !options.dryRun) {
        await this.clearExistingData()
      }

      const mrs = await this.getEligibleMergeRequests(options)
      console.log(`📊 Found ${mrs.length} merged MRs with Notion URLs to process`)
      if (mrs.length === 0) return

      let processed = 0
      let skippedAlreadyRecorded = 0
      let mappingsCreated = 0
      let bugFixLeadTimesInserted = 0
      let featureLeadTimesInserted = 0
      let errors = 0

      // For dry-run URL counting
      let notionUrlCount = 0

      for (const mr of mrs) {
        try {
          if (options.verbose) {
            console.log(`\n🧩 MR !${mr.merge_request_iid} (project ${mr.project_id})`) 
          }

          if (options.dryRun) {
            // Count Notion URLs that would be processed
            const { notionService } = await import('../services/notion.js')
            const urls = mr.description ? notionService.extractNotionUrls(mr.description) : { urls: [], totalFound: 0 }
            notionUrlCount += urls.urls.length
            if (options.verbose) console.log(`  🔍 Would process ${urls.urls.length} Notion URL(s)`) 
          } else {
            // Skip if already has lead time records (unless clearing)
            if (!options.clearExisting) {
              const hasBugFix = await this.hasBugFixLeadTimesForMR(mr.project_id, mr.merge_request_iid)
              const hasFeature = await this.hasFeatureLeadTimesForMR(mr.project_id, mr.merge_request_iid)
              if (hasBugFix && hasFeature) {
                skippedAlreadyRecorded++
                if (options.verbose) console.log('  ↪︎ Skipping: lead time records already exist')
                continue
              }
            }

            // 1) Ensure mappings and task storage exist
            const mappings = await taskMRMappingService.processMergeRequestForTaskMapping(
              mr.project_id,
              mr.merge_request_iid,
              mr.merge_request_id,
              mr.description || '',
            )
            mappingsCreated += mappings.length
            if (options.verbose) console.log(`  ✓ Mappings created: ${mappings.length}`)

            // 2) Insert bug fix lead time rows
            const bugFixBefore = await this.countBugFixLeadTimesForMR(mr.project_id, mr.merge_request_iid)
            await dbService.recordBugFixLeadTimesForMR(mr.project_id, mr.merge_request_iid, mr.merge_request_id)
            const bugFixAfter = await this.countBugFixLeadTimesForMR(mr.project_id, mr.merge_request_iid)
            const bugFixInserted = Math.max(0, bugFixAfter - bugFixBefore)
            bugFixLeadTimesInserted += bugFixInserted
            if (options.verbose) console.log(`  ✓ Bug fix lead time records inserted: ${bugFixInserted}`)

            // 3) Insert feature completion lead time rows
            const featureBefore = await this.countFeatureLeadTimesForMR(mr.project_id, mr.merge_request_iid)
            await dbService.recordFeatureCompletionLeadTimesForMR(mr.project_id, mr.merge_request_iid, mr.merge_request_id)
            const featureAfter = await this.countFeatureLeadTimesForMR(mr.project_id, mr.merge_request_iid)
            const featureInserted = Math.max(0, featureAfter - featureBefore)
            featureLeadTimesInserted += featureInserted
            if (options.verbose) console.log(`  ✓ Feature completion lead time records inserted: ${featureInserted}`)

            // Small delay to be polite to Notion API
            await new Promise(res => setTimeout(res, 100))
          }

          processed++
        } catch (err) {
          errors++
          console.error(`❌ Error on MR !${mr.merge_request_iid}:`, err)
        }
      }

      console.log('\n📈 Backfill Summary:')
      console.log(`  • Processed: ${processed} MRs`)
      console.log(`  • Skipped (already recorded): ${skippedAlreadyRecorded}`)
      if (options.dryRun) {
        console.log(`  • Notion URLs that would be processed: ${notionUrlCount}`)
      } else {
        console.log(`  • Task-MR mappings created: ${mappingsCreated}`)
        console.log(`  • Bug fix lead time records inserted: ${bugFixLeadTimesInserted}`)
        console.log(`  • Feature completion lead time records inserted: ${featureLeadTimesInserted}`)
      }
      console.log(`  • Errors: ${errors}`)
      console.log('✅ Backfill complete')

    } catch (e) {
      console.error('💥 Backfill failed:', e)
      throw e
    }
  }

  private async clearExistingData(): Promise<void> {
    console.log('🗑️  Clearing existing lead time data...')
    
    const bugFixCount = await dbService.query('SELECT COUNT(*) as count FROM bug_fix_lead_times')
    const featureCount = await dbService.query('SELECT COUNT(*) as count FROM feature_completion_lead_times')
    
    console.log(`  Clearing ${bugFixCount.rows[0].count} bug fix lead time records`)
    console.log(`  Clearing ${featureCount.rows[0].count} feature completion lead time records`)
    
    await dbService.query('DELETE FROM bug_fix_lead_times')
    await dbService.query('DELETE FROM feature_completion_lead_times')
    
    console.log('✓ Existing data cleared')
  }

  private async getEligibleMergeRequests(options: BackfillOptions): Promise<MergeRequestRow[]> {
    let query = `
      SELECT 
        project_id,
        merge_request_iid,
        merge_request_id,
        description,
        author_username,
        merged_at
      FROM merge_request_tracking
      WHERE merged_at IS NOT NULL
        AND (description IS NOT NULL AND description != '' AND description ILIKE '%notion%')
    `
    const params: any[] = []
    let idx = 1

    if (options.projectId) {
      query += ` AND project_id = $${idx++}`
      params.push(options.projectId)
    }

    if (options.dateFrom) {
      query += ` AND merged_at >= $${idx++}`
      params.push(options.dateFrom)
    }

    if (options.dateTo) {
      query += ` AND merged_at <= $${idx++}`
      params.push(options.dateTo)
    }

    query += ' ORDER BY merged_at DESC'

    const res = await dbService.query(query, params)
    return res.rows as MergeRequestRow[]
  }

  private async hasBugFixLeadTimesForMR(projectId: number, mrIid: number): Promise<boolean> {
    const res = await dbService.query(
      `SELECT 1 FROM bug_fix_lead_times WHERE project_id = $1 AND merge_request_iid = $2 LIMIT 1`,
      [projectId, mrIid]
    )
    return res!.rowCount! > 0
  }

  private async hasFeatureLeadTimesForMR(projectId: number, mrIid: number): Promise<boolean> {
    const res = await dbService.query(
      `SELECT 1 FROM feature_completion_lead_times WHERE project_id = $1 AND merge_request_iid = $2 LIMIT 1`,
      [projectId, mrIid]
    )
    return res!.rowCount! > 0
  }

  private async countBugFixLeadTimesForMR(projectId: number, mrIid: number): Promise<number> {
    const res = await dbService.query(
      `SELECT COUNT(*)::int AS c FROM bug_fix_lead_times WHERE project_id = $1 AND merge_request_iid = $2`,
      [projectId, mrIid]
    )
    return (res.rows?.[0]?.c as number) || 0
  }

  private async countFeatureLeadTimesForMR(projectId: number, mrIid: number): Promise<number> {
    const res = await dbService.query(
      `SELECT COUNT(*)::int AS c FROM feature_completion_lead_times WHERE project_id = $1 AND merge_request_iid = $2`,
      [projectId, mrIid]
    )
    return (res.rows?.[0]?.c as number) || 0
  }
}

async function main() {
  const args = process.argv.slice(2)
  const options: BackfillOptions = {}

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--project-id':
        options.projectId = parseInt(args[++i])
        break
      case '--date-from':
        options.dateFrom = new Date(args[++i])
        break
      case '--date-to':
        options.dateTo = new Date(args[++i])
        break
      case '--dry-run':
        options.dryRun = true
        break
      case '--verbose':
        options.verbose = true
        break
      case '--clear-existing':
        options.clearExisting = true
        break
      case '--help':
        console.log(`
Usage: npm run backfill-lead-times-with-estimation-start [-- options]

Options:
  --project-id <id>     Process only specific project
  --date-from <date>    Process merged MRs from this date (YYYY-MM-DD)
  --date-to <date>      Process merged MRs until this date (YYYY-MM-DD)
  --dry-run             Show what would be processed without making changes
  --verbose             Show detailed progress information
  --clear-existing      Clear existing lead time data before backfill
  --help                Show this help message

Examples:
  # Preview with clearing existing data
  npm run backfill-lead-times-with-estimation-start -- --dry-run --verbose --clear-existing

  # Full backfill with clearing existing data
  npm run backfill-lead-times-with-estimation-start -- --verbose --clear-existing

  # Backfill specific project
  npm run backfill-lead-times-with-estimation-start -- --project-id 123 --verbose
        `)
        return
    }
  }

  const service = new EstimationStartLeadTimeBackfillService()
  await service.run(options)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { EstimationStartLeadTimeBackfillService }
