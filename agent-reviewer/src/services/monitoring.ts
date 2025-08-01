import { embeddingService } from './embedding.js';
import { queueService } from './queue.js';
import { schedulingService } from './scheduling.js';

export interface ServiceHealthStatus {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: any;
  lastChecked: Date;
}

export interface SystemStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: ServiceHealthStatus[];
  timestamp: Date;
}

/**
 * Monitoring service for tracking system health and performance
 */
export class MonitoringService {
  /**
   * Get comprehensive system health status
   */
  async getSystemHealth(): Promise<SystemStatus> {
    const services: ServiceHealthStatus[] = [];
    
    // Check embedding service health
    try {
      const embeddingHealth = await embeddingService.checkEmbeddingServiceHealth();
      const circuitBreakerState = embeddingService.getCircuitBreakerState();
      
      services.push({
        service: 'embedding',
        status: embeddingHealth.isHealthy && embeddingHealth.canEmbed ? 'healthy' : 
                circuitBreakerState.state === 'OPEN' ? 'unhealthy' : 'degraded',
        details: {
          ...embeddingHealth,
          circuitBreaker: circuitBreakerState
        },
        lastChecked: embeddingHealth.lastChecked
      });
    } catch (error) {
      services.push({
        service: 'embedding',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : String(error) },
        lastChecked: new Date()
      });
    }

    // Check queue service health
    try {
      const queueStats = await this.getQueueStatistics();
      const hasStuckJobs = queueStats.processing > 0 && queueStats.oldestProcessingJob && 
                          (Date.now() - queueStats.oldestProcessingJob.getTime()) > 30 * 60 * 1000; // 30 minutes
      
      services.push({
        service: 'queue',
        status: hasStuckJobs ? 'degraded' : 'healthy',
        details: queueStats,
        lastChecked: new Date()
      });
    } catch (error) {
      services.push({
        service: 'queue',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : String(error) },
        lastChecked: new Date()
      });
    }

    // Check scheduling service
    try {
      const schedulingConfig = schedulingService.getSchedulingConfig();
      services.push({
        service: 'scheduling',
        status: 'healthy',
        details: schedulingConfig,
        lastChecked: new Date()
      });
    } catch (error) {
      services.push({
        service: 'scheduling',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : String(error) },
        lastChecked: new Date()
      });
    }

    // Determine overall status
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');
    
    let overall: 'healthy' | 'degraded' | 'unhealthy';
    if (unhealthyServices.length > 0) {
      overall = 'unhealthy';
    } else if (degradedServices.length > 0) {
      overall = 'degraded';
    } else {
      overall = 'healthy';
    }

    return {
      overall,
      services,
      timestamp: new Date()
    };
  }

  /**
   * Get queue statistics for monitoring
   */
  async getQueueStatistics(): Promise<{
    pending: number;
    delayed: number;
    processing: number;
    completed: number;
    failed: number;
    retrying: number;
    oldestPendingJob?: Date;
    oldestProcessingJob?: Date;
  }> {
    try {
      const stats = await queueService.getQueueStatistics();
      return stats;
    } catch (error) {
      console.error('Error getting queue statistics:', error);
      throw error;
    }
  }

  /**
   * Get embedding service metrics
   */
  async getEmbeddingMetrics(): Promise<{
    healthStatus: any;
    circuitBreakerState: any;
    isOffPeakHours: boolean;
    nextMidnightWIB: string;
  }> {
    try {
      const healthStatus = await embeddingService.checkEmbeddingServiceHealth();
      const circuitBreakerState = embeddingService.getCircuitBreakerState();
      const isOffPeakHours = schedulingService.isOffPeakHours();
      const nextMidnightWIB = schedulingService.calculateNextMidnightWIB().toISOString();

      return {
        healthStatus,
        circuitBreakerState,
        isOffPeakHours,
        nextMidnightWIB
      };
    } catch (error) {
      console.error('Error getting embedding metrics:', error);
      throw error;
    }
  }

  /**
   * Log system health status
   */
  async logSystemHealth(): Promise<void> {
    try {
      const health = await this.getSystemHealth();
      
      console.log(`[MONITORING] System Health: ${health.overall.toUpperCase()}`);
      
      for (const service of health.services) {
        const statusIcon = service.status === 'healthy' ? '✅' : 
                          service.status === 'degraded' ? '⚠️' : '❌';
        console.log(`[MONITORING] ${statusIcon} ${service.service}: ${service.status}`);
        
        if (service.status !== 'healthy') {
          console.log(`[MONITORING]   Details:`, JSON.stringify(service.details, null, 2));
        }
      }
    } catch (error) {
      console.error('[MONITORING] Error logging system health:', error);
    }
  }

  /**
   * Start periodic health monitoring
   */
  startPeriodicMonitoring(intervalMinutes: number = 5): void {
    const intervalMs = intervalMinutes * 60 * 1000;
    
    console.log(`[MONITORING] Starting periodic health monitoring every ${intervalMinutes} minutes`);
    
    // Log initial health status
    this.logSystemHealth();
    
    // Set up periodic monitoring
    setInterval(() => {
      this.logSystemHealth();
    }, intervalMs);
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();
