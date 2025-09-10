/*
  Backfill MR approvals: populate merge_request_tracking.approved_at for historical MRs.
  - Scans merge_request_tracking rows with missing approved_at (default) or all with --all
  - Fetches approval timestamp from GitLab MR system notes ("approved this merge request")
  - Writes earliest approval timestamp to approved_at (keeps earlier value if already present)

  Usage:
    npm run backfill-mr-approvals
    npm run backfill-mr-approvals -- --all --projectId=123 --limit=500
*/

import { dbService } from '../services/database.js'
import { gitlabService } from '../services/gitlab.js'

interface Row {
  project_id: number
  merge_request_iid: number
  web_url?: string
  created_at: string
  approved_at: string | null
}

function parseArgs() {
  const args = process.argv.slice(2)
  const opts: { all?: boolean; projectId?: number; limit?: number } = {}
  for (const arg of args) {
    if (arg === '--all') opts.all = true
    else if (arg.startsWith('--projectId=')) opts.projectId = Number(arg.split('=')[1])
    else if (arg.startsWith('--limit=')) opts.limit = Number(arg.split('=')[1])
  }
  return opts
}

async function main() {
  await dbService.connect()

  const { all, projectId, limit } = parseArgs()

  let where = all ? 'WHERE 1=1' : 'WHERE approved_at IS NULL'
  const params: any[] = []
  let paramIndex = 1

  if (projectId) {
    where += ` AND project_id = $${paramIndex}`
    params.push(projectId)
    paramIndex++
  }

  const limitClause = limit && limit > 0 ? `LIMIT ${limit}` : ''

  const query = `
    SELECT project_id, merge_request_iid, web_url, created_at, approved_at
    FROM merge_request_tracking
    ${where}
    ORDER BY created_at ASC
    ${limitClause}
  `

  const res = await dbService.query(query, params)
  const rows: Row[] = res.rows

  console.log(`Found ${rows.length} MRs to backfill approvals for`)

  const concurrency = 5
  let index = 0
  let updated = 0

  async function worker() {
    while (index < rows.length) {
      const current = rows[index++]
      try {
        const { project_id, merge_request_iid } = current
        const approvalAt = await gitlabService.getMergeRequestApprovalAt(project_id, merge_request_iid)
        if (approvalAt) {
          await dbService.setMRApprovedAt(project_id, merge_request_iid, approvalAt)
          updated++
          console.log(`✓ Set approved_at for ${project_id}!${merge_request_iid} -> ${approvalAt.toISOString()}`)
        } else {
          console.log(`- No approval note found for ${project_id}!${merge_request_iid}`)
        }
      } catch (err) {
        console.error(`Error processing MR !${rows[index-1]?.merge_request_iid}:`, err)
      }
    }
  }

  const workers = Array.from({ length: concurrency }).map(() => worker())
  await Promise.all(workers)

  console.log(`Backfill complete. Updated ${updated}/${rows.length} records.`)
  process.exit(0)
}

main().catch(err => {
  console.error('Backfill MR approvals failed:', err)
  process.exit(1)
})

