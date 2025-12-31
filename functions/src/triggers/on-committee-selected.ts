/**
 * Firestore Trigger: Committee Selected
 * 
 * Triggers when a committee document is created
 * Sends Slack notifications to all selected committee members
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyCommitteeSelected } from '../http/slack/notifications'

/**
 * Firestore trigger that fires when a committee document is created
 * Notifies all selected committee members
 */
export const onCommitteeSelected = onDocumentCreated(
  'teams/{teamId}/committees/{committeeId}',
  async (event) => {
    const data = event.data?.data()
    const committeeId = event.params.committeeId
    const teamId = event.params.teamId

    if (!data) {
      logger.warn('Committee document created without data', {
        committeeId,
        teamId
      })
      return
    }

    const committeeName = data.committeeName || 'Unknown Committee'
    const selectedMembers = (data.selectedMembers || []) as string[]
    const numberOfSeats = selectedMembers.length

    if (selectedMembers.length === 0) {
      logger.debug('Committee created with no selected members', {
        committeeId,
        teamId,
        committeeName
      })
      return
    }

    logger.info('Committee selected - sending notifications', {
      committeeId,
      teamId,
      committeeName,
      numberOfSeats,
      selectedMembers: selectedMembers.length
    })

    // Notify each selected member
    const notificationPromises = selectedMembers.map(async (userId) => {
      try {
        await notifyCommitteeSelected(
          userId,
          teamId,
          committeeId,
          committeeName,
          numberOfSeats
        )
        logger.debug('Committee selection notification sent', {
          userId,
          committeeId,
          teamId,
          committeeName
        })
      } catch (error) {
        // Log error but don't throw - continue with other notifications
        logger.error('Error sending committee selection notification', {
          committeeId,
          teamId,
          userId,
          committeeName,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    // Wait for all notifications to complete (but don't fail if some fail)
    await Promise.allSettled(notificationPromises)
  }
)

