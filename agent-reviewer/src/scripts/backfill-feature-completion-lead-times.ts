#!/usr/bin/env bun
/**
 * Backfill script for Feature Completion Lead Time metrics
 *
 * This script processes historical merge requests that contain Notion URLs in their descriptions,
 * ensures Notion tasks are extracted and stored (including task_type and notion_created_at),
 * creates task-MR mappings if missing, and inserts feature completion lead time records for tasks of type
 * "feature", "enhancement", or "story" measured from Notion task creation to MR merged time.
 *
 * CLI options (similar to backfill-completion-rates.ts):
 *  --project-id <id>   Limit to a single project
 *  --date-from <date>  Start date (YYYY-MM-DD) for MR merged_at
 *  --date-to <date>    End date (YYYY-MM-DD) for MR merged_at
 *  --dry-run           Preview actions without writing
 *  --verbose           More detailed logging
 */

import { dbService } from '../services/database.js'
import { taskMRMappingService } from '../services/task-mr-mapping.js'

interface BackfillOptions {
  projectId?: number
  dateFrom?: Date
  dateTo?: Date
  dryRun?: boolean
  verbose?: boolean
}

interface MergeRequestRow {
  project_id: number
  merge_request_iid: number
  merge_request_id: number
  description: string | null
  author_username: string | null
  merged_at: string | null
}

class FeatureCompletionLeadTimeBackfillService {
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting Feature Completion Lead Time backfill...')
    if (options.dryRun) console.log('🔍 DRY RUN MODE - No data will be modified')

