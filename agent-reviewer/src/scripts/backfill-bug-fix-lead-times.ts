#!/usr/bin/env bun
/**
 * Backfill script for Bug Fix Lead Time metrics
 *
 * This script processes historical merge requests that contain Notion URLs in their descriptions,
 * ensures Notion tasks are extracted and stored (including task_type and notion_created_at),
 * creates task-MR mappings if missing, and inserts bug fix lead time records for tasks of type
 * "issue" or "bug" measured from Notion task creation to MR merged time.
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

class BugFixLeadTimeBackfillService {
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting Bug Fix Lead Time backfill...')
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
          if (options.verbose) {
            console.log(`\n🧩 MR !${mr.merge_request_iid} (project ${mr.project_id})`) 
          }

          // Skip if bug_fix_lead_times already has records for this MR
          const alreadyHasLeadTimes = await this.hasLeadTimesForMR(mr.project_id, mr.merge_request_iid)
          if (alreadyHasLeadTimes) {
            skippedAlreadyRecorded++
            if (options.verbose) console.log('  ↪︎ Skipping: lead time records already exist')
            continue
          }

          if (options.dryRun) {
            // Count Notion URLs that would be processed
            const { notionService } = await import('../services/notion.js')
            const urls = mr.description ? notionService.extractNotionUrls(mr.description) : { urls: [], totalFound: 0 }
            notionUrlCount += urls.urls.length
            if (options.verbose) console.log(`  🔍 Would process ${urls.urls.length} Notion URL(s)`) 
          } else {
            // 1) Ensure mappings and task storage exist
            const mappings = await taskMRMappingService.processMergeRequestForTaskMapping(
              mr.project_id,
              mr.merge_request_iid,
              mr.merge_request_id,
              mr.description || '',
            )
            mappingsCreated += mappings.length
            if (options.verbose) console.log(`  ✓ Mappings created: ${mappings.length}`)

            // 2) Insert bug fix lead time rows (only for issue/bug types inside dbService)
            const before = await this.countLeadTimesForMR(mr.project_id, mr.merge_request_iid)
            await dbService.recordBugFixLeadTimesForMR(mr.project_id, mr.merge_request_iid, mr.merge_request_id)
            const after = await this.countLeadTimesForMR(mr.project_id, mr.merge_request_iid)
            const inserted = Math.max(0, after - before)
            leadTimesInserted += inserted
            if (options.verbose) console.log(`  ✓ Lead time records inserted: ${inserted}`)

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
        console.log(`  • Lead time records inserted: ${leadTimesInserted}`)
      }
      console.log(`  • Errors: ${errors}`)
      console.log('✅ Backfill complete')

    } catch (e) {
      console.error('💥 Backfill failed:', e)
      throw e
    }
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

  private async hasLeadTimesForMR(projectId: number, mrIid: number): Promise<boolean> {
    const res = await dbService.query(
      `SELECT 1 FROM bug_fix_lead_times WHERE project_id = $1 AND merge_request_iid = $2 LIMIT 1`,
      [projectId, mrIid]
    )
    return res!.rowCount! > 0
  }

  private async countLeadTimesForMR(projectId: number, mrIid: number): Promise<number> {
    const res = await dbService.query(
      `SELECT COUNT(*)::int AS c FROM bug_fix_lead_times WHERE project_id = $1 AND merge_request_iid = $2`,
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
      case '--help':
        console.log(`
Usage: bun run src/scripts/backfill-bug-fix-lead-times.ts [options]

Options:
  --project-id <id>     Process only specific project
  --date-from <date>    Process merged MRs from this date (YYYY-MM-DD)
  --date-to <date>      Process merged MRs until this date (YYYY-MM-DD)
  --dry-run             Show what would be processed without making changes
  --verbose             Show detailed progress information
  --help                Show this help message

Examples:
  bun run src/scripts/backfill-bug-fix-lead-times.ts --dry-run --verbose
  bun run src/scripts/backfill-bug-fix-lead-times.ts --project-id 123
  bun run src/scripts/backfill-bug-fix-lead-times.ts --date-from 2024-01-01 --date-to 2024-12-31
        `)
        return
    }
  }

  const service = new BugFixLeadTimeBackfillService()
  await service.run(options)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { BugFixLeadTimeBackfillService }

