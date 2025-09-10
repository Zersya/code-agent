/*
  Backfill Notion timing fields for existing tasks.
  - Hydrates: estimation_start, estimation_end, developer_start, developer_end, completed_at, ready_to_test_at
  - By default processes only tasks missing any of these fields.
  - Use --all to process all tasks.

  Usage examples:
    npm run backfill-notion-timing-fields
    npm run backfill-notion-timing-fields -- --all
*/

import { dbService } from '../services/database.js'
import { notionService } from '../services/notion.js'

interface Row {
  id: number
  notion_page_id: string
  project_id: number | null
  estimation_start: string | null
  estimation_end: string | null
  developer_start: string | null
  developer_end: string | null
  completed_at: string | null
  ready_to_test_at: string | null
}

async function main() {
  const args = process.argv.slice(2)
  const processAll = args.includes('--all')

  console.log(`[backfill] starting backfill-notion-timing-fields (all=${processAll})`)

  const whereClause = processAll
    ? ''
    : `WHERE estimation_start IS NULL OR estimation_end IS NULL OR developer_start IS NULL OR developer_end IS NULL OR completed_at IS NULL OR ready_to_test_at IS NULL`

  const query = `
    SELECT id, notion_page_id, project_id, estimation_start, estimation_end, developer_start, developer_end, completed_at, ready_to_test_at
    FROM notion_tasks
    ${whereClause}
    ORDER BY id ASC
  `

  const res = await dbService.query(query)
  const rows: Row[] = res.rows
  console.log(`[backfill] found ${rows.length} tasks to process`)

  let success = 0
  let failed = 0

  // Simple concurrency control
  const concurrency = 5
  let index = 0

  async function worker(workerId: number) {
    while (index < rows.length) {
      const current = rows[index++]
      try {
        // Fetch fresh Notion page content
        const pageContent = await notionService.fetchPageContent(current.notion_page_id)
        // Store task to upsert timing fields
        const url = `https://www.notion.so/${current.notion_page_id.replace(/-/g, '')}`
        await notionService.storeTaskFromPageContent(pageContent, url, current.project_id ?? undefined)
        success++
        if (success % 25 === 0) console.log(`[backfill] processed ${success}/${rows.length}`)
      } catch (err) {
        failed++
        console.error(`[backfill] failed for task id=${current.id}, page=${current.notion_page_id}:`, err)
      }
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, Math.max(rows.length, 1)) }, (_, i) => worker(i))
  await Promise.all(workers)

  console.log(`[backfill] done. success=${success}, failed=${failed}`)
}

main().catch((e) => {
  console.error('[backfill] fatal error:', e)
  process.exit(1)
})

