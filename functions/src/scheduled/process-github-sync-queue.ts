/**
 * Scheduled Function: Process GitHub Sync Queue
 * 
 * Periodically processes queued GitHub sync operations
 * Implements retry logic with exponential backoff
 * 
 * Story 7.6: Handle GitHub Outage with Graceful Degradation
 */

import { onSchedule } from 'firebase-functions/v2/scheduler'
import { logger } from '../shared/logger'
import { processSyncQueue, getQueueStatus } from '../http/github/github-retry-queue'
import { getCircuitBreaker } from '../http/github/github-circuit-breaker'

/**
 * Scheduled function to process GitHub sync queue
 * Runs every 5 minutes
 */
export const processGithubSyncQueue = onSchedule(
  {
    schedule: 'every 5 minutes',
    timeZone: 'UTC'
  },
  async (event) => {
    try {
      logger.info('Processing GitHub sync queue (scheduled)', {
        scheduleTime: event.scheduleTime
      })

      const queueStatus = await getQueueStatus()
      logger.info('GitHub sync queue status', queueStatus)

      if (queueStatus.total === 0) {
        logger.debug('GitHub sync queue is empty')
        return
      }

      const circuitBreaker = getCircuitBreaker()
      const circuitStatus = circuitBreaker.getStatus()
      logger.info('GitHub circuit breaker status', circuitStatus)

      await processSyncQueue()

      logger.info('GitHub sync queue processing completed', {
        processed: queueStatus.ready
      })
    } catch (error) {
      logger.error('Error in scheduled GitHub sync queue processing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
    }
  }
)

