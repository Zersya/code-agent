# QDrant Migration Guide

This guide explains how to migrate the @agent-reviewer project's embedding storage from PostgreSQL to QDrant vector database for improved performance and scalability.

## Overview

The migration moves embeddings from PostgreSQL (with pgvector) to QDrant, a dedicated vector database optimized for similarity search operations. The system supports a hybrid approach during migration, allowing gradual transition with fallback mechanisms.

## Architecture

### Before Migration
- **Storage**: PostgreSQL with pgvector extension
- **Fallback**: JSONB storage when pgvector unavailable
- **Search**: Cosine similarity using pgvector operators

### After Migration
- **Primary Storage**: QDrant vector database
- **Backup Storage**: PostgreSQL (optional, for consistency)
- **Search**: QDrant's optimized vector search
- **Fallback**: Automatic fallback to PostgreSQL if QDrant unavailable

## Prerequisites

1. **QDrant Server**: Running QDrant instance (Docker recommended)
2. **Dependencies**: QDrant client library installed
3. **Environment**: Proper environment variables configured
4. **Backup**: Database backup before migration

## Installation

### 1. Install Dependencies

The QDrant client is already added to package.json:

```bash
npm install
```

### 2. Start QDrant Server

Using Docker Compose:

```bash
# Start QDrant with the provided configuration
docker-compose -f docker-compose.qdrant.yml up -d qdrant
```

Or manually with Docker:

```bash
docker run -p 6333:6333 -p 6334:6334 \
  -v $(pwd)/qdrant_storage:/qdrant/storage \
  qdrant/qdrant:v1.7.4
```

### 3. Configure Environment

Update your `.env` file:

```env
# QDrant Configuration
QDRANT_URL=http://localhost:6333
QDRANT_API_KEY=
QDRANT_CODE_COLLECTION=code_embeddings
QDRANT_DOCS_COLLECTION=documentation_embeddings

# Migration Settings
USE_QDRANT=false  # Set to true after successful migration
QDRANT_FALLBACK_TO_DB=true  # Recommended during migration
```

## Migration Process

### Phase 1: Preparation

1. **Backup Database**:
   ```bash
   pg_dump your_database > backup_before_migration.sql
   ```

2. **Verify QDrant Connection**:
   ```bash
   curl http://localhost:6333/health
   ```

3. **Check Current Data**:
   ```bash
   npm run migrate:verify
   ```

### Phase 2: Dry Run Migration

Test the migration without actually moving data:

```bash
npm run migrate:qdrant:dry-run
```

This will:
- Validate all embeddings
- Check QDrant connectivity
- Estimate migration time
- Report any issues

### Phase 3: Actual Migration

Run the migration with default settings:

```bash
npm run migrate:qdrant
```

Or with custom options:

```bash
npm run migrate:qdrant -- --batch-size=50 --no-validate
```

Available options:
- `--dry-run`: Test without migrating
- `--batch-size=N`: Embeddings per batch (default: 100)
- `--no-validate`: Skip data validation
- `--skip-existing`: Skip existing embeddings
- `--no-continue-on-error`: Stop on first error
- `--no-verify`: Skip integrity verification

### Phase 4: Verification

After migration, verify data integrity:

```bash
npm run migrate:verify
```

This compares record counts between PostgreSQL and QDrant.

### Phase 5: Switch to QDrant

1. **Update Environment**:
   ```env
   USE_QDRANT=true
   ```

2. **Restart Application**:
   ```bash
   npm run start:webhook
   ```

3. **Monitor Performance**:
   Check logs and API responses for any issues.

## API Endpoints

The migration adds several API endpoints for monitoring and management:

### Status and Health

```bash
# Get overall status
GET /api/qdrant/status

# Health check
GET /api/qdrant/health

# Collection information
GET /api/qdrant/collections/code
GET /api/qdrant/collections/documentation
```

### Migration Management

