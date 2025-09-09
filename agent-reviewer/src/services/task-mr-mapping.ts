import { notionService } from './notion.js';
import { dbService } from './database.js';
import { NotionTask, TaskMRMapping } from '../types/performance.js';

/**
 * Service for managing task-MR mappings
 */
export class TaskMRMappingService {
  
  /**
   * Process merge request description to create task-MR mappings
   */
  async processMergeRequestForTaskMapping(
    projectId: number,
    mergeRequestIid: number,
    mergeRequestId: number,
    description: string,
    authorUsername?: string
  ): Promise<TaskMRMapping[]> {
    try {
      console.log(`Processing MR !${mergeRequestIid} for task mapping`);
      
      // Extract Notion URLs from description
      const urlResult = notionService.extractNotionUrls(description);
      
      if (urlResult.urls.length === 0) {
        console.log(`No Notion URLs found in MR !${mergeRequestIid}`);
        return [];
      }
      
      console.log(`Found ${urlResult.urls.length} Notion URLs in MR !${mergeRequestIid}`);
      
      const mappings: TaskMRMapping[] = [];
      
      // Process each Notion URL
      for (const url of urlResult.urls) {
        try {
          // Fetch and store task context
          const result = await notionService.fetchAndStoreTaskContext(url, projectId);
          const storedTask = result.storedTask;
          
          // Create task-MR mapping
          const mapping = await dbService.createTaskMRMapping({
            notion_task_id: storedTask.id,
            project_id: projectId,
            merge_request_iid: mergeRequestIid,
            merge_request_id: mergeRequestId
          });
          
          mappings.push(mapping);
          
          console.log(`Created task-MR mapping: Task ${storedTask.title} -> MR !${mergeRequestIid}`);
          
        } catch (error) {
          console.error(`Error processing Notion URL ${url} for MR !${mergeRequestIid}:`, error);
          // Continue processing other URLs even if one fails
        }
      }
      
      return mappings;
      
    } catch (error) {
      console.error(`Error processing MR !${mergeRequestIid} for task mapping:`, error);
      return [];
    }
  }
  
  /**
   * Update task completion status when MR is merged
   */
  async updateTaskCompletionOnMerge(
    projectId: number,
    mergeRequestIid: number
  ): Promise<void> {
    try {
      console.log(`Updating task completion for merged MR !${mergeRequestIid}`);
      
      // Get all task mappings for this MR
      const mappings = await dbService.getTaskMRMappingsByMR(projectId, mergeRequestIid);
      
      if (mappings.length === 0) {
        console.log(`No task mappings found for MR !${mergeRequestIid}`);
        return;
      }
      
      // Update each associated task to completed status
      for (const mapping of mappings) {
        try {
          const task = await dbService.getNotionTaskByPageId(mapping.notion_task_id.toString());
          if (task) {
            // Update task status to completed
            await dbService.upsertNotionTask({
              ...task,
              status: 'Completed',
              completed_at: new Date()
            });
            
            console.log(`Marked task "${task.title}" as completed due to MR merge`);
          }
        } catch (error) {
          console.error(`Error updating task completion for mapping ${mapping.id}:`, error);
        }
      }
      
    } catch (error) {
      console.error(`Error updating task completion for MR !${mergeRequestIid}:`, error);
    }
  }
  
  /**
   * Get task mappings for a merge request
   */
  async getTaskMappingsForMR(
    projectId: number,
    mergeRequestIid: number
  ): Promise<TaskMRMapping[]> {
    try {
      return await dbService.getTaskMRMappingsByMR(projectId, mergeRequestIid);
    } catch (error) {
      console.error(`Error getting task mappings for MR !${mergeRequestIid}:`, error);
      return [];
    }
  }
  
  /**
   * Get MR mappings for a task
   */
  async getMRMappingsForTask(taskId: number): Promise<TaskMRMapping[]> {
    try {
      return await dbService.getTaskMRMappings(taskId);
    } catch (error) {
      console.error(`Error getting MR mappings for task ${taskId}:`, error);
      return [];
    }
  }
  
  /**
   * Check if a task has any merged MRs (is completed)
   */
  async isTaskCompletedByMergedMRs(taskId: number): Promise<boolean> {
    try {
      const mappings = await this.getMRMappingsForTask(taskId);
      
      // Check if any associated MR is merged
      return mappings.some(mapping => 
        mapping.mr_status === 'merged' && mapping.mr_merged_at
      );
    } catch (error) {
      console.error(`Error checking task completion for task ${taskId}:`, error);
      return false;
    }
  }
  
  /**
   * Process existing merge requests to backfill task mappings
   */
  async backfillTaskMappings(
    projectId?: number,
    dateFrom?: Date,
    dateTo?: Date
  ): Promise<number> {
    try {
      console.log('Starting backfill of task mappings for existing MRs');
      
      // Build query to get existing MRs
      let query = `
        SELECT project_id, merge_request_iid, merge_request_id, description, author_username
        FROM merge_request_tracking
        WHERE description IS NOT NULL AND description != ''
      `;
      const params: any[] = [];
      let paramIndex = 1;
      
      if (projectId) {
        query += ` AND project_id = $${paramIndex}`;
        params.push(projectId);
        paramIndex++;
      }
      
      if (dateFrom) {
        query += ` AND created_at >= $${paramIndex}`;
        params.push(dateFrom);
        paramIndex++;
      }
      
      if (dateTo) {
        query += ` AND created_at <= $${paramIndex}`;
        params.push(dateTo);
        paramIndex++;
      }
      
      query += ` ORDER BY created_at DESC`;
      
      const result = await dbService.query(query, params);
      const mergeRequests = result.rows;
      
      console.log(`Found ${mergeRequests.length} MRs to process for backfill`);
      
      let processedCount = 0;
      
      // Process each MR
      for (const mr of mergeRequests) {
        try {
          const mappings = await this.processMergeRequestForTaskMapping(
            mr.project_id,
            mr.merge_request_iid,
            mr.merge_request_id,
            mr.description,
            mr.author_username
          );
          
          if (mappings.length > 0) {
            processedCount++;
          }
          
          // Add small delay to avoid overwhelming Notion API
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`Error processing MR !${mr.merge_request_iid} during backfill:`, error);
        }
      }
      
      console.log(`Backfill completed: processed ${processedCount} MRs with task mappings`);
      return processedCount;
      
    } catch (error) {
      console.error('Error during task mapping backfill:', error);
      return 0;
    }
  }
}

export const taskMRMappingService = new TaskMRMappingService();
