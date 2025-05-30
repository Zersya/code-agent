-- Enable pgvector extension for vector similarity operations
-- This script runs automatically when the PostgreSQL container starts for the first time

-- Create the vector extension if it doesn't exist
CREATE EXTENSION IF NOT EXISTS vector;

-- Grant necessary permissions to the database user
GRANT ALL PRIVILEGES ON DATABASE repopo_reviewer TO postgres;

-- Log that the extension has been enabled
DO $$
BEGIN
    RAISE NOTICE 'pgvector extension has been enabled successfully';
END $$;
