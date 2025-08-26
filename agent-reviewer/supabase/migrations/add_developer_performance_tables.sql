-- Migration: Add Developer Performance Analytics Tables
-- Version: 1.0.0
-- Date: 2024-01-XX

BEGIN;

-- Create developer performance tracking table
CREATE TABLE IF NOT EXISTS developer_performance (
    id SERIAL PRIMARY KEY,
    developer_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    performance_date DATE NOT NULL,
    total_mrs INTEGER DEFAULT 0,
    merged_mrs INTEGER DEFAULT 0,
    success_rate DECIMAL(5,2) DEFAULT 0.00,
    avg_merge_time_hours DECIMAL(8,2) DEFAULT 0.00,
    quality_score DECIMAL(3,1) DEFAULT 0.0,
    issues_created INTEGER DEFAULT 0,
    issues_resolved INTEGER DEFAULT 0,
    avg_resolution_time_days DECIMAL(8,2) DEFAULT 0.00,
    calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(developer_id, project_id, performance_date)
);

-- Create MR quality metrics table
CREATE TABLE IF NOT EXISTS mr_quality_metrics (
    id SERIAL PRIMARY KEY,
    merge_request_id INTEGER NOT NULL,
    developer_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    quality_score DECIMAL(3,1) DEFAULT 0.0,
    review_cycles INTEGER DEFAULT 0,
    critical_issues_count INTEGER DEFAULT 0,
    fixes_implemented_count INTEGER DEFAULT 0,
    time_to_first_review_hours DECIMAL(8,2),
    time_to_merge_hours DECIMAL(8,2),
    code_complexity_score DECIMAL(3,1),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(merge_request_id)
);

-- Create Notion issues tracking table
CREATE TABLE IF NOT EXISTS notion_issues (
    id TEXT PRIMARY KEY,
    notion_page_id TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    issue_type TEXT NOT NULL DEFAULT 'Bug',
    status TEXT NOT NULL DEFAULT 'Open',
    priority_level TEXT DEFAULT 'Medium',
    creator_id INTEGER,
    assignee_id INTEGER,
    project_id INTEGER,
    merge_request_id INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create issue metrics tracking table
CREATE TABLE IF NOT EXISTS issue_metrics (
    id SERIAL PRIMARY KEY,
    notion_issue_id TEXT NOT NULL REFERENCES notion_issues(id) ON DELETE CASCADE,
    developer_id INTEGER NOT NULL,
    project_id INTEGER NOT NULL,
    action_type TEXT NOT NULL,
    action_date TIMESTAMP WITH TIME ZONE NOT NULL,
    resolution_time_days DECIMAL(8,2),
    priority_level TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create performance indexes
CREATE INDEX IF NOT EXISTS idx_developer_performance_developer_id ON developer_performance(developer_id);
CREATE INDEX IF NOT EXISTS idx_developer_performance_project_id ON developer_performance(project_id);
CREATE INDEX IF NOT EXISTS idx_developer_performance_date ON developer_performance(performance_date DESC);

-- Create quality metrics indexes
CREATE INDEX IF NOT EXISTS idx_mr_quality_metrics_developer_id ON mr_quality_metrics(developer_id);
CREATE INDEX IF NOT EXISTS idx_mr_quality_metrics_project_id ON mr_quality_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_mr_quality_metrics_quality_score ON mr_quality_metrics(quality_score DESC);

-- Create issue tracking indexes
CREATE INDEX IF NOT EXISTS idx_notion_issues_creator_id ON notion_issues(creator_id);
CREATE INDEX IF NOT EXISTS idx_notion_issues_assignee_id ON notion_issues(assignee_id);
CREATE INDEX IF NOT EXISTS idx_notion_issues_project_id ON notion_issues(project_id);
CREATE INDEX IF NOT EXISTS idx_notion_issues_status ON notion_issues(status);
CREATE INDEX IF NOT EXISTS idx_notion_issues_created_at ON notion_issues(created_at DESC);

-- Create issue metrics indexes
CREATE INDEX IF NOT EXISTS idx_issue_metrics_developer_id ON issue_metrics(developer_id);
CREATE INDEX IF NOT EXISTS idx_issue_metrics_project_id ON issue_metrics(project_id);
CREATE INDEX IF NOT EXISTS idx_issue_metrics_action_date ON issue_metrics(action_date DESC);

-- Create performance calculation function
CREATE OR REPLACE FUNCTION calculate_developer_performance()
RETURNS TRIGGER AS $$
BEGIN
    -- Recalculate performance metrics when MR data changes
    INSERT INTO developer_performance (
        developer_id, project_id, performance_date,
        total_mrs, merged_mrs, success_rate, avg_merge_time_hours
    )
    SELECT 
        NEW.author_id,
        NEW.project_id,
        CURRENT_DATE,
        COUNT(*),
        COUNT(CASE WHEN status = 'merged' THEN 1 END),
        ROUND((COUNT(CASE WHEN status = 'merged' THEN 1 END)::decimal / COUNT(*)) * 100, 2),
        AVG(EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600)
    FROM merge_request_tracking
    WHERE author_id = NEW.author_id 
      AND project_id = NEW.project_id
      AND DATE(created_at) = CURRENT_DATE
    GROUP BY author_id, project_id
    ON CONFLICT (developer_id, project_id, performance_date)
    DO UPDATE SET
        total_mrs = EXCLUDED.total_mrs,
        merged_mrs = EXCLUDED.merged_mrs,
        success_rate = EXCLUDED.success_rate,
        avg_merge_time_hours = EXCLUDED.avg_merge_time_hours,
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic performance calculation
CREATE TRIGGER trigger_calculate_performance
    AFTER INSERT OR UPDATE ON merge_request_tracking
    FOR EACH ROW
    EXECUTE FUNCTION calculate_developer_performance();

COMMIT;