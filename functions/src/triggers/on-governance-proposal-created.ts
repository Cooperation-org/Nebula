/**
 * Firestore Trigger: Governance Proposal Created
 * 
 * Triggers when a governance proposal is created
 * Sends Slack notifications to team members
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { notifyGovernanceProposalCreated } from '../http/slack/notifications'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Firestore trigger that fires when a governance proposal is created
 * Notifies team members about the new proposal
 */
export const onGovernanceProposalCreated = onDocumentCreated(
  'governanceProposals/{proposalId}',
  async (event) => {
    const data = event.data?.data()
    const proposalId = event.params.proposalId

    if (!data) {
      return
    }

    const teamId = data.teamId as string
    const proposalTitle = data.title as string
    const proposalType = data.type as string

    if (!teamId || !proposalTitle) {
      logger.warn('Invalid governance proposal data', {
        proposalId,
        hasTeamId: !!teamId,
        hasTitle: !!proposalTitle
      })
      return
    }

    logger.info('Governance proposal created detected', {
      proposalId,
      teamId,
      proposalTitle,
      proposalType
    })

    // Get all team members to notify
    try {
      const teamDoc = await db.collection('teams').doc(teamId).get()
      if (!teamDoc.exists) {
        logger.warn('Team not found for governance proposal notification', {
          proposalId,
          teamId
        })
        return
      }

      const teamData = teamDoc.data()
      const members = teamData?.members || {}

      // Notify all team members (or just stewards/admins for certain proposal types)
      // For now, notify all team members
      const memberIds = Object.keys(members)

      for (const memberId of memberIds) {
        try {
          await notifyGovernanceProposalCreated(memberId, teamId, proposalId, proposalTitle, proposalType)
        } catch (error) {
          // Log error but don't throw - continue with other notifications
          logger.error('Error sending governance proposal notification', {
            proposalId,
            teamId,
            memberId,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      }
    } catch (error) {
      // Log error but don't throw - trigger should not fail
      logger.error('Error fetching team members for governance proposal notification', {
        proposalId,
        teamId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)

