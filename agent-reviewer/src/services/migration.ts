import { dbService } from './database.js';
import { qdrantService } from './qdrant.js';
import { CodeEmbedding, DocumentationEmbedding } from '../models/embedding.js';
import { MigrationProgress, MigrationOptions } from '../models/qdrant.js';

/**
 * Migration service for moving embeddings from PostgreSQL to QDrant
 */
export class MigrationService {
  private progress: MigrationProgress | null = null;

  /**
   * Migrate all embeddings from PostgreSQL to QDrant
   */
  async migrateAllEmbeddings(options: MigrationOptions = {
    batchSize: 100,
    validateData: true,
    skipExisting: false,
    dryRun: false,
    continueOnError: true
  }): Promise<MigrationProgress> {
    console.log('Starting migration from PostgreSQL to QDrant...');
    console.log('Migration options:', options);

    if (options.dryRun) {
      console.log('DRY RUN MODE - No data will be migrated');
    }

    // Initialize QDrant collections
    if (!options.dryRun) {
      await qdrantService.initializeCollections();
    }

    // Migrate code embeddings
    const codeProgress = await this.migrateCodeEmbeddings(options);
    
    // Migrate documentation embeddings
    const docsProgress = await this.migrateDocumentationEmbeddings(options);

    // Combine progress
    const totalProgress: MigrationProgress = {
      totalRecords: codeProgress.totalRecords + docsProgress.totalRecords,
      migratedRecords: codeProgress.migratedRecords + docsProgress.migratedRecords,
      failedRecords: codeProgress.failedRecords + docsProgress.failedRecords,
      currentBatch: Math.max(codeProgress.currentBatch, docsProgress.currentBatch),
      totalBatches: codeProgress.totalBatches + docsProgress.totalBatches,
      startTime: codeProgress.startTime,
      errors: [...codeProgress.errors, ...docsProgress.errors]
    };

    console.log('Migration completed!');
    console.log(`Total records: ${totalProgress.totalRecords}`);
    console.log(`Migrated: ${totalProgress.migratedRecords}`);
    console.log(`Failed: ${totalProgress.failedRecords}`);
    console.log(`Errors: ${totalProgress.errors.length}`);

    return totalProgress;
  }

  /**
   * Migrate code embeddings
   */
  async migrateCodeEmbeddings(options: MigrationOptions): Promise<MigrationProgress> {
    console.log('Migrating code embeddings...');
    
    const startTime = new Date();
    let migratedRecords = 0;
    let failedRecords = 0;
    const errors: string[] = [];

    try {
      // Get all projects to migrate
      const projects = await dbService.getAllProjects();
      console.log(`Found ${projects.length} projects to migrate`);

      let totalRecords = 0;
      let currentBatch = 0;

      // Count total records first
      for (const project of projects) {
        const embeddings = await dbService.getEmbeddingsByProject(project.projectId);
        totalRecords += embeddings.length;
      }

      const totalBatches = Math.ceil(totalRecords / options.batchSize);

      this.progress = {
        totalRecords,
        migratedRecords: 0,
        failedRecords: 0,
        currentBatch: 0,
        totalBatches,
        startTime,
        errors: []
      };

      // Migrate each project
      for (const project of projects) {
        console.log(`Migrating project ${project.projectId}: ${project.name}`);
        
        try {
          const embeddings = await dbService.getEmbeddingsByProject(project.projectId);
          console.log(`Found ${embeddings.length} embeddings for project ${project.projectId}`);

          // Process in batches
          for (let i = 0; i < embeddings.length; i += options.batchSize) {
            currentBatch++;
            const batch = embeddings.slice(i, i + options.batchSize);
            
            console.log(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} embeddings)`);

            try {
              if (options.validateData) {
                // Validate embeddings before migration
                const validEmbeddings = this.validateCodeEmbeddings(batch);
                if (validEmbeddings.length !== batch.length) {
                  const invalidCount = batch.length - validEmbeddings.length;
                  console.warn(`Skipping ${invalidCount} invalid embeddings in batch ${currentBatch}`);
                  failedRecords += invalidCount;
                }
                
                if (validEmbeddings.length === 0) {
                  continue;
                }

                if (!options.dryRun) {
                  await qdrantService.batchUpsertCodeEmbeddings(validEmbeddings);
                }
                migratedRecords += validEmbeddings.length;
              } else {
                if (!options.dryRun) {
                  await qdrantService.batchUpsertCodeEmbeddings(batch);
                }
                migratedRecords += batch.length;
              }

              this.progress.migratedRecords = migratedRecords;
              this.progress.failedRecords = failedRecords;
              this.progress.currentBatch = currentBatch;

              // Log progress every 10 batches
              if (currentBatch % 10 === 0) {
                const progressPercent = ((migratedRecords + failedRecords) / totalRecords * 100).toFixed(2);
                console.log(`Progress: ${progressPercent}% (${migratedRecords + failedRecords}/${totalRecords})`);
              }

            } catch (error) {
              const errorMsg = `Error migrating batch ${currentBatch}: ${error instanceof Error ? error.message : String(error)}`;
              console.error(errorMsg);
              errors.push(errorMsg);
              failedRecords += batch.length;

              if (!options.continueOnError) {
                throw error;
              }
            }
          }
        } catch (error) {
          const errorMsg = `Error migrating project ${project.projectId}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          errors.push(errorMsg);

          if (!options.continueOnError) {
            throw error;
          }
        }
      }

      return {
        totalRecords,
        migratedRecords,
        failedRecords,
        currentBatch,
        totalBatches,
        startTime,
        errors
      };

    } catch (error) {
      console.error('Fatal error during code embeddings migration:', error);
      throw error;
    }
  }

