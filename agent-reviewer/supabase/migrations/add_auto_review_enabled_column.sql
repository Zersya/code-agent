-- Migration: Add auto_review_enabled column to projects table
-- Version: 1.0.0
-- Date: 2024-09-03
-- Description: Add column to enable/disable auto review for individual projects

BEGIN;

-- Add the auto_review_enabled column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'auto_review_enabled'
    ) THEN
        ALTER TABLE projects ADD COLUMN auto_review_enabled BOOLEAN DEFAULT true;
        RAISE NOTICE 'Column auto_review_enabled added to projects table';
    ELSE
        RAISE NOTICE 'Column auto_review_enabled already exists in projects table';
    END IF;
END $$;

-- Add the updated_at column if it doesn't exist (for tracking changes)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'projects' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE projects ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        RAISE NOTICE 'Column updated_at added to projects table';
    ELSE
        RAISE NOTICE 'Column updated_at already exists in projects table';
    END IF;
END $$;

-- Update existing projects to have auto_review_enabled set to true (default)
UPDATE projects 
SET auto_review_enabled = true 
WHERE auto_review_enabled IS NULL;

-- Create index for better performance on auto_review_enabled queries
CREATE INDEX IF NOT EXISTS idx_projects_auto_review_enabled ON projects(auto_review_enabled);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at timestamp
DROP TRIGGER IF EXISTS update_projects_updated_at ON projects;
CREATE TRIGGER update_projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- Add a comment to document the new column
COMMENT ON COLUMN projects.auto_review_enabled IS 'Controls whether automatic merge request reviews are enabled for this project. Default is true.';