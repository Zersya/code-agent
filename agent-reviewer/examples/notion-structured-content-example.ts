/**
 * Example demonstrating the enhanced Notion service with structured content parsing
 * This file shows how to use the new structured content features
 */

import { notionService } from '../src/services/notion.js';
import { 
  StructuredNotionContent, 
  UserStoryBlock, 
  AcceptanceCriteriaBlock, 
  ScreenshotBlock, 
  TodoListBlock 
} from '../src/types/notion.js';

/**
 * Example: Fetching and using structured content from a Notion page
 */
async function demonstrateStructuredContentParsing() {
  try {
    // Example Notion URL (replace with actual URL)
    const notionUrl = 'https://www.notion.so/workspace/User-Management-Feature-abc123def456';
    
    console.log('🔍 Fetching task context from Notion...');
    const taskContext = await notionService.fetchTaskContext(notionUrl);
    
    console.log(`📄 Page Title: ${taskContext.title}`);
    console.log(`🔗 URL: ${taskContext.url}`);
    
    // Check if structured content is available
    if (taskContext.structuredContent && taskContext.structuredContent.hasStructuredContent) {
      console.log('\n✨ Structured content found! Analyzing...\n');
      
      const structured = taskContext.structuredContent;
      
      // Analyze User Story
      if (structured.userStory) {
        console.log('👤 USER STORY:');
        console.log(`   Summary: ${structured.userStory.summary}`);
        console.log(`   Description: ${structured.userStory.description.substring(0, 100)}...`);
        console.log('');
      }
      
      // Analyze Acceptance Criteria
      if (structured.acceptanceCriteria) {
        console.log('✅ ACCEPTANCE CRITERIA:');
        console.log(`   Progress: ${structured.acceptanceCriteria.completedItems}/${structured.acceptanceCriteria.totalItems} completed`);
        
        structured.acceptanceCriteria.items.forEach((item, index) => {
          const status = item.completed ? '✅' : '⏳';
          const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
          console.log(`   ${index + 1}. ${status} ${item.text}${priority}`);
          
          // Show nested items
          item.nested.forEach((nested, nestedIndex) => {
            const nestedStatus = nested.completed ? '✅' : '⏳';
            const nestedPriority = nested.priority ? ` [${nested.priority.toUpperCase()}]` : '';
            console.log(`      ${nestedIndex + 1}.${index + 1}. ${nestedStatus} ${nested.text}${nestedPriority}`);
          });
        });
        console.log('');
      }
      
      // Analyze Screenshots
      if (structured.screenshots) {
        console.log('📸 SCREENSHOTS & ASSETS:');
        console.log(`   Total: ${structured.screenshots.totalImages} item(s)`);
        
        structured.screenshots.images.forEach((image, index) => {
          console.log(`   ${index + 1}. ${image.type.toUpperCase()}: ${image.caption || 'No caption'}`);
          if (image.url) {
            console.log(`      URL: ${image.url}`);
          }
        });
        console.log('');
      }
      
      // Analyze Todo List
      if (structured.todoList) {
        console.log('📝 TODO LIST:');
        console.log(`   Progress: ${structured.todoList.completedItems}/${structured.todoList.totalItems} completed (${structured.todoList.pendingItems} pending)`);
        
        structured.todoList.items.forEach((item, index) => {
          const status = item.completed ? '✅' : '⏳';
          const priority = item.priority ? ` [${item.priority.toUpperCase()}]` : '';
          const assignee = item.assignee ? ` (@${item.assignee})` : '';
          console.log(`   ${index + 1}. ${status} ${item.text}${priority}${assignee}`);
        });
        console.log('');
      }
      
      // Generate formatted content for reviews
      console.log('📋 FORMATTED FOR REVIEW:');
      const formattedContent = notionService.formatStructuredContentForReview(structured);
      console.log(formattedContent);
      
      // Extract insights for AI analysis
      console.log('🧠 AI INSIGHTS:');
      const insights = notionService.extractStructuredInsights(structured);
      console.log(`   ${insights.userStoryInsights}`);
      console.log(`   ${insights.acceptanceCriteriaInsights}`);
      console.log(`   ${insights.todoInsights}`);
      console.log(`   ${insights.overallProgress}`);
      
    } else {
      console.log('📝 No structured content found, using legacy parsing...');
      console.log(`Description: ${taskContext.description.substring(0, 200)}...`);
      console.log(`Requirements: ${taskContext.requirements.length} item(s)`);
      console.log(`Acceptance Criteria: ${taskContext.acceptanceCriteria.length} item(s)`);
    }
    
  } catch (error) {
    console.error('❌ Error demonstrating structured content:', error);
  }
}