```bash
# Start migration
POST /api/qdrant/migrate
{
  "batchSize": 100,
  "validateData": true,
  "dryRun": false
}

# Check progress
GET /api/qdrant/migrate/progress

# Verify integrity
POST /api/qdrant/migrate/verify
```

### Mode Switching

```bash
# Enable QDrant mode
POST /api/qdrant/enable

# Disable QDrant (database-only)
POST /api/qdrant/disable
```

### Collection Management

```bash
# Clear collection (DANGEROUS)
DELETE /api/qdrant/collections/code
{
  "confirm": true
}

# Search embeddings
POST /api/qdrant/collections/code/search
{
  "query": "search text",
  "limit": 10,
  "projectId": 123
}
```

## Configuration Options

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `QDRANT_URL` | QDrant server URL | `http://localhost:6333` |
| `QDRANT_API_KEY` | QDrant API key (optional) | - |
| `QDRANT_CODE_COLLECTION` | Code embeddings collection | `code_embeddings` |
| `QDRANT_DOCS_COLLECTION` | Documentation collection | `documentation_embeddings` |
| `USE_QDRANT` | Enable QDrant usage | `false` |
| `QDRANT_FALLBACK_TO_DB` | Fallback to database | `true` |

### Migration Options

| Option | Description | Default |
|--------|-------------|---------|
| `batchSize` | Records per batch | 100 |
| `validateData` | Validate before migration | true |
| `skipExisting` | Skip existing records | false |
| `dryRun` | Test without migrating | false |
| `continueOnError` | Continue on batch errors | true |

## Troubleshooting

### Common Issues

1. **QDrant Connection Failed**:
   - Check if QDrant server is running
   - Verify QDRANT_URL configuration
   - Check firewall/network settings

2. **Migration Stuck**:
   - Check migration progress: `GET /api/qdrant/migrate/progress`
   - Look for errors in application logs
   - Consider reducing batch size

3. **Data Mismatch**:
   - Run verification: `POST /api/qdrant/migrate/verify`
   - Check for failed batches in migration logs
   - Re-run migration with `skipExisting: true`

4. **Performance Issues**:
   - Monitor QDrant resource usage
   - Adjust batch size and concurrency
   - Check QDrant configuration

### Recovery Procedures

1. **Rollback to Database**:
   ```env
   USE_QDRANT=false
   ```

2. **Clear QDrant Collections**:
   ```bash
   curl -X DELETE "http://localhost:6333/collections/code_embeddings"
   curl -X DELETE "http://localhost:6333/collections/documentation_embeddings"
   ```

3. **Restart Migration**:
   ```bash
   npm run migrate:qdrant -- --skip-existing
   ```

## Performance Comparison

### Before (PostgreSQL + pgvector)
- Search time: ~100-500ms for 10k embeddings
- Memory usage: High for large result sets
- Scalability: Limited by PostgreSQL performance

### After (QDrant)
- Search time: ~10-50ms for 10k embeddings
- Memory usage: Optimized vector storage
- Scalability: Horizontal scaling support

## Best Practices

1. **Migration**:
   - Always run dry-run first
   - Monitor system resources during migration
   - Keep fallback enabled initially

2. **Production**:
   - Use QDrant clustering for high availability
   - Monitor QDrant metrics and logs
   - Regular backup of QDrant data

3. **Development**:
   - Use smaller batch sizes for testing
   - Enable detailed logging
   - Test fallback scenarios

## Next Steps

After successful migration:

1. **Monitor Performance**: Track search response times and accuracy
2. **Optimize Configuration**: Tune QDrant settings for your workload
3. **Scale Infrastructure**: Consider QDrant clustering for production
4. **Clean Up**: Optionally remove embeddings from PostgreSQL to save space

## Support

For issues or questions:
1. Check application logs for detailed error messages
2. Review QDrant documentation: https://qdrant.tech/documentation/
3. Use the API endpoints to monitor system status
4. Consider the troubleshooting section above
