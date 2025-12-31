/**
 * Firestore Trigger: Board Visibility Changed
 *
 * Triggers when a board's visibility field changes from Restricted to Team-Visible
 * Sends Slack notifications to all assignees and reviewers of tasks on the board
 *
 * Story 11B.4: Real-Time Notifications via Slack
 * FR39: Notify assignees and reviewers when board visibility changes
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyBoardVisibilityChanged } from '../http/slack/notifications'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Firestore trigger that fires when a board document is updated
 * Checks if visibility changed from Restricted to Team-Visible and notifies users
 */
export const onBoardVisibilityChanged = onDocumentUpdated(
  'teams/{teamId}/boards/{boardId}',
  async event => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const boardId = event.params.boardId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if visibility changed from Restricted to Team-Visible
    const beforeVisibility = beforeData.visibility
    const afterVisibility = afterData.visibility

    if (beforeVisibility !== 'Restricted' || afterVisibility !== 'Team-Visible') {
      // Not the visibility change we're looking for
      return
    }

    const boardName = afterData.name || 'Untitled Board'

    logger.info('Board visibility changed from Restricted to Team-Visible', {
      boardId,
      teamId,
      boardName,
      fromVisibility: beforeVisibility,
      toVisibility: afterVisibility
    })

    // Get all tasks on the board to identify assignees and reviewers
    const db = getFirestore()
    const tasksSnapshot = await db
      .collection('teams')
      .doc(teamId)
      .collection('tasks')
      .where('boardId', '==', boardId)
      .get()

    // Collect unique assignees and reviewers
    const usersToNotify = new Set<string>()

    tasksSnapshot.forEach(taskDoc => {
      const taskData = taskDoc.data()
      const contributors = (taskData.contributors || []) as string[]
      const reviewers = (taskData.reviewers || []) as string[]

      contributors.forEach(contributor => usersToNotify.add(contributor))
      reviewers.forEach(reviewer => usersToNotify.add(reviewer))
    })

    if (usersToNotify.size === 0) {
      logger.debug('No assignees or reviewers to notify for board visibility change', {
        boardId,
        teamId,
        boardName
      })
      return
    }

    logger.info('Sending board visibility change notifications', {
      boardId,
      teamId,
      boardName,
      usersToNotify: usersToNotify.size
    })

    // Notify each user
    const notificationPromises = Array.from(usersToNotify).map(async userId => {
      try {
        await notifyBoardVisibilityChanged(
          userId,
          teamId,
          boardId,
          boardName,
          beforeVisibility,
          afterVisibility
        )
        logger.debug('Board visibility change notification sent', {
          userId,
          boardId,
          teamId,
          boardName
        })
      } catch (error) {
        // Log error but don't throw - continue with other notifications
        logger.error('Error sending board visibility change notification', {
          boardId,
          teamId,
          userId,
          boardName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    // Wait for all notifications to complete (but don't fail if some fail)
    await Promise.allSettled(notificationPromises)
  }
)
