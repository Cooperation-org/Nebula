/**
 * Firestore Trigger: Review Initiated
 *
 * Triggers when a review document is created
 * Sends Slack notifications to assigned reviewers
 *
 * Story 11B.4: Real-Time Notifications via Slack
 * Notify assigned reviewers when review is initiated (Story 5.1)
 *
 * Note: This trigger complements onReviewRequested, which handles notifications
 * when a task state changes to Review. This trigger handles notifications when
 * a review document is created via initiateReview().
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyReviewRequested } from '../http/slack/notifications'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Firestore trigger that fires when a review document is created
 * Notifies all assigned reviewers
 */
export const onReviewInitiated = onDocumentCreated(
  'teams/{teamId}/reviews/{reviewId}',
  async event => {
    const data = event.data?.data()
    const reviewId = event.params.reviewId
    const teamId = event.params.teamId

    if (!data) {
      logger.warn('Review document created without data', {
        reviewId,
        teamId
      })
      return
    }

    const taskId = data.taskId
    const requiredReviewers = data.requiredReviewers || 1

    if (!taskId) {
      logger.warn('Review document created without taskId', {
        reviewId,
        teamId
      })
      return
    }

    // Get task to retrieve reviewers and task details
    try {
      const taskDoc = await db
        .collection('teams')
        .doc(teamId)
        .collection('tasks')
        .doc(taskId)
        .get()

      if (!taskDoc.exists) {
        logger.warn('Task not found for review', {
          reviewId,
          teamId,
          taskId
        })
        return
      }

      const taskData = taskDoc.data()!
      const taskTitle = taskData.title || 'Untitled Task'
      const reviewers = (taskData.reviewers || []) as string[]

      if (reviewers.length === 0) {
        logger.debug('Review created with no assigned reviewers', {
          reviewId,
          teamId,
          taskId
        })
        return
      }

      logger.info('Review initiated - sending notifications', {
        reviewId,
        teamId,
        taskId,
        taskTitle,
        requiredReviewers,
        reviewers: reviewers.length
      })

      // Notify each assigned reviewer
      const notificationPromises = reviewers.map(async reviewerId => {
        try {
          await notifyReviewRequested(
            reviewerId,
            teamId,
            taskId,
            taskTitle,
            requiredReviewers
          )
          logger.debug('Review initiation notification sent', {
            reviewerId,
            reviewId,
            teamId,
            taskId
          })
        } catch (error) {
          // Log error but don't throw - continue with other notifications
          logger.error('Error sending review initiation notification', {
            reviewId,
            teamId,
            taskId,
            reviewerId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      // Wait for all notifications to complete (but don't fail if some fail)
      await Promise.allSettled(notificationPromises)
    } catch (error) {
      logger.error('Error processing review initiation trigger', {
        reviewId,
        teamId,
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)
