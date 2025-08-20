#!/usr/bin/env node

/**
 * Debug script to investigate embedding storage issues
 * This script will check the current state of the database and help identify
 * why embeddings are not being stored correctly.
 */

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is not set');
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
});

async function debugEmbeddings() {
  const client = await pool.connect();
  
  try {
    console.log('=== Embedding Storage Debug Report ===\n');
    
    // Check if tables exist
    console.log('1. Checking table existence...');
    const tablesQuery = `
      SELECT 
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'projects') as projects_exists,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'embeddings') as embeddings_exists,
        EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'embedding_jobs') as jobs_exists
    `;
    const tablesResult = await client.query(tablesQuery);
    console.log('Tables exist:', tablesResult.rows[0]);
    console.log();
    
    // Check embedding table structure
    console.log('2. Checking embeddings table structure...');
    const structureQuery = `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'embeddings'
      ORDER BY ordinal_position
    `;
    const structureResult = await client.query(structureQuery);
    console.log('Embeddings table columns:');
    structureResult.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });
    console.log();
    
    // Check projects table
    console.log('3. Checking projects table...');
    const projectsQuery = `
      SELECT project_id, name, url, last_processed_at, last_reembedding_at
      FROM projects
      ORDER BY project_id
    `;
    const projectsResult = await client.query(projectsQuery);
    console.log(`Found ${projectsResult.rows.length} projects:`);
    projectsResult.rows.forEach(row => {
      console.log(`  - ID: ${row.project_id}, Name: ${row.name}, Last processed: ${row.last_processed_at}`);
    });
    console.log();
    
    // Check embeddings table
    console.log('4. Checking embeddings table...');
    const embeddingsQuery = `
      SELECT 
        project_id,
        COUNT(*) as embedding_count,
        MAX(updated_at) as last_updated,
        COUNT(DISTINCT file_path) as unique_files
      FROM embeddings
      GROUP BY project_id
      ORDER BY project_id
    `;
    const embeddingsResult = await client.query(embeddingsQuery);
    console.log(`Found embeddings for ${embeddingsResult.rows.length} projects:`);
    embeddingsResult.rows.forEach(row => {
      console.log(`  - Project ${row.project_id}: ${row.embedding_count} embeddings, ${row.unique_files} unique files, last updated: ${row.last_updated}`);
    });
    console.log();
    
    // Check embedding jobs
    console.log('5. Checking embedding jobs...');
    const jobsQuery = `
      SELECT 
        project_id,
        status,
        COUNT(*) as job_count,
        MAX(updated_at) as last_updated
      FROM embedding_jobs
      GROUP BY project_id, status
      ORDER BY project_id, status
    `;
    const jobsResult = await client.query(jobsQuery);
    console.log(`Found ${jobsResult.rows.length} job status groups:`);
    jobsResult.rows.forEach(row => {
      console.log(`  - Project ${row.project_id}, Status: ${row.status}, Count: ${row.job_count}, Last updated: ${row.last_updated}`);
    });
    console.log();
    
    // Check for projects with jobs but no embeddings
    console.log('6. Checking for projects with completed jobs but no embeddings...');
    const mismatchQuery = `
      SELECT 
        j.project_id,
        p.name as project_name,
        COUNT(j.id) as completed_jobs,
        COALESCE(e.embedding_count, 0) as embedding_count
      FROM embedding_jobs j
      LEFT JOIN projects p ON j.project_id = p.project_id
      LEFT JOIN (
        SELECT project_id, COUNT(*) as embedding_count
        FROM embeddings
        GROUP BY project_id
      ) e ON j.project_id = e.project_id
      WHERE j.status = 'completed'
      GROUP BY j.project_id, p.name, e.embedding_count
      HAVING COALESCE(e.embedding_count, 0) = 0
      ORDER BY j.project_id
    `;
    const mismatchResult = await client.query(mismatchQuery);
    console.log(`Found ${mismatchResult.rows.length} projects with completed jobs but no embeddings:`);
    mismatchResult.rows.forEach(row => {
      console.log(`  - Project ${row.project_id} (${row.project_name}): ${row.completed_jobs} completed jobs, ${row.embedding_count} embeddings`);
    });
    console.log();
    
    // Check recent job errors
    console.log('7. Checking recent job errors...');
    const errorsQuery = `
      SELECT 
        project_id,
        status,
        error,
        updated_at
      FROM embedding_jobs
      WHERE error IS NOT NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    const errorsResult = await client.query(errorsQuery);
    console.log(`Found ${errorsResult.rows.length} recent jobs with errors:`);
    errorsResult.rows.forEach(row => {
      console.log(`  - Project ${row.project_id}, Status: ${row.status}, Error: ${row.error?.substring(0, 100)}..., Time: ${row.updated_at}`);
    });
    
    console.log('\n=== Debug Report Complete ===');
    
  } catch (error) {
    console.error('Error running debug script:', error);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the debug script
debugEmbeddings().catch(console.error);
