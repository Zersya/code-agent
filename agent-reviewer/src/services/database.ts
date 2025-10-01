import { Pool } from 'pg';
import dotenv from 'dotenv';
import { CodeEmbedding, ProjectMetadata, EmbeddingBatch, DocumentationSource, DocumentationEmbedding, ProjectDocumentationMapping } from '../models/embedding.js';
import { WebhookProcessingRecord, WebhookProcessingStatus } from '../models/webhook.js';

import { DeveloperPerformanceMetrics, MRQualityMetrics, NotionIssue, NotionTask, TaskMRMapping, FeatureCompletionRate } from '../types/performance.js';
import { WhatsAppConfigurationRecord } from '../models/whatsapp.js';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/repopo_reviewer';

class DatabaseService {
  private pool: Pool;
  private initialized: boolean = false;

  constructor() {
    this.pool = new Pool({
      connectionString: DATABASE_URL,
    });
  }

  /**
   * Get a database client from the pool
   * This is useful for transaction operations
   */
  async getClient() {
    return await this.pool.connect();
  }

  /**
   * Execute a query with parameters
   */
  async query(text: string, params?: any[]) {
    return await this.pool.query(text, params);
  }

  /**
   * Check if content contains binary data that might cause database issues
   */
  private containsBinaryData(content: string): boolean {
    // Check for null bytes which cause PostgreSQL errors
    if (content.includes('\u0000')) {
      return true;
    }

    // Check for other non-printable characters that might indicate binary data
    const nonPrintablePattern = /[\x00-\x08\x0B\x0C\x0E-\x1F]/;
    if (nonPrintablePattern.test(content)) {
      return true;
    }

    return false;
  }

  /**
   * Sanitize content to remove problematic characters for database storage
   */
  private sanitizeContent(content: string): string {
    if (!content) return '';

    if (this.containsBinaryData(content)) {
      return '[BINARY CONTENT REMOVED]';
    }

    return content;
  }

