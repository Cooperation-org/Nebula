/**
 * Firestore Trigger: Voting Started
 * 
 * Triggers when a voting instance is created
 * Sends Slack notifications to team members
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyVotingStarted } from '../http/slack/notifications'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Firestore trigger that fires when a voting instance is created
 * Notifies team members about the new voting
 */
export const onVotingStarted = onDocumentCreated(
  'voting/{votingId}',
  async (event) => {
    const data = event.data?.data()
    const votingId = event.params.votingId

    if (!data) {
      return
    }

    const teamId = data.teamId as string
    const proposalTitle = data.title as string

    if (!teamId || !proposalTitle) {
      logger.warn('Invalid voting data', {
        votingId,
        hasTeamId: !!teamId,
        hasTitle: !!proposalTitle
      })
      return
    }

    logger.info('Voting started detected', {
      votingId,
      teamId,
      proposalTitle
    })

    // Get all team members to notify
    try {
      const teamDoc = await db.collection('teams').doc(teamId).get()
      if (!teamDoc.exists) {
        logger.warn('Team not found for voting notification', {
          votingId,
          teamId
        })
        return
      }

      const teamData = teamDoc.data()
      const members = teamData?.members || {}

      // Notify all team members
      const memberIds = Object.keys(members)

      for (const memberId of memberIds) {
        try {
          await notifyVotingStarted(memberId, teamId, votingId, proposalTitle)
        } catch (error) {
          // Log error but don't throw - continue with other notifications
          logger.error('Error sending voting notification', {
            votingId,
            teamId,
            memberId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    } catch (error) {
      // Log error but don't throw - trigger should not fail
      logger.error('Error fetching team members for voting notification', {
        votingId,
        teamId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

