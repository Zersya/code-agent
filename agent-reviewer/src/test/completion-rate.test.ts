// Test file for completion rate functionality
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { dbService } from '../services/database.js';
import { completionRateService } from '../services/completion-rate.js';
import { taskMRMappingService } from '../services/task-mr-mapping.js';
import { notionService } from '../services/notion.js';

describe('Feature Completion Rate System', () => {
  
  beforeAll(async () => {
    // Initialize database schema
    await dbService.initializeSchema();
  });

  describe('Database Schema', () => {
    test('should create notion_tasks table', async () => {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'notion_tasks'
        )
      `;
      const result = await dbService.query(query);
      expect(result.rows[0].exists).toBe(true);
    });

    test('should create task_mr_mappings table', async () => {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'task_mr_mappings'
        )
      `;
      const result = await dbService.query(query);
      expect(result.rows[0].exists).toBe(true);
    });

    test('should create feature_completion_rates table', async () => {
      const query = `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_name = 'feature_completion_rates'
        )
      `;
      const result = await dbService.query(query);
      expect(result.rows[0].exists).toBe(true);
    });
  });

  describe('Notion Task Management', () => {
    test('should store and retrieve notion task', async () => {
      const taskData = {
        notion_page_id: 'test-page-123',
        title: 'Test Task',
        status: 'In Progress',
        assignee_username: 'testuser',
        assignee_name: 'Test User',
        project_id: 1
      };

      const storedTask = await dbService.upsertNotionTask(taskData);
      expect(storedTask.notion_page_id).toBe(taskData.notion_page_id);
      expect(storedTask.title).toBe(taskData.title);
      expect(storedTask.assignee_username).toBe(taskData.assignee_username);

      // Retrieve task
      const retrievedTask = await dbService.getNotionTaskByPageId('test-page-123');
      expect(retrievedTask).toBeTruthy();
      expect(retrievedTask?.title).toBe('Test Task');
    });

    test('should get tasks by assignee', async () => {
      const tasks = await dbService.getNotionTasksByAssignee('testuser');
      expect(tasks.length).toBeGreaterThan(0);
      expect(tasks[0].assignee_username).toBe('testuser');
    });
  });

  describe('Task-MR Mapping', () => {
    test('should create task-MR mapping', async () => {
      // First ensure we have a task
      const task = await dbService.getNotionTaskByPageId('test-page-123');
      expect(task).toBeTruthy();

      const mappingData = {
        notion_task_id: task!.id!,
        project_id: 1,
        merge_request_iid: 123,
        merge_request_id: 456
      };

      const mapping = await dbService.createTaskMRMapping(mappingData);
      expect(mapping.notion_task_id).toBe(task!.id);
      expect(mapping.merge_request_iid).toBe(123);
    });

    test('should get task mappings', async () => {
      const task = await dbService.getNotionTaskByPageId('test-page-123');
      const mappings = await taskMRMappingService.getMRMappingsForTask(task!.id!);
      expect(mappings.length).toBeGreaterThan(0);
    });
  });

  describe('Completion Rate Calculation', () => {
    test('should calculate completion rate for developer', async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const result = await completionRateService.calculateCompletionRate(
        'testuser',
        month,
        year,
        1
      );

      expect(result.username).toBe('testuser');
      expect(result.totalTasks).toBeGreaterThanOrEqual(0);
      expect(result.completionRate).toBeGreaterThanOrEqual(0);
      expect(result.completionRate).toBeLessThanOrEqual(100);
    });

    test('should get team completion rates', async () => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const result = await completionRateService.getTeamCompletionRates(
        month,
        year,
        1
      );

      expect(result.teamStats).toBeTruthy();
      expect(result.developers).toBeInstanceOf(Array);
      expect(result.teamStats.totalDevelopers).toBeGreaterThanOrEqual(0);
    });

    test('should get completion rate trends', async () => {
      const result = await completionRateService.getCompletionRateTrends(
        'testuser',
        3,
        1
      );

      expect(result.username).toBe('testuser');
      expect(result.trends).toBeInstanceOf(Array);
      expect(result.trends.length).toBe(3);
    });
  });

  describe('Notion URL Extraction', () => {
    test('should extract notion URLs from MR description', () => {
      const description = `
        ## Description
        This MR implements the user authentication feature.
        
        ## Related Links:
        - Notion Task: https://www.notion.so/workspace/User-Authentication-Implementation-abc123def456
        - Design: https://figma.com/design/123
      `;

      const result = notionService.extractNotionUrls(description);
      expect(result.urls.length).toBe(1);
      expect(result.urls[0]).toContain('notion.so');
    });

    test('should handle empty description', () => {
      const result = notionService.extractNotionUrls('');
      expect(result.urls.length).toBe(0);
    });
  });

  describe('Integration Tests', () => {
    test('should process MR for task mapping (mocked)', async () => {
      // This would normally require actual Notion API calls
      // For testing, we'll just verify the method exists and handles errors gracefully
      
      const description = 'No Notion URLs here';
      const mappings = await taskMRMappingService.processMergeRequestForTaskMapping(
        1,
        999,
        999,
        description,
        'testuser'
      );

      // Should return empty array for description without Notion URLs
      expect(mappings).toBeInstanceOf(Array);
      expect(mappings.length).toBe(0);
    });

    test('should handle task completion update', async () => {
      // Test the task completion update method
      await taskMRMappingService.updateTaskCompletionOnMerge(1, 123);
      
      // Should complete without errors even if no mappings exist
      expect(true).toBe(true);
    });
  });

  describe('Cache Management', () => {
    test('should clear cache', () => {
      completionRateService.clearCache('testuser');
      completionRateService.clearCache(); // Clear all
      
      // Should complete without errors
      expect(true).toBe(true);
    });
  });

  afterAll(async () => {
    // Clean up test data
    try {
      await dbService.query('DELETE FROM task_mr_mappings WHERE project_id = 1');
      await dbService.query('DELETE FROM notion_tasks WHERE notion_page_id = $1', ['test-page-123']);
      await dbService.query('DELETE FROM feature_completion_rates WHERE username = $1', ['testuser']);
    } catch (error) {
      console.log('Cleanup error (expected in some cases):', error);
    }
  });
});

// Export test functions for manual testing
export async function testCompletionRateSystem() {
  console.log('Testing completion rate system...');
  
  try {
    // Test database schema
    await dbService.initializeSchema();
    console.log('✓ Database schema initialized');

    // Test basic functionality
    const now = new Date();
    const result = await completionRateService.calculateCompletionRate(
      'test-developer',
      now.getMonth() + 1,
      now.getFullYear()
    );
    
    console.log('✓ Completion rate calculation works:', result);
    
    // Test team rates
    const teamResult = await completionRateService.getTeamCompletionRates(
      now.getMonth() + 1,
      now.getFullYear()
    );
    
    console.log('✓ Team completion rates work:', teamResult.teamStats);
    
    console.log('All tests passed!');
    return true;
    
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
}

export async function testNotionIntegration() {
  console.log('Testing Notion integration...');
  
  try {
    // Test URL extraction
    const testDescription = `
      Related task: https://notion.so/test-page-123
      Another link: https://www.notion.so/workspace/Task-abc123
    `;
    
    const result = notionService.extractNotionUrls(testDescription);
    console.log('✓ Notion URL extraction works:', result);
    
    return true;
  } catch (error) {
    console.error('Notion integration test failed:', error);
    return false;
  }
}
