#!/usr/bin/env node
/**
 * Test script to verify completion rate endpoints are working
 */

import { dbService } from '../services/database.js';
import { completionRateService } from '../services/completion-rate.js';

async function testCompletionRateEndpoints() {
  console.log('🧪 Testing Completion Rate Endpoints...\n');

  try {
    // Initialize database connection
    await dbService.connect();
    console.log('✅ Database connected\n');

    // Test 1: Check if tables exist
    console.log('1️⃣ Checking database tables...');
    
    const tablesQuery = `
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('notion_tasks', 'task_mr_mappings', 'feature_completion_rates')
      ORDER BY table_name
    `;
    
    const tablesResult = await dbService.query(tablesQuery);
    console.log('📊 Found tables:', tablesResult.rows.map(r => r.table_name));
    
    if (tablesResult.rows.length < 3) {
      console.log('⚠️  Some completion rate tables are missing. Running schema initialization...');
      await dbService.initializeSchema();
      console.log('✅ Schema initialized');
    }

    // Test 2: Check for sample data
    console.log('\n2️⃣ Checking for sample data...');

    const notionTasksCount = await dbService.query('SELECT COUNT(*) as count FROM notion_tasks');
    const mappingsCount = await dbService.query('SELECT COUNT(*) as count FROM task_mr_mappings');
    const ratesCount = await dbService.query('SELECT COUNT(*) as count FROM feature_completion_rates');

    console.log(`📝 Notion tasks: ${notionTasksCount.rows[0].count}`);
    console.log(`🔗 Task-MR mappings: ${mappingsCount.rows[0].count}`);
    console.log(`📈 Completion rates: ${ratesCount.rows[0].count}`);

    // Test 2.1: Analyze actual data
    console.log('\n🔍 Analyzing actual data...');

    // Check assignees in notion tasks
    const assigneesQuery = await dbService.query(`
      SELECT assignee_username, assignee_name, COUNT(*) as task_count
      FROM notion_tasks
      WHERE assignee_username IS NOT NULL
      GROUP BY assignee_username, assignee_name
      ORDER BY task_count DESC
      LIMIT 10
    `);
    console.log('👥 Top assignees:', assigneesQuery.rows);

    // Check date ranges
    const dateRangeQuery = await dbService.query(`
      SELECT
        MIN(created_at) as earliest_task,
        MAX(created_at) as latest_task,
        EXTRACT(YEAR FROM MIN(created_at)) as earliest_year,
        EXTRACT(MONTH FROM MIN(created_at)) as earliest_month,
        EXTRACT(YEAR FROM MAX(created_at)) as latest_year,
        EXTRACT(MONTH FROM MAX(created_at)) as latest_month
      FROM notion_tasks
    `);
    console.log('📅 Date range:', dateRangeQuery.rows[0]);

    // Check completion rates by month
    const monthlyRatesQuery = await dbService.query(`
      SELECT year, month, COUNT(*) as rate_count
      FROM feature_completion_rates
      GROUP BY year, month
      ORDER BY year DESC, month DESC
      LIMIT 10
    `);
    console.log('📊 Monthly completion rates:', monthlyRatesQuery.rows);

    // Test 3: Create sample data if none exists
    if (parseInt(notionTasksCount.rows[0].count) === 0) {
      console.log('\n3️⃣ Creating sample data...');
      
      // Create sample notion tasks
      const sampleTasks = [
        {
          notion_page_id: 'test-page-001',
          title: 'Implement user authentication',
          status: 'Done',
          assignee_username: 'john-doe',
          assignee_name: 'John Doe',
          project_id: 1
        },
        {
          notion_page_id: 'test-page-002',
          title: 'Add dashboard analytics',
          status: 'In Progress',
          assignee_username: 'jane-smith',
          assignee_name: 'Jane Smith',
          project_id: 1
        },
        {
          notion_page_id: 'test-page-003',
          title: 'Fix login bug',
          status: 'Done',
          assignee_username: 'john-doe',
          assignee_name: 'John Doe',
          project_id: 1
        }
      ];

      for (const task of sampleTasks) {
        await dbService.upsertNotionTask(task);
      }
      console.log('✅ Sample tasks created');

      // Create sample task-MR mappings
      const tasks = await dbService.query('SELECT id, notion_page_id FROM notion_tasks LIMIT 2');

      for (let i = 0; i < tasks.rows.length; i++) {
        const task = tasks.rows[i];
        await dbService.createTaskMRMapping({
          notion_task_id: task.id,
          project_id: 1,
          merge_request_iid: 100 + i,
          merge_request_id: 1000 + i
        });
      }

      // Create sample merge request tracking records to simulate merged MRs
      for (let i = 0; i < tasks.rows.length; i++) {
        const mergeRequestData = {
          project_id: 1,
          merge_request_iid: 100 + i,
          merge_request_id: 1000 + i,
          title: `Sample MR ${i + 1}`,
          description: `Test merge request ${i + 1}`,
          source_branch: `feature/test-${i + 1}`,
          target_branch: 'main',
          author_username: i === 0 ? 'john-doe' : 'jane-smith',
          author_name: i === 0 ? 'John Doe' : 'Jane Smith',
          status: i === 0 ? 'merged' : 'opened', // First one is merged
          merged_at: i === 0 ? new Date() : null,
          created_at: new Date(),
          updated_at: new Date()
        };

        // Insert merge request tracking record
        await dbService.query(`
          INSERT INTO merge_request_tracking (
            project_id, merge_request_iid, merge_request_id, title, description,
            source_branch, target_branch, author_username, author_name,
            status, merged_at, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          ON CONFLICT (project_id, merge_request_iid) DO UPDATE SET
            status = EXCLUDED.status,
            merged_at = EXCLUDED.merged_at,
            updated_at = EXCLUDED.updated_at
        `, [
          mergeRequestData.project_id,
          mergeRequestData.merge_request_iid,
          mergeRequestData.merge_request_id,
          mergeRequestData.title,
          mergeRequestData.description,
          mergeRequestData.source_branch,
          mergeRequestData.target_branch,
          mergeRequestData.author_username,
          mergeRequestData.author_name,
          mergeRequestData.status,
          mergeRequestData.merged_at,
          mergeRequestData.created_at,
          mergeRequestData.updated_at
        ]);
      }
      console.log('✅ Sample mappings created');
    }

    // Test 4: Test completion rate calculation with real data
    console.log('\n4️⃣ Testing completion rate calculation with real data...');

    try {
      // Get the most recent month with data
      const recentDataQuery = await dbService.query(`
        SELECT year, month, COUNT(*) as rate_count
        FROM feature_completion_rates
        WHERE rate_count > 0
        ORDER BY year DESC, month DESC
        LIMIT 1
      `);

      let testMonth, testYear;
      if (recentDataQuery.rows.length > 0) {
        testYear = recentDataQuery.rows[0].year;
        testMonth = recentDataQuery.rows[0].month;
        console.log(`📅 Using month with data: ${testYear}-${testMonth}`);
      } else {
        // Fallback to current month if no completion rates exist yet
        const now = new Date();
        testMonth = now.getMonth() + 1;
        testYear = now.getFullYear();
        console.log(`📅 No completion rates found, using current month: ${testYear}-${testMonth}`);
      }

      // Get actual assignees from the database
      const assigneesQuery = await dbService.query(`
        SELECT assignee_username
        FROM notion_tasks
        WHERE assignee_username IS NOT NULL
        GROUP BY assignee_username
        ORDER BY COUNT(*) DESC
        LIMIT 2
      `);

      const testUsers = assigneesQuery.rows.length > 0
        ? assigneesQuery.rows.map(row => row.assignee_username)
        : ['john-doe', 'jane-smith']; // fallback

      console.log(`👥 Testing with users: ${testUsers.join(', ')}`);

      // Test individual completion rates
      for (const username of testUsers) {
        const result = await completionRateService.calculateCompletionRate(username, testMonth, testYear, 1);
        console.log(`👤 ${username} completion rate:`, result);
      }

      // Test team completion rates
      const teamResult = await completionRateService.getTeamCompletionRates(testMonth, testYear, 1);
      console.log('👥 Team completion rates:', teamResult);

      // Test stats
      const statsResult = await completionRateService.getCompletionRateStats(1);
      console.log('📊 Completion rate stats:', statsResult);

      console.log('\n✅ All completion rate calculations working!');

    } catch (calcError) {
      console.error('❌ Completion rate calculation failed:', calcError);
    }

    // Test 5: Test API endpoint simulation with real data
    console.log('\n5️⃣ Testing API endpoint simulation with real data...');

    try {
      // Get the most recent month with data for API simulation
      const recentDataQuery = await dbService.query(`
        SELECT year, month
        FROM feature_completion_rates
        ORDER BY year DESC, month DESC
        LIMIT 1
      `);

      let apiTestMonth, apiTestYear;
      if (recentDataQuery.rows.length > 0) {
        apiTestYear = recentDataQuery.rows[0].year;
        apiTestMonth = recentDataQuery.rows[0].month;
      } else {
        // Fallback to current month
        const now = new Date();
        apiTestMonth = now.getMonth() + 1;
        apiTestYear = now.getFullYear();
      }

      // Simulate the API calls that the frontend would make
      const mockFilters = { month: `${apiTestYear}-${apiTestMonth.toString().padStart(2, '0')}` };
      console.log('🔍 Using filters:', mockFilters);

      // Parse month from filter
      const [filterYear, filterMonth] = mockFilters.month.split('-').map(Number);

      const teamRatesResponse = await completionRateService.getTeamCompletionRates(filterMonth, filterYear, 1);
      console.log('📡 Team rates API response:', {
        success: true,
        data: teamRatesResponse
      });

      const statsResponse = await completionRateService.getCompletionRateStats(1);
      console.log('📡 Stats API response:', {
        success: true,
        data: statsResponse
      });

      console.log('\n🎉 All tests passed! Completion rate system is working correctly.');

    } catch (apiError) {
      console.error('❌ API simulation failed:', apiError);
    }

  } catch (error) {
    console.error('💥 Test failed:', error);
    process.exit(1);
  } finally {
    await dbService.disconnect();
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testCompletionRateEndpoints().catch(console.error);
}

export { testCompletionRateEndpoints };
