# Enhanced Notion Integration with Structured Content Parsing

This document describes the enhanced Notion integration that supports parsing and extracting structured content from Notion pages for better GitLab merge request reviews.

## Overview

The enhanced Notion service now supports parsing specific block structures that represent typical task documentation:

1. **User Story blocks** - Extract 1-2 line descriptions that summarize the task
2. **Acceptance Criteria blocks** - Parse checkbox lists with nested items/sub-criteria  
3. **Screenshot blocks** - Identify and reference any embedded images or files
4. **To-do List blocks** - Extract actionable items and their completion status

## New Type Definitions

### UserStoryBlock
```typescript
interface UserStoryBlock {
  content: string;      // Full content of the user story section
  description: string;  // Detailed description
  summary: string;      // 1-2 line summary
}
```

### AcceptanceCriteriaBlock
```typescript
interface AcceptanceCriteriaBlock {
  items: AcceptanceCriteriaItem[];
  totalItems: number;
  completedItems: number;
}

interface AcceptanceCriteriaItem {
  text: string;
  completed: boolean;
  nested: AcceptanceCriteriaItem[];
  priority?: 'high' | 'medium' | 'low';
}
```

### ScreenshotBlock
```typescript
interface ScreenshotBlock {
  images: {
    id: string;
    caption?: string;
    url?: string;
    type: 'image' | 'file' | 'embed';
  }[];
  totalImages: number;
}
```

### TodoListBlock
```typescript
interface TodoListBlock {
  items: TodoListItem[];
  totalItems: number;
  completedItems: number;
  pendingItems: number;
}

interface TodoListItem {
  text: string;
  completed: boolean;
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
}
```

## Enhanced Features

### 1. Structured Content Parsing
The service now extracts structured content from Notion pages and provides it in the `structuredContent` property of `NotionTaskContext`:

```typescript
interface NotionTaskContext {
  // ... existing properties
  structuredContent?: StructuredNotionContent;
}
```

### 2. Improved Block Type Support
- **Image blocks**: Detects and extracts image URLs and captions
- **File blocks**: Handles file attachments with metadata
- **Embed blocks**: Supports embedded content with URLs
- **Nested checkbox items**: Properly handles indented acceptance criteria
- **Priority detection**: Automatically detects priority levels from text content
- **Assignee extraction**: Identifies @mentions and assignee patterns

### 3. Smart Section Detection
The parser now recognizes various heading formats:
- `# User Story` or `User Story`
- `# Acceptance Criteria` or `Acceptance Criteria`  
- `# Screenshots` or `Screenshots`
- `# To-do List` or `To-do List`

### 4. Progress Tracking
Automatically calculates completion percentages for:
- Acceptance criteria items
- Todo list items
- Overall task progress

## Usage Examples

### Example Notion Page Structure
```markdown
# User or Job Story 1
As a user, I want to add a new user so that they can access certain features on the platform.
I also want to be able to edit and delete their access when needed.

# Acceptance Criteria
- [ ] When the User Management module is opened for the first time, a list table of users will be displayed
- [x] The user can add a new role by tapping the "Create user" or "New user" button
- [ ] The user can edit a user from the user list table
  - [ ] Full name validation
  - [ ] Email format validation
- [ ] The user can delete a user from the user list table [HIGH PRIORITY]

# Screenshots
[Image: mockup.png] - User management interface mockup
[File: requirements.pdf] - Detailed requirements document

# To-do List
- [x] Create the User Management Table List
- [ ] Create the Create User Page @john
- [ ] Create the Delete Confirmation Dialog [HIGH PRIORITY]
- [ ] Create Empty state
```

### Accessing Structured Content
```typescript
const taskContext = await notionService.fetchTaskContext(notionUrl);

if (taskContext.structuredContent) {
  const { userStory, acceptanceCriteria, screenshots, todoList } = taskContext.structuredContent;
  
  // Access user story
  if (userStory) {
    console.log('Summary:', userStory.summary);
    console.log('Description:', userStory.description);
  }
  
  // Access acceptance criteria with progress
  if (acceptanceCriteria) {
    console.log(`Progress: ${acceptanceCriteria.completedItems}/${acceptanceCriteria.totalItems}`);
    acceptanceCriteria.items.forEach(item => {
      console.log(`- ${item.completed ? '✅' : '⏳'} ${item.text}`);
      if (item.priority) console.log(`  Priority: ${item.priority}`);
    });
  }
  
  // Access screenshots and assets
  if (screenshots) {
    screenshots.images.forEach(image => {
      console.log(`${image.type}: ${image.caption || 'No caption'}`);
      if (image.url) console.log(`URL: ${image.url}`);
    });
  }
  
  // Access todo items with assignees
  if (todoList) {
    todoList.items.forEach(item => {
      console.log(`- ${item.completed ? '✅' : '⏳'} ${item.text}`);
      if (item.assignee) console.log(`  Assigned to: @${item.assignee}`);
      if (item.priority) console.log(`  Priority: ${item.priority}`);
    });
  }
}
```

### Formatting for Reviews
```typescript
// Format structured content for display in merge request reviews
const formattedContent = notionService.formatStructuredContentForReview(taskContext.structuredContent);

// Extract insights for AI analysis
const insights = notionService.extractStructuredInsights(taskContext.structuredContent);
console.log(insights.overallProgress); // "Overall Progress: 3/8 tasks completed (38%)"
```

## Integration with GitLab Reviews

The structured content enhances the AI review process by providing:

1. **Clear Context**: Understanding of business requirements and user stories
2. **Progress Tracking**: Visibility into task completion status
3. **Priority Awareness**: Focus on high-priority incomplete items
4. **Asset References**: Knowledge of related screenshots and documentation
5. **Assignee Information**: Understanding of task ownership

## Backward Compatibility

The enhancement maintains full backward compatibility:
- Existing `NotionTaskContext` properties remain unchanged
- Legacy parsing logic continues to work
- New `structuredContent` is optional and only populated when structured content is found
- All existing integrations continue to function without modification

## Error Handling

The service includes robust error handling:
- Graceful degradation when structured content is not found
- Fallback to legacy parsing for unsupported page structures
- Detailed error reporting for debugging
- Timeout handling for API calls

## Performance Considerations

- Structured content parsing adds minimal overhead
- Parsing is done in a single pass through the blocks
- Results are cached within the NotionTaskContext
- No additional API calls required
