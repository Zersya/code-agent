#!/usr/bin/env ts-node

/**
 * Migration script to move embeddings from PostgreSQL to QDrant
 * 
 * Usage:
 *   npm run migrate:qdrant [options]
 * 
 * Options:
 *   --dry-run          Run without actually migrating data
 *   --batch-size=N     Number of embeddings to process per batch (default: 100)
 *   --validate         Validate data before migration (default: true)
 *   --skip-existing    Skip existing embeddings in QDrant (default: false)
 *   --continue-on-error Continue migration even if some batches fail (default: true)
 *   --verify           Verify migration integrity after completion (default: true)
 */

import dotenv from 'dotenv';
import { migrationService } from '../src/services/migration.js';
import { qdrantService } from '../src/services/qdrant.js';
import { dbService } from '../src/services/database.js';
import { MigrationOptions } from '../src/models/qdrant.js';

// Load environment variables
dotenv.config();

interface CliOptions {
  dryRun: boolean;
  batchSize: number;
  validate: boolean;
  skipExisting: boolean;
  continueOnError: boolean;
  verify: boolean;
  help: boolean;
}

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: CliOptions = {
    dryRun: false,
    batchSize: 100,
    validate: true,
    skipExisting: false,
    continueOnError: true,
    verify: true,
    help: false
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg.startsWith('--batch-size=')) {
      options.batchSize = parseInt(arg.split('=')[1], 10) || 100;
    } else if (arg === '--no-validate') {
      options.validate = false;
    } else if (arg === '--skip-existing') {
      options.skipExisting = true;
    } else if (arg === '--no-continue-on-error') {
      options.continueOnError = false;
    } else if (arg === '--no-verify') {
      options.verify = false;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    }
  }

  return options;
}

function printHelp(): void {
  console.log(`
QDrant Migration Script

Usage: npm run migrate:qdrant [options]

Options:
  --dry-run              Run without actually migrating data
  --batch-size=N         Number of embeddings to process per batch (default: 100)
  --no-validate          Skip data validation before migration
  --skip-existing        Skip existing embeddings in QDrant
  --no-continue-on-error Stop migration if any batch fails
  --no-verify            Skip migration integrity verification
  --help, -h             Show this help message

Examples:
  npm run migrate:qdrant --dry-run
  npm run migrate:qdrant --batch-size=50 --no-verify
  npm run migrate:qdrant --skip-existing --continue-on-error

Environment Variables:
  QDRANT_URL             QDrant server URL (default: http://localhost:6333)
  QDRANT_API_KEY         QDrant API key (optional)
  DATABASE_URL           PostgreSQL connection string
`);
}

async function checkPrerequisites(): Promise<void> {
  console.log('Checking prerequisites...');

  // Check database connection
  try {
    await dbService.healthCheck();
    console.log('✓ Database connection successful');
  } catch (error) {
    console.error('✗ Database connection failed:', error);
    throw new Error('Database is not accessible');
  }

  // Check QDrant connection
  try {
    const isHealthy = await qdrantService.healthCheck();
    if (!isHealthy) {
      throw new Error('QDrant health check failed');
    }
    console.log('✓ QDrant connection successful');
  } catch (error) {
    console.error('✗ QDrant connection failed:', error);
    throw new Error('QDrant is not accessible');
  }

  // Check QDrant collections
  try {
    await qdrantService.initializeCollections();
    console.log('✓ QDrant collections initialized');
  } catch (error) {
    console.error('✗ QDrant collection initialization failed:', error);
    throw new Error('Failed to initialize QDrant collections');
  }
}

