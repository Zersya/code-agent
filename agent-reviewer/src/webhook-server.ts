import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { webhookAuth } from './middleware/webhook-auth.js';
import { apiAuth } from './middleware/api-auth.js';
import { adminAuth } from './middleware/admin-auth.js';
import { processWebhook } from './controllers/webhook.js';
import { processRepository, getRepositoryStatus, getQueueStatus, retryRepositoryJob, cancelRepositoryJob, deleteRepositoryJob } from './controllers/repository.js';
import { searchCode, listProjects, updateProjectAutoReview, updateProjectAutoApprove, getProjectAutoReview, getProjectAutoApprove } from './controllers/search.js';
import {
  addDocumentationSource,
  getDocumentationSources,
  getDocumentationSource,
  updateDocumentationSource,
  deleteDocumentationSource,
  reembedDocumentationSource,
  retryDocumentationJob,
  mapProjectToDocumentation,
  getProjectDocumentationMappings
} from './controllers/documentation.js';
import { adminLogin, adminLogout, getAdminUser } from './controllers/admin-auth.js';
import { getReviewHistory, exportReviewHistory } from './controllers/admin-reviews.js';
import { getMergeRequests, getMergeRequest, getUserMRStatistics, exportMergeRequests, updateMergeRequestFixesCount, updateMergeRequestReviewStatus } from './controllers/admin-merge-requests.js';
import {
  getAnalytics,
  getSystemHealth,
  getDeveloperPerformanceAnalytics,
  getMRQualityAnalytics,
  getIssueTrackingAnalytics,
  getCompletionRate,
  getTeamCompletionRates,
  getCompletionRateTrends,
  getProjectCompletionRates,
  getCompletionRateStats
} from './controllers/admin-analytics.js';
import {
  getWhatsAppConfigurations,
  getWhatsAppConfiguration,
  upsertWhatsAppConfiguration,
  deleteWhatsAppConfiguration,
  testWhatsAppMessage,
  getWhatsAppServiceStatus
} from './controllers/whatsapp.js';
import { dbService } from './services/database.js';
import { webhookDeduplicationService } from './services/webhook-deduplication.js';
import { monitoringService } from './services/monitoring.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 9080;

// Middleware
app.use(morgan('dev'));
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Health check endpoints
app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