  /**
   * Migrate documentation embeddings
   */
  async migrateDocumentationEmbeddings(options: MigrationOptions): Promise<MigrationProgress> {
    console.log('Migrating documentation embeddings...');
    
    const startTime = new Date();
    let migratedRecords = 0;
    let failedRecords = 0;
    const errors: string[] = [];

    try {
      // Get all documentation sources
      const sources = await dbService.getAllDocumentationSources();
      console.log(`Found ${sources.length} documentation sources to migrate`);

      let totalRecords = 0;
      let currentBatch = 0;

      // Count total records first
      for (const source of sources) {
        const embeddings = await dbService.getDocumentationEmbeddingsBySource(source.id);
        totalRecords += embeddings.length;
      }

      const totalBatches = Math.ceil(totalRecords / options.batchSize);

      // Migrate each source
      for (const source of sources) {
        console.log(`Migrating documentation source ${source.id}: ${source.name}`);
        
        try {
          const embeddings = await dbService.getDocumentationEmbeddingsBySource(source.id);
          console.log(`Found ${embeddings.length} embeddings for source ${source.id}`);

          // Process in batches
          for (let i = 0; i < embeddings.length; i += options.batchSize) {
            currentBatch++;
            const batch = embeddings.slice(i, i + options.batchSize);
            
            console.log(`Processing batch ${currentBatch}/${totalBatches} (${batch.length} embeddings)`);

            try {
              if (options.validateData) {
                // Validate embeddings before migration
                const validEmbeddings = this.validateDocumentationEmbeddings(batch);
                if (validEmbeddings.length !== batch.length) {
                  const invalidCount = batch.length - validEmbeddings.length;
                  console.warn(`Skipping ${invalidCount} invalid embeddings in batch ${currentBatch}`);
                  failedRecords += invalidCount;
                }
                
                if (validEmbeddings.length === 0) {
                  continue;
                }

                if (!options.dryRun) {
                  await qdrantService.batchUpsertDocumentationEmbeddings(validEmbeddings);
                }
                migratedRecords += validEmbeddings.length;
              } else {
                if (!options.dryRun) {
                  await qdrantService.batchUpsertDocumentationEmbeddings(batch);
                }
                migratedRecords += batch.length;
              }

              // Log progress every 10 batches
              if (currentBatch % 10 === 0) {
                const progressPercent = ((migratedRecords + failedRecords) / totalRecords * 100).toFixed(2);
                console.log(`Progress: ${progressPercent}% (${migratedRecords + failedRecords}/${totalRecords})`);
              }

            } catch (error) {
              const errorMsg = `Error migrating batch ${currentBatch}: ${error instanceof Error ? error.message : String(error)}`;
              console.error(errorMsg);
              errors.push(errorMsg);
              failedRecords += batch.length;

              if (!options.continueOnError) {
                throw error;
              }
            }
          }
        } catch (error) {
          const errorMsg = `Error migrating source ${source.id}: ${error instanceof Error ? error.message : String(error)}`;
          console.error(errorMsg);
          errors.push(errorMsg);

          if (!options.continueOnError) {
            throw error;
          }
        }
      }

      return {
        totalRecords,
        migratedRecords,
        failedRecords,
        currentBatch,
        totalBatches,
        startTime,
        errors
      };

    } catch (error) {
      console.error('Fatal error during documentation embeddings migration:', error);
      throw error;
    }
  }