  async connect(): Promise<void> {
    try {
      // Test the connection
      const client = await this.pool.connect();
      client.release();
      console.log('Connected to PostgreSQL');

      // Initialize the database schema if not already done
      if (!this.initialized) {
        try {
          await this.initializeSchema();
          this.initialized = true;
        } catch (schemaError) {
          console.error('Failed to initialize schema, but continuing:', schemaError);
          // We'll still mark as initialized to avoid repeated attempts
          this.initialized = true;
        }
      }
    } catch (error) {
      console.error('Failed to connect to PostgreSQL', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.pool.end();
    console.log('Disconnected from PostgreSQL');
  }

  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    try {
      await this.initializeSchema();
      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    }
  }

  async initializeSchema(): Promise<void> {
    const client = await this.pool.connect();
    let vectorExtensionAvailable = false;

    try {
      // Check if the vector extension is available without trying to create it
      try {
        const extensionCheck = await client.query(`
          SELECT 1 FROM pg_available_extensions WHERE name = 'vector'
        `);

      // Add new columns to existing merge_request_reviews table if they don't exist (migration)
      try {
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'automated' CHECK (reviewer_type IN ('automated', 'manual'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS critical_issues_count INTEGER DEFAULT 0
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS fixes_implemented_count INTEGER DEFAULT 0
        `);
      } catch (error) {
        // Columns might already exist, ignore the error
        console.log('Review tracking columns might already exist:', error);
      }

      // Add new columns to existing merge_request_reviews table if they don't exist (migration)
      try {
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'automated' CHECK (reviewer_type IN ('automated', 'manual'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS critical_issues_count INTEGER DEFAULT 0
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS fixes_implemented_count INTEGER DEFAULT 0
        `);
      } catch (error) {
        // Columns might already exist, ignore the error
        console.log('Review tracking columns might already exist:', error);
      }

      // Add new columns to existing merge_request_reviews table if they don't exist (migration)
      try {
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'automated' CHECK (reviewer_type IN ('automated', 'manual'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS critical_issues_count INTEGER DEFAULT 0
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS fixes_implemented_count INTEGER DEFAULT 0
        `);
      } catch (error) {
        // Columns might already exist, ignore the error
        console.log('Review tracking columns might already exist:', error);
      }
        vectorExtensionAvailable = extensionCheck.rows.length > 0;

        if (vectorExtensionAvailable) {
          console.log('Vector extension is available');
        } else {
          console.warn('Vector extension is not available. Vector similarity search will not be available.');
          console.warn('You may need to install the pgvector extension on your PostgreSQL server');
        }
      } catch (error) {
        console.warn('Could not check for vector extension:', error);
        vectorExtensionAvailable = false;
      }

      // Create projects table
      await client.query(`
        CREATE TABLE IF NOT EXISTS projects (
          project_id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          url TEXT,
          default_branch TEXT,
          last_processed_commit TEXT,
          last_processed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          last_reembedding_at TIMESTAMP WITH TIME ZONE,
          auto_review_enabled BOOLEAN DEFAULT true
        )
      `);

      // Add the last_reembedding_at column if it doesn't exist (migration)
      try {
        await client.query(`
          ALTER TABLE projects
          ADD COLUMN IF NOT EXISTS last_reembedding_at TIMESTAMP WITH TIME ZONE
        `);
      } catch (error) {
        // Column might already exist, ignore the error
        console.log('Column last_reembedding_at might already exist:', error);
      }

      // Add the auto_review_enabled column if it doesn't exist (migration)
      try {
        await client.query(`
          ALTER TABLE projects
          ADD COLUMN IF NOT EXISTS auto_review_enabled BOOLEAN DEFAULT true
        `);
      } catch (error) {
        // Column might already exist, ignore the error
        console.log('Column auto_review_enabled might already exist:', error);
      }

      // Add the auto_approve_enabled column if it doesn't exist (migration)
      try {
        await client.query(`
          ALTER TABLE projects
          ADD COLUMN IF NOT EXISTS auto_approve_enabled BOOLEAN DEFAULT false
        `);
      } catch (error) {
        // Column might already exist, ignore the error
        console.log('Column auto_approve_enabled might already exist:', error);
      }

      // Create embeddings table based on vector extension availability
      if (vectorExtensionAvailable) {
        try {
          // Try to create the extension
          await client.query('CREATE EXTENSION IF NOT EXISTS vector');
          console.log('Vector extension enabled');

          // Create embeddings table with vector type
          await client.query(`
            CREATE TABLE IF NOT EXISTS embeddings (
              id SERIAL PRIMARY KEY,
              project_id INTEGER NOT NULL,
              repository_url TEXT,
              file_path TEXT NOT NULL,
              content TEXT,
              embedding vector(1024),
              language TEXT,
              commit_id TEXT NOT NULL,
              branch TEXT,
              created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
              UNIQUE(project_id, file_path)
            )
          `);

      // Add new columns to existing merge_request_reviews table if they don't exist (migration)
      try {
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'automated' CHECK (reviewer_type IN ('automated', 'manual'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS critical_issues_count INTEGER DEFAULT 0
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS fixes_implemented_count INTEGER DEFAULT 0
        `);
      } catch (error) {
        // Columns might already exist, ignore the error
        console.log('Review tracking columns might already exist:', error);
      }

      // Add new columns to existing merge_request_reviews table if they don't exist (migration)
      try {
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS reviewer_type TEXT NOT NULL DEFAULT 'automated' CHECK (reviewer_type IN ('automated', 'manual'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected'))
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS critical_issues_count INTEGER DEFAULT 0
        `);
        await client.query(`
          ALTER TABLE merge_request_reviews
          ADD COLUMN IF NOT EXISTS fixes_implemented_count INTEGER DEFAULT 0
        `);
      } catch (error) {
        // Columns might already exist, ignore the error
        console.log('Review tracking columns might already exist:', error);
      }

          // Try to create a vector index
          try {
            await client.query('CREATE INDEX IF NOT EXISTS idx_embeddings_embedding ON embeddings USING ivfflat (embedding vector_cosine_ops)');
            console.log('Vector index created successfully');
          } catch (error) {
            console.warn('Could not create vector index, but continuing:', error);
          }
        } catch (error) {
          console.warn('Could not create embeddings table with vector type, falling back to JSONB:', error);
          vectorExtensionAvailable = false;
        }
      }

      // If vector extension is not available or failed, create table with JSONB
      if (!vectorExtensionAvailable) {
        await client.query(`
          CREATE TABLE IF NOT EXISTS embeddings (
            id SERIAL PRIMARY KEY,
            project_id INTEGER NOT NULL,
            repository_url TEXT,
            file_path TEXT NOT NULL,
            content TEXT,
            embedding JSONB,
            language TEXT,
            commit_id TEXT NOT NULL,
            branch TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            UNIQUE(project_id, file_path)
          )
        `);
      }

      // Create batches table
      await client.query(`
        CREATE TABLE IF NOT EXISTS batches (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          commit_id TEXT NOT NULL,
          branch TEXT,
          files JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create merge request reviews table for tracking review history
      await client.query(`
        CREATE TABLE IF NOT EXISTS merge_request_reviews (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          last_reviewed_commit_sha TEXT NOT NULL,
          review_comment_id INTEGER,
          reviewer_type TEXT NOT NULL DEFAULT 'automated' CHECK (reviewer_type IN ('automated', 'manual')),
          status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'approved', 'rejected')),
          critical_issues_count INTEGER DEFAULT 0,
          fixes_implemented_count INTEGER DEFAULT 0,
          reviewed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(project_id, merge_request_iid)
        )
      `);

      // Create webhook processing table for duplicate prevention
      await client.query(`
        CREATE TABLE IF NOT EXISTS webhook_processing (
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
        )
      `);

      // Create documentation sources table
      await client.query(`
        CREATE TABLE IF NOT EXISTS documentation_sources (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          url TEXT NOT NULL,
          framework TEXT NOT NULL,
          version TEXT,
          is_active BOOLEAN DEFAULT true,
          refresh_interval_days INTEGER DEFAULT 7,
          last_fetched_at TIMESTAMP WITH TIME ZONE,
          last_embedded_at TIMESTAMP WITH TIME ZONE,
          fetch_status TEXT DEFAULT 'pending',
          fetch_error TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Create documentation embeddings table
      if (vectorExtensionAvailable) {
        // create table embedding jobs
        await client.query(`
          CREATE TABLE IF NOT EXISTS embedding_jobs (
            id TEXT PRIMARY KEY,
            repository_url TEXT NOT NULL,
            processing_id TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL,
            error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            priority INTEGER NOT NULL DEFAULT 5,
            project_id INTEGER NOT NULL,
            is_reembedding BOOLEAN DEFAULT FALSE
          )
        `);

        // Add the is_reembedding column if it doesn't exist (migration)
        try {
          await client.query(`
            ALTER TABLE embedding_jobs
            ADD COLUMN IF NOT EXISTS is_reembedding BOOLEAN DEFAULT FALSE
          `);
        } catch (error) {
          // Column might already exist, ignore the error
          console.log('Column is_reembedding might already exist:', error);
        }

        // Add the scheduled_for column if it doesn't exist (migration for scheduling)
        try {
          await client.query(`
            ALTER TABLE embedding_jobs
            ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMP WITH TIME ZONE
          `);
        } catch (error) {
          // Column might already exist, ignore the error
          console.log('Column scheduled_for might already exist:', error);
        }

        // Create documentation_jobs table if it doesn't exist
        await client.query(`
          CREATE TABLE IF NOT EXISTS documentation_jobs (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            source_url TEXT NOT NULL,
            processing_id TEXT NOT NULL UNIQUE,
            status TEXT NOT NULL,
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL,
            error TEXT,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            started_at TIMESTAMP WITH TIME ZONE,
            completed_at TIMESTAMP WITH TIME ZONE,
            priority INTEGER NOT NULL DEFAULT 5
          )
        `);


        await client.query(`
          CREATE TABLE IF NOT EXISTS documentation_embeddings (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES documentation_sources(id) ON DELETE CASCADE,
            section TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding vector(1024),
            url TEXT,
            framework TEXT NOT NULL,
            version TEXT,
            keywords TEXT[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
      } else {
        await client.query(`
          CREATE TABLE IF NOT EXISTS documentation_embeddings (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL REFERENCES documentation_sources(id) ON DELETE CASCADE,
            section TEXT NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            embedding JSONB,
            url TEXT,
            framework TEXT NOT NULL,
            version TEXT,
            keywords TEXT[],
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
      }

      // Create project documentation mappings table
      await client.query(`
        CREATE TABLE IF NOT EXISTS project_documentation_mappings (
          project_id INTEGER NOT NULL,
          source_id TEXT NOT NULL REFERENCES documentation_sources(id) ON DELETE CASCADE,
          is_enabled BOOLEAN DEFAULT true,
          priority INTEGER DEFAULT 1,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          PRIMARY KEY (project_id, source_id)
        )
      `);

      // Create merge request tracking table
      await client.query(`
        CREATE TABLE IF NOT EXISTS merge_request_tracking (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          merge_request_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          author_id INTEGER NOT NULL,
          author_username TEXT NOT NULL,
          author_name TEXT,
          source_branch TEXT NOT NULL,
          target_branch TEXT NOT NULL,
          status TEXT NOT NULL,
          action TEXT NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE NOT NULL,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          merged_at TIMESTAMP WITH TIME ZONE,
          closed_at TIMESTAMP WITH TIME ZONE,
          merge_commit_sha TEXT,
          repository_url TEXT,
          web_url TEXT,
          is_repopo_event BOOLEAN DEFAULT FALSE,
          repopo_token TEXT,
          UNIQUE(project_id, merge_request_iid)
        )
      `);
      // Ensure approval timestamp column exists for MRs
      await client.query(`ALTER TABLE merge_request_tracking ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`);


      // Create user MR statistics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS user_mr_statistics (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL,
          username TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          total_mrs_created INTEGER DEFAULT 0,
          total_mrs_merged INTEGER DEFAULT 0,
          total_mrs_closed INTEGER DEFAULT 0,
          total_mrs_rejected INTEGER DEFAULT 0,
          avg_merge_time_hours DECIMAL(10,2),
          last_mr_created_at TIMESTAMP WITH TIME ZONE,
          last_mr_merged_at TIMESTAMP WITH TIME ZONE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(user_id, project_id)
        )
      `);

      // Create WhatsApp configurations table
      await client.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_configurations (
          id SERIAL PRIMARY KEY,
          gitlab_username TEXT NOT NULL UNIQUE,
          whatsapp_number TEXT NOT NULL,
          is_active BOOLEAN DEFAULT true,
          notification_types JSONB DEFAULT '["merge_request_created", "merge_request_assigned"]'::jsonb,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);


      await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_status ON embedding_jobs(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_processing_id ON embedding_jobs(processing_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_embedding_jobs_project_id ON embedding_jobs(project_id)');

      // Create indexes if they don't exist
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_jobs_status ON documentation_jobs(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_jobs_processing_id ON documentation_jobs(processing_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_jobs_source_id ON documentation_jobs(source_id)');

      // Create indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_embeddings_project_id ON embeddings(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_embeddings_commit_id ON embeddings(commit_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_batches_project_id_commit_id ON batches(project_id, commit_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_processing_webhook_key ON webhook_processing(webhook_key)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_processing_status ON webhook_processing(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_webhook_processing_started_at ON webhook_processing(started_at)');

      // Create WhatsApp configurations indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_whatsapp_configurations_gitlab_username ON whatsapp_configurations(gitlab_username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_whatsapp_configurations_is_active ON whatsapp_configurations(is_active)');

      // Documentation indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_sources_framework ON documentation_sources(framework)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_sources_active ON documentation_sources(is_active)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_embeddings_source_id ON documentation_embeddings(source_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_documentation_embeddings_framework ON documentation_embeddings(framework)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_project_documentation_mappings_project_id ON project_documentation_mappings(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_project_documentation_mappings_enabled ON project_documentation_mappings(is_enabled)');

      // Merge request tracking indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_mr_tracking_author ON merge_request_tracking(author_username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_mr_tracking_project ON merge_request_tracking(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_mr_tracking_status ON merge_request_tracking(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_mr_tracking_created_at ON merge_request_tracking(created_at)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_mr_stats_username ON user_mr_statistics(username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_user_mr_stats_project ON user_mr_statistics(project_id)');

      // Create developer performance tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS developer_performance (
          id SERIAL PRIMARY KEY,
          username TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          date DATE NOT NULL,
          mrs_created INTEGER DEFAULT 0,
          mrs_merged INTEGER DEFAULT 0,
          lines_added INTEGER DEFAULT 0,
          lines_removed INTEGER DEFAULT 0,
          commits_count INTEGER DEFAULT 0,
          avg_review_time_hours DECIMAL(10,2),
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(username, project_id, date)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS mr_quality_metrics (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          username TEXT NOT NULL,
          quality_score DECIMAL(5,2) NOT NULL,
          review_cycles INTEGER NOT NULL,
          critical_issues_count INTEGER NOT NULL,
          fixes_implemented_count INTEGER NOT NULL,
          time_to_first_review_hours DECIMAL(10,2),
          time_to_merge_hours DECIMAL(10,2),
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(project_id, merge_request_iid)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS notion_issues (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          issue_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          status TEXT,
          priority TEXT,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(project_id, merge_request_iid, issue_id)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS issue_metrics (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          issue_id TEXT NOT NULL,
          username TEXT NOT NULL,
          status TEXT NOT NULL,
          priority TEXT,
          resolution_time_days DECIMAL(10,2),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          resolved_at TIMESTAMP WITH TIME ZONE,
          UNIQUE(project_id, issue_id)
        )
      `);

      // Create feature completion rate tables
      await client.query(`
        CREATE TABLE IF NOT EXISTS notion_tasks (
          id SERIAL PRIMARY KEY,
          notion_page_id TEXT NOT NULL UNIQUE,
          title TEXT NOT NULL,
          status TEXT NOT NULL,
          assignee_id INTEGER,
          assignee_username TEXT,
          assignee_name TEXT,
          project_id INTEGER,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          completed_at TIMESTAMP WITH TIME ZONE,
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
      `);

      // Ensure timing columns exist for Notion tasks
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS estimation_start TIMESTAMPTZ`);
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS estimation_end TIMESTAMPTZ`);
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS developer_start TIMESTAMPTZ`);
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS developer_end TIMESTAMPTZ`);
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS ready_to_test_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS notion_created_at TIMESTAMPTZ`);
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS task_type TEXT`);
      await client.query(`ALTER TABLE notion_tasks ADD COLUMN IF NOT EXISTS points INTEGER`);



      await client.query(`
        CREATE TABLE IF NOT EXISTS task_mr_mappings (
          id SERIAL PRIMARY KEY,
          notion_task_id INTEGER NOT NULL REFERENCES notion_tasks(id) ON DELETE CASCADE,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          merge_request_id INTEGER NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(notion_task_id, project_id, merge_request_iid)
        )
      `);

      await client.query(`
        CREATE TABLE IF NOT EXISTS feature_completion_rates (
          id SERIAL PRIMARY KEY,
          developer_id INTEGER,
          username TEXT NOT NULL,
          project_id INTEGER NOT NULL,
          month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
          year INTEGER NOT NULL CHECK (year >= 2020),
          total_tasks INTEGER NOT NULL DEFAULT 0,
          tasks_with_mrs INTEGER NOT NULL DEFAULT 0,
          completed_tasks INTEGER NOT NULL DEFAULT 0,
          completion_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
          calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          UNIQUE(username, project_id, month, year)
        )
      `);

      // Create indexes for developer performance tables
      await client.query('CREATE INDEX IF NOT EXISTS idx_developer_performance_username ON developer_performance(username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_developer_performance_project ON developer_performance(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_developer_performance_date ON developer_performance(date)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_mr_quality_metrics_project ON mr_quality_metrics(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_mr_quality_metrics_username ON mr_quality_metrics(username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_notion_issues_project ON notion_issues(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_notion_issues_mr ON notion_issues(merge_request_iid)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_issue_metrics_project ON issue_metrics(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_issue_metrics_username ON issue_metrics(username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_issue_metrics_status ON issue_metrics(status)');

      // Create indexes for feature completion rate tables
      await client.query('CREATE INDEX IF NOT EXISTS idx_notion_tasks_page_id ON notion_tasks(notion_page_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_notion_tasks_assignee ON notion_tasks(assignee_username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_notion_tasks_project ON notion_tasks(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_notion_tasks_status ON notion_tasks(status)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_task_mr_mappings_task ON task_mr_mappings(notion_task_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_task_mr_mappings_mr ON task_mr_mappings(project_id, merge_request_iid)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_feature_completion_rates_developer ON feature_completion_rates(username)');
      // Bug fix lead time metrics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS bug_fix_lead_times (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          merge_request_id INTEGER NOT NULL,
          author_id INTEGER,
          author_username TEXT,
          notion_task_id INTEGER REFERENCES notion_tasks(id) ON DELETE SET NULL,
          notion_page_id TEXT,
          issue_type TEXT,
          notion_created_at TIMESTAMPTZ,
          merged_at TIMESTAMPTZ,
          lead_time_hours DECIMAL(10,2),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(project_id, merge_request_iid, notion_task_id)
        )
      `);

      // Feature completion lead time metrics table
      await client.query(`
        CREATE TABLE IF NOT EXISTS feature_completion_lead_times (
          id SERIAL PRIMARY KEY,
          project_id INTEGER NOT NULL,
          merge_request_iid INTEGER NOT NULL,
          merge_request_id INTEGER NOT NULL,
          author_id INTEGER,
          author_username TEXT,
          notion_task_id INTEGER REFERENCES notion_tasks(id) ON DELETE SET NULL,
          notion_page_id TEXT,
          issue_type TEXT,
          notion_created_at TIMESTAMPTZ,
          merged_at TIMESTAMPTZ,
          lead_time_hours DECIMAL(10,2),
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(project_id, merge_request_iid, notion_task_id)
        )
      `);

      await client.query('CREATE INDEX IF NOT EXISTS idx_bflt_project ON bug_fix_lead_times(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_bflt_author ON bug_fix_lead_times(author_username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_bflt_merged_at ON bug_fix_lead_times(merged_at)');

      // Feature completion lead time indexes
      await client.query('CREATE INDEX IF NOT EXISTS idx_fclt_project ON feature_completion_lead_times(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_fclt_author ON feature_completion_lead_times(author_username)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_fclt_merged_at ON feature_completion_lead_times(merged_at)');

      await client.query('CREATE INDEX IF NOT EXISTS idx_feature_completion_rates_project ON feature_completion_rates(project_id)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_feature_completion_rates_date ON feature_completion_rates(year, month)');

      // Monthly reports table
      await client.query(`
        CREATE TABLE IF NOT EXISTS monthly_reports (
          id SERIAL PRIMARY KEY,
          month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
          year INTEGER NOT NULL CHECK (year >= 2020),
          report_data JSONB NOT NULL,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          created_by TEXT,
          UNIQUE(month, year)
        )
      `);

      await client.query('CREATE INDEX IF NOT EXISTS idx_monthly_reports_date ON monthly_reports(year, month)');
      await client.query('CREATE INDEX IF NOT EXISTS idx_monthly_reports_created_by ON monthly_reports(created_by)');

      console.log('Database schema initialized');
    } catch (error) {
      console.error('Failed to initialize database schema:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveEmbedding(embedding: CodeEmbedding): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Sanitize content to prevent database errors with binary data
      const sanitizedContent = this.sanitizeContent(embedding.content);

      // Check if we're using pgvector or JSONB for embeddings
      const res = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'embedding'
      `);

      const isVector = res.rows.length > 0 && res.rows[0].data_type === 'vector';

      if (isVector) {
        await client.query(`
          INSERT INTO embeddings (
            project_id, repository_url, file_path, content, embedding,
            language, commit_id, branch, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10)
          ON CONFLICT (project_id, file_path)
          DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            language = EXCLUDED.language,
            commit_id = EXCLUDED.commit_id,
            branch = EXCLUDED.branch,
            updated_at = EXCLUDED.updated_at
        `, [
          embedding.projectId,
          embedding.repositoryUrl,
          embedding.filePath,
          sanitizedContent,
          embedding.embedding,
          embedding.language,
          embedding.commitId,
          embedding.branch,
          embedding.createdAt,
          embedding.updatedAt
        ]);
      } else {
        // Fallback to JSONB if vector type is not available
        await client.query(`
          INSERT INTO embeddings (
            project_id, repository_url, file_path, content, embedding,
            language, commit_id, branch, created_at, updated_at
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          ON CONFLICT (project_id, file_path)
          DO UPDATE SET
            content = EXCLUDED.content,
            embedding = EXCLUDED.embedding,
            language = EXCLUDED.language,
            commit_id = EXCLUDED.commit_id,
            branch = EXCLUDED.branch,
            updated_at = EXCLUDED.updated_at
        `, [
          embedding.projectId,
          embedding.repositoryUrl,
          embedding.filePath,
          sanitizedContent,
          JSON.stringify(embedding.embedding),
          embedding.language,
          embedding.commitId,
          embedding.branch,
          embedding.createdAt,
          embedding.updatedAt
        ]);
      }
    } catch (error) {
      console.error('Error saving embedding:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveEmbeddings(embeddings: CodeEmbedding[]): Promise<void> {
    if (embeddings.length === 0) {
      console.log('saveEmbeddings called with empty array, skipping');
      return;
    }

    console.log(`saveEmbeddings called with ${embeddings.length} embeddings for project ${embeddings[0]?.projectId}`);
    const client = await this.pool.connect();

    try {
      // Check if we're using pgvector or JSONB for embeddings
      const res = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'embedding'
      `);

      const isVector = res.rows.length > 0 && res.rows[0].data_type === 'vector';

      // Start a transaction
      await client.query('BEGIN');

      for (const embedding of embeddings) {
        // Sanitize content to prevent database errors with binary data
        const sanitizedContent = this.sanitizeContent(embedding.content);

        if (isVector) {
          await client.query(`
            INSERT INTO embeddings (
              project_id, repository_url, file_path, content, embedding,
              language, commit_id, branch, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5::vector, $6, $7, $8, $9, $10)
            ON CONFLICT (project_id, file_path)
            DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              language = EXCLUDED.language,
              commit_id = EXCLUDED.commit_id,
              branch = EXCLUDED.branch,
              updated_at = EXCLUDED.updated_at
          `, [
            embedding.projectId,
            embedding.repositoryUrl,
            embedding.filePath,
            sanitizedContent,
            embedding.embedding,
            embedding.language,
            embedding.commitId,
            embedding.branch,
            embedding.createdAt,
            embedding.updatedAt
          ]);
        } else {
          // Fallback to JSONB if vector type is not available
          await client.query(`
            INSERT INTO embeddings (
              project_id, repository_url, file_path, content, embedding,
              language, commit_id, branch, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (project_id, file_path)
            DO UPDATE SET
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              language = EXCLUDED.language,
              commit_id = EXCLUDED.commit_id,
              branch = EXCLUDED.branch,
              updated_at = EXCLUDED.updated_at
          `, [
            embedding.projectId,
            embedding.repositoryUrl,
            embedding.filePath,
            sanitizedContent,
            JSON.stringify(embedding.embedding),
            embedding.language,
            embedding.commitId,
            embedding.branch,
            embedding.createdAt,
            embedding.updatedAt
          ]);
        }
      }

      // Commit the transaction
      await client.query('COMMIT');
      console.log(`Successfully saved ${embeddings.length} embeddings to database for project ${embeddings[0]?.projectId}`);
    } catch (error) {
      // Rollback the transaction in case of error
      await client.query('ROLLBACK');
      console.error('Error saving embeddings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveBatch(batch: EmbeddingBatch): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Sanitize file contents to prevent database errors with binary data
      const sanitizedFiles = batch.files.map(file => ({
        ...file,
        content: this.sanitizeContent(file.content)
      }));

      await client.query(`
        INSERT INTO batches (project_id, commit_id, branch, files, created_at)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        batch.projectId,
        batch.commitId,
        batch.branch,
        JSON.stringify(sanitizedFiles),
        batch.createdAt
      ]);
    } catch (error) {
      console.error('Error saving batch:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async updateProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        INSERT INTO projects (
          project_id, name, description, url, default_branch,
          last_processed_commit, last_processed_at, last_reembedding_at,
          auto_review_enabled, auto_approve_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (project_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          url = EXCLUDED.url,
          default_branch = EXCLUDED.default_branch,
          last_processed_commit = EXCLUDED.last_processed_commit,
          last_processed_at = EXCLUDED.last_processed_at,
          last_reembedding_at = EXCLUDED.last_reembedding_at,
          auto_review_enabled = COALESCE(EXCLUDED.auto_review_enabled, projects.auto_review_enabled),
          auto_approve_enabled = COALESCE(EXCLUDED.auto_approve_enabled, projects.auto_approve_enabled)
      `, [
        metadata.projectId,
        metadata.name,
        metadata.description,
        metadata.url,
        metadata.defaultBranch,
        metadata.lastProcessedCommit,
        metadata.lastProcessedAt,
        metadata.lastReembeddingAt,
        metadata.autoReviewEnabled !== undefined ? metadata.autoReviewEnabled : true,
        metadata.autoApproveEnabled !== undefined ? metadata.autoApproveEnabled : false
      ]);
    } catch (error) {
      console.error('Error updating project metadata:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getProjectMetadata(projectId: number): Promise<ProjectMetadata | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          project_id as "projectId",
          name,
          description,
          url,
          default_branch as "defaultBranch",
          last_processed_commit as "lastProcessedCommit",
          last_processed_at as "lastProcessedAt",
          last_reembedding_at as "lastReembeddingAt",
          auto_review_enabled as "autoReviewEnabled",
          auto_approve_enabled as "autoApproveEnabled"
        FROM projects
        WHERE project_id = $1
      `, [projectId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as ProjectMetadata;
    } catch (error) {
      console.error('Error getting project metadata:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getEmbeddingsByProject(projectId: number): Promise<CodeEmbedding[]> {
    const client = await this.pool.connect();

    try {
      // Check if we're using pgvector or JSONB for embeddings
      const typeRes = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'embedding'
      `);

      const isVector = typeRes.rows.length > 0 && typeRes.rows[0].data_type === 'vector';

      const result = await client.query(`
        SELECT
          project_id as "projectId",
          repository_url as "repositoryUrl",
          file_path as "filePath",
          content,
          embedding,
          language,
          commit_id as "commitId",
          branch,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM embeddings
        WHERE project_id = $1
      `, [projectId]);

      // Convert embedding from JSONB to array if needed
      return result.rows.map((row: any) => {
        if (!isVector && typeof row.embedding === 'string') {
          row.embedding = JSON.parse(row.embedding);
        }
        return row as CodeEmbedding;
      });
    } catch (error) {
      console.error('Error getting embeddings by project:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if a project has any embeddings
   * @param projectId The ID of the project
   * @returns True if the project has embeddings, false otherwise
   */
  async hasEmbeddings(projectId: number): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT COUNT(*) as count
        FROM embeddings
        WHERE project_id = $1
        LIMIT 1
      `, [projectId]);

      return result.rows[0].count > 0;
    } catch (error) {
      console.error('Error checking if project has embeddings:', error);
      return false;
    } finally {
      client.release();
    }
  }

  async getEmbeddingsByCommit(projectId: number, commitId: string): Promise<CodeEmbedding[]> {
    const client = await this.pool.connect();

    try {
      // Check if we're using pgvector or JSONB for embeddings
      const typeRes = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'embedding'
      `);

      const isVector = typeRes.rows.length > 0 && typeRes.rows[0].data_type === 'vector';

      const result = await client.query(`
        SELECT
          project_id as "projectId",
          repository_url as "repositoryUrl",
          file_path as "filePath",
          content,
          embedding,
          language,
          commit_id as "commitId",
          branch,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM embeddings
        WHERE project_id = $1 AND commit_id = $2
      `, [projectId, commitId]);

      // Convert embedding from JSONB to array if needed
      return result.rows.map((row: any) => {
        if (!isVector && typeof row.embedding === 'string') {
          row.embedding = JSON.parse(row.embedding);
        }
        return row as CodeEmbedding;
      });
    } catch (error) {
      console.error('Error getting embeddings by commit:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchSimilarCode(projectId: number, embedding: number[], limit: number = 10): Promise<CodeEmbedding[]> {
    const client = await this.pool.connect();

    try {
      // Check if we're using pgvector or JSONB for embeddings
      const typeRes = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'embedding'
      `);

      const isVector = typeRes.rows.length > 0 && typeRes.rows[0].data_type === 'vector';

      if (isVector) {
        try {
          // Try to use pgvector for similarity search
          const result = await client.query(`
            SELECT
              project_id as "projectId",
              repository_url as "repositoryUrl",
              file_path as "filePath",
              content,
              embedding,
              language,
              commit_id as "commitId",
              branch,
              created_at as "createdAt",
              updated_at as "updatedAt",
              1 - (embedding <=> $1) as similarity
            FROM embeddings
            WHERE project_id = $2
            ORDER BY embedding <=> $1
            LIMIT $3
          `, [embedding, projectId, limit]);

          return result.rows as CodeEmbedding[];
        } catch (error) {
          console.warn('Vector similarity search failed, falling back to basic filtering:', error);
        }
      }

      // Fallback to basic filtering if vector search is not available
      console.warn('Vector similarity search not available, falling back to basic filtering');

      const result = await client.query(`
        SELECT
          project_id as "projectId",
          repository_url as "repositoryUrl",
          file_path as "filePath",
          content,
          embedding,
          language,
          commit_id as "commitId",
          branch,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM embeddings
        WHERE project_id = $1
        ORDER BY updated_at DESC
        LIMIT $2
      `, [projectId, limit]);

      // Convert embedding from JSONB to array if needed
      return result.rows.map((row: any) => {
        if (!isVector && typeof row.embedding === 'string') {
          row.embedding = JSON.parse(row.embedding);
        }
        return row as CodeEmbedding;
      });
    } catch (error) {
      console.error('Error searching similar code:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async searchSimilarCodeAcrossProjects(embedding: number[], limit: number = 10): Promise<CodeEmbedding[]> {
    const client = await this.pool.connect();

    try {
      // Check if we're using pgvector or JSONB for embeddings
      const typeRes = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'embedding'
      `);

      const isVector = typeRes.rows.length > 0 && typeRes.rows[0].data_type === 'vector';

      if (isVector) {
        try {
          // Try to use pgvector for similarity search across all projects
          const result = await client.query(`
            SELECT
              project_id as "projectId",
              repository_url as "repositoryUrl",
              file_path as "filePath",
              content,
              embedding,
              language,
              commit_id as "commitId",
              branch,
              created_at as "createdAt",
              updated_at as "updatedAt",
              1 - (embedding <=> $1) as similarity
            FROM embeddings
            ORDER BY embedding <=> $1
            LIMIT $2
          `, [embedding, limit]);

          return result.rows as CodeEmbedding[];
        } catch (error) {
          console.warn('Vector similarity search failed, falling back to basic filtering:', error);
        }
      }

      // Fallback to basic filtering if vector search is not available
      console.warn('Vector similarity search not available, falling back to basic filtering');

      const result = await client.query(`
        SELECT
          project_id as "projectId",
          repository_url as "repositoryUrl",
          file_path as "filePath",
          content,
          embedding,
          language,
          commit_id as "commitId",
          branch,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM embeddings
        ORDER BY updated_at DESC
        LIMIT $1
      `, [limit]);

      // Convert embedding from JSONB to array if needed
      return result.rows.map((row: any) => {
        if (!isVector && typeof row.embedding === 'string') {
          row.embedding = JSON.parse(row.embedding);
        }
        return row as CodeEmbedding;
      });
    } catch (error) {
      console.error('Error searching similar code across projects:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async getAllProjects(): Promise<ProjectMetadata[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          project_id as "projectId",
          name,
          description,
          url,
          default_branch as "defaultBranch",
          last_processed_commit as "lastProcessedCommit",
          last_processed_at as "lastProcessedAt",
          last_reembedding_at as "lastReembeddingAt",
          auto_review_enabled as "autoReviewEnabled",
          auto_approve_enabled as "autoApproveEnabled"
        FROM projects
        ORDER BY name
      `);

      return result.rows as ProjectMetadata[];
    } catch (error) {
      console.error('Error getting all projects:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete all embeddings for a specific project
   * @param projectId The ID of the project
   * @returns Number of deleted embeddings
   */
  async deleteProjectEmbeddings(projectId: number): Promise<number> {
    const client = await this.pool.connect();

    try {
      console.log(`Deleting all embeddings for project ${projectId}`);

      const result = await client.query(`
        DELETE FROM embeddings
        WHERE project_id = $1
      `, [projectId]);

      const deletedCount = result.rowCount || 0;
      console.log(`Deleted ${deletedCount} embeddings for project ${projectId}`);

      return deletedCount;
    } catch (error) {
      console.error('Error deleting project embeddings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete all batches for a specific project
   * @param projectId The ID of the project
   * @returns Number of deleted batches
   */
  async deleteProjectBatches(projectId: number): Promise<number> {
    const client = await this.pool.connect();

    try {
      console.log(`Deleting all batches for project ${projectId}`);

      const result = await client.query(`
        DELETE FROM batches
        WHERE project_id = $1
      `, [projectId]);

      const deletedCount = result.rowCount || 0;
      console.log(`Deleted ${deletedCount} batches for project ${projectId}`);

      return deletedCount;
    } catch (error) {
      console.error('Error deleting project batches:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Clear all embedding data for a project (embeddings and batches)
   * This is used before re-embedding a project
   * @param projectId The ID of the project
   * @returns Object with counts of deleted embeddings and batches
   */
  async clearProjectEmbeddingData(projectId: number): Promise<{ deletedEmbeddings: number; deletedBatches: number }> {
    const client = await this.pool.connect();

    try {
      console.log(`Clearing all embedding data for project ${projectId}`);

      // Start a transaction to ensure atomicity
      await client.query('BEGIN');

      // Delete embeddings
      const embeddingsResult = await client.query(`
        DELETE FROM embeddings
        WHERE project_id = $1
      `, [projectId]);

      // Delete batches
      const batchesResult = await client.query(`
        DELETE FROM batches
        WHERE project_id = $1
      `, [projectId]);

      // Commit the transaction
      await client.query('COMMIT');

      const deletedEmbeddings = embeddingsResult.rowCount || 0;
      const deletedBatches = batchesResult.rowCount || 0;

      console.log(`Cleared embedding data for project ${projectId}: ${deletedEmbeddings} embeddings, ${deletedBatches} batches`);

      return { deletedEmbeddings, deletedBatches };
    } catch (error) {
      // Rollback the transaction on error
      await client.query('ROLLBACK');
      console.error('Error clearing project embedding data:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async saveProjectMetadata(metadata: ProjectMetadata): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        INSERT INTO projects (
          project_id, name, description, url, default_branch,
          last_processed_commit, last_processed_at, last_reembedding_at,
          auto_review_enabled, auto_approve_enabled
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT (project_id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          url = EXCLUDED.url,
          default_branch = EXCLUDED.default_branch,
          last_processed_commit = EXCLUDED.last_processed_commit,
          last_processed_at = EXCLUDED.last_processed_at,
          last_reembedding_at = EXCLUDED.last_reembedding_at,
          auto_review_enabled = COALESCE(EXCLUDED.auto_review_enabled, projects.auto_review_enabled),
          auto_approve_enabled = COALESCE(EXCLUDED.auto_approve_enabled, projects.auto_approve_enabled)
      `, [
        metadata.projectId,
        metadata.name,
        metadata.description,
        metadata.url,
        metadata.defaultBranch,
        metadata.lastProcessedCommit,
        metadata.lastProcessedAt,
        metadata.lastReembeddingAt,
        metadata.autoReviewEnabled,
        metadata.autoApproveEnabled
      ]);
    } catch (error) {
      console.error('Error saving project metadata:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update the last re-embedding timestamp for a project
   * @param projectId The ID of the project
   * @param timestamp The timestamp when re-embedding was initiated
   */
  async updateLastReembeddingTimestamp(projectId: number, timestamp: Date): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE projects
        SET last_reembedding_at = $2, updated_at = NOW()
        WHERE project_id = $1
      `, [projectId, timestamp]);
    } catch (error) {
      console.error('Error updating last re-embedding timestamp:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update the auto review enabled status for a project
   * @param projectId The ID of the project
   * @param enabled Whether auto review is enabled
   */
  async updateAutoReviewEnabled(projectId: number, enabled: boolean): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE projects
        SET auto_review_enabled = $2, updated_at = NOW()
        WHERE project_id = $1
      `, [projectId, enabled]);

      console.log(`Updated auto review enabled for project ${projectId}: ${enabled}`);
    } catch (error) {
      console.error('Error updating auto review enabled status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if auto review is enabled for a project
   * @param projectId The ID of the project
   * @returns True if auto review is enabled, false otherwise
   */
  async isAutoReviewEnabled(projectId: number): Promise<boolean> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT auto_review_enabled
        FROM projects
        WHERE project_id = $1
      `, [projectId]);

      if (result.rows.length === 0) {
        // If project doesn't exist, default to enabled
        return true;
      }

      return result.rows[0].auto_review_enabled;
    } catch (error) {
      console.error('Error checking auto review enabled status:', error);
      // Default to enabled on error
      return true;
    } finally {
      client.release();
    }
  }

  /**
   * Update the auto approve enabled status for a project
   * @param projectId The ID of the project
   * @param enabled Whether auto approve is enabled
   */
  async updateAutoApproveEnabled(projectId: number, enabled: boolean): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(`
        UPDATE projects
        SET auto_approve_enabled = $2, updated_at = NOW()
        WHERE project_id = $1
      `, [projectId, enabled]);

      console.log(`Updated auto approve enabled for project ${projectId}: ${enabled}`);
    } catch (error) {
      console.error('Error updating auto approve enabled status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if auto approve is enabled for a project
   * @param projectId The ID of the project
   * @returns True if auto approve is enabled, false otherwise
   */
  async isAutoApproveEnabled(projectId: number): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      const result = await client.query(`
        SELECT auto_approve_enabled
        FROM projects
        WHERE project_id = $1
      `, [projectId]);
      if (result.rows.length === 0) {
        // If project doesn't exist, default to disabled
        return false;
      }
      return result.rows[0].auto_approve_enabled;
    } catch (error) {
      console.error('Error checking auto approve enabled status:', error);
      // Default to disabled on error
      return false;
    } finally {
      client.release();
    }
  }

  /**
   * Save or update merge request review history
   * @param projectId The ID of the project
   * @param mergeRequestIid The IID of the merge request
   * @param lastReviewedCommitSha The SHA of the last reviewed commit
   * @param reviewCommentId The ID of the review comment (optional)
   * @param reviewerType The type of reviewer (automated or manual)
   * @param status The review status
   * @param criticalIssuesCount The number of critical issues found
   * @param fixesImplementedCount The number of fixes implemented
   */
  async saveMergeRequestReview(
    projectId: number,
    mergeRequestIid: number,
    lastReviewedCommitSha: string,
    reviewCommentId?: number,
    reviewerType: 'automated' | 'manual' = 'automated',
    status: 'pending' | 'reviewed' | 'approved' | 'rejected' = 'reviewed',
    criticalIssuesCount: number = 0,
    fixesImplementedCount: number = 0
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        INSERT INTO merge_request_reviews (
          project_id, merge_request_iid, last_reviewed_commit_sha, review_comment_id,
          reviewer_type, status, critical_issues_count, fixes_implemented_count,
          reviewed_at, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW(), NOW())
        ON CONFLICT (project_id, merge_request_iid)
        DO UPDATE SET
          last_reviewed_commit_sha = EXCLUDED.last_reviewed_commit_sha,
          review_comment_id = EXCLUDED.review_comment_id,
          reviewer_type = EXCLUDED.reviewer_type,
          status = EXCLUDED.status,
          critical_issues_count = EXCLUDED.critical_issues_count,
          fixes_implemented_count = EXCLUDED.fixes_implemented_count,
          reviewed_at = EXCLUDED.reviewed_at,
          updated_at = EXCLUDED.updated_at
      `, [projectId, mergeRequestIid, lastReviewedCommitSha, reviewCommentId, reviewerType, status, criticalIssuesCount, fixesImplementedCount]);

      console.log(`Saved review history for MR !${mergeRequestIid} in project ${projectId}, reviewer: ${reviewerType}, status: ${status}`);
    } catch (error) {
      console.error('Error saving merge request review history:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get merge request review history
   * @param projectId The ID of the project
   * @param mergeRequestIid The IID of the merge request
   * @returns The review history or null if not found
   */
  async getMergeRequestReview(projectId: number, mergeRequestIid: number): Promise<{
    id: number;
    projectId: number;
    mergeRequestIid: number;
    lastReviewedCommitSha: string;
    reviewCommentId: number | null;
    reviewerType: 'automated' | 'manual';
    status: 'pending' | 'reviewed' | 'approved' | 'rejected';
    criticalIssuesCount: number;
    fixesImplementedCount: number;
    reviewedAt: Date;
    createdAt: Date;
    updatedAt: Date;
  } | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          id,
          project_id as "projectId",
          merge_request_iid as "mergeRequestIid",
          last_reviewed_commit_sha as "lastReviewedCommitSha",
          review_comment_id as "reviewCommentId",
          reviewer_type as "reviewerType",
          status,
          critical_issues_count as "criticalIssuesCount",
          fixes_implemented_count as "fixesImplementedCount",
          reviewed_at as "reviewedAt",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM merge_request_reviews
        WHERE project_id = $1 AND merge_request_iid = $2
      `, [projectId, mergeRequestIid]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0];
    } catch (error) {
      console.error('Error getting merge request review history:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update fixes implemented count for a merge request review
   * @param projectId The ID of the project
   * @param mergeRequestIid The IID of the merge request
   * @param fixesImplementedCount The number of fixes implemented
   */
  async updateMergeRequestFixesCount(
    projectId: number,
    mergeRequestIid: number,
    fixesImplementedCount: number
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE merge_request_reviews
        SET fixes_implemented_count = $3, updated_at = NOW()
        WHERE project_id = $1 AND merge_request_iid = $2
      `, [projectId, mergeRequestIid, fixesImplementedCount]);

      console.log(`Updated fixes count for MR !${mergeRequestIid} in project ${projectId}: ${fixesImplementedCount} fixes`);
    } catch (error) {
      console.error('Error updating merge request fixes count:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update review status for a merge request
   * @param projectId The ID of the project
   * @param mergeRequestIid The IID of the merge request
   * @param status The new review status
   */
  async updateMergeRequestReviewStatus(
    projectId: number,
    mergeRequestIid: number,
    status: 'pending' | 'reviewed' | 'approved' | 'rejected'
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE merge_request_reviews
        SET status = $3, updated_at = NOW()
        WHERE project_id = $1 AND merge_request_iid = $2
      `, [projectId, mergeRequestIid, status]);

      console.log(`Updated review status for MR !${mergeRequestIid} in project ${projectId}: ${status}`);
    } catch (error) {
      console.error('Error updating merge request review status:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Create a new webhook processing record
   * @param record The webhook processing record to create
   */
  async createWebhookProcessing(record: WebhookProcessingRecord): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        INSERT INTO webhook_processing (
          id, webhook_key, event_type, project_id, status,
          started_at, completed_at, error, server_id, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      `, [
        record.id,
        record.webhookKey,
        record.eventType,
        record.projectId,
        record.status,
        record.startedAt,
        record.completedAt,
        record.error,
        record.serverId,
        record.createdAt,
        record.updatedAt
      ]);
    } catch (error) {
      console.error('Error creating webhook processing record:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get active webhook processing record by webhook key
   * @param webhookKey The webhook key to search for
   * @returns The active processing record or null if not found
   */
  async getActiveWebhookProcessing(webhookKey: string): Promise<WebhookProcessingRecord | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          id,
          webhook_key as "webhookKey",
          event_type as "eventType",
          project_id as "projectId",
          status,
          started_at as "startedAt",
          completed_at as "completedAt",
          error,
          server_id as "serverId",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM webhook_processing
        WHERE webhook_key = $1 AND status = $2
      `, [webhookKey, WebhookProcessingStatus.PROCESSING]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as WebhookProcessingRecord;
    } catch (error) {
      console.error('Error getting active webhook processing:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update webhook processing status
   * @param processingId The processing ID to update
   * @param status The new status
   * @param completedAt The completion timestamp (optional)
   * @param error The error message (optional)
   */
  async updateWebhookProcessingStatus(
    processingId: string,
    status: WebhookProcessingStatus,
    completedAt?: Date,
    error?: string
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE webhook_processing
        SET status = $2, completed_at = $3, error = $4, updated_at = NOW()
        WHERE id = $1
      `, [processingId, status, completedAt, error]);
    } catch (dbError) {
      console.error('Error updating webhook processing status:', dbError);
      throw dbError;
    } finally {
      client.release();
    }
  }

  /**
   * Clean up stale webhook processing records
   * @param cutoffTime Records started before this time will be cleaned up
   * @returns Number of records cleaned up
   */
  async cleanupStaleWebhookProcessing(cutoffTime: Date): Promise<number> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        DELETE FROM webhook_processing
        WHERE status = $1 AND started_at < $2
      `, [WebhookProcessingStatus.PROCESSING, cutoffTime]);

      return result.rowCount || 0;
    } catch (error) {
      console.error('Error cleaning up stale webhook processing:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get webhook processing statistics
   * @returns Statistics about webhook processing
   */
  async getWebhookProcessingStats(): Promise<{
    active: number;
    completed: number;
    failed: number;
  }> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          status,
          COUNT(*) as count
        FROM webhook_processing
        GROUP BY status
      `);

      const stats = {
        active: 0,
        completed: 0,
        failed: 0
      };

      result.rows.forEach(row => {
        switch (row.status) {
          case WebhookProcessingStatus.PROCESSING:
            stats.active = parseInt(row.count);
            break;
          case WebhookProcessingStatus.COMPLETED:
            stats.completed = parseInt(row.count);
            break;
          case WebhookProcessingStatus.FAILED:
            stats.failed = parseInt(row.count);
            break;
        }
      });

      return stats;
    } catch (error) {
      console.error('Error getting webhook processing stats:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Documentation-related methods

  /**
   * Save or update a documentation source
   */
  async saveDocumentationSource(source: DocumentationSource): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        INSERT INTO documentation_sources (
          id, name, description, url, framework, version, is_active,
          refresh_interval_days, last_fetched_at, last_embedded_at,
          fetch_status, fetch_error, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT (id)
        DO UPDATE SET
          name = EXCLUDED.name,
          description = EXCLUDED.description,
          url = EXCLUDED.url,
          framework = EXCLUDED.framework,
          version = EXCLUDED.version,
          is_active = EXCLUDED.is_active,
          refresh_interval_days = EXCLUDED.refresh_interval_days,
          last_fetched_at = EXCLUDED.last_fetched_at,
          last_embedded_at = EXCLUDED.last_embedded_at,
          fetch_status = EXCLUDED.fetch_status,
          fetch_error = EXCLUDED.fetch_error,
          updated_at = EXCLUDED.updated_at
      `, [
        source.id,
        source.name,
        source.description,
        source.url,
        source.framework,
        source.version,
        source.isActive,
        source.refreshIntervalDays,
        source.lastFetchedAt,
        source.lastEmbeddedAt,
        source.fetchStatus,
        source.fetchError,
        source.createdAt,
        source.updatedAt
      ]);
    } catch (error) {
      console.error('Error saving documentation source:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get a documentation source by ID
   */
  async getDocumentationSource(id: string): Promise<DocumentationSource | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          id,
          name,
          description,
          url,
          framework,
          version,
          is_active as "isActive",
          refresh_interval_days as "refreshIntervalDays",
          last_fetched_at as "lastFetchedAt",
          last_embedded_at as "lastEmbeddedAt",
          fetch_status as "fetchStatus",
          fetch_error as "fetchError",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM documentation_sources
        WHERE id = $1
      `, [id]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as DocumentationSource;
    } catch (error) {
      console.error('Error getting documentation source:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get documentation sources by frameworks
   */
  async getDocumentationSourcesByFrameworks(frameworks: string[]): Promise<DocumentationSource[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          id,
          name,
          description,
          url,
          framework,
          version,
          is_active as "isActive",
          refresh_interval_days as "refreshIntervalDays",
          last_fetched_at as "lastFetchedAt",
          last_embedded_at as "lastEmbeddedAt",
          fetch_status as "fetchStatus",
          fetch_error as "fetchError",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM documentation_sources
        WHERE framework = ANY($1) AND is_active = true
        ORDER BY framework, name
      `, [frameworks]);

      return result.rows as DocumentationSource[];
    } catch (error) {
      console.error('Error getting documentation sources by frameworks:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update documentation source status
   */
  async updateDocumentationSourceStatus(
    id: string,
    status: 'pending' | 'success' | 'failed',
    error?: string,
    lastFetchedAt?: Date
  ): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        UPDATE documentation_sources
        SET fetch_status = $2, fetch_error = $3, last_fetched_at = $4, updated_at = NOW()
        WHERE id = $1
      `, [id, status, error, lastFetchedAt]);
    } catch (dbError) {
      console.error('Error updating documentation source status:', dbError);
      throw dbError;
    } finally {
      client.release();
    }
  }

  /**
   * Delete a documentation source
   */
  async deleteDocumentationSource(id: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        DELETE FROM documentation_sources
        WHERE id = $1
      `, [id]);
    } catch (error) {
      console.error('Error deleting documentation source:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save documentation embeddings in batch
   */
  async saveDocumentationEmbeddings(embeddings: DocumentationEmbedding[]): Promise<void> {
    if (embeddings.length === 0) {
      return;
    }

    const client = await this.pool.connect();

    try {
      // Check if vector extension is available
      const typeRes = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'documentation_embeddings' AND column_name = 'embedding'
      `);

      const isVector = typeRes.rows.length > 0 && typeRes.rows[0].data_type === 'vector';

      // Start transaction
      await client.query('BEGIN');

      for (const embedding of embeddings) {
        if (isVector) {
          await client.query(`
            INSERT INTO documentation_embeddings (
              id, source_id, section, title, content, embedding,
              url, framework, version, keywords, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6::vector, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id)
            DO UPDATE SET
              section = EXCLUDED.section,
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              url = EXCLUDED.url,
              framework = EXCLUDED.framework,
              version = EXCLUDED.version,
              keywords = EXCLUDED.keywords,
              updated_at = EXCLUDED.updated_at
          `, [
            embedding.id,
            embedding.sourceId,
            embedding.section,
            embedding.title,
            embedding.content,
            embedding.embedding,
            embedding.url,
            embedding.framework,
            embedding.version,
            embedding.keywords,
            embedding.createdAt,
            embedding.updatedAt
          ]);
        } else {
          await client.query(`
            INSERT INTO documentation_embeddings (
              id, source_id, section, title, content, embedding,
              url, framework, version, keywords, created_at, updated_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (id)
            DO UPDATE SET
              section = EXCLUDED.section,
              title = EXCLUDED.title,
              content = EXCLUDED.content,
              embedding = EXCLUDED.embedding,
              url = EXCLUDED.url,
              framework = EXCLUDED.framework,
              version = EXCLUDED.version,
              keywords = EXCLUDED.keywords,
              updated_at = EXCLUDED.updated_at
          `, [
            embedding.id,
            embedding.sourceId,
            embedding.section,
            embedding.title,
            embedding.content,
            JSON.stringify(embedding.embedding),
            embedding.url,
            embedding.framework,
            embedding.version,
            embedding.keywords,
            embedding.createdAt,
            embedding.updatedAt
          ]);
        }
      }

      await client.query('COMMIT');
      console.log(`Saved ${embeddings.length} documentation embeddings`);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error saving documentation embeddings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete documentation embeddings for a source
   */
  async deleteDocumentationEmbeddings(sourceId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        DELETE FROM documentation_embeddings
        WHERE source_id = $1
      `, [sourceId]);
    } catch (error) {
      console.error('Error deleting documentation embeddings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Search similar documentation sections
   */
  async searchSimilarDocumentation(
    frameworks: string[],
    embedding: number[],
    limit: number = 5
  ): Promise<DocumentationEmbedding[]> {
    const client = await this.pool.connect();

    try {
      // Check if vector extension is available
      const typeRes = await client.query(`
        SELECT data_type
        FROM information_schema.columns
        WHERE table_name = 'documentation_embeddings' AND column_name = 'embedding'
      `);

      const isVector = typeRes.rows.length > 0 && typeRes.rows[0].data_type === 'vector';

      if (isVector) {
        try {
          const result = await client.query(`
            SELECT
              id,
              source_id as "sourceId",
              section,
              title,
              content,
              embedding,
              url,
              framework,
              version,
              keywords,
              created_at as "createdAt",
              updated_at as "updatedAt",
              1 - (embedding <=> $1) as similarity
            FROM documentation_embeddings
            WHERE framework = ANY($2)
            ORDER BY embedding <=> $1
            LIMIT $3
          `, [embedding, frameworks, limit]);

          return result.rows as DocumentationEmbedding[];
        } catch (error) {
          console.warn('Vector similarity search failed for documentation, falling back to basic filtering:', error);
        }
      }

      // Fallback to basic filtering
      const result = await client.query(`
        SELECT
          id,
          source_id as "sourceId",
          section,
          title,
          content,
          embedding,
          url,
          framework,
          version,
          keywords,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM documentation_embeddings
        WHERE framework = ANY($1)
        ORDER BY updated_at DESC
        LIMIT $2
      `, [frameworks, limit]);

      // Convert embedding from JSONB to array if needed
      return result.rows.map((row: any) => {
        if (!isVector && typeof row.embedding === 'string') {
          row.embedding = JSON.parse(row.embedding);
        }
        return row as DocumentationEmbedding;
      });
    } catch (error) {
      console.error('Error searching similar documentation:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Save project documentation mapping
   */
  async saveProjectDocumentationMapping(mapping: ProjectDocumentationMapping): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        INSERT INTO project_documentation_mappings (
          project_id, source_id, is_enabled, priority, created_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT (project_id, source_id)
        DO UPDATE SET
          is_enabled = EXCLUDED.is_enabled,
          priority = EXCLUDED.priority,
          updated_at = EXCLUDED.updated_at
      `, [
        mapping.projectId,
        mapping.sourceId,
        mapping.isEnabled,
        mapping.priority,
        mapping.createdAt,
        mapping.updatedAt
      ]);
    } catch (error) {
      console.error('Error saving project documentation mapping:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get project documentation mapping
   */
  async getProjectDocumentationMapping(
    projectId: number,
    sourceId: string
  ): Promise<ProjectDocumentationMapping | null> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          project_id as "projectId",
          source_id as "sourceId",
          is_enabled as "isEnabled",
          priority,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM project_documentation_mappings
        WHERE project_id = $1 AND source_id = $2
      `, [projectId, sourceId]);

      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as ProjectDocumentationMapping;
    } catch (error) {
      console.error('Error getting project documentation mapping:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get project documentation mappings
   */
  async getProjectDocumentationMappings(projectId: number): Promise<ProjectDocumentationMapping[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          project_id as "projectId",
          source_id as "sourceId",
          is_enabled as "isEnabled",
          priority,
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM project_documentation_mappings
        WHERE project_id = $1 AND is_enabled = true
        ORDER BY priority DESC, created_at ASC
      `, [projectId]);

      return result.rows as ProjectDocumentationMapping[];
    } catch (error) {
      console.error('Error getting project documentation mappings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete project documentation mappings for a source
   */
  async deleteProjectDocumentationMappings(sourceId: string): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        DELETE FROM project_documentation_mappings
        WHERE source_id = $1
      `, [sourceId]);
    } catch (error) {
      console.error('Error deleting project documentation mappings:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get all documentation sources
   */
  async getAllDocumentationSources(): Promise<DocumentationSource[]> {
    const client = await this.pool.connect();

    try {
      const result = await client.query(`
        SELECT
          id,
          name,
          description,
          url,
          framework,
          version,
          is_active as "isActive",
          refresh_interval_days as "refreshIntervalDays",
          last_fetched_at as "lastFetchedAt",
          last_embedded_at as "lastEmbeddedAt",
          fetch_status as "fetchStatus",
          fetch_error as "fetchError",
          created_at as "createdAt",
          updated_at as "updatedAt"
        FROM documentation_sources
        ORDER BY framework, name
      `);

      return result.rows as DocumentationSource[];
    } catch (error) {
      console.error('Error getting all documentation sources:', error);
      throw error;
    } finally {
      client.release();
    }
  }

  // Merge Request Tracking Methods

  /**
   * Save merge request tracking data
   */
  async saveMergeRequestTracking(mrData: any): Promise<void> {
    const client = await this.pool.connect();

    try {
      await client.query(`
        INSERT INTO merge_request_tracking (
          project_id, merge_request_iid, merge_request_id, title, description,
          author_id, author_username, author_name, source_branch, target_branch,
          status, action, created_at, updated_at, approved_at, merged_at, closed_at,
          merge_commit_sha, repository_url, web_url, is_repopo_event, repopo_token
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
        ON CONFLICT (project_id, merge_request_iid)
        DO UPDATE SET
          title = EXCLUDED.title,
          description = EXCLUDED.description,
          status = EXCLUDED.status,
          action = EXCLUDED.action,
          updated_at = EXCLUDED.updated_at,
          approved_at = COALESCE(merge_request_tracking.approved_at, EXCLUDED.approved_at),
          merged_at = EXCLUDED.merged_at,
          closed_at = EXCLUDED.closed_at,
          merge_commit_sha = EXCLUDED.merge_commit_sha
      `, [
        mrData.project_id, mrData.merge_request_iid, mrData.merge_request_id,
        mrData.title, mrData.description, mrData.author_id, mrData.author_username,
        mrData.author_name, mrData.source_branch, mrData.target_branch,
        mrData.status, mrData.action, mrData.created_at, mrData.updated_at, mrData.approved_at,
        mrData.merged_at, mrData.closed_at, mrData.merge_commit_sha,
        mrData.repository_url, mrData.web_url, mrData.is_repopo_event, mrData.repopo_token
      ]);
    } catch (error) {
      console.error('Error saving merge request tracking data:', error);
      throw error;
    } finally {
      client.release();
    }
    }



  /**
   * Set approved_at timestamp for a merge request if not already set or if earlier than provided
   */
  async setMRApprovedAt(projectId: number, mergeRequestIid: number, approvedAt: Date): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(
        `UPDATE merge_request_tracking
         SET approved_at = CASE
           WHEN approved_at IS NULL OR approved_at > $3 THEN $3
           ELSE approved_at
         END
         WHERE project_id = $1 AND merge_request_iid = $2`,
        [projectId, mergeRequestIid, approvedAt]
      );
    } catch (error) {
      console.error('Error updating MR approved_at:', error);
      throw error;
    } finally {
      client.release();
    }
  }



  /**
   * Update user MR statistics
   */
  async updateUserMRStatistics(userId: number, username: string, projectId: number): Promise<void> {
    const client = await this.pool.connect();

    try {
      // Calculate statistics from merge_request_tracking table
      const statsResult = await client.query(`
        SELECT
          COUNT(*) as total_created,
          COUNT(CASE WHEN status = 'merged' THEN 1 END) as total_merged,
          COUNT(CASE WHEN status = 'closed' AND merged_at IS NULL THEN 1 END) as total_closed,
          AVG(CASE
            WHEN merged_at IS NOT NULL AND created_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (merged_at - created_at)) / 3600
          END) as avg_merge_time_hours,
          MAX(CASE WHEN action = 'open' THEN created_at END) as last_created,
          MAX(merged_at) as last_merged
        FROM merge_request_tracking
        WHERE author_id = $1 AND project_id = $2
      `, [userId, projectId]);

      const stats = statsResult.rows[0];

      await client.query(`
        INSERT INTO user_mr_statistics (
          user_id, username, project_id, total_mrs_created, total_mrs_merged,
          total_mrs_closed, total_mrs_rejected, avg_merge_time_hours,
          last_mr_created_at, last_mr_merged_at, updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
        ON CONFLICT (user_id, project_id)
        DO UPDATE SET
          username = EXCLUDED.username,
          total_mrs_created = EXCLUDED.total_mrs_created,
          total_mrs_merged = EXCLUDED.total_mrs_merged,
          total_mrs_closed = EXCLUDED.total_mrs_closed,
          total_mrs_rejected = EXCLUDED.total_mrs_rejected,
          avg_merge_time_hours = EXCLUDED.avg_merge_time_hours,
          last_mr_created_at = EXCLUDED.last_mr_created_at,
          last_mr_merged_at = EXCLUDED.last_mr_merged_at,
          updated_at = NOW()
      `, [
        userId, username, projectId,
        parseInt(stats.total_created) || 0,
        parseInt(stats.total_merged) || 0,
        parseInt(stats.total_closed) || 0,
        0, // total_mrs_rejected - we'll calculate this later if needed
        parseFloat(stats.avg_merge_time_hours) || null,
        stats.last_created,
        stats.last_merged
      ]);
    } catch (error) {
    } finally {
      client.release();
    }
  }

  /**
   * Record bug fix lead times for a merged MR by using task-MR mappings and notion_tasks
   * Only records when task_type is 'issue' or 'bug' (case-insensitive) and merged_at is present
   * Uses estimation_start as the start time, falls back to notion_created_at, then created_at
   */
  async recordBugFixLeadTimesForMR(projectId: number, mergeRequestIid: number, mergeRequestId: number): Promise<void> {
    const query = `
      WITH mapping AS (
        SELECT t.id AS notion_task_id,
               t.notion_page_id,
               LOWER(COALESCE(t.task_type, '')) AS task_type,
               COALESCE(t.estimation_start, t.notion_created_at, t.created_at) AS start_time
        FROM task_mr_mappings m
        JOIN notion_tasks t ON t.id = m.notion_task_id
        WHERE m.project_id = $1 AND m.merge_request_iid = $2
      ), mr AS (
        SELECT author_id, author_username, merged_at
        FROM merge_request_tracking
        WHERE project_id = $1 AND merge_request_iid = $2 AND merged_at IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 1
      )
      INSERT INTO bug_fix_lead_times (
        project_id, merge_request_iid, merge_request_id,
        author_id, author_username,
        notion_task_id, notion_page_id, issue_type,
        notion_created_at, merged_at, lead_time_hours
      )
      SELECT $1, $2, $3,
             mr.author_id, mr.author_username,
             m.notion_task_id, m.notion_page_id, m.task_type,
             m.start_time, mr.merged_at,
             ROUND(EXTRACT(EPOCH FROM (mr.merged_at - m.start_time)) / 3600.0, 2)
      FROM mapping m, mr
      WHERE m.task_type IN ('issue', 'bug') AND m.start_time IS NOT NULL
      ON CONFLICT (project_id, merge_request_iid, notion_task_id) DO NOTHING
    `;

    await this.query(query, [projectId, mergeRequestIid, mergeRequestId]);
  }

  /**
   * Record feature completion lead times for a merged MR by using task-MR mappings and notion_tasks
   * Only records when task_type is 'feature', 'enhancement', 'story', 'new feature', or 'improvement' (case-insensitive) and merged_at is present
   * Uses estimation_start as the start time, falls back to notion_created_at, then created_at
   */
  async recordFeatureCompletionLeadTimesForMR(projectId: number, mergeRequestIid: number, mergeRequestId: number): Promise<void> {
    const query = `
      WITH mapping AS (
        SELECT t.id AS notion_task_id,
               t.notion_page_id,
               LOWER(COALESCE(t.task_type, '')) AS task_type,
               COALESCE(t.estimation_start, t.notion_created_at, t.created_at) AS start_time
        FROM task_mr_mappings m
        JOIN notion_tasks t ON t.id = m.notion_task_id
        WHERE m.project_id = $1 AND m.merge_request_iid = $2
      ), mr AS (
        SELECT author_id, author_username, merged_at
        FROM merge_request_tracking
        WHERE project_id = $1 AND merge_request_iid = $2 AND merged_at IS NOT NULL
        ORDER BY updated_at DESC
        LIMIT 1
      )
      INSERT INTO feature_completion_lead_times (
        project_id, merge_request_iid, merge_request_id,
        author_id, author_username,
        notion_task_id, notion_page_id, issue_type,
        notion_created_at, merged_at, lead_time_hours
      )
      SELECT $1, $2, $3,
             mr.author_id, mr.author_username,
             m.notion_task_id, m.notion_page_id, m.task_type,
             m.start_time, mr.merged_at,
             ROUND(EXTRACT(EPOCH FROM (mr.merged_at - m.start_time)) / 3600.0, 2)
      FROM mapping m, mr
      WHERE m.task_type IN ('feature', 'enhancement', 'story', 'new feature', 'improvement') AND m.start_time IS NOT NULL
      ON CONFLICT (project_id, merge_request_iid, notion_task_id) DO NOTHING
    `;

    await this.query(query, [projectId, mergeRequestIid, mergeRequestId]);
  }


  // Developer Performance Analytics Methods

  /**
   * Get developer performance metrics
   */
  async getDeveloperPerformanceMetrics(
    dateFrom: Date,
    dateTo: Date,
    developerId?: number,
    projectId?: number
  ): Promise<DeveloperPerformanceMetrics[]> {
    const conditions = ['performance_date BETWEEN $1 AND $2'];
    const params: any[] = [dateFrom, dateTo];

    if (developerId) {
      conditions.push(`developer_id = $${params.length + 1}`);
      params.push(developerId);
    }

    if (projectId) {
      conditions.push(`project_id = $${params.length + 1}`);
      params.push(projectId);
    }

    const query = `
      SELECT
        dp.*,
        u.username,
        u.name as developer_name,
        p.name as project_name
      FROM developer_performance dp
      LEFT JOIN users u ON dp.developer_id = u.id
      LEFT JOIN projects p ON dp.project_id = p.project_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY dp.performance_date DESC, dp.quality_score DESC
    `;

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Insert or update developer performance metrics
   */
  async upsertDeveloperPerformance(
    metrics: DeveloperPerformanceMetrics
  ): Promise<void> {
    const query = `
      INSERT INTO developer_performance (
        developer_id, project_id, performance_date,
        total_mrs, merged_mrs, success_rate, avg_merge_time_hours,
        quality_score, issues_created, issues_resolved, avg_resolution_time_days
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (developer_id, project_id, performance_date)
      DO UPDATE SET
        total_mrs = EXCLUDED.total_mrs,
        merged_mrs = EXCLUDED.merged_mrs,
        success_rate = EXCLUDED.success_rate,
        avg_merge_time_hours = EXCLUDED.avg_merge_time_hours,
        quality_score = EXCLUDED.quality_score,
        issues_created = EXCLUDED.issues_created,
        issues_resolved = EXCLUDED.issues_resolved,
        avg_resolution_time_days = EXCLUDED.avg_resolution_time_days,
        updated_at = NOW()
    `;

    await this.query(query, [
      metrics.developer_id,
      metrics.project_id,
      metrics.performance_date,
      metrics.total_mrs,
      metrics.merged_mrs,
      metrics.success_rate,
      metrics.avg_merge_time_hours,
      metrics.quality_score,
      metrics.issues_created,
      metrics.issues_resolved,
      metrics.avg_resolution_time_days
    ]);
  }

  /**
   * Get MR quality metrics
   */
  async getMRQualityMetrics(
    dateFrom: Date,
    dateTo: Date,
    developerId?: number
  ): Promise<MRQualityMetrics[]> {
    const conditions = ['mqm.created_at BETWEEN $1 AND $2'];
    const params: any[] = [dateFrom, dateTo];

    if (developerId) {
      conditions.push(`mqm.developer_id = $${params.length + 1}`);
      params.push(developerId);
    }

    const query = `
      SELECT
        mqm.*,
        mrt.title as mr_title,
        mrt.source_branch,
        mrt.target_branch
      FROM mr_quality_metrics mqm
      LEFT JOIN merge_request_tracking mrt ON mqm.merge_request_id = mrt.merge_request_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY mqm.created_at DESC
    `;

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Insert MR quality metrics
   */
  async insertMRQualityMetrics(
    metrics: MRQualityMetrics
  ): Promise<void> {
    const query = `
      INSERT INTO mr_quality_metrics (
        merge_request_id, developer_id, project_id,
        quality_score, review_cycles, critical_issues_count,
        fixes_implemented_count, time_to_first_review_hours,
        time_to_merge_hours, code_complexity_score
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (merge_request_id)
      DO UPDATE SET
        quality_score = EXCLUDED.quality_score,
        review_cycles = EXCLUDED.review_cycles,
        critical_issues_count = EXCLUDED.critical_issues_count,
        fixes_implemented_count = EXCLUDED.fixes_implemented_count,
        time_to_first_review_hours = EXCLUDED.time_to_first_review_hours,
        time_to_merge_hours = EXCLUDED.time_to_merge_hours,
        code_complexity_score = EXCLUDED.code_complexity_score,
        updated_at = NOW()
    `;

    await this.query(query, [
      metrics.merge_request_id,
      metrics.developer_id,
      metrics.project_id,
      metrics.quality_score,
      metrics.review_cycles,
      metrics.critical_issues_count,
      metrics.fixes_implemented_count,
      metrics.time_to_first_review_hours,
      metrics.time_to_merge_hours,
      metrics.code_complexity_score
    ]);
  }

  /**
   * Get Notion issues
   */
  async getNotionIssues(
    dateFrom: Date,
    dateTo: Date,
    issueType: string = 'Bug',
    projectId?: number
  ): Promise<NotionIssue[]> {
    const conditions = ['created_at BETWEEN $1 AND $2', 'issue_type = $3'];
    const params: any[] = [dateFrom, dateTo, issueType];

    if (projectId) {
      conditions.push(`project_id = $${params.length + 1}`);
      params.push(projectId);
    }

    const query = `
      SELECT * FROM notion_issues
      WHERE ${conditions.join(' AND ')}
      ORDER BY created_at DESC
    `;

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Insert or update Notion issue
   */
  async upsertNotionIssue(issue: NotionIssue): Promise<void> {
    const query = `
      INSERT INTO notion_issues (
        id, notion_page_id, title, description, issue_type,
        status, priority_level, creator_id, assignee_id,
        project_id, merge_request_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (id)
      DO UPDATE SET
        title = EXCLUDED.title,
        description = EXCLUDED.description,
        status = EXCLUDED.status,
        priority_level = EXCLUDED.priority_level,
        assignee_id = EXCLUDED.assignee_id,
        resolved_at = CASE
          WHEN EXCLUDED.status = 'Resolved' AND notion_issues.status != 'Resolved'
          THEN NOW()
          ELSE notion_issues.resolved_at
        END,
        updated_at = NOW()
    `;

    await this.query(query, [
      issue.id,
      issue.notion_page_id,
      issue.title,
      issue.description,
      issue.issue_type,
      issue.status,
      issue.priority_level,
      issue.creator_id,
      issue.assignee_id,
      issue.project_id,
      issue.merge_request_id
    ]);
  }

  // WhatsApp Configuration Methods

  /**
   * Get all WhatsApp configurations
   */
  async getWhatsAppConfigurations(): Promise<WhatsAppConfigurationRecord[]> {
    const query = `
      SELECT
        id,
        gitlab_username,
        whatsapp_number,
        is_active,
        notification_types,
        created_at,
        updated_at
      FROM whatsapp_configurations
      ORDER BY gitlab_username ASC
    `;

    try {
      console.log('Executing WhatsApp configurations query...');

      // First check if table exists
      const tableCheck = await this.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'whatsapp_configurations'
        );
      `);
      console.log('WhatsApp table exists:', tableCheck.rows[0].exists);

      if (!tableCheck.rows[0].exists) {
        console.log('WhatsApp table does not exist, creating it...');
        await this.query(`
          CREATE TABLE IF NOT EXISTS whatsapp_configurations (
            id SERIAL PRIMARY KEY,
            gitlab_username TEXT NOT NULL UNIQUE,
            whatsapp_number TEXT NOT NULL,
            is_active BOOLEAN DEFAULT true,
            notification_types JSONB DEFAULT '["merge_request_created", "merge_request_assigned"]'::jsonb,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
          )
        `);
        console.log('WhatsApp table created');
      }

      const result = await this.query(query);
      console.log('Query result:', result.rows.length, 'rows');
      return result.rows;
    } catch (error) {
      console.error('Error in getWhatsAppConfigurations:', error);
      throw error;
    }
  }

  /**
   * Get WhatsApp configuration by GitLab username
   */
  async getWhatsAppConfigurationByUsername(gitlabUsername: string): Promise<WhatsAppConfigurationRecord | null> {
    const query = `
      SELECT
        id,
        gitlab_username,
        whatsapp_number,
        is_active,
        notification_types,
        created_at,
        updated_at
      FROM whatsapp_configurations
      WHERE gitlab_username = $1
    `;

    const result = await this.query(query, [gitlabUsername]);
    return result.rows[0] || null;
  }

  /**
   * Create or update WhatsApp configuration
   */
  async upsertWhatsAppConfiguration(config: {
    gitlabUsername: string;
    whatsappNumber: string;
    isActive: boolean;
    notificationTypes: string[];
  }): Promise<WhatsAppConfigurationRecord> {
    const query = `
      INSERT INTO whatsapp_configurations (
        gitlab_username,
        whatsapp_number,
        is_active,
        notification_types
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (gitlab_username)
      DO UPDATE SET
        whatsapp_number = EXCLUDED.whatsapp_number,
        is_active = EXCLUDED.is_active,
        notification_types = EXCLUDED.notification_types,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.query(query, [
      config.gitlabUsername,
      config.whatsappNumber,
      config.isActive,
      JSON.stringify(config.notificationTypes)
    ]);

    return result.rows[0];
  }

  /**
   * Delete WhatsApp configuration
   */
  async deleteWhatsAppConfiguration(gitlabUsername: string): Promise<boolean> {
    const query = `
      DELETE FROM whatsapp_configurations
      WHERE gitlab_username = $1
    `;

    const result = await this.query(query, [gitlabUsername]);
    return (result.rowCount || 0) > 0;
  }

  /**
   * Get active WhatsApp configurations for specific notification type
   */
  async getActiveWhatsAppConfigurationsForNotification(notificationType: string): Promise<WhatsAppConfigurationRecord[]> {
    const query = `
      SELECT
        id,
        gitlab_username,
        whatsapp_number,
        is_active,
        notification_types,
        created_at,
        updated_at
      FROM whatsapp_configurations
      WHERE is_active = true
        AND notification_types ? $1
    `;

    const result = await this.query(query, [notificationType]);
    return result.rows;
  }

  // Feature Completion Rate Methods

  /**
   * Create or update a Notion task
   */
  async upsertNotionTask(task: Omit<NotionTask, 'id' | 'created_at' | 'updated_at'>): Promise<NotionTask> {
    const query = `
      INSERT INTO notion_tasks (
        notion_page_id, title, status, assignee_id, assignee_username,
        assignee_name, project_id, completed_at,
        estimation_start, estimation_end, developer_start, developer_end, ready_to_test_at,
        task_type, notion_created_at, points
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT (notion_page_id)
      DO UPDATE SET
        title = EXCLUDED.title,
        status = EXCLUDED.status,
        assignee_id = EXCLUDED.assignee_id,
        assignee_username = EXCLUDED.assignee_username,
        assignee_name = EXCLUDED.assignee_name,
        project_id = EXCLUDED.project_id,
        completed_at = EXCLUDED.completed_at,
        estimation_start = EXCLUDED.estimation_start,
        estimation_end = EXCLUDED.estimation_end,
        developer_start = EXCLUDED.developer_start,
        developer_end = EXCLUDED.developer_end,
        ready_to_test_at = EXCLUDED.ready_to_test_at,
        task_type = EXCLUDED.task_type,
        notion_created_at = COALESCE(notion_tasks.notion_created_at, EXCLUDED.notion_created_at),
        points = EXCLUDED.points,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.query(query, [
      task.notion_page_id,
      task.title,
      task.status,
      task.assignee_id,
      task.assignee_username,
      task.assignee_name,
      task.project_id,
      task.completed_at,
      task.estimation_start,
      task.estimation_end,
      task.developer_start,
      task.developer_end,
      task.ready_to_test_at,
      (task as any).task_type,
      (task as any).notion_created_at,
      (task as any).points
    ]);

    return result.rows[0];
  }

  /**
   * Get Notion task by page ID
   */
  async getNotionTaskByPageId(pageId: string): Promise<NotionTask | null> {
    const query = `
      SELECT * FROM notion_tasks
      WHERE notion_page_id = $1
    `;

    const result = await this.query(query, [pageId]);
    return result.rows[0] || null;
  }

  /**
   * Get Notion tasks by assignee and date range
   * Includes tasks that were active during the period (started, completed, or updated)
   */
  async getNotionTasksByAssignee(
    assigneeUsername: string,
    dateFrom?: Date,
    dateTo?: Date,
    projectId?: number
  ): Promise<NotionTask[]> {
    let query = `
      SELECT * FROM notion_tasks
      WHERE assignee_username = $1
    `;
    const params: any[] = [assigneeUsername];
    let paramIndex = 2;

    if (dateFrom && dateTo) {
      // Include tasks that were active during the period:
      // 1. Tasks that started in the period
      // 2. Tasks that were completed in the period
      // 3. Tasks that were updated in the period
      // 4. Tasks that span across the period (started before and ended after)
      query += ` AND (
        (COALESCE(estimation_start, developer_start, created_at) BETWEEN $${paramIndex} AND $${paramIndex + 1})
        OR (completed_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
        OR (updated_at BETWEEN $${paramIndex} AND $${paramIndex + 1})
        OR (COALESCE(estimation_start, developer_start, created_at) <= $${paramIndex}
            AND (completed_at IS NULL OR completed_at >= $${paramIndex + 1}))
      )`;
      params.push(dateFrom, dateTo);
      paramIndex += 2;
    } else if (dateFrom) {
      query += ` AND (
        COALESCE(estimation_start, developer_start, created_at) >= $${paramIndex}
        OR completed_at >= $${paramIndex}
        OR updated_at >= $${paramIndex}
      )`;
      params.push(dateFrom);
      paramIndex++;
    } else if (dateTo) {
      query += ` AND (
        COALESCE(estimation_start, developer_start, created_at) <= $${paramIndex}
        OR completed_at <= $${paramIndex}
        OR updated_at <= $${paramIndex}
      )`;
      params.push(dateTo);
      paramIndex++;
    }

    if (projectId) {
      // Include tasks that either have project_id set or are linked via mappings to this project
      query += ` AND (
        project_id = $${paramIndex}
        OR EXISTS (
          SELECT 1 FROM task_mr_mappings tmm
          WHERE tmm.notion_task_id = notion_tasks.id
            AND tmm.project_id = $${paramIndex}
        )
      )`;
      params.push(projectId);
      paramIndex++;
    }

    query += ` ORDER BY COALESCE(estimation_start, developer_start, created_at) DESC`;

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Create a task-MR mapping
   */
  async createTaskMRMapping(mapping: Omit<TaskMRMapping, 'id' | 'created_at' | 'updated_at'>): Promise<TaskMRMapping> {
    const query = `
      INSERT INTO task_mr_mappings (
        notion_task_id, project_id, merge_request_iid, merge_request_id
      ) VALUES ($1, $2, $3, $4)
      ON CONFLICT (notion_task_id, project_id, merge_request_iid)
      DO UPDATE SET
        merge_request_id = EXCLUDED.merge_request_id,
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.query(query, [
      mapping.notion_task_id,
      mapping.project_id,
      mapping.merge_request_iid,
      mapping.merge_request_id
    ]);

    return result.rows[0];
  }

  /**
   * Get task-MR mappings for a task
   */
  async getTaskMRMappings(taskId: number): Promise<TaskMRMapping[]> {
    const query = `
      SELECT tmm.*, mrt.title as mr_title, mrt.status as mr_status,
        mrt.merged_at as mr_merged_at, mrt.web_url as mr_web_url,
        mrt.approved_at as mr_approved_at, mrt.created_at as mr_created_at
      FROM task_mr_mappings tmm
      LEFT JOIN merge_request_tracking mrt ON tmm.project_id = mrt.project_id
        AND tmm.merge_request_iid = mrt.merge_request_iid
      WHERE tmm.notion_task_id = $1
    `;

    const result = await this.query(query, [taskId]);
    return result.rows;
  }

  /**
   * Get task-MR mappings for a merge request
   */
  async getTaskMRMappingsByMR(projectId: number, mergeRequestIid: number): Promise<TaskMRMapping[]> {
    const query = `
      SELECT tmm.*, nt.title as task_title
      FROM task_mr_mappings tmm
      LEFT JOIN notion_tasks nt ON tmm.notion_task_id = nt.id
      WHERE tmm.project_id = $1 AND tmm.merge_request_iid = $2
    `;

    const result = await this.query(query, [projectId, mergeRequestIid]);
    return result.rows;
  }

  /**
   * Create or update feature completion rate
   */
  async upsertFeatureCompletionRate(rate: Omit<FeatureCompletionRate, 'id' | 'created_at' | 'updated_at'>): Promise<FeatureCompletionRate> {
    const query = `
      INSERT INTO feature_completion_rates (
        developer_id, username, project_id, month, year,
        total_tasks, tasks_with_mrs, completed_tasks, completion_rate
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (username, project_id, month, year)
      DO UPDATE SET
        developer_id = EXCLUDED.developer_id,
        total_tasks = EXCLUDED.total_tasks,
        tasks_with_mrs = EXCLUDED.tasks_with_mrs,
        completed_tasks = EXCLUDED.completed_tasks,
        completion_rate = EXCLUDED.completion_rate,
        calculated_at = NOW(),
        updated_at = NOW()
      RETURNING *
    `;

    const result = await this.query(query, [
      rate.developer_id,
      rate.username,
      rate.project_id,
      rate.month,
      rate.year,
      rate.total_tasks,
      rate.tasks_with_mrs,
      rate.completed_tasks,
      rate.completion_rate
    ]);

    return result.rows[0];
  }

  /**
   * Get feature completion rates with filters
   */
  async getFeatureCompletionRates(filters: {
    username?: string;
    projectId?: number;
    month?: number;
    year?: number;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<FeatureCompletionRate[]> {
    let query = `
      SELECT fcr.*, p.name as project_name
      FROM feature_completion_rates fcr
      LEFT JOIN projects p ON fcr.project_id = p.project_id
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.username) {
      query += ` AND fcr.username = $${paramIndex}`;
      params.push(filters.username);
      paramIndex++;
    }

    if (filters.projectId) {
      query += ` AND fcr.project_id = $${paramIndex}`;
      params.push(filters.projectId);
      paramIndex++;
    }

    if (filters.month) {
      query += ` AND fcr.month = $${paramIndex}`;
      params.push(filters.month);
      paramIndex++;
    }

    if (filters.year) {
      query += ` AND fcr.year = $${paramIndex}`;
      params.push(filters.year);
      paramIndex++;
    }

    if (filters.dateFrom) {
      query += ` AND DATE(fcr.year || '-' || LPAD(fcr.month::text, 2, '0') || '-01') >= $${paramIndex}`;
      params.push(filters.dateFrom);
      paramIndex++;
    }

    if (filters.dateTo) {
      query += ` AND DATE(fcr.year || '-' || LPAD(fcr.month::text, 2, '0') || '-01') <= $${paramIndex}`;
      params.push(filters.dateTo);
      paramIndex++;
    }

    query += ` ORDER BY fcr.year DESC, fcr.month DESC, fcr.username`;

    const result = await this.query(query, params);
    return result.rows;
  }

  /**
   * Monthly Reports CRUD operations
   */
  async createMonthlyReport(month: number, year: number, reportData: any, createdBy?: string): Promise<any> {
    const query = `
      INSERT INTO monthly_reports (month, year, report_data, created_by, created_at, updated_at)
      VALUES ($1, $2, $3, $4, NOW(), NOW())
      RETURNING *
    `;
    const result = await this.query(query, [month, year, JSON.stringify(reportData), createdBy]);
    return result.rows[0];
  }

  async getMonthlyReport(month: number, year: number): Promise<any> {
    const query = `
      SELECT * FROM monthly_reports
      WHERE month = $1 AND year = $2
    `;
    const result = await this.query(query, [month, year]);
    return result.rows[0];
  }

  async getMonthlyReportById(id: number): Promise<any> {
    const query = `
      SELECT * FROM monthly_reports
      WHERE id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rows[0];
  }

  async listMonthlyReports(filters: { year?: number; month?: number; page?: number; limit?: number }): Promise<{ reports: any[]; total: number }> {
    let query = `
      SELECT * FROM monthly_reports
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.year) {
      query += ` AND year = $${paramIndex}`;
      params.push(filters.year);
      paramIndex++;
    }

    if (filters.month) {
      query += ` AND month = $${paramIndex}`;
      params.push(filters.month);
      paramIndex++;
    }

    // Get total count
    const countQuery = query.replace('SELECT *', 'SELECT COUNT(*)');
    const countResult = await this.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const offset = (page - 1) * limit;

    query += ` ORDER BY year DESC, month DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await this.query(query, params);
    return { reports: result.rows, total };
  }

  async updateMonthlyReport(id: number, reportData: any): Promise<any> {
    const query = `
      UPDATE monthly_reports
      SET report_data = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `;
    const result = await this.query(query, [JSON.stringify(reportData), id]);
    return result.rows[0];
  }

  async deleteMonthlyReport(id: number): Promise<boolean> {
    const query = `
      DELETE FROM monthly_reports
      WHERE id = $1
    `;
    const result = await this.query(query, [id]);
    return result.rowCount !== null && result.rowCount > 0;
  }
}

export const dbService = new DatabaseService();