    try {
      await dbService.initializeSchema()
      console.log('✓ Database schema verified')

      const mrs = await this.getEligibleMergeRequests(options)
      console.log(`📊 Found ${mrs.length} merged MRs with Notion URLs to process`)
      if (mrs.length === 0) return

      let processed = 0
      let skippedAlreadyRecorded = 0
      let mappingsCreated = 0
      let leadTimesInserted = 0
      let errors = 0

      // For dry-run URL counting
      let notionUrlCount = 0

      for (const mr of mrs) {
        try {
          processed++
          if (options.verbose) console.log(`\n[${processed}/${mrs.length}] Processing MR !${mr.merge_request_iid} (Project ${mr.project_id})`)

          // Skip if already has lead time records
          if (!options.dryRun && await this.hasLeadTimesForMR(mr.project_id, mr.merge_request_iid)) {
            skippedAlreadyRecorded++
            if (options.verbose) console.log(`  ⏭️  Already has feature completion lead time records`)
            continue
          }

          if (options.dryRun) {
            // Count Notion URLs for dry run
            const { notionService } = await import('../services/notion.js')
            const urlResult = notionService.extractNotionUrls(mr.description || '')
            notionUrlCount += urlResult.urls.length
            if (options.verbose && urlResult.urls.length > 0) {
              console.log(`  🔗 Found ${urlResult.urls.length} Notion URLs`)
            }
            continue
          }

          // 1) Process task-MR mappings (extracts Notion tasks, creates mappings)
          const mappings = await taskMRMappingService.processMergeRequestForTaskMapping(
            mr.project_id,
            mr.merge_request_iid,
            mr.merge_request_id,
            mr.description || '',
            mr.author_username || 'unknown'
          )
          mappingsCreated += mappings.length
          if (options.verbose) console.log(`  ✓ Mappings created: ${mappings.length}`)

          // 2) Insert feature completion lead time rows (only for feature/enhancement/story types inside dbService)
          const before = await this.countLeadTimesForMR(mr.project_id, mr.merge_request_iid)
          await dbService.recordFeatureCompletionLeadTimesForMR(mr.project_id, mr.merge_request_iid, mr.merge_request_id)
          const after = await this.countLeadTimesForMR(mr.project_id, mr.merge_request_iid)
          const inserted = Math.max(0, after - before)
          leadTimesInserted += inserted
          if (options.verbose) console.log(`  ✓ Lead time records inserted: ${inserted}`)

          // Small delay to be polite to Notion API
          await new Promise(res => setTimeout(res, 100))

        } catch (error) {
          errors++
          console.error(`❌ Error processing MR !${mr.merge_request_iid}:`, error)
        }
      }

      // Summary
      console.log('\n📈 Feature Completion Lead Time Backfill Summary:')
      console.log(`   Processed: ${processed} MRs`)
      if (options.dryRun) {
        console.log(`   Notion URLs found: ${notionUrlCount}`)
        console.log(`   (Run without --dry-run to process)`)
      } else {
        console.log(`   Skipped (already recorded): ${skippedAlreadyRecorded}`)
        console.log(`   Task-MR mappings created: ${mappingsCreated}`)
        console.log(`   Feature completion lead time records inserted: ${leadTimesInserted}`)
        console.log(`   Errors: ${errors}`)
      }

    } catch (error) {
      console.error('💥 Backfill failed:', error)
      process.exit(1)
    }
  }

  private async getEligibleMergeRequests(options: BackfillOptions): Promise<MergeRequestRow[]> {
    let query = `
      SELECT project_id, merge_request_iid, merge_request_id, description, author_username, merged_at
      FROM merge_request_tracking
      WHERE state = 'merged'
        AND merged_at IS NOT NULL
        AND (description LIKE '%notion.so%' OR description LIKE '%notion.site%')
    `

    const params: any[] = []

    if (options.projectId) {
      query += ` AND project_id = $${params.length + 1}`
      params.push(options.projectId)
    }

    if (options.dateFrom) {
      query += ` AND merged_at >= $${params.length + 1}`
      params.push(options.dateFrom.toISOString())
    }

    if (options.dateTo) {
      query += ` AND merged_at <= $${params.length + 1}`
      params.push(options.dateTo.toISOString())
    }

    query += ' ORDER BY merged_at DESC'

    const res = await dbService.query(query, params)
    return res.rows as MergeRequestRow[]
  }

  private async hasLeadTimesForMR(projectId: number, mrIid: number): Promise<boolean> {
    const res = await dbService.query(
      `SELECT 1 FROM feature_completion_lead_times WHERE project_id = $1 AND merge_request_iid = $2 LIMIT 1`,
      [projectId, mrIid]
    )
    return res!.rowCount! > 0
  }

  private async countLeadTimesForMR(projectId: number, mrIid: number): Promise<number> {
    const res = await dbService.query(
      `SELECT COUNT(*)::int AS c FROM feature_completion_lead_times WHERE project_id = $1 AND merge_request_iid = $2`,
      [projectId, mrIid]
    )
    return (res.rows?.[0]?.c as number) || 0
  }
}

// CLI parsing
function parseArgs(): BackfillOptions {
  const args = process.argv.slice(2)
  const options: BackfillOptions = {}

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
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
      case '--help':
        console.log(`
Feature Completion Lead Time Backfill Script

Usage: bun run src/scripts/backfill-feature-completion-lead-times.ts [options]

Options:
  --project-id <id>   Limit to a single project
  --date-from <date>  Start date (YYYY-MM-DD) for MR merged_at
  --date-to <date>    End date (YYYY-MM-DD) for MR merged_at
  --dry-run           Preview actions without writing
  --verbose           More detailed logging
  --help              Show this help message

Examples:
  # Dry run preview
  bun run src/scripts/backfill-feature-completion-lead-times.ts --dry-run --verbose

  # Limit to a project
  bun run src/scripts/backfill-feature-completion-lead-times.ts --project-id 123

  # Limit by merge window
  bun run src/scripts/backfill-feature-completion-lead-times.ts --date-from 2024-01-01 --date-to 2024-12-31

  # Full run
  bun run src/scripts/backfill-feature-completion-lead-times.ts --verbose
        `)
        process.exit(0)
        break
    }
  }

  return options
}

// Main execution
if (import.meta.main) {
  const options = parseArgs()
  const service = new FeatureCompletionLeadTimeBackfillService()
  await service.run(options)
}
