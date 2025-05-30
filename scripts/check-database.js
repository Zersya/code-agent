#!/usr/bin/env node

/**
 * Database Health Check Script
 * 
 * This script verifies that PostgreSQL with pgvector extension is properly configured
 * and accessible by the agent-reviewer application.
 */

const { Pool } = require('pg');
require('dotenv').config();

// Use environment variables for connection, with fallback to defaults
const POSTGRES_USER = process.env.POSTGRES_USER || 'postgres';
const POSTGRES_PASSWORD = process.env.POSTGRES_PASSWORD || 'postgres';
const POSTGRES_DB = process.env.POSTGRES_DB || 'repopo_reviewer';
const POSTGRES_PORT = process.env.POSTGRES_PORT || '5432';

const DATABASE_URL = process.env.DATABASE_URL ||
  `postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:${POSTGRES_PORT}/${POSTGRES_DB}`;

async function checkDatabase() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
  });

  try {
    console.log('🔍 Checking database connection...');
    
    // Test basic connection
    const client = await pool.connect();
    console.log('✅ Database connection successful');

    // Check PostgreSQL version
    const versionResult = await client.query('SELECT version()');
    console.log('📊 PostgreSQL version:', versionResult.rows[0].version.split(' ')[1]);

    // Check if pgvector extension is available
    const extensionResult = await client.query(`
      SELECT * FROM pg_extension WHERE extname = 'vector'
    `);
    
    if (extensionResult.rows.length > 0) {
      console.log('✅ pgvector extension is enabled');
      console.log('📦 Extension version:', extensionResult.rows[0].extversion);
    } else {
      console.log('❌ pgvector extension is not enabled');
      
      // Try to enable it
      try {
        await client.query('CREATE EXTENSION IF NOT EXISTS vector');
        console.log('✅ pgvector extension enabled successfully');
      } catch (error) {
        console.log('❌ Failed to enable pgvector extension:', error.message);
      }
    }

    // Test vector operations
    try {
      await client.query("SELECT '[1,2,3]'::vector as test_vector");
      console.log('✅ Vector operations working correctly');
    } catch (error) {
      console.log('❌ Vector operations failed:', error.message);
    }

    // Check if required tables exist
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('projects', 'embeddings', 'documentation_embeddings', 'batches')
    `);

    const existingTables = tablesResult.rows.map(row => row.table_name);
    const requiredTables = ['projects', 'embeddings', 'documentation_embeddings', 'batches'];
    
    console.log('📋 Existing tables:', existingTables.length > 0 ? existingTables.join(', ') : 'None');
    
    const missingTables = requiredTables.filter(table => !existingTables.includes(table));
    if (missingTables.length > 0) {
      console.log('⚠️  Missing tables:', missingTables.join(', '));
      console.log('💡 Tables will be created automatically when the application starts');
    } else {
      console.log('✅ All required tables exist');
    }

    // Check embedding column type
    if (existingTables.includes('embeddings')) {
      const columnResult = await client.query(`
        SELECT data_type, udt_name
        FROM information_schema.columns
        WHERE table_name = 'embeddings' AND column_name = 'embedding'
      `);
      
      if (columnResult.rows.length > 0) {
        const columnType = columnResult.rows[0].udt_name || columnResult.rows[0].data_type;
        console.log('📊 Embedding column type:', columnType);
        
        if (columnType === 'vector') {
          console.log('✅ Using pgvector for embeddings');
        } else if (columnType === 'jsonb') {
          console.log('⚠️  Using JSONB fallback for embeddings');
        }
      }
    }

    client.release();
    console.log('\n🎉 Database health check completed successfully!');
    
  } catch (error) {
    console.error('❌ Database health check failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Run the health check
checkDatabase().catch(error => {
  console.error('💥 Unexpected error:', error);
  process.exit(1);
});