async function printMigrationSummary(): Promise<void> {
  console.log('\n=== Migration Summary ===');

  try {
    // Get database counts
    const projects = await dbService.getAllProjects();
    const sources = await dbService.getAllDocumentationSources();
    
    let totalCodeEmbeddings = 0;
    let totalDocEmbeddings = 0;

    for (const project of projects) {
      const embeddings = await dbService.getEmbeddingsByProject(project.projectId);
      totalCodeEmbeddings += embeddings.length;
    }

    for (const source of sources) {
      const embeddings = await dbService.getDocumentationEmbeddingsBySource(source.id);
      totalDocEmbeddings += embeddings.length;
    }

    console.log(`Projects: ${projects.length}`);
    console.log(`Code embeddings: ${totalCodeEmbeddings}`);
    console.log(`Documentation sources: ${sources.length}`);
    console.log(`Documentation embeddings: ${totalDocEmbeddings}`);
    console.log(`Total embeddings to migrate: ${totalCodeEmbeddings + totalDocEmbeddings}`);

    // Get QDrant stats
    const qdrantStats = await qdrantService.getCollectionStats();
    console.log('\nCurrent QDrant state:');
    console.log(`Code embeddings in QDrant: ${qdrantStats.codeEmbeddings.count}`);
    console.log(`Documentation embeddings in QDrant: ${qdrantStats.documentationEmbeddings.count}`);

  } catch (error) {
    console.error('Error getting migration summary:', error);
  }
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  console.log('🚀 Starting QDrant Migration');
  console.log('============================');

  if (options.dryRun) {
    console.log('🔍 DRY RUN MODE - No data will be migrated');
  }

  try {
    // Check prerequisites
    await checkPrerequisites();

    // Print migration summary
    await printMigrationSummary();

    // Confirm migration
    if (!options.dryRun) {
      console.log('\n⚠️  This will migrate all embeddings from PostgreSQL to QDrant.');
      console.log('Make sure you have backed up your data before proceeding.');
      
      // In a real implementation, you might want to add a confirmation prompt here
      // For now, we'll proceed automatically
    }

    // Prepare migration options
    const migrationOptions: MigrationOptions = {
      batchSize: options.batchSize,
      validateData: options.validate,
      skipExisting: options.skipExisting,
      dryRun: options.dryRun,
      continueOnError: options.continueOnError
    };

    console.log('\nMigration options:', migrationOptions);

    // Start migration
    const startTime = Date.now();
    console.log('\n🔄 Starting migration...');

    const progress = await migrationService.migrateAllEmbeddings(migrationOptions);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000;

    // Print results
    console.log('\n✅ Migration completed!');
    console.log('======================');
    console.log(`Duration: ${duration.toFixed(2)} seconds`);
    console.log(`Total records: ${progress.totalRecords}`);
    console.log(`Migrated: ${progress.migratedRecords}`);
    console.log(`Failed: ${progress.failedRecords}`);
    console.log(`Success rate: ${((progress.migratedRecords / progress.totalRecords) * 100).toFixed(2)}%`);

    if (progress.errors.length > 0) {
      console.log(`\n⚠️  Errors encountered: ${progress.errors.length}`);
      progress.errors.slice(0, 5).forEach((error, index) => {
        console.log(`${index + 1}. ${error}`);
      });
      if (progress.errors.length > 5) {
        console.log(`... and ${progress.errors.length - 5} more errors`);
      }
    }

    // Verify migration if requested
    if (options.verify && !options.dryRun) {
      console.log('\n🔍 Verifying migration integrity...');
      const verification = await migrationService.verifyMigration();
      
      console.log('\nVerification Results:');
      console.log(`Code embeddings - DB: ${verification.codeEmbeddings.database}, QDrant: ${verification.codeEmbeddings.qdrant}, Match: ${verification.codeEmbeddings.match ? '✅' : '❌'}`);
      console.log(`Documentation embeddings - DB: ${verification.documentationEmbeddings.database}, QDrant: ${verification.documentationEmbeddings.qdrant}, Match: ${verification.documentationEmbeddings.match ? '✅' : '❌'}`);

      if (verification.codeEmbeddings.match && verification.documentationEmbeddings.match) {
        console.log('\n✅ Migration verification successful!');
      } else {
        console.log('\n❌ Migration verification failed - counts do not match');
        process.exit(1);
      }
    }

    // Next steps
    if (!options.dryRun) {
      console.log('\n📋 Next Steps:');
      console.log('1. Update your .env file to set USE_QDRANT=true');
      console.log('2. Restart your application to use QDrant');
      console.log('3. Monitor the application for any issues');
      console.log('4. Once stable, you can optionally remove embeddings from PostgreSQL');
    }

  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('Unhandled rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  process.exit(1);
});

// Run the migration
main().catch((error) => {
  console.error('Migration script failed:', error);
  process.exit(1);
});
