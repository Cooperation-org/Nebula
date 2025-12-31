/**
 * Firestore Trigger: Review Requested
 *
 * Triggers when a task moves to Review state
 * Sends Slack notifications to assigned reviewers
 *
 * Story 11B.4: Real-Time Notifications via Slack
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyReviewRequested } from '../http/slack/notifications'
// const db = getFirestore() // Reserved for future use

/**
 * Firestore trigger that fires when a task document is updated
 * Checks if state changed to Review and notifies assigned reviewers
 */
export const onReviewRequested = onDocumentUpdated(
  'teams/{teamId}/tasks/{taskId}',
  async event => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const taskId = event.params.taskId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if state changed to Review
    const beforeState = beforeData.state
    const afterState = afterData.state

    if (beforeState === 'Review' || afterState !== 'Review') {
      // Not moving to Review state, no notifications needed
      return
    }

    const taskTitle = afterData.title || 'Untitled Task'
    const reviewers = (afterData.reviewers || []) as string[]
    const cookValue = afterData.cookValue || 0

    // Calculate required reviewers based on COOK value
    let requiredReviewers = 1
    if (cookValue >= 10 && cookValue <= 50) {
      requiredReviewers = 2
    } else if (cookValue > 50) {
      requiredReviewers = 3
    }

    logger.info('Review requested detected', {
      taskId,
      teamId,
      reviewers,
      requiredReviewers,
      cookValue,
      taskTitle
    })

    // Notify each assigned reviewer
    for (const reviewerId of reviewers) {
      try {
        await notifyReviewRequested(
          reviewerId,
          teamId,
          taskId,
          taskTitle,
          requiredReviewers
        )
      } catch (error) {
        // Log error but don't throw - continue with other notifications
        logger.error('Error sending review request notification', {
          taskId,
          teamId,
          reviewerId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }
)
