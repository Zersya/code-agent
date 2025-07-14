// Integration tests for analytics database schema
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { Pool } from 'pg';
import { dbService } from '../../services/database.js';

// Test database configuration
const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/repopo_reviewer_test';

describe('Analytics Database Schema Tests', () => {
  let testPool: Pool;

  beforeAll(async () => {
    // Create a separate connection for testing
    testPool = new Pool({
      connectionString: TEST_DATABASE_URL,
    });

    // Initialize the database schema
    try {
      await dbService.connect();
    } catch (error) {
      console.warn('Database connection failed, skipping schema tests:', error);
    }
  });

  afterAll(async () => {
    if (testPool) {
      await testPool.end();
    }
    await dbService.disconnect();
  });

  describe('Analytics Tables Creation', () => {
    test('should create developer_metrics table with correct structure', async () => {
      const client = await testPool.connect();
      
      try {
        // Check if table exists
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'developer_metrics'
          );
        `);

        expect(tableExists.rows[0].exists).toBe(true);

        // Check table columns
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_name = 'developer_metrics'
          ORDER BY ordinal_position;
        `);

        const columnNames = columns.rows.map(row => row.column_name);
        const expectedColumns = [
          'id',
          'developer_id',
          'developer_username',
          'developer_email',
          'project_id',
          'metric_date',
          'mrs_created',
          'mrs_merged',
          'mrs_closed',
          'total_lines_added',
          'total_lines_removed',
          'total_files_changed',
          'avg_cycle_time_hours',
          'avg_review_time_hours',
          'critical_issues_count',
          'total_review_comments',
          'approval_rate',
          'rework_rate',
          'code_quality_score',
          'created_at',
          'updated_at'
        ];

        expectedColumns.forEach(column => {
          expect(columnNames).toContain(column);
        });
      } finally {
        client.release();
      }
    });

    test('should create merge_request_analytics table with correct structure', async () => {
      const client = await testPool.connect();
      
      try {
        // Check if table exists
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'merge_request_analytics'
          );
        `);

        expect(tableExists.rows[0].exists).toBe(true);

        // Check table columns
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'merge_request_analytics'
          ORDER BY ordinal_position;
        `);

        const columnNames = columns.rows.map(row => row.column_name);
        const expectedColumns = [
          'id',
          'project_id',
          'merge_request_iid',
          'developer_id',
          'developer_username',
          'title',
          'source_branch',
          'target_branch',
          'created_at',
          'merged_at',
          'closed_at',
          'lines_added',
          'lines_removed',
          'files_changed',
          'complexity_score',
          'cycle_time_hours',
          'review_time_hours',
          'first_response_time_hours',
          'critical_issues_count',
          'total_review_comments',
          'was_approved',
          'required_rework',
          'code_quality_score',
          'has_notion_context',
          'review_mode',
          'sequential_thinking_used'
        ];

        expectedColumns.forEach(column => {
          expect(columnNames).toContain(column);
        });
      } finally {
        client.release();
      }
    });

    test('should create review_feedback_analytics table with correct structure', async () => {
      const client = await testPool.connect();
      
      try {
        // Check if table exists
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'review_feedback_analytics'
          );
        `);

        expect(tableExists.rows[0].exists).toBe(true);

        // Check table columns
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'review_feedback_analytics'
          ORDER BY ordinal_position;
        `);

        const columnNames = columns.rows.map(row => row.column_name);
        const expectedColumns = [
          'id',
          'merge_request_analytics_id',
          'project_id',
          'merge_request_iid',
          'feedback_type',
          'category',
          'severity',
          'feedback_text',
          'file_path',
          'line_number',
          'was_addressed',
          'resolution_time_hours',
          'created_at'
        ];

        expectedColumns.forEach(column => {
          expect(columnNames).toContain(column);
        });
      } finally {
        client.release();
      }
    });

    test('should create project_performance_metrics table with correct structure', async () => {
      const client = await testPool.connect();
      
      try {
        // Check if table exists
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'project_performance_metrics'
          );
        `);

        expect(tableExists.rows[0].exists).toBe(true);

        // Check table columns
        const columns = await client.query(`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'project_performance_metrics'
          ORDER BY ordinal_position;
        `);

        const columnNames = columns.rows.map(row => row.column_name);
        const expectedColumns = [
          'id',
          'project_id',
          'metric_date',
          'total_developers',
          'total_mrs_created',
          'total_mrs_merged',
          'avg_cycle_time_hours',
          'avg_code_quality_score',
          'productivity_trend',
          'quality_trend',
          'created_at'
        ];

        expectedColumns.forEach(column => {
          expect(columnNames).toContain(column);
        });
      } finally {
        client.release();
      }
    });
  });

  describe('Analytics Table Constraints', () => {
    test('should have unique constraint on developer_metrics', async () => {
      const client = await testPool.connect();
      
      try {
        const constraints = await client.query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'developer_metrics' AND constraint_type = 'UNIQUE';
        `);

        expect(constraints.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });

    test('should have unique constraint on merge_request_analytics', async () => {
      const client = await testPool.connect();
      
      try {
        const constraints = await client.query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'merge_request_analytics' AND constraint_type = 'UNIQUE';
        `);

        expect(constraints.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });

    test('should have foreign key constraint on review_feedback_analytics', async () => {
      const client = await testPool.connect();
      
      try {
        const constraints = await client.query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'review_feedback_analytics' AND constraint_type = 'FOREIGN KEY';
        `);

        expect(constraints.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });

    test('should have unique constraint on project_performance_metrics', async () => {
      const client = await testPool.connect();
      
      try {
        const constraints = await client.query(`
          SELECT constraint_name, constraint_type
          FROM information_schema.table_constraints
          WHERE table_name = 'project_performance_metrics' AND constraint_type = 'UNIQUE';
        `);

        expect(constraints.rows.length).toBeGreaterThan(0);
      } finally {
        client.release();
      }
    });
  });

  describe('Analytics Table Indexes', () => {
    test('should have indexes on developer_metrics', async () => {
      const client = await testPool.connect();
      
      try {
        const indexes = await client.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'developer_metrics';
        `);

        const indexNames = indexes.rows.map(row => row.indexname);
        
        // Check for expected indexes
        expect(indexNames.some(name => name.includes('developer_project'))).toBe(true);
        expect(indexNames.some(name => name.includes('date'))).toBe(true);
      } finally {
        client.release();
      }
    });

    test('should have indexes on merge_request_analytics', async () => {
      const client = await testPool.connect();
      
      try {
        const indexes = await client.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'merge_request_analytics';
        `);

        const indexNames = indexes.rows.map(row => row.indexname);
        
        // Check for expected indexes
        expect(indexNames.some(name => name.includes('project_id'))).toBe(true);
        expect(indexNames.some(name => name.includes('developer_id'))).toBe(true);
      } finally {
        client.release();
      }
    });

    test('should have indexes on review_feedback_analytics', async () => {
      const client = await testPool.connect();
      
      try {
        const indexes = await client.query(`
          SELECT indexname
          FROM pg_indexes
          WHERE tablename = 'review_feedback_analytics';
        `);

        const indexNames = indexes.rows.map(row => row.indexname);
        
        // Check for expected indexes
        expect(indexNames.some(name => name.includes('mr_analytics_id'))).toBe(true);
        expect(indexNames.some(name => name.includes('type'))).toBe(true);
      } finally {
        client.release();
      }
    });
  });

  describe('Data Type Validation', () => {
    test('should have correct data types for numeric fields', async () => {
      const client = await testPool.connect();
      
      try {
        const columns = await client.query(`
          SELECT column_name, data_type, numeric_precision, numeric_scale
          FROM information_schema.columns
          WHERE table_name = 'developer_metrics' 
          AND column_name IN ('avg_cycle_time_hours', 'approval_rate', 'code_quality_score');
        `);

        columns.rows.forEach(row => {
          expect(row.data_type).toBe('numeric');
          if (row.column_name === 'avg_cycle_time_hours') {
            expect(row.numeric_precision).toBe(10);
            expect(row.numeric_scale).toBe(2);
          }
          if (row.column_name === 'approval_rate' || row.column_name === 'code_quality_score') {
            expect(row.numeric_precision).toBe(5);
            expect(row.numeric_scale).toBe(2);
          }
        });
      } finally {
        client.release();
      }
    });

    test('should have correct data types for timestamp fields', async () => {
      const client = await testPool.connect();
      
      try {
        const columns = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'merge_request_analytics' 
          AND column_name IN ('created_at', 'merged_at', 'closed_at');
        `);

        columns.rows.forEach(row => {
          expect(row.data_type).toBe('timestamp with time zone');
        });
      } finally {
        client.release();
      }
    });

    test('should have correct data types for boolean fields', async () => {
      const client = await testPool.connect();
      
      try {
        const columns = await client.query(`
          SELECT column_name, data_type
          FROM information_schema.columns
          WHERE table_name = 'merge_request_analytics' 
          AND column_name IN ('was_approved', 'required_rework', 'has_notion_context', 'sequential_thinking_used');
        `);

        columns.rows.forEach(row => {
          expect(row.data_type).toBe('boolean');
        });
      } finally {
        client.release();
      }
    });
  });
});
