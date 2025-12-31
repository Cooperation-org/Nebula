/**
 * Firestore Trigger: COOK Issued
 *
 * Triggers when a COOK ledger entry is created
 * Sends Slack notifications to contributors who earned COOK
 *
 * Story 11B.4: Real-Time Notifications via Slack
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyCookIssued } from '../http/slack/notifications'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Firestore trigger that fires when a COOK ledger entry is created
 * Notifies the contributor who earned COOK
 */
export const onCookIssued = onDocumentCreated(
  'teams/{teamId}/cookLedger/{entryId}',
  async event => {
    const data = event.data?.data()
    const entryId = event.params.entryId
    const teamId = event.params.teamId

    if (!data) {
      return
    }

    const contributorId = data.contributorId as string
    const taskId = data.taskId as string
    const cookValue = data.cookValue as number

    if (!contributorId || !taskId || !cookValue) {
      logger.warn('Invalid COOK ledger entry data', {
        entryId,
        teamId,
        hasContributorId: !!contributorId,
        hasTaskId: !!taskId,
        hasCookValue: !!cookValue
      })
      return
    }

    logger.info('COOK issued detected', {
      entryId,
      teamId,
      contributorId,
      taskId,
      cookValue
    })

    // Get task title for notification
    let taskTitle = 'Completed Task'
    try {
      const taskDoc = await db
        .collection('teams')
        .doc(teamId)
        .collection('tasks')
        .doc(taskId)
        .get()
      if (taskDoc.exists) {
        const taskData = taskDoc.data()
        taskTitle = taskData?.title || 'Completed Task'
      }
    } catch (error) {
      logger.warn('Error fetching task title for notification', {
        taskId,
        teamId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }

    // Notify contributor
    try {
      await notifyCookIssued(contributorId, teamId, taskId, taskTitle, cookValue)
    } catch (error) {
      // Log error but don't throw - trigger should not fail
      logger.error('Error sending COOK issued notification', {
        entryId,
        teamId,
        contributorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)
