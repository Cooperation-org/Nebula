/**
 * Firestore Trigger: Review Escalated
 *
 * Triggers when a review dispute is escalated
 * Sends Slack notifications to stewards
 *
 * Story 11B.4: Real-Time Notifications via Slack
 * Notify stewards when review dispute is escalated (Story 5.6)
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyReviewEscalated } from '../http/slack/notifications'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Get stewards (Steward or Admin role) for a team
 * Queries users collection for users with Steward or Admin role in the team
 *
 * @param teamId - Team ID
 * @returns Array of user IDs who are stewards or admins
 */
async function getStewardsFromTeam(teamId: string): Promise<string[]> {
  try {
    // Query all users where teams map contains this teamId
    const usersRef = db.collection('users')
    const querySnapshot = await usersRef.where(`teams.${teamId}`, '!=', null).get()

    const stewards: string[] = []

    querySnapshot.forEach(doc => {
      const data = doc.data()
      const userRole = data.teams?.[teamId]

      // Check if user has Steward or Admin role
      if (userRole === 'Steward' || userRole === 'Admin') {
        stewards.push(doc.id)
      }
    })

    logger.debug('Fetched stewards from team', {
      teamId,
      stewardCount: stewards.length,
      stewardIds: stewards
    })

    return stewards
  } catch (error) {
    logger.error('Error fetching stewards from team', {
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Return empty array on error to avoid breaking the flow
    return []
  }
}

/**
 * Firestore trigger that fires when a review document is updated
 * Checks if review was escalated and notifies stewards
 */
export const onReviewEscalated = onDocumentUpdated(
  'teams/{teamId}/reviews/{reviewId}',
  async event => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const reviewId = event.params.reviewId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if review was escalated
    const beforeEscalated = beforeData.escalated || false
    const afterEscalated = afterData.escalated || false

    if (beforeEscalated || !afterEscalated) {
      // Not being escalated now, no notifications needed
      return
    }

    const taskId = afterData.taskId
    const escalatedTo = afterData.escalatedTo as string | undefined
    const escalatedAt = afterData.escalatedAt
    const objectionCount = (afterData.objections || []).length

    if (!taskId) {
      logger.warn('Review escalated but taskId is missing', {
        reviewId,
        teamId
      })
      return
    }

    logger.info('Review dispute escalated', {
      reviewId,
      teamId,
      taskId,
      escalatedTo: escalatedTo || 'all stewards',
      objectionCount
    })

    try {
      // Get task to retrieve task title
      const taskDoc = await db
        .collection('teams')
        .doc(teamId)
        .collection('tasks')
        .doc(taskId)
        .get()

      if (!taskDoc.exists) {
        logger.warn('Task not found for review escalation', {
          reviewId,
          teamId,
          taskId
        })
        return
      }

      const taskData = taskDoc.data()!
      const taskTitle = taskData.title || 'Untitled Task'

      // Get stewards to notify
      let stewardsToNotify: string[]

      if (escalatedTo) {
        // Specific steward was targeted, only notify that steward
        stewardsToNotify = [escalatedTo]
      } else {
        // No specific steward, notify all stewards
        stewardsToNotify = await getStewardsFromTeam(teamId)
      }

      if (stewardsToNotify.length === 0) {
        logger.warn('No stewards found to notify for review escalation', {
          reviewId,
          teamId,
          taskId,
          escalatedTo
        })
        return
      }

      // Get escalation details from review document
      const escalatedBy = afterData.escalatedBy as string | undefined
      const escalationReason = afterData.escalationReason as string | undefined

      logger.info('Sending escalation notifications to stewards', {
        reviewId,
        teamId,
        taskId,
        stewardsToNotify: stewardsToNotify.length,
        escalatedTo: escalatedTo || 'all stewards'
      })

      // Notify each steward
      const notificationPromises = stewardsToNotify.map(async stewardId => {
        try {
          await notifyReviewEscalated(
            stewardId,
            teamId,
            reviewId,
            taskId,
            taskTitle,
            escalatedBy || 'unknown',
            escalationReason,
            objectionCount
          )
          logger.debug('Review escalation notification sent', {
            stewardId,
            reviewId,
            teamId,
            taskId
          })
        } catch (error) {
          // Log error but don't throw - continue with other notifications
          logger.error('Error sending review escalation notification', {
            reviewId,
            teamId,
            taskId,
            stewardId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      // Wait for all notifications to complete (but don't fail if some fail)
      await Promise.allSettled(notificationPromises)
    } catch (error) {
      logger.error('Error processing review escalation trigger', {
        reviewId,
        teamId,
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)
