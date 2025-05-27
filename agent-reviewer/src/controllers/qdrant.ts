import { Request, Response } from 'express';
import { qdrantService } from '../services/qdrant.js';
import { hybridDbService } from '../services/hybrid-database.js';
import { migrationService } from '../services/migration.js';
import { MigrationOptions } from '../models/qdrant.js';

/**
 * Get QDrant service status
 */
export const getQdrantStatus = async (_req: Request, res: Response): Promise<void> => {
  try {
    const status = await hybridDbService.getStatus();
    const config = hybridDbService.getConfig();
    
    let qdrantStats = null;
    if (status.qdrant.available) {
      try {
        qdrantStats = await qdrantService.getCollectionStats();
      } catch (error) {
        console.error('Error getting QDrant stats:', error);
      }
    }

    res.status(200).json({
      status,
      config,
      stats: qdrantStats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting QDrant status:', error);
    res.status(500).json({ error: 'Failed to get QDrant status' });
  }
};

/**
 * Get QDrant collection information
 */
export const getCollectionInfo = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collection } = req.params;
    
    if (!collection || !['code', 'documentation'].includes(collection)) {
      res.status(400).json({ error: 'Invalid collection name. Must be "code" or "documentation"' });
      return;
    }

    const config = qdrantService.getConfig();
    const collectionName = collection === 'code' 
      ? config.collections.code 
      : config.collections.documentation;

    const info = await qdrantService.getCollectionInfo(collectionName);
    
    if (!info) {
      res.status(404).json({ error: `Collection ${collectionName} not found` });
      return;
    }

    res.status(200).json({
      collection: collectionName,
      info,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting collection info:', error);
    res.status(500).json({ error: 'Failed to get collection information' });
  }
};

/**
 * Enable QDrant mode
 */
export const enableQdrant = async (_req: Request, res: Response): Promise<void> => {
  try {
    await hybridDbService.enableQdrant();
    
    res.status(200).json({
      message: 'QDrant mode enabled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error enabling QDrant:', error);
    res.status(500).json({ error: 'Failed to enable QDrant mode' });
  }
};

/**
 * Disable QDrant mode (switch to database-only)
 */
export const disableQdrant = async (_req: Request, res: Response): Promise<void> => {
  try {
    hybridDbService.disableQdrant();
    
    res.status(200).json({
      message: 'QDrant mode disabled, switched to database-only mode',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error disabling QDrant:', error);
    res.status(500).json({ error: 'Failed to disable QDrant mode' });
  }
};

/**
 * Start migration from database to QDrant
 */
export const startMigration = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      batchSize = 100,
      validateData = true,
      skipExisting = false,
      dryRun = false,
      continueOnError = true
    } = req.body;

    const options: MigrationOptions = {
      batchSize: Number(batchSize),
      validateData: Boolean(validateData),
      skipExisting: Boolean(skipExisting),
      dryRun: Boolean(dryRun),
      continueOnError: Boolean(continueOnError)
    };

    // Start migration in background
    migrationService.migrateAllEmbeddings(options)
      .then(progress => {
        console.log('Migration completed:', progress);
      })
      .catch(error => {
        console.error('Migration failed:', error);
      });

    res.status(202).json({
      message: 'Migration started',
      options,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error starting migration:', error);
    res.status(500).json({ error: 'Failed to start migration' });
  }
};

/**
 * Get migration progress
 */
export const getMigrationProgress = async (_req: Request, res: Response): Promise<void> => {
  try {
    const progress = migrationService.getProgress();
    
    if (!progress) {
      res.status(404).json({ error: 'No migration in progress' });
      return;
    }

    // Calculate estimated time remaining
    const now = new Date();
    const elapsed = now.getTime() - progress.startTime.getTime();
    const rate = progress.migratedRecords / (elapsed / 1000); // records per second
    const remaining = progress.totalRecords - progress.migratedRecords - progress.failedRecords;
    const estimatedTimeRemaining = rate > 0 ? remaining / rate : null;

    res.status(200).json({
      ...progress,
      elapsedTime: elapsed,
      estimatedTimeRemaining,
      rate: rate.toFixed(2),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting migration progress:', error);
    res.status(500).json({ error: 'Failed to get migration progress' });
  }
};

/**
 * Verify migration integrity
 */
export const verifyMigration = async (_req: Request, res: Response): Promise<void> => {
  try {
    const verification = await migrationService.verifyMigration();
    
    const isValid = verification.codeEmbeddings.match && verification.documentationEmbeddings.match;
    
    res.status(200).json({
      verification,
      isValid,
      message: isValid ? 'Migration verification successful' : 'Migration verification failed - counts do not match',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error verifying migration:', error);
    res.status(500).json({ error: 'Failed to verify migration' });
  }
};

/**
 * Clear QDrant collection
 */
export const clearCollection = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collection } = req.params;
    const { confirm } = req.body;
    
    if (!collection || !['code', 'documentation'].includes(collection)) {
      res.status(400).json({ error: 'Invalid collection name. Must be "code" or "documentation"' });
      return;
    }

    if (!confirm) {
      res.status(400).json({ error: 'Confirmation required. Send { "confirm": true } in request body' });
      return;
    }

    const config = qdrantService.getConfig();
    const collectionName = collection === 'code' 
      ? config.collections.code 
      : config.collections.documentation;

    await qdrantService.clearCollection(collectionName);
    
    res.status(200).json({
      message: `Collection ${collectionName} cleared successfully`,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing collection:', error);
    res.status(500).json({ error: 'Failed to clear collection' });
  }
};

/**
 * Search embeddings in QDrant
 */
export const searchEmbeddings = async (req: Request, res: Response): Promise<void> => {
  try {
    const { collection } = req.params;
    const { query, limit = 10, projectId, frameworks, scoreThreshold } = req.body;
    
    if (!collection || !['code', 'documentation'].includes(collection)) {
      res.status(400).json({ error: 'Invalid collection name. Must be "code" or "documentation"' });
      return;
    }

    if (!query) {
      res.status(400).json({ error: 'Query is required' });
      return;
    }

    // Generate embedding for the query (you'd need to import embeddingService)
    // For now, we'll return a placeholder response
    res.status(501).json({ error: 'Search functionality not yet implemented in this endpoint' });
  } catch (error) {
    console.error('Error searching embeddings:', error);
    res.status(500).json({ error: 'Failed to search embeddings' });
  }
};

/**
 * Get QDrant health check
 */
export const getQdrantHealth = async (_req: Request, res: Response): Promise<void> => {
  try {
    const isHealthy = await qdrantService.healthCheck();
    
    res.status(isHealthy ? 200 : 503).json({
      healthy: isHealthy,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error checking QDrant health:', error);
    res.status(503).json({ 
      healthy: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
  }
};