// Comprehensive system health endpoint
app.get('/health/system', async (_req, res) => {
  try {
    const systemHealth = await monitoringService.getSystemHealth();
    const statusCode = systemHealth.overall === 'healthy' ? 200 :
                      systemHealth.overall === 'degraded' ? 200 : 503;
    res.status(statusCode).json(systemHealth);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get system health',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Embedding service metrics endpoint
app.get('/health/embedding', async (_req, res) => {
  try {
    const metrics = await monitoringService.getEmbeddingMetrics();
    res.status(200).json(metrics);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get embedding metrics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Queue statistics endpoint
app.get('/health/queue', async (_req, res) => {
  try {
    const stats = await monitoringService.getQueueStatistics();
    res.status(200).json(stats);
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get queue statistics',
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Webhook endpoint
app.post('/webhook', webhookAuth, processWebhook);

// API endpoints
// Repository embedding API
app.post('/api/repositories/embed', apiAuth, processRepository);
app.get('/api/repositories/status/:processingId', apiAuth, getRepositoryStatus);
app.post('/api/repositories/retry/:processingId', apiAuth, retryRepositoryJob);
app.post('/api/repositories/cancel/:processingId', apiAuth, cancelRepositoryJob);
app.delete('/api/repositories/job/:processingId', apiAuth, deleteRepositoryJob);
app.get('/api/queue/status', apiAuth, getQueueStatus);

// Code search API
app.post('/api/search', apiAuth, searchCode);
app.get('/api/projects', apiAuth, listProjects);

// Project auto review API
app.put('/api/projects/:projectId/auto-review', adminAuth, updateProjectAutoReview);
app.get('/api/projects/:projectId/auto-review', apiAuth, getProjectAutoReview);

// Project auto approve API
app.put('/api/projects/:projectId/auto-approve', adminAuth, updateProjectAutoApprove);
app.get('/api/projects/:projectId/auto-approve', apiAuth, getProjectAutoApprove);

// Documentation API
app.post('/api/documentation/sources', apiAuth, addDocumentationSource);
app.get('/api/documentation/sources', apiAuth, getDocumentationSources);
app.get('/api/documentation/sources/:id', apiAuth, getDocumentationSource);
app.put('/api/documentation/sources/:id', apiAuth, updateDocumentationSource);
app.delete('/api/documentation/sources/:id', apiAuth, deleteDocumentationSource);
app.post('/api/documentation/sources/:id/reembed', apiAuth, reembedDocumentationSource);
app.post('/api/documentation/retry/:processingId', apiAuth, retryDocumentationJob);

// Project documentation mapping API
app.post('/api/projects/:projectId/documentation', apiAuth, mapProjectToDocumentation);
app.get('/api/projects/:projectId/documentation', apiAuth, getProjectDocumentationMappings);

// Webhook processing statistics API
app.get('/api/webhook/stats', apiAuth, async (_req, res) => {
  try {
    const stats = await webhookDeduplicationService.getProcessingStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting webhook stats:', error);
    res.status(500).json({ error: 'Failed to get webhook statistics' });
  }
});

// Admin Dashboard API endpoints
// Authentication endpoints
app.post('/api/auth/login', adminLogin);
app.post('/api/auth/logout', adminAuth, adminLogout);
app.get('/api/auth/me', adminAuth, getAdminUser);

// Review history endpoints
app.get('/api/reviews', adminAuth, getReviewHistory);
app.get('/api/reviews/export', adminAuth, exportReviewHistory);

// Merge request tracking endpoints
app.get('/api/merge-requests', adminAuth, getMergeRequests);
app.get('/api/merge-requests/export', adminAuth, exportMergeRequests);
app.get('/api/merge-requests/:id', adminAuth, getMergeRequest);
app.get('/api/users/:username/mr-statistics', adminAuth, getUserMRStatistics);

// Merge request review tracking endpoints
app.put('/api/projects/:projectId/merge-requests/:mergeRequestIid/fixes-count', adminAuth, updateMergeRequestFixesCount);
app.put('/api/projects/:projectId/merge-requests/:mergeRequestIid/review-status', adminAuth, updateMergeRequestReviewStatus);

// Analytics endpoints
app.get('/api/analytics', adminAuth, getAnalytics);
app.get('/api/system/health', adminAuth, getSystemHealth);

// Developer Performance Analytics endpoints
app.get('/api/analytics/developers', adminAuth, getDeveloperPerformanceAnalytics);
app.get('/api/analytics/merge-requests', adminAuth, getMRQualityAnalytics);
app.get('/api/analytics/issues', adminAuth, getIssueTrackingAnalytics);

// Feature Completion Rate Analytics endpoints (register specific routes BEFORE the generic :developerId route)
app.get('/api/analytics/completion-rate/team', adminAuth, getTeamCompletionRates);
app.get('/api/analytics/completion-rate/stats', adminAuth, getCompletionRateStats);
app.get('/api/analytics/completion-rate/trends/:developerId', adminAuth, getCompletionRateTrends);
app.get('/api/analytics/completion-rate/projects/:projectId', adminAuth, getProjectCompletionRates);
app.get('/api/analytics/completion-rate/:developerId', adminAuth, getCompletionRate);

// WhatsApp Configuration endpoints
app.get('/api/whatsapp/configurations', adminAuth, getWhatsAppConfigurations);
app.get('/api/whatsapp/configurations/:username', adminAuth, getWhatsAppConfiguration);
app.post('/api/whatsapp/configurations', adminAuth, upsertWhatsAppConfiguration);
app.put('/api/whatsapp/configurations', adminAuth, upsertWhatsAppConfiguration);
app.delete('/api/whatsapp/configurations/:username', adminAuth, deleteWhatsAppConfiguration);
app.post('/api/whatsapp/test', adminAuth, testWhatsAppMessage);
app.get('/api/whatsapp/status', adminAuth, getWhatsAppServiceStatus);

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start the server
async function startServer() {
  try {
    // Connect to the database
    try {
      await dbService.connect();
      console.log('Database connection established');
    } catch (dbError) {
      console.error('Warning: Database connection failed, but continuing:', dbError);
      console.warn('Some features may not work correctly without a database connection');
    }

    app.listen(PORT, () => {
      console.log(`Webhook server running on port ${PORT}`);

      // Start periodic monitoring
      monitoringService.startPeriodicMonitoring(5); // Every 5 minutes
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down server...');
  webhookDeduplicationService.stopPeriodicCleanup();
  await dbService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down server...');
  webhookDeduplicationService.stopPeriodicCleanup();
  await dbService.disconnect();
  process.exit(0);
});

// Start the server
startServer().catch(error => {
  console.error("Failed to start webhook server:", error); // This should give a more detailed error
  if (error instanceof Error) {
      console.error("Error name:", error.name);
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);
  }
  process.exit(1);
});;
