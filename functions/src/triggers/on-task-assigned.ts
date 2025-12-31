/**
 * Firestore Trigger: Task Assigned
 *
 * Triggers when a task's contributors array changes
 * Sends Slack notifications to newly assigned users
 *
 * Story 11B.4: Real-Time Notifications via Slack
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyTaskAssigned } from '../http/slack/notifications'

/**
 * Firestore trigger that fires when a task document is updated
 * Checks if contributors changed and notifies newly assigned users
 */
export const onTaskAssigned = onDocumentUpdated(
  'teams/{teamId}/tasks/{taskId}',
  async event => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const taskId = event.params.taskId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if contributors changed
    const beforeContributors = (beforeData.contributors || []) as string[]
    const afterContributors = (afterData.contributors || []) as string[]

    // Find newly assigned contributors
    const newContributors = afterContributors.filter(
      contributor => !beforeContributors.includes(contributor)
    )

    if (newContributors.length === 0) {
      // No new contributors, no notifications needed
      return
    }

    const taskTitle = afterData.title || 'Untitled Task'

    logger.info('Task assignment detected', {
      taskId,
      teamId,
      newContributors,
      taskTitle
    })

    // Notify each newly assigned contributor
    for (const contributorId of newContributors) {
      try {
        await notifyTaskAssigned(contributorId, teamId, taskId, taskTitle)
      } catch (error) {
        // Log error but don't throw - continue with other notifications
        logger.error('Error sending task assignment notification', {
          taskId,
          teamId,
          contributorId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }
  }
)