/**
 * Example: Processing multiple Notion URLs from a merge request
 */
async function demonstrateMultipleNotionPages() {
  try {
    // Example merge request description with multiple Notion URLs
    const mergeRequestDescription = `
## Description
This MR implements the user management feature as specified in the requirements.

## Related Links:
- Main Task: https://www.notion.so/workspace/User-Management-Feature-abc123
- Design Specs: https://www.notion.so/workspace/UI-Design-Specifications-def456
- API Documentation: https://www.notion.so/workspace/API-Endpoints-ghi789

## Changes
- Added user management components
- Implemented CRUD operations
- Added validation and error handling
    `;
    
    console.log('🔍 Extracting Notion URLs from merge request description...');
    const extractionResult = notionService.extractNotionUrls(mergeRequestDescription);
    
    console.log(`📎 Found ${extractionResult.totalFound} Notion URLs`);
    if (extractionResult.extractedFromSection) {
      console.log(`📍 Extracted from: ${extractionResult.extractedFromSection}`);
    }
    
    if (extractionResult.urls.length > 0) {
      console.log('\n🔄 Fetching context from multiple pages...');
      const combinedContext = await notionService.fetchMultipleTaskContexts(extractionResult.urls);
      
      console.log(`📊 Summary: ${combinedContext.summary}`);
      console.log(`✅ Successful fetches: ${combinedContext.successfulFetches}/${combinedContext.totalPages}`);
      
      if (combinedContext.errors.length > 0) {
        console.log(`❌ Errors: ${combinedContext.errors.length}`);
      }
      
      // Analyze each context
      combinedContext.contexts.forEach((context, index) => {
        console.log(`\n📄 Task ${index + 1}: ${context.title}`);
        
        if (context.structuredContent && context.structuredContent.hasStructuredContent) {
          console.log('   ✨ Has structured content');
          
          const insights = notionService.extractStructuredInsights(context.structuredContent);
          if (insights.overallProgress) {
            console.log(`   📈 ${insights.overallProgress}`);
          }
        } else {
          console.log('   📝 Using legacy content parsing');
        }
      });
    }
    
  } catch (error) {
    console.error('❌ Error demonstrating multiple pages:', error);
  }
}

/**
 * Example: Integration with GitLab merge request review
 */
function demonstrateReviewIntegration() {
  console.log('🔧 INTEGRATION WITH GITLAB REVIEWS:');
  console.log('');
  console.log('The enhanced Notion service integrates seamlessly with GitLab merge request reviews:');
  console.log('');
  console.log('1. 📥 Webhook receives merge request event');
  console.log('2. 🔍 Extract Notion URLs from MR description');
  console.log('3. 📄 Fetch structured content from Notion pages');
  console.log('4. 🧠 AI reviewer uses structured context for better analysis');
  console.log('5. 📝 Generate contextual review comments');
  console.log('');
  console.log('Benefits:');
  console.log('• ✅ Verify code changes align with acceptance criteria');
  console.log('• 📋 Check if todo items are addressed');
  console.log('• 🎯 Focus on high-priority incomplete requirements');
  console.log('• 📸 Reference related screenshots and documentation');
  console.log('• 👥 Consider assignee information for targeted feedback');
  console.log('');
}

// Run examples if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🚀 Enhanced Notion Integration Examples\n');
  
  demonstrateReviewIntegration();
  
  // Uncomment to run live examples (requires valid Notion URLs and API token)
  // await demonstrateStructuredContentParsing();
  // await demonstrateMultipleNotionPages();
  
  console.log('✨ Examples completed!');
}

export {
  demonstrateStructuredContentParsing,
  demonstrateMultipleNotionPages,
  demonstrateReviewIntegration
};
