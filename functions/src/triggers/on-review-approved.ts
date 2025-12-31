/**
 * Firestore Trigger: Review Approved
 * 
 * Triggers when a review status changes to "approved" (all required reviewers approved)
 * Transitions COOK from Locked to Final and issues COOK to contributors
 * 
 * Story 4.5: COOK State Machine - Locked to Final
 * Story 6B.4: Automatically Issue COOK Upon Finalization
 * Trigger next step in workflow when all reviewers approve (Story 5.4)
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Firestore trigger that fires when a review document is updated
 * Checks if status changed to "approved" and finalizes COOK
 */
export const onReviewApproved = onDocumentUpdated(
  'teams/{teamId}/reviews/{reviewId}',
  async (event) => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const reviewId = event.params.reviewId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if status changed to "approved"
    const beforeStatus = beforeData.status
    const afterStatus = afterData.status

    if (beforeStatus === 'approved' || afterStatus !== 'approved') {
      // Not moving to approved status, no action needed
      return
    }

    const taskId = afterData.taskId
    if (!taskId) {
      logger.warn('Review approved but taskId is missing', {
        reviewId,
        teamId
      })
      return
    }

    // Verify all required reviewers have approved
    const approvals = (afterData.approvals || []) as string[]
    const requiredReviewers = afterData.requiredReviewers || 1

    if (approvals.length < requiredReviewers) {
      logger.warn('Review status is approved but not all required reviewers have approved', {
        reviewId,
        teamId,
        taskId,
        approvals: approvals.length,
        requiredReviewers
      })
      return
    }

    logger.info('Review approved - finalizing COOK', {
      reviewId,
      teamId,
      taskId,
      approvals: approvals.length,
      requiredReviewers
    })

    try {
      // Get task to check COOK state and get contributors
      const taskDoc = await db.collection('teams').doc(teamId).collection('tasks').doc(taskId).get()
      
      if (!taskDoc.exists) {
        logger.warn('Task not found for review approval', {
          reviewId,
          teamId,
          taskId
        })
        return
      }

      const taskData = taskDoc.data()!
      const currentCookState = taskData.cookState || 'Draft'
      const cookValue = taskData.cookValue
      const contributors = (taskData.contributors || []) as string[]
      const cookAttribution = taskData.cookAttribution || 'self'
      const unauthorizedMovement = taskData.github?.unauthorizedMovement

      // Story 7.8, FR19: Block COOK issuance if unauthorized movement detected
      if (unauthorizedMovement?.blocked) {
        logger.warn('COOK issuance blocked due to unauthorized GitHub movement', {
          reviewId,
          teamId,
          taskId,
          unauthorizedMovement: {
            detectedAt: unauthorizedMovement.detectedAt,
            fromState: unauthorizedMovement.fromState,
            attemptedState: unauthorizedMovement.attemptedState,
            reason: unauthorizedMovement.reason
          }
        })
        return
      }

      // Only finalize if COOK is in Locked state
      if (currentCookState !== 'Locked') {
        logger.debug('COOK is not in Locked state, skipping finalization', {
          reviewId,
          teamId,
          taskId,
          currentCookState
        })
        return
      }

      // Check if COOK value exists
      if (cookValue === undefined || cookValue === null || cookValue <= 0) {
        logger.warn('Review approved but task has no COOK value', {
          reviewId,
          teamId,
          taskId
        })
        return
      }

      // Check if there are contributors
      if (contributors.length === 0) {
        logger.warn('Review approved but task has no contributors', {
          reviewId,
          teamId,
          taskId
        })
        return
      }

      // Transition COOK to Final state
      await taskDoc.ref.update({
        cookState: 'Final',
        updatedAt: FieldValue.serverTimestamp()
      })

      logger.info('COOK transitioned to Final state', {
        reviewId,
        teamId,
        taskId,
        fromState: 'Locked',
        toState: 'Final',
        cookValue
      })

      // Calculate COOK per contributor (equal distribution)
      const cookValuePerContributor = cookValue / contributors.length

      // Issue COOK to all contributors
      // Story 6B.4: Automatically Issue COOK Upon Finalization
      const issuancePromises = contributors.map(async (contributorId) => {
        try {
          // Check if COOK has already been issued for this task and contributor
          const existingEntries = await db.collection('teams').doc(teamId)
            .collection('cookLedger')
            .where('taskId', '==', taskId)
            .where('contributorId', '==', contributorId)
            .get()

          if (!existingEntries.empty) {
            logger.debug('COOK already issued for this task and contributor, skipping', {
              reviewId,
              teamId,
              taskId,
              contributorId
            })
            return
          }

          // Create COOK ledger entry
          const entryId = db.collection('teams').doc(teamId).collection('cookLedger').doc().id
          const now = new Date().toISOString()

          await db.collection('teams').doc(teamId).collection('cookLedger').doc(entryId).set({
            taskId,
            teamId,
            contributorId,
            cookValue: cookValuePerContributor,
            attribution: cookAttribution,
            issuedAt: FieldValue.serverTimestamp()
          })

          logger.info('COOK issued to contributor', {
            entryId,
            reviewId,
            teamId,
            taskId,
            contributorId,
            cookValue: cookValuePerContributor,
            attribution: cookAttribution,
            timestamp: now,
            // Implicit consent: Task approval through review process provides implicit consent for governance (FR30, Story 6B.5)
            implicitConsent: true
          })
        } catch (error) {
          // Log error but continue with other contributors
          logger.error('Error issuing COOK to contributor', {
            reviewId,
            teamId,
            taskId,
            contributorId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      // Wait for all COOK issuances to complete
      await Promise.allSettled(issuancePromises)

      logger.info('COOK finalized and issued to all contributors', {
        reviewId,
        teamId,
        taskId,
        contributors: contributors.length,
        totalCookValue: cookValue,
        cookValuePerContributor
      })
    } catch (error) {
      logger.error('Error processing review approval trigger', {
        reviewId,
        teamId,
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