  /**
   * Validate code embeddings
   */
  private validateCodeEmbeddings(embeddings: CodeEmbedding[]): CodeEmbedding[] {
    return embeddings.filter(embedding => {
      // Check required fields
      if (!embedding.projectId || !embedding.filePath || !embedding.content) {
        console.warn(`Invalid code embedding: missing required fields for ${embedding.filePath}`);
        return false;
      }

      // Check embedding vector
      if (!embedding.embedding || !Array.isArray(embedding.embedding) || embedding.embedding.length !== 1536) {
        console.warn(`Invalid code embedding: invalid vector for ${embedding.filePath}`);
        return false;
      }

      // Check for NaN or infinite values in embedding
      if (embedding.embedding.some(val => !isFinite(val))) {
        console.warn(`Invalid code embedding: non-finite values in vector for ${embedding.filePath}`);
        return false;
      }

      return true;
    });
  }

  /**
   * Validate documentation embeddings
   */
  private validateDocumentationEmbeddings(embeddings: DocumentationEmbedding[]): DocumentationEmbedding[] {
    return embeddings.filter(embedding => {
      // Check required fields
      if (!embedding.id || !embedding.sourceId || !embedding.title || !embedding.content) {
        console.warn(`Invalid documentation embedding: missing required fields for ${embedding.id}`);
        return false;
      }

      // Check embedding vector
      if (!embedding.embedding || !Array.isArray(embedding.embedding) || embedding.embedding.length !== 1536) {
        console.warn(`Invalid documentation embedding: invalid vector for ${embedding.id}`);
        return false;
      }

      // Check for NaN or infinite values in embedding
      if (embedding.embedding.some(val => !isFinite(val))) {
        console.warn(`Invalid documentation embedding: non-finite values in vector for ${embedding.id}`);
        return false;
      }

      return true;
    });
  }

  /**
   * Get current migration progress
   */
  getProgress(): MigrationProgress | null {
    return this.progress;
  }

  /**
   * Verify migration integrity
   */
  async verifyMigration(): Promise<{
    codeEmbeddings: { database: number; qdrant: number; match: boolean };
    documentationEmbeddings: { database: number; qdrant: number; match: boolean };
  }> {
    console.log('Verifying migration integrity...');

    try {
      // Count records in database
      const dbCodeCount = await this.countDatabaseCodeEmbeddings();
      const dbDocsCount = await this.countDatabaseDocumentationEmbeddings();

      // Count records in QDrant
      const qdrantStats = await qdrantService.getCollectionStats();
      const qdrantCodeCount = qdrantStats.codeEmbeddings.count;
      const qdrantDocsCount = qdrantStats.documentationEmbeddings.count;

      const result = {
        codeEmbeddings: {
          database: dbCodeCount,
          qdrant: qdrantCodeCount,
          match: dbCodeCount === qdrantCodeCount
        },
        documentationEmbeddings: {
          database: dbDocsCount,
          qdrant: qdrantDocsCount,
          match: dbDocsCount === qdrantDocsCount
        }
      };

      console.log('Migration verification results:', result);
      return result;

    } catch (error) {
      console.error('Error verifying migration:', error);
      throw error;
    }
  }

  /**
   * Count code embeddings in database
   */
  private async countDatabaseCodeEmbeddings(): Promise<number> {
    // This method would need to be implemented in the database service
    // For now, we'll estimate based on projects
    const projects = await dbService.getAllProjects();
    let total = 0;
    
    for (const project of projects) {
      const embeddings = await dbService.getEmbeddingsByProject(project.projectId);
      total += embeddings.length;
    }
    
    return total;
  }

  /**
   * Count documentation embeddings in database
   */
  private async countDatabaseDocumentationEmbeddings(): Promise<number> {
    // This method would need to be implemented in the database service
    const sources = await dbService.getAllDocumentationSources();
    let total = 0;
    
    for (const source of sources) {
      const embeddings = await dbService.getDocumentationEmbeddingsBySource(source.id);
      total += embeddings.length;
    }
    
    return total;
  }
}

export const migrationService = new MigrationService();
