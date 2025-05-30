# PostgreSQL with pgvector Setup

This document explains the PostgreSQL database setup with pgvector extension support for the agent-reviewer project.

## Overview

The agent-reviewer project uses PostgreSQL with the pgvector extension to store and perform vector similarity operations on code embeddings and documentation embeddings. This setup supports the GitLab merge request review automation and documentation embedding capabilities.

## Docker Compose Configuration

The `docker-compose.yml` file includes a PostgreSQL service with the following features:

### PostgreSQL Service Features

- **Image**: `pgvector/pgvector:pg16` - PostgreSQL 16 with pgvector extension pre-installed
- **Container Name**: `agent_reviewer_postgres`
- **Port**: Configurable host port (default 5432) mapped to container port 5432
- **Networks**: Connected to `qodo_network` and `llm-network`
- **Health Check**: Monitors database availability
- **Persistent Storage**: Data persisted in `postgres_data` volume

### Environment Variables

The following environment variables configure the PostgreSQL container:

```bash
# PostgreSQL Docker Configuration
POSTGRES_DB='repopo_reviewer'          # Database name
POSTGRES_USER='postgres'               # Database user
POSTGRES_PASSWORD='postgres'           # Database password
POSTGRES_PORT='5432'                   # Host port (change if 5432 is in use)
```

### Database Connection

The agent-reviewer service connects to PostgreSQL using:

```bash
DATABASE_URL=postgresql://postgres:postgres@postgres:5432/repopo_reviewer
```

## Initialization Scripts

The `init-scripts/01-enable-pgvector.sql` script automatically:

1. Enables the pgvector extension
2. Grants necessary permissions
3. Logs successful initialization

## Vector Extension Support

The database service supports:

- **Vector Embeddings**: Store high-dimensional vectors for code and documentation
- **Similarity Search**: Perform vector similarity operations using pgvector
- **Efficient Indexing**: Create indexes on vector columns for fast retrieval

## Migration from Previous Setup

The database service is designed to work with the existing embedding processes in `agent-reviewer/src/services/database.ts`, which:

- Automatically detects pgvector extension availability
- Creates appropriate table schemas (vector vs JSONB)
- Handles both vector and fallback storage methods

## Usage

### Starting the Services

```bash
# Start all services including PostgreSQL
docker-compose up -d

# Check PostgreSQL health
docker-compose ps postgres

# View PostgreSQL logs
docker-compose logs postgres
```

### Database Access

```bash
# Connect to PostgreSQL container
docker-compose exec postgres psql -U postgres -d repopo_reviewer

# Check pgvector extension
SELECT * FROM pg_extension WHERE extname = 'vector';

# List tables
\dt
```

### Data Persistence

- Database data is stored in the `postgres_data` Docker volume
- Data persists across container restarts
- To reset the database, remove the volume: `docker volume rm gitlab_postgres_data`

## Configuration Options

### Custom Database Credentials

Update the environment variables in your `.env` file:

```bash
POSTGRES_DB='your_database_name'
POSTGRES_USER='your_username'
POSTGRES_PASSWORD='your_secure_password'
```

### Custom Port Configuration

If port 5432 is already in use on your host system, you can change the PostgreSQL port:

```bash
# In your .env file
POSTGRES_PORT='5433'  # or any other available port
```

This will map the specified host port to the container's internal port 5432. The agent-reviewer service will still connect using the internal Docker network, so no additional configuration is needed.

### External Database

To use an external PostgreSQL database instead of the Docker container:

1. Set `DATABASE_URL` to your external database connection string
2. Ensure the external database has pgvector extension installed
3. Comment out or remove the postgres service from docker-compose.yml

## Troubleshooting

### Common Issues

1. **Port Conflict**: If port 5432 is already in use:
   ```bash
   # Check what's using port 5432
   lsof -i :5432
   # or
   netstat -tulpn | grep 5432

   # Set a different port in .env file
   POSTGRES_PORT='5433'
   ```

2. **Permission Issues**: Ensure Docker has permission to create volumes
3. **Extension Not Found**: Verify the pgvector/pgvector image is being used

### Health Check Failures

If the PostgreSQL health check fails:

```bash
# Check container logs
docker-compose logs postgres

# Verify database is accepting connections
docker-compose exec postgres pg_isready -U postgres
```

### Vector Extension Issues

To verify pgvector is working:

```sql
-- Connect to database and test vector operations
SELECT '[1,2,3]'::vector;
```

## Performance Considerations

- **Vector Indexes**: The database service automatically creates appropriate indexes for vector columns
- **Memory Settings**: Default PostgreSQL settings are used; adjust for production workloads
- **Connection Pooling**: The agent-reviewer uses pg.Pool for efficient connection management

## Security Notes

- Default credentials are used for development; change for production
- Database is accessible only within Docker networks by default
- Consider using Docker secrets for production deployments
