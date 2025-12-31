/**
 * Firestore Trigger: Review Objected
 * 
 * Triggers when an objection is added to a review
 * Sends Slack notifications to contributors and other reviewers
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 * Notify contributor and other reviewers when objection is raised (Story 5.5)
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyReviewObjected } from '../http/slack/notifications'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Firestore trigger that fires when a review document is updated
 * Checks if an objection was added and notifies contributors and other reviewers
 */
export const onReviewObjected = onDocumentUpdated(
  'teams/{teamId}/reviews/{reviewId}',
  async (event) => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const reviewId = event.params.reviewId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if objections array changed (new objection added)
    const beforeObjections = (beforeData.objections || []) as any[]
    const afterObjections = (afterData.objections || []) as any[]

    if (afterObjections.length <= beforeObjections.length) {
      // No new objection added, or objection was removed
      return
    }

    // Find the newly added objection
    const newObjection = afterObjections.find(
      (obj) => !beforeObjections.some((beforeObj) => 
        beforeObj.reviewerId === obj.reviewerId && beforeObj.timestamp === obj.timestamp
      )
    )

    if (!newObjection) {
      logger.debug('No new objection detected', {
        reviewId,
        teamId,
        beforeCount: beforeObjections.length,
        afterCount: afterObjections.length
      })
      return
    }

    const objectorId = newObjection.reviewerId
    const objectionReason = newObjection.reason || 'No reason provided'
    const taskId = afterData.taskId

    if (!taskId) {
      logger.warn('Review objected but taskId is missing', {
        reviewId,
        teamId
      })
      return
    }

    logger.info('Review objection detected', {
      reviewId,
      teamId,
      taskId,
      objectorId,
      objectionCount: afterObjections.length
    })

    try {
      // Get task to retrieve contributors and reviewers
      const taskDoc = await db.collection('teams').doc(teamId).collection('tasks').doc(taskId).get()
      
      if (!taskDoc.exists) {
        logger.warn('Task not found for review objection', {
          reviewId,
          teamId,
          taskId
        })
        return
      }

      const taskData = taskDoc.data()!
      const taskTitle = taskData.title || 'Untitled Task'
      const contributors = (taskData.contributors || []) as string[]
      const reviewers = (taskData.reviewers || []) as string[]

      // Collect users to notify:
      // 1. All contributors
      // 2. All reviewers except the one who objected
      const usersToNotify = new Set<string>()
      contributors.forEach(contributor => usersToNotify.add(contributor))
      reviewers.forEach(reviewer => {
        if (reviewer !== objectorId) {
          usersToNotify.add(reviewer)
        }
      })

      if (usersToNotify.size === 0) {
        logger.debug('No users to notify for review objection', {
          reviewId,
          teamId,
          taskId,
          contributors: contributors.length,
          reviewers: reviewers.length,
          objectorId
        })
        return
      }

      logger.info('Sending objection notifications', {
        reviewId,
        teamId,
        taskId,
        usersToNotify: usersToNotify.size,
        contributors: contributors.length,
        reviewers: reviewers.length - 1 // Excluding objector
      })

      // Notify each user
      const notificationPromises = Array.from(usersToNotify).map(async (userId) => {
        try {
          await notifyReviewObjected(
            userId,
            teamId,
            taskId,
            taskTitle,
            objectorId,
            objectionReason
          )
          logger.debug('Review objection notification sent', {
            userId,
            reviewId,
            teamId,
            taskId
          })
        } catch (error) {
          // Log error but don't throw - continue with other notifications
          logger.error('Error sending review objection notification', {
            reviewId,
            teamId,
            taskId,
            userId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      // Wait for all notifications to complete (but don't fail if some fail)
      await Promise.allSettled(notificationPromises)
    } catch (error) {
      logger.error('Error processing review objection trigger', {
        reviewId,
        teamId,
        taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

