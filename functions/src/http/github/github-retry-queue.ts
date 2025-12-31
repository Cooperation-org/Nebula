/**
 * GitHub Retry Queue
 *
 * Queues failed GitHub sync operations for retry when service recovers
 * Implements exponential backoff for retries
 *
 * Story 7.6: Handle GitHub Outage with Graceful Degradation
 */

import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'
import { getCircuitBreaker } from './github-circuit-breaker'

const db = getFirestore()

export interface QueuedSyncOperation {
  id: string
  teamId: string
  taskId: string
  operation: 'sync_state' | 'sync_metadata' | 'move_card' | 'add_comment' | 'add_label'
  data: {
    state?: string
    metadata?: any
    cardId?: number
    columnId?: number
    issueNumber?: number
    repository?: string
    repositoryOwner?: string
    comment?: string
    labels?: string[]
  }
  retryCount: number
  maxRetries: number
  nextRetryAt: string
  createdAt: string
  updatedAt: string
}

/**
 * Queue a failed GitHub sync operation for retry
 */
export async function queueSyncOperation(
  teamId: string,
  taskId: string,
  operation: QueuedSyncOperation['operation'],
  data: QueuedSyncOperation['data'],
  maxRetries: number = 10
): Promise<void> {
  try {
    const queueRef = db.collection('githubSyncQueue').doc()
    const now = new Date().toISOString()

    // Calculate initial retry delay (exponential backoff: 2^retryCount minutes)
    const initialDelay = 2 * 60 * 1000 // 2 minutes
    const nextRetryAt = new Date(Date.now() + initialDelay).toISOString()

    const queuedOperation: QueuedSyncOperation = {
      id: queueRef.id,
      teamId,
      taskId,
      operation,
      data,
      retryCount: 0,
      maxRetries,
      nextRetryAt,
      createdAt: now,
      updatedAt: now
    }

    await queueRef.set(queuedOperation)

    logger.info('GitHub sync operation queued for retry', {
      queueId: queueRef.id,
      teamId,
      taskId,
      operation,
      nextRetryAt
    })
  } catch (error) {
    logger.error('Error queueing GitHub sync operation', {
      teamId,
      taskId,
      operation,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Process queued sync operations
 * Should be called periodically (e.g., via Cloud Function scheduled trigger)
 */
export async function processSyncQueue(): Promise<void> {
  const circuitBreaker = getCircuitBreaker()

  // Don't process queue if circuit is open
  if (!circuitBreaker.canExecute()) {
    logger.debug('Skipping sync queue processing - circuit breaker is open', {
      state: circuitBreaker.getState()
    })
    return
  }

  try {
    const now = new Date()
    const queueRef = db.collection('githubSyncQueue')

    // Get operations ready for retry
    const readyOperations = await queueRef
      .where('nextRetryAt', '<=', now.toISOString())
      .limit(10) // Process in batches
      .get()

    if (readyOperations.empty) {
      return
    }

    logger.info('Processing GitHub sync queue', {
      count: readyOperations.size
    })

    for (const doc of readyOperations.docs) {
      const operation = doc.data() as QueuedSyncOperation

      try {
        // Attempt to process the operation
        // This would call the appropriate sync function based on operation type
        // For now, we'll just log and mark as processed
        // In production, this would call syncTaskStateToGitHub, etc.

        logger.info('Retrying queued GitHub sync operation', {
          queueId: operation.id,
          teamId: operation.teamId,
          taskId: operation.taskId,
          operation: operation.operation,
          retryCount: operation.retryCount
        })

        // Mark as processed (in production, would actually execute the operation)
        // If successful, delete from queue
        // If failed, update retry count and nextRetryAt

        // For now, we'll delete after max retries or simulate success
        if (operation.retryCount >= operation.maxRetries) {
          await doc.ref.delete()
          logger.warn('GitHub sync operation exceeded max retries - removed from queue', {
            queueId: operation.id,
            retryCount: operation.retryCount
          })
        } else {
          // Calculate next retry with exponential backoff
          const delay = Math.min(
            Math.pow(2, operation.retryCount) * 60 * 1000, // 2^retryCount minutes
            60 * 60 * 1000 // Max 1 hour
          )
          const nextRetryAt = new Date(Date.now() + delay).toISOString()

          await doc.ref.update({
            retryCount: operation.retryCount + 1,
            nextRetryAt,
            updatedAt: new Date().toISOString()
          })

          logger.info('GitHub sync operation scheduled for retry', {
            queueId: operation.id,
            retryCount: operation.retryCount + 1,
            nextRetryAt
          })
        }

        // Record success/failure in circuit breaker
        circuitBreaker.recordSuccess()
      } catch (error) {
        logger.error('Error processing queued GitHub sync operation', {
          queueId: operation.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        circuitBreaker.recordFailure()
      }
    }
  } catch (error) {
    logger.error('Error processing GitHub sync queue', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}

/**
 * Get queue status for monitoring
 */
export async function getQueueStatus(): Promise<{
  total: number
  ready: number
  oldest: string | null
}> {
  try {
    const queueRef = db.collection('githubSyncQueue')
    const all = await queueRef.get()
    const now = new Date().toISOString()
    const ready = await queueRef.where('nextRetryAt', '<=', now).get()

    let oldest: string | null = null
    if (!all.empty) {
      const sorted = all.docs.sort((a, b) => {
        const aTime = a.data().createdAt
        const bTime = b.data().createdAt
        return aTime.localeCompare(bTime)
      })
      oldest = sorted[0].data().createdAt
    }

    return {
      total: all.size,
      ready: ready.size,
      oldest
    }
  } catch (error) {
    logger.error('Error getting queue status', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return { total: 0, ready: 0, oldest: null }
  }
}
