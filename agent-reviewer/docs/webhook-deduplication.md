# Webhook Deduplication System

## Overview

The webhook deduplication system prevents duplicate processing of GitLab webhook events that may be sent simultaneously or in rapid succession. This is crucial for avoiding redundant code reviews, embedding processes, and resource waste.

## How It Works

### 1. Webhook Identification

Each incoming webhook event is assigned a unique identifier based on:

- **Push Events**: `push-{project_id}-{commit_sha}-{ref}`
- **Merge Request Events**: `mr-{project_id}-{merge_request_iid}-{last_commit_sha}-{action}`
- **Note Events**: `note-{project_id}-{note_id}-{updated_at}`
- **Emoji Events**: `emoji-{project_id}-{emoji_id}-{updated_at}`

The identifier is then hashed using SHA-256 to create a consistent webhook key.

### 2. Processing State Tracking

The system maintains a database table `webhook_processing` that tracks:

- `id`: Unique processing ID (UUID)
- `webhook_key`: Hashed webhook identifier
- `event_type`: Type of webhook event
- `project_id`: GitLab project ID
- `status`: Processing status (processing, completed, failed)
- `started_at`: When processing started
- `completed_at`: When processing completed (if applicable)
- `error`: Error message (if failed)
- `server_id`: ID of the server processing the webhook
- `created_at`: Record creation timestamp
- `updated_at`: Record update timestamp

### 3. Duplicate Prevention Flow

1. **Webhook Received**: When a webhook arrives, the system generates a webhook key
2. **Duplicate Check**: Check if a record with the same webhook key and "processing" status exists
3. **Decision**:
   - If duplicate found: Return success immediately without processing
   - If not duplicate: Create processing record and proceed with processing
4. **Processing**: Execute the normal webhook processing logic
5. **Completion**: Mark the processing record as completed or failed

### 4. Cleanup Mechanisms

#### Automatic Cleanup
- **Periodic Cleanup**: Runs every 5 minutes (configurable) to remove stale processing records
- **Stale Record Detection**: Records older than 30 minutes (configurable) in "processing" status are considered stale
- **Server Restart Recovery**: Handles cases where server restarts leave orphaned processing records

#### Manual Cleanup
- **Graceful Shutdown**: Stops periodic cleanup when server shuts down
- **API Endpoint**: `/api/webhook/stats` provides processing statistics

## Configuration

Environment variables for configuration:

```bash
# Server identification (auto-generated if not provided)
SERVER_ID=server-unique-id

# Maximum processing time before considering a record stale (minutes)
WEBHOOK_MAX_PROCESSING_TIME_MINUTES=30

# Cleanup interval for stale records (minutes)
WEBHOOK_CLEANUP_INTERVAL_MINUTES=5
```

## Database Schema

```sql
CREATE TABLE webhook_processing (
  id TEXT PRIMARY KEY,
  webhook_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  project_id INTEGER NOT NULL,
  status TEXT NOT NULL,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  server_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_webhook_processing_webhook_key ON webhook_processing(webhook_key);
CREATE INDEX idx_webhook_processing_status ON webhook_processing(status);
CREATE INDEX idx_webhook_processing_started_at ON webhook_processing(started_at);
```

## API Endpoints

### Webhook Processing Statistics

```http
GET /api/webhook/stats
Authorization: Bearer <api_token>
```

Response:
```json
{
  "active": 2,
  "completed": 150,
  "failed": 3
}
```

## Edge Cases Handled

### 1. Server Restarts
- In-memory tracking is lost, but database records persist
- Periodic cleanup removes stale records from previous server instances
- New webhooks can be processed normally after restart

### 2. Rapid Successive Updates
- Legitimate rapid updates (e.g., force pushes) are handled by including timestamps in webhook keys
- Each unique state change gets its own processing record

### 3. Network Issues
- Failed webhook processing is marked as failed, allowing retry
- Stale processing records are cleaned up automatically

### 4. Database Failures
- If database is unavailable, webhooks are processed without deduplication
- System logs warnings but continues to function

## Monitoring and Debugging

### Logs
The system provides detailed logging for:
- Webhook key generation
- Duplicate detection
- Processing start/completion/failure
- Cleanup operations

### Statistics
Monitor webhook processing health using the stats endpoint:
- **Active**: Currently processing webhooks
- **Completed**: Successfully processed webhooks
- **Failed**: Failed webhook processing attempts

### Troubleshooting

#### High Active Count
- Check for stuck processing records
- Verify cleanup is running properly
- Check for database connectivity issues

#### High Failed Count
- Review error logs for common failure patterns
- Check GitLab API connectivity
- Verify database schema is up to date

#### Duplicate Processing Still Occurring
- Verify webhook key generation is consistent
- Check database unique constraints
- Review server clock synchronization

## Performance Considerations

### Database Impact
- Minimal overhead: One SELECT and one INSERT per webhook
- Indexes ensure fast lookups
- Periodic cleanup prevents table growth

### Memory Usage
- No in-memory caching required
- Stateless design allows horizontal scaling

### Scalability
- Multiple server instances can run simultaneously
- Each server has unique ID for tracking
- Database handles concurrency control

## Testing

Run the webhook deduplication tests:

```bash
# Run the test file
bun run src/test/webhook-deduplication.test.ts

# Or with Node.js
node dist/test/webhook-deduplication.test.js
```

The tests verify:
- Webhook key generation consistency
- Webhook identifier creation
- Different events produce different keys
- Same events produce identical keys
