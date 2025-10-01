#!/usr/bin/env bun
/**
 * Backfill script for Notion Task Points
 * 
 * This script processes existing Notion tasks to extract and populate the points field
 * from Notion page properties. It fetches the latest data from Notion API and updates
 * the database with story points/estimates.
 * 
 * CLI options:
 *  --project-id <id>   Limit to a single project
 *  --dry-run           Preview actions without writing
 *  --verbose           More detailed logging
 *  --force             Re-fetch all tasks even if they have points
 *  --all               Process all tasks (default: only tasks without points)
 */

import { dbService } from '../services/database.js';
import { notionService } from '../services/notion.js';

interface BackfillOptions {
  projectId?: number;
  dryRun?: boolean;
  verbose?: boolean;
  force?: boolean;
  all?: boolean;
}

interface NotionTaskRow {
  id: number;
  notion_page_id: string;
  title: string;
  points: number | null;
  project_id: number | null;
}

class NotionPointsBackfillService {
  
  async run(options: BackfillOptions = {}): Promise<void> {
    console.log('🚀 Starting Notion Points backfill process...');
    
    if (options.dryRun) {
      console.log('🔍 DRY RUN MODE - No data will be modified');
    }

    try {
      await dbService.initializeSchema();
      console.log('✓ Database schema verified');

      // Get tasks that need points extraction
      await this.extractAndUpdatePoints(options);

      console.log('✅ Notion Points backfill complete');

    } catch (error) {
      console.error('💥 Backfill failed:', error);
      throw error;
    }
  }

  private async extractAndUpdatePoints(options: BackfillOptions): Promise<void> {
    console.log('\n📊 Extracting points from Notion tasks...');

    // Get tasks to process
    const tasks = await this.getTasksToProcess(options);
    console.log(`Found ${tasks.length} tasks to process`);

    let processed = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    let pointsFound = 0;

    for (const task of tasks) {
      try {
        if (options.verbose) {
          console.log(`\nProcessing task: ${task.title} (ID: ${task.id})`);
          console.log(`  Notion Page ID: ${task.notion_page_id}`);
          console.log(`  Current points: ${task.points ?? 'null'}`);
        }

        // Skip if already has points and not forcing
        if (task.points !== null && !options.force && !options.all) {
          if (options.verbose) {
            console.log(`  ⏭️  Skipping - already has points (use --force to re-fetch)`);
          }
          skipped++;
          processed++;
          continue;
        }

        // Fetch fresh data from Notion
        const pageContent = await notionService.fetchPageContent(task.notion_page_id);
        
        // Extract points from properties
        const points = (notionService as any).extractPoints(pageContent.properties);
        
        if (points !== undefined && points !== null) {
          pointsFound++;
          
          if (options.verbose) {
            console.log(`  ✓ Found points: ${points}`);
          }

          // Update database
          if (!options.dryRun) {
            await dbService.query(
              'UPDATE notion_tasks SET points = $1, updated_at = NOW() WHERE id = $2',
              [points, task.id]
            );
          }
          
          updated++;
        } else {
          if (options.verbose) {
            console.log(`  ⚠️  No points found in Notion properties`);
          }
        }

        processed++;

        // Rate limiting - wait 100ms between requests to avoid hitting Notion API limits
        if (processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }

      } catch (error: any) {
        errors++;
        console.error(`❌ Error processing task ${task.id} (${task.title}):`, error.message);
        
        if (options.verbose) {
          console.error('  Full error:', error);
        }
      }
    }

    console.log(`\n📈 Points Extraction Summary:`);
    console.log(`  Tasks processed: ${processed}`);
    console.log(`  Tasks updated: ${updated}`);
    console.log(`  Tasks with points found: ${pointsFound}`);
    console.log(`  Tasks skipped: ${skipped}`);
    console.log(`  Errors: ${errors}`);
  }

  private async getTasksToProcess(options: BackfillOptions): Promise<NotionTaskRow[]> {
    let query = `
      SELECT id, notion_page_id, title, points, project_id
      FROM notion_tasks
      WHERE 1=1
    `;

    const params: any[] = [];
    let paramIndex = 1;

    // Filter by project if specified
    if (options.projectId) {
      query += ` AND project_id = $${paramIndex}`;
      params.push(options.projectId);
      paramIndex++;
    }

    // Filter by points status unless --all or --force
    if (!options.all && !options.force) {
      query += ` AND points IS NULL`;
    }

    query += ` ORDER BY id ASC`;

    const result = await dbService.query(query, params);
    return result.rows;
  }

  async showSummary(): Promise<void> {
    try {
      // Show current points statistics
      const statsResult = await dbService.query(`
        SELECT 
          COUNT(*) as total_tasks,
          COUNT(points) as tasks_with_points,
          COUNT(*) - COUNT(points) as tasks_without_points,
          MIN(points) as min_points,
          MAX(points) as max_points,
          ROUND(AVG(points), 1) as avg_points
        FROM notion_tasks
      `);
      
      const stats = statsResult.rows[0];
      
      console.log('\n📊 Current Points Statistics:');
      console.log(`  Total tasks: ${stats.total_tasks}`);
      console.log(`  Tasks with points: ${stats.tasks_with_points} (${((stats.tasks_with_points / stats.total_tasks) * 100).toFixed(1)}%)`);
      console.log(`  Tasks without points: ${stats.tasks_without_points}`);
      
      if (stats.tasks_with_points > 0) {
        console.log(`  Points range: ${stats.min_points} - ${stats.max_points}`);
        console.log(`  Average points: ${stats.avg_points}`);
      }

      // Show points distribution
      const distributionResult = await dbService.query(`
        SELECT points, COUNT(*) as count
        FROM notion_tasks
        WHERE points IS NOT NULL
        GROUP BY points
        ORDER BY points DESC
        LIMIT 10
      `);

      if (distributionResult.rows.length > 0) {
        console.log('\n📈 Points Distribution (Top 10):');
        distributionResult.rows.forEach((row) => {
          const bar = '█'.repeat(Math.min(50, Math.ceil(row.count / 2)));
          console.log(`  ${row.points} points: ${bar} (${row.count} tasks)`);
        });
      }

      // Show projects with most pointed tasks
      const projectsResult = await dbService.query(`
        SELECT 
          p.name as project_name,
          COUNT(nt.id) as total_tasks,
          COUNT(nt.points) as tasks_with_points,
          ROUND(AVG(nt.points), 1) as avg_points
        FROM notion_tasks nt
        LEFT JOIN projects p ON nt.project_id = p.project_id
        WHERE nt.points IS NOT NULL
        GROUP BY p.name
        ORDER BY tasks_with_points DESC
        LIMIT 5
      `);

      if (projectsResult.rows.length > 0) {
        console.log('\n🏆 Top Projects by Pointed Tasks:');
        projectsResult.rows.forEach((row, index) => {
          console.log(`  ${index + 1}. ${row.project_name || 'Unknown'}: ${row.tasks_with_points} tasks (avg: ${row.avg_points} points)`);
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
    } else if (arg === '--all') {
      options.all = true;
    } else if (arg === '--project-id' && i + 1 < args.length) {
      options.projectId = parseInt(args[++i]);
    }
  }

  return options;
}

// Main execution
async function main() {
  try {
    await dbService.connect();
    
    const options = parseArgs();
    const service = new NotionPointsBackfillService();
    
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

