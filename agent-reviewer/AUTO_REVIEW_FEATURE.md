# Auto Review Toggle Feature

## Overview

This feature allows administrators to enable or disable automatic merge request reviews on a per-repository basis. When auto review is disabled for a repository, the system will skip automatic review processing for merge requests in that repository, while still allowing manual reviews.

## Features

- **Per-repository control**: Enable/disable auto review for individual repositories
- **Default enabled**: New repositories default to having auto review enabled
- **Web UI**: User-friendly toggle interface in the admin dashboard
- **API endpoints**: RESTful API for programmatic control
- **Graceful fallback**: System defaults to enabled if project doesn't exist in database

## Database Schema

### Projects Table

The `projects` table has been updated with the following columns:

```sql
ALTER TABLE projects ADD COLUMN auto_review_enabled BOOLEAN DEFAULT true;
ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
```

#### Column Details

- `auto_review_enabled`: Controls whether auto review is enabled for the project
  - `true`: Auto review is enabled (default)
  - `false`: Auto review is disabled
- `updated_at`: Timestamp for tracking when the project was last updated

## API Endpoints

### Get All Projects

```http
GET /api/projects
```

Returns a list of all projects with their auto review status.

**Response:**
```json
{
  "projects": [
    {
      "projectId": 1,
      "name": "My Project",
      "description": "Project description",
      "url": "https://gitlab.com/example/project",
      "defaultBranch": "main",
      "lastProcessedCommit": "abc123",
      "lastProcessedAt": "2024-09-03T10:00:00Z",
      "lastReembeddingAt": "2024-09-03T10:00:00Z",
      "autoReviewEnabled": true
    }
  ],
  "count": 1,
  "timestamp": "2024-09-03T10:00:00Z"
}
```

### Get Auto Review Status

```http
GET /api/projects/:projectId/auto-review
```

Returns the auto review status for a specific project.

**Response:**
```json
{
  "projectId": 1,
  "autoReviewEnabled": true,
  "timestamp": "2024-09-03T10:00:00Z"
}
```

### Update Auto Review Status

```http
PUT /api/projects/:projectId/auto-review
Content-Type: application/json

{
  "enabled": true
}
```

Updates the auto review status for a specific project.

**Response:**
```json
{
  "success": true,
  "message": "Auto review enabled for project 1",
  "projectId": 1,
  "autoReviewEnabled": true,
  "timestamp": "2024-09-03T10:00:00Z"
}
```

## Frontend Components

### AutoReviewSettingsView

A dedicated page for managing auto review settings across all repositories.

**Route:** `/auto-review-settings`

**Features:**
- List all repositories with their current auto review status
- Toggle switches for enabling/disabling auto review
- Real-time status updates
- Loading indicators and error handling
- Empty state for repositories without embeddings

### Navigation

The feature is accessible through:
- Main navigation: "Auto Review Settings" link
- Dashboard quick actions section
- Direct URL: `/auto-review-settings`

## Backend Implementation

### Database Service Methods

#### `updateAutoReviewEnabled(projectId: number, enabled: boolean): Promise<void>`
Updates the auto review enabled status for a project.

#### `isAutoReviewEnabled(projectId: number): Promise<boolean>`
Checks if auto review is enabled for a project. Returns `true` if:
- Project has auto review enabled
- Project doesn't exist in database (graceful fallback)
- Error occurs (fail-safe behavior)

#### `updateProjectMetadata(metadata: ProjectMetadata): Promise<void>`
Updated to include `autoReviewEnabled` field when updating project metadata.

#### `getProjectMetadata(projectId: number): Promise<ProjectMetadata | null>`
Updated to include `autoReviewEnabled` field in returned metadata.

#### `getAllProjects(): Promise<ProjectMetadata[]>`
Updated to include `autoReviewEnabled` field in all projects.

### Review Service Integration

The review service now checks project-specific auto review settings before processing:

```typescript
// In submitReview and submitReReview methods
const isAutoReviewEnabledForProject = await dbService.isAutoReviewEnabled(projectId);
if (!isAutoReviewEnabledForProject) {
  console.log(`Auto review is disabled for project ${projectId}. Skipping review for !${mergeRequestIid}`);
  return;
}
```

## Security Considerations

1. **Authentication**: All API endpoints require authentication
2. **Authorization**: Update endpoints require admin privileges
3. **Validation**: Input validation for project IDs and boolean values
4. **Fail-safe**: System defaults to enabled if there are errors

## Migration

### Database Migration

The migration script `add_auto_review_enabled_column.sql`:
1. Adds the `auto_review_enabled` column with default value `true`
2. Adds the `updated_at` column for tracking changes
3. Updates existing records to have `auto_review_enabled = true`
4. Creates indexes for performance
5. Sets up triggers for automatic timestamp updates

### Application Migration

1. **Database schema**: Run the migration script
2. **Type definitions**: Updated interfaces include `autoReviewEnabled` field
3. **API endpoints**: New endpoints for managing auto review status
4. **Frontend components**: New view and navigation items
5. **Review service**: Updated to check project-specific settings

## Testing

### Test Script

Run the test script to verify functionality:

```bash
node test-auto-review.js
```

The test script verifies:
- Database operations (create, update, check status)
- Default behavior for non-existent projects
- Metadata retrieval
- Project listing

### Manual Testing

1. Navigate to `/auto-review-settings` in the web interface
2. Toggle auto review for various repositories
3. Verify the toggle state persists after page refresh
4. Check that the API endpoints return correct data
5. Test with merge requests to ensure disabled repositories skip auto review

## Error Handling

### Database Errors
- Connection failures: Default to enabled (fail-safe)
- Query errors: Log error and default to enabled
- Invalid project IDs: Return appropriate HTTP error codes

### API Errors
- Invalid input: 400 Bad Request
- Authentication failures: 401 Unauthorized
- Authorization failures: 403 Forbidden
- Server errors: 500 Internal Server Error

### Frontend Errors
- Network failures: Show error message with retry option
- Validation errors: Show inline validation messages
- Loading states: Show loading indicators during API calls

## Performance Considerations

1. **Database Indexing**: Index on `auto_review_enabled` column for fast filtering
2. **Caching**: Consider caching frequently accessed project settings
3. **Batch Operations**: Frontend updates multiple settings efficiently
4. **Minimal Queries**: Optimized database queries to reduce load

## Future Enhancements

1. **Bulk Operations**: Enable/disable auto review for multiple repositories at once
2. **Scheduling**: Temporarily disable auto review for maintenance periods
3. **Audit Logging**: Track changes to auto review settings
4. **Notifications**: Alert administrators when auto review is disabled
5. **Project Templates**: Default auto review settings for new project types

## Troubleshooting

### Common Issues

1. **Auto review not working**
   - Check if global `ENABLE_MR_REVIEW` is enabled
   - Verify project-specific auto review setting
   - Check database connectivity

2. **Toggle not working in UI**
   - Check browser console for JavaScript errors
   - Verify API authentication
   - Check network requests in browser dev tools

3. **Database migration failed**
   - Check database permissions
   - Verify PostgreSQL version compatibility
   - Check for existing columns with different names

### Debug Commands

```bash
# Check database schema
psql -d your_database -c "\d projects"

# Test API endpoints
curl -H "Authorization: Bearer your_token" http://localhost:9080/api/projects

# Run test script
node test-auto-review.js
```