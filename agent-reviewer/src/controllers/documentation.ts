import { Request, Response } from 'express';
import { documentationService } from '../services/documentation.js';
import { dbService } from '../services/database.js';
import { DocumentationSource } from '../models/embedding.js';

/**
 * Add a new documentation source
 */
export async function addDocumentationSource(req: Request, res: Response): Promise<void> {
  try {
    const {
      name,
      description,
      url,
      framework,
      version,
      isActive = true,
      refreshIntervalDays = 7
    } = req.body;

    // Validate required fields
    if (!name || !url || !framework) {
      res.status(400).json({
        error: 'Missing required fields: name, url, framework'
      });
      return;
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      res.status(400).json({
        error: 'Invalid URL format'
      });
      return;
    }

    const source = await documentationService.addDocumentationSource({
      name,
      description: description || '',
      url,
      framework,
      version,
      isActive,
      refreshIntervalDays,
      lastFetchedAt: undefined,
      lastEmbeddedAt: undefined,
      fetchStatus: 'pending',
      fetchError: undefined
    });

    res.status(201).json({
      success: true,
      source
    });
  } catch (error) {
    console.error('Error adding documentation source:', error);
    res.status(500).json({
      error: 'Failed to add documentation source',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get all documentation sources
 */
export async function getDocumentationSources(req: Request, res: Response): Promise<void> {
  try {
    const { framework, active } = req.query;

    let sources: DocumentationSource[];

    if (framework) {
      const frameworks = Array.isArray(framework) ? framework as string[] : [framework as string];
      sources = await dbService.getDocumentationSourcesByFrameworks(frameworks);
    } else {
      // Get all sources - we need to implement this method
      sources = await getAllDocumentationSources();
    }

    // Filter by active status if specified
    if (active !== undefined) {
      const isActive = active === 'true';
      sources = sources.filter(source => source.isActive === isActive);
    }

    res.json({
      success: true,
      sources,
      total: sources.length
    });
  } catch (error) {
    console.error('Error getting documentation sources:', error);
    res.status(500).json({
      error: 'Failed to get documentation sources',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get a specific documentation source
 */
export async function getDocumentationSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const source = await dbService.getDocumentationSource(id);

    if (!source) {
      res.status(404).json({
        error: 'Documentation source not found'
      });
      return;
    }

    res.json({
      success: true,
      source
    });
  } catch (error) {
    console.error('Error getting documentation source:', error);
    res.status(500).json({
      error: 'Failed to get documentation source',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Update a documentation source
 */
export async function updateDocumentationSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Validate URL if provided
    if (updates.url) {
      try {
        new URL(updates.url);
      } catch {
        res.status(400).json({
          error: 'Invalid URL format'
        });
        return;
      }
    }

    const updatedSource = await documentationService.updateDocumentationSource(id, updates);

    if (!updatedSource) {
      res.status(404).json({
        error: 'Documentation source not found'
      });
      return;
    }

    res.json({
      success: true,
      source: updatedSource
    });
  } catch (error) {
    console.error('Error updating documentation source:', error);
    res.status(500).json({
      error: 'Failed to update documentation source',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Delete a documentation source
 */
export async function deleteDocumentationSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const deleted = await documentationService.deleteDocumentationSource(id);

    if (!deleted) {
      res.status(404).json({
        error: 'Documentation source not found'
      });
      return;
    }

    res.json({
      success: true,
      message: 'Documentation source deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting documentation source:', error);
    res.status(500).json({
      error: 'Failed to delete documentation source',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Trigger re-embedding of a documentation source
 */
export async function reembedDocumentationSource(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    const source = await dbService.getDocumentationSource(id);

    if (!source) {
      res.status(404).json({
        error: 'Documentation source not found'
      });
      return;
    }

    await documentationService.queueDocumentationEmbedding(id);

    res.json({
      success: true,
      message: 'Documentation re-embedding queued successfully'
    });
  } catch (error) {
    console.error('Error triggering documentation re-embedding:', error);
    res.status(500).json({
      error: 'Failed to trigger documentation re-embedding',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Map a project to documentation sources
 */
export async function mapProjectToDocumentation(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;
    const { sourceId, priority = 1, isEnabled = true } = req.body;

    if (!sourceId) {
      res.status(400).json({
        error: 'Missing required field: sourceId'
      });
      return;
    }

    const mapping = await documentationService.mapProjectToDocumentation(
      parseInt(projectId, 10),
      sourceId,
      priority,
      isEnabled
    );

    res.json({
      success: true,
      mapping
    });
  } catch (error) {
    console.error('Error mapping project to documentation:', error);
    res.status(500).json({
      error: 'Failed to map project to documentation',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

/**
 * Get project documentation mappings
 */
export async function getProjectDocumentationMappings(req: Request, res: Response): Promise<void> {
  try {
    const { projectId } = req.params;

    const mappings = await dbService.getProjectDocumentationMappings(parseInt(projectId, 10));

    res.json({
      success: true,
      mappings,
      total: mappings.length
    });
  } catch (error) {
    console.error('Error getting project documentation mappings:', error);
    res.status(500).json({
      error: 'Failed to get project documentation mappings',
      details: error instanceof Error ? error.message : String(error)
    });
  }
}

// Helper function to get all documentation sources
async function getAllDocumentationSources(): Promise<DocumentationSource[]> {
  return await dbService.getAllDocumentationSources();
}
