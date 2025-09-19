#!/usr/bin/env bun
/**
 * Migration script to update existing lead time records to use estimation_start instead of notion_created_at
 *
 * This script:
 * 1. Updates existing bug_fix_lead_times records to use estimation_start as the start time
 * 2. Updates existing feature_completion_lead_times records to use estimation_start as the start time
 * 3. Recalculates lead_time_hours based on the new start time
 * 4. Only updates records where estimation_start is available and different from current start time
 *
 * CLI options:
 *  --dry-run           Preview changes without writing
 *  --verbose           More detailed logging
 *  --force             Update all records even if estimation_start is the same
 */

import { dbService } from '../services/database.js'

interface MigrationOptions {
  dryRun?: boolean
  verbose?: boolean
  force?: boolean
}

class LeadTimeMigrationService {
  async run(options: MigrationOptions = {}): Promise<void> {
    console.log('🚀 Starting Lead Time Migration to Estimation Start...')
    if (options.dryRun) console.log('🔍 DRY RUN MODE - No data will be modified')

    try {
      await dbService.initializeSchema()
      console.log('✓ Database schema verified')

      // Migrate bug fix lead times
      await this.migrateBugFixLeadTimes(options)
      
      // Migrate feature completion lead times
      await this.migrateFeatureCompletionLeadTimes(options)

      console.log('✅ Migration complete')

    } catch (error) {
      console.error('💥 Migration failed:', error)
      throw error
    }
  }

  private async migrateBugFixLeadTimes(options: MigrationOptions): Promise<void> {
    console.log('\n📊 Migrating Bug Fix Lead Times...')

    // Get records that need migration
    const query = `
      SELECT 
        bflt.id,
        bflt.project_id,
        bflt.merge_request_iid,
        bflt.notion_task_id,
        bflt.notion_created_at as current_start_time,
        bflt.merged_at,
        bflt.lead_time_hours as current_lead_time,
        nt.estimation_start,
        nt.title as task_title
      FROM bug_fix_lead_times bflt
      JOIN notion_tasks nt ON bflt.notion_task_id = nt.id
      WHERE nt.estimation_start IS NOT NULL
        ${options.force ? '' : 'AND nt.estimation_start != bflt.notion_created_at'}
      ORDER BY bflt.id
    `

    const result = await dbService.query(query)
    const records = result.rows

    console.log(`Found ${records.length} bug fix lead time records to migrate`)

    if (records.length === 0) {
      console.log('No bug fix records need migration')
      return
    }

    let updated = 0
    let errors = 0

    for (const record of records) {
      try {
        const newLeadTimeHours = (new Date(record.merged_at).getTime() - new Date(record.estimation_start).getTime()) / (1000 * 60 * 60)
        
        if (options.verbose) {
          console.log(`\n🔧 Bug Fix Record ID ${record.id}:`)
          console.log(`  Task: ${record.task_title}`)
          console.log(`  Current start: ${record.current_start_time}`)
          console.log(`  New start (estimation): ${record.estimation_start}`)
          console.log(`  Current lead time: ${record.current_lead_time}h`)
          console.log(`  New lead time: ${newLeadTimeHours.toFixed(2)}h`)
        }

        if (!options.dryRun) {
          await dbService.query(`
            UPDATE bug_fix_lead_times 
            SET 
              notion_created_at = $1,
              lead_time_hours = $2
            WHERE id = $3
          `, [record.estimation_start, Math.round(newLeadTimeHours * 100) / 100, record.id])
        }

        updated++
      } catch (error) {
        errors++
        console.error(`❌ Error updating bug fix record ${record.id}:`, error)
      }
    }

    console.log(`\n📈 Bug Fix Migration Summary:`)
    console.log(`  Records processed: ${records.length}`)
    console.log(`  Successfully updated: ${updated}`)
    console.log(`  Errors: ${errors}`)
  }

  private async migrateFeatureCompletionLeadTimes(options: MigrationOptions): Promise<void> {
    console.log('\n📊 Migrating Feature Completion Lead Times...')

    // Get records that need migration
    const query = `
      SELECT 
        fclt.id,
        fclt.project_id,
        fclt.merge_request_iid,
        fclt.notion_task_id,
        fclt.notion_created_at as current_start_time,
        fclt.merged_at,
        fclt.lead_time_hours as current_lead_time,
        nt.estimation_start,
        nt.title as task_title
      FROM feature_completion_lead_times fclt
      JOIN notion_tasks nt ON fclt.notion_task_id = nt.id
      WHERE nt.estimation_start IS NOT NULL
        ${options.force ? '' : 'AND nt.estimation_start != fclt.notion_created_at'}
      ORDER BY fclt.id
    `

    const result = await dbService.query(query)
    const records = result.rows

    console.log(`Found ${records.length} feature completion lead time records to migrate`)

    if (records.length === 0) {
      console.log('No feature completion records need migration')
      return
    }

    let updated = 0
    let errors = 0

    for (const record of records) {
      try {
        const newLeadTimeHours = (new Date(record.merged_at).getTime() - new Date(record.estimation_start).getTime()) / (1000 * 60 * 60)
        
        if (options.verbose) {
          console.log(`\n🔧 Feature Completion Record ID ${record.id}:`)
          console.log(`  Task: ${record.task_title}`)
          console.log(`  Current start: ${record.current_start_time}`)
          console.log(`  New start (estimation): ${record.estimation_start}`)
          console.log(`  Current lead time: ${record.current_lead_time}h`)
          console.log(`  New lead time: ${newLeadTimeHours.toFixed(2)}h`)
        }

        if (!options.dryRun) {
          await dbService.query(`
            UPDATE feature_completion_lead_times 
            SET 
              notion_created_at = $1,
              lead_time_hours = $2
            WHERE id = $3
          `, [record.estimation_start, Math.round(newLeadTimeHours * 100) / 100, record.id])
        }

        updated++
      } catch (error) {
        errors++
        console.error(`❌ Error updating feature completion record ${record.id}:`, error)
      }
    }

    console.log(`\n📈 Feature Completion Migration Summary:`)
    console.log(`  Records processed: ${records.length}`)
    console.log(`  Successfully updated: ${updated}`)
    console.log(`  Errors: ${errors}`)
  }
}

async function main() {
  const args = process.argv.slice(2)
  const options: MigrationOptions = {}

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--dry-run':
        options.dryRun = true
        break
      case '--verbose':
        options.verbose = true
        break
      case '--force':
        options.force = true
        break
      case '--help':
        console.log(`
Usage: bun run src/scripts/migrate-lead-times-to-estimation-start.ts [options]

Options:
  --dry-run             Show what would be updated without making changes
  --verbose             Show detailed progress information
  --force               Update all records even if estimation_start is the same
  --help                Show this help message

Examples:
  # Preview changes
  bun run src/scripts/migrate-lead-times-to-estimation-start.ts --dry-run --verbose

  # Run migration
  bun run src/scripts/migrate-lead-times-to-estimation-start.ts --verbose

  # Force update all records
  bun run src/scripts/migrate-lead-times-to-estimation-start.ts --force --verbose
        `)
        return
    }
  }

  const service = new LeadTimeMigrationService()
  await service.run(options)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error)
}

export { LeadTimeMigrationService }
