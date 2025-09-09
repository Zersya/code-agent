#!/usr/bin/env bun
/**
 * Integration verification script for completion rate feature
 * This script verifies that all components work together correctly
 */

import { dbService } from '../services/database.js';
import { completionRateService } from '../services/completion-rate.js';
import { taskMRMappingService } from '../services/task-mr-mapping.js';
import { notionService } from '../services/notion.js';

class CompletionRateIntegrationVerifier {
  
  async verifyIntegration(): Promise<boolean> {
    console.log('🔍 Verifying completion rate integration...\n');
    
    let allTestsPassed = true;
    
    try {
      // Test 1: Database Schema
      console.log('1️⃣  Testing database schema...');
      const schemaValid = await this.verifyDatabaseSchema();
      if (schemaValid) {
        console.log('   ✅ Database schema is valid\n');
      } else {
        console.log('   ❌ Database schema issues found\n');
        allTestsPassed = false;
      }

      // Test 2: Notion URL Extraction
      console.log('2️⃣  Testing Notion URL extraction...');
      const urlExtractionWorks = await this.verifyNotionUrlExtraction();
      if (urlExtractionWorks) {
        console.log('   ✅ Notion URL extraction works\n');
      } else {
        console.log('   ❌ Notion URL extraction failed\n');
        allTestsPassed = false;
      }

      // Test 3: Task Storage
      console.log('3️⃣  Testing task storage...');
      const taskStorageWorks = await this.verifyTaskStorage();
      if (taskStorageWorks) {
        console.log('   ✅ Task storage works\n');
      } else {
        console.log('   ❌ Task storage failed\n');
        allTestsPassed = false;
      }

      // Test 4: Task-MR Mapping
      console.log('4️⃣  Testing task-MR mapping...');
      const mappingWorks = await this.verifyTaskMRMapping();
      if (mappingWorks) {
        console.log('   ✅ Task-MR mapping works\n');
      } else {
        console.log('   ❌ Task-MR mapping failed\n');
        allTestsPassed = false;
      }

      // Test 5: Completion Rate Calculation
      console.log('5️⃣  Testing completion rate calculation...');
      const calculationWorks = await this.verifyCompletionRateCalculation();
      if (calculationWorks) {
        console.log('   ✅ Completion rate calculation works\n');
      } else {
        console.log('   ❌ Completion rate calculation failed\n');
        allTestsPassed = false;
      }

      // Test 6: API Endpoints (basic check)
      console.log('6️⃣  Testing API endpoint structure...');
      const apiWorks = await this.verifyApiEndpoints();
      if (apiWorks) {
        console.log('   ✅ API endpoints are properly structured\n');
      } else {
        console.log('   ❌ API endpoint issues found\n');
        allTestsPassed = false;
      }

      // Cleanup test data
      await this.cleanupTestData();

      if (allTestsPassed) {
        console.log('🎉 All integration tests passed! The completion rate feature is ready to use.\n');
        console.log('Next steps:');
        console.log('1. Run the backfill script to process existing data:');
        console.log('   bun run src/scripts/backfill-completion-rates.ts --dry-run');
        console.log('2. Test the API endpoints with real data');
        console.log('3. Monitor webhook processing for new MRs');
      } else {
        console.log('❌ Some integration tests failed. Please check the issues above.');
      }

      return allTestsPassed;

    } catch (error) {
      console.error('💥 Integration verification failed:', error);
      return false;
    }
  }

  private async verifyDatabaseSchema(): Promise<boolean> {
    try {
      // Check if all required tables exist
      const tables = ['notion_tasks', 'task_mr_mappings', 'feature_completion_rates'];
      
      for (const table of tables) {
        const query = `
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = $1
          )
        `;
        const result = await dbService.query(query, [table]);
        
        if (!result.rows[0].exists) {
          console.log(`   ❌ Table ${table} does not exist`);
          return false;
        }
        console.log(`   ✓ Table ${table} exists`);
      }

      // Check if indexes exist
      const indexes = [
        'idx_notion_tasks_page_id',
        'idx_task_mr_mappings_task',
        'idx_feature_completion_rates_developer'
      ];

      for (const index of indexes) {
        const query = `
          SELECT EXISTS (
            SELECT FROM pg_indexes 
            WHERE indexname = $1
          )
        `;
        const result = await dbService.query(query, [index]);
        
        if (!result.rows[0].exists) {
          console.log(`   ⚠️  Index ${index} does not exist (may affect performance)`);
        } else {
          console.log(`   ✓ Index ${index} exists`);
        }
      }

      return true;
    } catch (error) {
      console.error('   ❌ Database schema verification failed:', error);
      return false;
    }
  }

  private async verifyNotionUrlExtraction(): Promise<boolean> {
    try {
      const testDescriptions = [
        {
          description: 'Related task: https://notion.so/test-page-123',
          expectedUrls: 1
        },
        {
          description: `
            ## Related Links:
            - Notion: https://www.notion.so/workspace/Task-abc123
            - Design: https://figma.com/design/123
          `,
          expectedUrls: 1
        },
        {
          description: 'No Notion URLs here',
          expectedUrls: 0
        }
      ];

      for (const test of testDescriptions) {
        const result = notionService.extractNotionUrls(test.description);
        if (result.urls.length !== test.expectedUrls) {
          console.log(`   ❌ Expected ${test.expectedUrls} URLs, got ${result.urls.length}`);
          return false;
        }
        console.log(`   ✓ Extracted ${result.urls.length} URLs correctly`);
      }

      return true;
    } catch (error) {
      console.error('   ❌ Notion URL extraction verification failed:', error);
      return false;
    }
  }

