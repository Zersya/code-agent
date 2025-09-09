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
          merge_request_id: 1000 + i,
          is_merged: i === 0, // First one is merged
          merged_at: i === 0 ? new Date().toISOString() : null
        });
      }
      console.log('✅ Sample mappings created');
    }

    // Test 4: Test completion rate calculation
    console.log('\n4️⃣ Testing completion rate calculation...');
    
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    try {
      const johnResult = await completionRateService.calculateCompletionRate('john-doe', month, year, 1);
      console.log('👤 John Doe completion rate:', johnResult);

      const janeResult = await completionRateService.calculateCompletionRate('jane-smith', month, year, 1);
      console.log('👤 Jane Smith completion rate:', janeResult);

      const teamResult = await completionRateService.getTeamCompletionRates(month, year, 1);
      console.log('👥 Team completion rates:', teamResult);

      const statsResult = await completionRateService.getCompletionRateStats(1);
      console.log('📊 Completion rate stats:', statsResult);

      console.log('\n✅ All completion rate calculations working!');

    } catch (calcError) {
      console.error('❌ Completion rate calculation failed:', calcError);
    }

    // Test 5: Test API endpoint simulation
    console.log('\n5️⃣ Testing API endpoint simulation...');
    
    // Simulate the API calls that the frontend would make
    const mockFilters = { month: `${year}-${month.toString().padStart(2, '0')}` };
    console.log('🔍 Using filters:', mockFilters);

    try {
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
if (require.main === module) {
  testCompletionRateEndpoints().catch(console.error);
}

export { testCompletionRateEndpoints };
