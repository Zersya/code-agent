# Analytics Integration Points

## Overview
This document maps the specific integration points in the agent-reviewer system where analytics data should be captured and stored.

## Data Collection Points

### 1. Merge Request Creation/Update (webhook.ts)

**Location**: `processRepopoMergeRequestEvent()` and `processMergeRequestEvent()`
**Trigger**: GitLab webhook events with `object_kind: 'merge_request'` and `action: 'open'` or `'update'`

**Available Data Points**:
- `event.object_attributes.iid` - Merge request IID
- `event.object_attributes.author` - Developer info (id, username, email)
- `event.project.id` - Project ID
- `event.object_attributes.title` - MR title
- `event.object_attributes.description` - MR description
- `event.object_attributes.source_branch` - Source branch
- `event.object_attributes.target_branch` - Target branch
- `event.object_attributes.created_at` - Creation timestamp
- `event.object_attributes.last_commit.id` - Latest commit SHA

**Analytics Data to Capture**:
- Create initial `merge_request_analytics` record
- Track MR creation for daily `developer_metrics` aggregation

### 2. Merge Request Review Completion (review.ts)

**Location**: `reviewService.submitReview()` completion
**Trigger**: After successful review submission and approval decision

**Available Data Points**:
- Review result text and critical issues count
- Approval decision (`shouldApprove`)
- Review mode (sequential thinking vs direct LLM)
- Notion context availability
- MR changes data (lines added/removed, files changed)
- Review processing time

**Analytics Data to Capture**:
- Update `merge_request_analytics` with review results
- Extract and store critical issues in `review_feedback_analytics`
- Calculate code quality score
- Update daily `developer_metrics` aggregations

### 3. Merge Request Completion (webhook.ts)

**Location**: `processMergeCompletionEvent()`
**Trigger**: GitLab webhook with `action: 'merge'` and `state: 'merged'`

**Available Data Points**:
- Final merge timestamp
- Total cycle time (creation to merge)
- Final approval status

**Analytics Data to Capture**:
- Update `merge_request_analytics` with final timestamps
- Calculate final cycle time metrics
- Update daily `developer_metrics` with completed MR

### 4. Review Feedback Analysis (review.ts)

**Location**: After `reviewCodeWithLLM()` or `reviewCodeWithSequentialThinking()`
**Trigger**: When review result is generated

**Available Data Points**:
- Full review text with structured feedback
- Critical issues (🔴 markers)
- Code quality assessments
- Performance and security findings

**Analytics Data to Capture**:
- Parse and categorize feedback into `review_feedback_analytics`
- Count critical issues by type
- Extract code quality indicators

## Integration Strategy

### Phase 1: Basic Data Collection
1. Add analytics service calls to existing webhook processing
2. Capture basic MR lifecycle events (create, review, merge)
3. Store raw metrics without complex calculations

### Phase 2: Advanced Analytics
1. Implement real-time KPI calculations
2. Add daily aggregation jobs
3. Enhance feedback categorization

### Phase 3: Optimization
1. Add caching for frequently accessed metrics
2. Implement background processing for heavy calculations
3. Add data retention policies

## Data Flow

```
GitLab Webhook → Webhook Controller → Analytics Service
                                   ↓
Review Service → Review Completion → Analytics Service
                                   ↓
                              Database Storage
                                   ↓
                           Daily Aggregation Jobs
                                   ↓
                              Analytics API
```

## Implementation Notes

### Non-Intrusive Integration
- All analytics calls should be wrapped in try-catch blocks
- Analytics failures should not affect core functionality
- Use async processing where possible to avoid blocking

### Data Consistency
- Use database transactions for related analytics updates
- Implement retry mechanisms for failed analytics operations
- Add data validation before storage

### Performance Considerations
- Batch analytics operations where possible
- Use background jobs for heavy calculations
- Implement caching for frequently accessed data

## Specific Code Locations

### webhook.ts Integration Points
```typescript
// In processRepopoMergeRequestEvent()
await analyticsService.trackMergeRequestCreated(event);

// In processMergeCompletionEvent()
await analyticsService.trackMergeRequestCompleted(event);
```

### review.ts Integration Points
```typescript
// In submitReview() after successful review
await analyticsService.trackReviewCompleted(
  projectId, 
  mergeRequestIid, 
  reviewResult, 
  changes,
  reviewMetadata
);
```

### Database Service Integration
```typescript
// Add analytics-specific database operations
await dbService.saveMergeRequestAnalytics(analyticsData);
await dbService.updateDeveloperMetrics(developerId, projectId, metrics);
```