  private async verifyTaskStorage(): Promise<boolean> {
    try {
      const testTask = {
        notion_page_id: 'verify-test-page-123',
        title: 'Verification Test Task',
        status: 'In Progress',
        assignee_username: 'verify-testuser',
        assignee_name: 'Verify Test User',
        project_id: 999
      };

      // Store task
      const storedTask = await dbService.upsertNotionTask(testTask);
      console.log(`   ✓ Stored task with ID: ${storedTask.id}`);

      // Retrieve task
      const retrievedTask = await dbService.getNotionTaskByPageId('verify-test-page-123');
      if (!retrievedTask || retrievedTask.title !== testTask.title) {
        console.log('   ❌ Failed to retrieve stored task');
        return false;
      }
      console.log('   ✓ Retrieved task successfully');

      // Get tasks by assignee
      const tasks = await dbService.getNotionTasksByAssignee('verify-testuser');
      if (tasks.length === 0) {
        console.log('   ❌ Failed to get tasks by assignee');
        return false;
      }
      console.log(`   ✓ Found ${tasks.length} tasks for assignee`);

      return true;
    } catch (error) {
      console.error('   ❌ Task storage verification failed:', error);
      return false;
    }
  }

  private async verifyTaskMRMapping(): Promise<boolean> {
    try {
      // Get the test task
      const task = await dbService.getNotionTaskByPageId('verify-test-page-123');
      if (!task) {
        console.log('   ❌ Test task not found');
        return false;
      }

      // Create mapping
      const mappingData = {
        notion_task_id: task.id!,
        project_id: 999,
        merge_request_iid: 999,
        merge_request_id: 999
      };

      const mapping = await dbService.createTaskMRMapping(mappingData);
      console.log(`   ✓ Created mapping with ID: ${mapping.id}`);

      // Get mappings
      const mappings = await taskMRMappingService.getMRMappingsForTask(task.id!);
      if (mappings.length === 0) {
        console.log('   ❌ Failed to retrieve mappings');
        return false;
      }
      console.log(`   ✓ Retrieved ${mappings.length} mappings`);

      return true;
    } catch (error) {
      console.error('   ❌ Task-MR mapping verification failed:', error);
      return false;
    }
  }

  private async verifyCompletionRateCalculation(): Promise<boolean> {
    try {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      // Calculate completion rate
      const result = await completionRateService.calculateCompletionRate(
        'verify-testuser',
        month,
        year,
        999
      );

      console.log(`   ✓ Calculated completion rate: ${result.completionRate}%`);
      console.log(`   ✓ Total tasks: ${result.totalTasks}`);
      console.log(`   ✓ Tasks with MRs: ${result.tasksWithMRs}`);

      // Get team rates
      const teamResult = await completionRateService.getTeamCompletionRates(month, year, 999);
      console.log(`   ✓ Team stats: ${teamResult.developers.length} developers`);

      // Get trends
      const trendsResult = await completionRateService.getCompletionRateTrends('verify-testuser', 3, 999);
      console.log(`   ✓ Trends: ${trendsResult.trends.length} months`);

      return true;
    } catch (error) {
      console.error('   ❌ Completion rate calculation verification failed:', error);
      return false;
    }
  }

  private async verifyApiEndpoints(): Promise<boolean> {
    try {
      // Import the analytics controller to verify exports exist
      const analyticsModule = await import('../controllers/admin-analytics.js');
      
      const requiredEndpoints = [
        'getCompletionRate',
        'getTeamCompletionRates',
        'getCompletionRateTrends',
        'getProjectCompletionRates',
        'getCompletionRateStats'
      ];

      for (const endpoint of requiredEndpoints) {
        if (typeof (analyticsModule as any)[endpoint] !== 'function') {
          console.log(`   ❌ Endpoint ${endpoint} is not exported or not a function`);
          return false;
        }
        console.log(`   ✓ Endpoint ${endpoint} is available`);
      }

      return true;
    } catch (error) {
      console.error('   ❌ API endpoint verification failed:', error);
      return false;
    }
  }

  private async cleanupTestData(): Promise<void> {
    try {
      await dbService.query('DELETE FROM task_mr_mappings WHERE project_id = 999');
      await dbService.query('DELETE FROM notion_tasks WHERE notion_page_id = $1', ['verify-test-page-123']);
      await dbService.query('DELETE FROM feature_completion_rates WHERE username = $1', ['verify-testuser']);
      console.log('🧹 Cleaned up test data');
    } catch (error) {
      console.log('⚠️  Cleanup warning (may be expected):', error);
    }
  }
}

// CLI interface
async function main() {
  const verifier = new CompletionRateIntegrationVerifier();
  const success = await verifier.verifyIntegration();
  process.exit(success ? 0 : 1);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { CompletionRateIntegrationVerifier };
