/**
 * Firestore Trigger: Task Moved
 *
 * Triggers when a task's state field changes
 * Sends Slack notifications to assignees (contributors) and reviewers
 *
 * Story 11B.4: Real-Time Notifications via Slack
 *
 * Note: This trigger complements onReviewRequested, which specifically handles
 * notifications when tasks move to Review state. This trigger handles all other
 * state transitions.
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyTaskMoved } from '../http/slack/notifications'

/**
 * Firestore trigger that fires when a task document is updated
 * Checks if state changed and notifies assignees and reviewers
 */
export const onTaskMoved = onDocumentUpdated(
  'teams/{teamId}/tasks/{taskId}',
  async event => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const taskId = event.params.taskId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if state changed
    const beforeState = beforeData.state
    const afterState = afterData.state

    if (beforeState === afterState) {
      // State didn't change, no notifications needed
      return
    }

    // Skip if moving to Review state - onReviewRequested handles that
    if (afterState === 'Review') {
      logger.debug(
        'Task moved to Review state - skipping notification (handled by onReviewRequested)',
        {
          taskId,
          teamId,
          fromState: beforeState,
          toState: afterState
        }
      )
      return
    }

    const taskTitle = afterData.title || 'Untitled Task'
    const contributors = (afterData.contributors || []) as string[]
    const reviewers = (afterData.reviewers || []) as string[]

    // Collect all users to notify (contributors and reviewers)
    const usersToNotify = new Set<string>()
    contributors.forEach(contributor => usersToNotify.add(contributor))
    reviewers.forEach(reviewer => usersToNotify.add(reviewer))

    if (usersToNotify.size === 0) {
      logger.debug('No contributors or reviewers to notify', {
        taskId,
        teamId,
        fromState: beforeState,
        toState: afterState
      })
      return
    }

    logger.info('Task moved detected', {
      taskId,
      teamId,
      fromState: beforeState,
      toState: afterState,
      contributors: contributors.length,
      reviewers: reviewers.length,
      totalUsersToNotify: usersToNotify.size,
      taskTitle
    })

    // Notify each contributor and reviewer
    const notificationPromises = Array.from(usersToNotify).map(async userId => {
      try {
        await notifyTaskMoved(userId, teamId, taskId, taskTitle, beforeState, afterState)
        logger.debug('Task moved notification sent', {
          userId,
          taskId,
          teamId,
          fromState: beforeState,
          toState: afterState
        })
      } catch (error) {
        // Log error but don't throw - continue with other notifications
        logger.error('Error sending task moved notification', {
          taskId,
          teamId,
          userId,
          fromState: beforeState,
          toState: afterState,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    // Wait for all notifications to complete (but don't fail if some fail)
    await Promise.allSettled(notificationPromises)
  }
)
