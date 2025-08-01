import dotenv from 'dotenv';

dotenv.config();

// Configuration for scheduling
const ENABLE_MIDNIGHT_SCHEDULING = process.env.ENABLE_MIDNIGHT_SCHEDULING === 'true';
const WIB_TIMEZONE_OFFSET = 7; // UTC+7 for Western Indonesian Time

export interface SchedulingOptions {
  isAutomatic: boolean;
  forceImmediate?: boolean;
}

export interface SchedulingResult {
  shouldSchedule: boolean;
  delay: number;
  scheduledTime?: Date;
  reason: string;
}

/**
 * Service for managing embedding job scheduling
 * Handles off-peak scheduling for automatic jobs while keeping manual jobs immediate
 */
export class SchedulingService {
  /**
   * Calculate the next midnight in WIB (Western Indonesian Time - UTC+7)
   * @returns Date object representing the next midnight WIB
   */
  calculateNextMidnightWIB(): Date {
    const now = new Date();
    
    // Convert current time to WIB
    const wibTime = new Date(now.getTime() + (WIB_TIMEZONE_OFFSET * 60 * 60 * 1000));
    
    // Calculate next midnight in WIB
    const nextMidnightWIB = new Date(wibTime);
    nextMidnightWIB.setUTCHours(0, 0, 0, 0);
    nextMidnightWIB.setUTCDate(nextMidnightWIB.getUTCDate() + 1);
    
    // Convert back to UTC
    const nextMidnightUTC = new Date(nextMidnightWIB.getTime() - (WIB_TIMEZONE_OFFSET * 60 * 60 * 1000));
    
    return nextMidnightUTC;
  }

  /**
   * Calculate delay until next midnight WIB
   * @returns Delay in milliseconds
   */
  getDelayUntilMidnightWIB(): number {
    const now = new Date();
    const nextMidnight = this.calculateNextMidnightWIB();
    return Math.max(0, nextMidnight.getTime() - now.getTime());
  }

  /**
   * Determine if a job should be scheduled for midnight WIB
   * @param options Scheduling options including whether the job is automatic
   * @returns SchedulingResult with scheduling decision and details
   */
  shouldScheduleForMidnight(options: SchedulingOptions): SchedulingResult {
    // If scheduling is disabled, process immediately
    if (!ENABLE_MIDNIGHT_SCHEDULING) {
      return {
        shouldSchedule: false,
        delay: 0,
        reason: 'Midnight scheduling is disabled'
      };
    }

    // If forced immediate processing, don't schedule
    if (options.forceImmediate) {
      return {
        shouldSchedule: false,
        delay: 0,
        reason: 'Forced immediate processing requested'
      };
    }

    // Manual jobs should be processed immediately
    if (!options.isAutomatic) {
      return {
        shouldSchedule: false,
        delay: 0,
        reason: 'Manual job - processing immediately'
      };
    }

    // Check if we're already close to midnight WIB (within 1 hour)
    const delay = this.getDelayUntilMidnightWIB();
    const oneHour = 60 * 60 * 1000;
    
    if (delay <= oneHour) {
      return {
        shouldSchedule: false,
        delay: 0,
        reason: 'Already close to midnight WIB - processing immediately'
      };
    }

    // Schedule for midnight WIB
    const scheduledTime = this.calculateNextMidnightWIB();
    return {
      shouldSchedule: true,
      delay,
      scheduledTime,
      reason: `Automatic job scheduled for midnight WIB (${scheduledTime.toISOString()})`
    };
  }

  /**
   * Get current WIB time for logging and debugging
   * @returns Current time in WIB
   */
  getCurrentWIBTime(): Date {
    const now = new Date();
    return new Date(now.getTime() + (WIB_TIMEZONE_OFFSET * 60 * 60 * 1000));
  }

  /**
   * Check if current time is within off-peak hours (midnight to 6 AM WIB)
   * @returns True if currently in off-peak hours
   */
  isOffPeakHours(): boolean {
    const wibTime = this.getCurrentWIBTime();
    const hour = wibTime.getUTCHours();
    return hour >= 0 && hour < 6; // Midnight to 6 AM WIB
  }

  /**
   * Get scheduling configuration for debugging
   * @returns Current scheduling configuration
   */
  getSchedulingConfig(): {
    enabled: boolean;
    timezoneOffset: number;
    currentWIBTime: string;
    nextMidnightWIB: string;
    isOffPeak: boolean;
  } {
    const currentWIB = this.getCurrentWIBTime();
    const nextMidnight = this.calculateNextMidnightWIB();
    
    return {
      enabled: ENABLE_MIDNIGHT_SCHEDULING,
      timezoneOffset: WIB_TIMEZONE_OFFSET,
      currentWIBTime: currentWIB.toISOString(),
      nextMidnightWIB: nextMidnight.toISOString(),
      isOffPeak: this.isOffPeakHours()
    };
  }
}

// Export singleton instance
export const schedulingService = new SchedulingService();
