/**
 * Slack Notifications Service
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 * 
 * Sends Slack notifications for system events
 */

import { WebClient } from '@slack/web-api'
import * as functions from 'firebase-functions'
import { logger } from '../../shared/logger'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

/**
 * Get user's Slack user ID from Firebase user document
 * 
 * @param userId - Firebase user ID
 * @returns Slack user ID or null
 */
async function getSlackUserId(userId: string): Promise<string | null> {
  try {
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return null
    }
    
    const userData = userDoc.data()
    return userData?.slackUserId || null
  } catch (error) {
    logger.error('Error fetching Slack user ID', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Get Slack Web API client
 * 
 * @returns Slack Web API client or null if not configured
 */
function getSlackClient(): WebClient | null {
  // Access config from Firebase Functions config (legacy API, works until March 2026)
  const botToken = functions.config().slack?.bot_token || process.env.SLACK_BOT_TOKEN
  if (!botToken) {
    logger.warn('SLACK_BOT_TOKEN not configured - notifications disabled')
    return null
  }
  
  return new WebClient(botToken)
}

/**
 * Send a Slack DM to a user
 * 
 * @param slackUserId - Slack user ID
 * @param message - Message text
 * @param blocks - Optional Slack blocks for rich formatting
 * @returns Whether message was sent successfully
 */
async function sendSlackDM(
  slackUserId: string,
  message: string,
  blocks?: any[]
): Promise<boolean> {
  try {
    const client = getSlackClient()
    if (!client) {
      logger.warn('Slack client not available - notification not sent', { slackUserId })
      return false
    }
    
    const result = await client.chat.postMessage({
      channel: slackUserId,
      text: message,
      blocks: blocks,
      unfurl_links: false,
      unfurl_media: false
    })
    
    if (result.ok) {
      logger.info('Slack notification sent', {
        slackUserId,
        messageLength: message.length,
        hasBlocks: !!blocks
      })
      return true
    } else {
      logger.error('Failed to send Slack notification', {
        slackUserId,
        error: result.error
      })
      return false
    }
  } catch (error) {
    logger.error('Error sending Slack notification', {
      slackUserId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return false
  }
}

/**
 * Notification event types
 */
export type NotificationEventType =
  | 'task_assigned'
  | 'task_moved_to_review'
  | 'review_requested'
  | 'review_approved'
  | 'review_objected'
  | 'cook_issued'
  | 'governance_proposal_created'
  | 'voting_started'
  | 'board_visibility_changed'

/**
 * Notification payload interface
 */
export interface NotificationPayload {
  eventType: NotificationEventType
  userId: string // Firebase user ID
  teamId: string
  title: string
  message: string
  actionUrl?: string // URL to view details in web UI
  metadata?: Record<string, any>
}

/**
 * Send notification to a user via Slack
 * 
 * @param payload - Notification payload
 * @returns Whether notification was sent successfully
 */
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    // Get user's Slack user ID
    const slackUserId = await getSlackUserId(payload.userId)
    if (!slackUserId) {
      logger.debug('User does not have Slack account linked - notification skipped', {
        userId: payload.userId,
        eventType: payload.eventType
      })
      return false
    }
    
    // Check notification preferences (future enhancement)
    // For now, send all notifications
    
    // Format message with blocks for rich formatting
    const blocks: any[] = [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${payload.title}*\n\n${payload.message}`
        }
      }
    ]
    
    // Add action button if URL provided
    if (payload.actionUrl) {
      blocks.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details'
            },
            url: payload.actionUrl,
            style: 'primary'
          }
        ]
      })
    }
    
    // Send notification
    return await sendSlackDM(slackUserId, payload.message, blocks)
  } catch (error) {
    logger.error('Error sending notification', {
      payload,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return false
  }
}

/**
 * Notify user when task is assigned
 */
export async function notifyTaskAssigned(
  userId: string,
  teamId: string,
  taskId: string,
  taskTitle: string
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  await sendNotification({
    eventType: 'task_assigned',
    userId,
    teamId,
    title: '📋 Task Assigned',
    message: `You have been assigned to task: *${taskTitle}*\n\nTask ID: \`${taskId}\``,
    actionUrl: `${webAppUrl}/teams/${teamId}/tasks/${taskId}`,
    metadata: { taskId, taskTitle }
  })
}

/**
 * Notify reviewer when review is requested
 */
export async function notifyReviewRequested(
  reviewerId: string,
  teamId: string,
  taskId: string,
  taskTitle: string,
  requiredReviewers: number
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  await sendNotification({
    eventType: 'review_requested',
    userId: reviewerId,
    teamId,
    title: '👀 Review Requested',
    message: `You have been requested to review task: *${taskTitle}*\n\nRequired reviewers: ${requiredReviewers}\n\nUse \`/cook review ${taskId} approve\` to approve or \`/cook review ${taskId} object -reason "reason"\` to object.`,
    actionUrl: `${webAppUrl}/teams/${teamId}/tasks/${taskId}/review`,
    metadata: { taskId, taskTitle, requiredReviewers }
  })
}

/**
 * Notify contributor when COOK is issued
 */
export async function notifyCookIssued(
  contributorId: string,
  teamId: string,
  taskId: string,
  taskTitle: string,
  cookValue: number
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  await sendNotification({
    eventType: 'cook_issued',
    userId: contributorId,
    teamId,
    title: '💰 COOK Issued',
    message: `You have earned ${cookValue} COOK for completing task: *${taskTitle}*\n\nTask ID: \`${taskId}\`\n\nView your COOK ledger with \`/cook my-cook\``,
    actionUrl: `${webAppUrl}/teams/${teamId}/tasks/${taskId}`,
    metadata: { taskId, taskTitle, cookValue }
  })
}

/**
 * Notify user when a review objection is raised
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 * Notify contributor and other reviewers when objection is raised (Story 5.5)
 * 
 * @param userId - User ID to notify (contributor or reviewer)
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @param taskTitle - Task title
 * @param objectorId - User ID who raised the objection
 * @param objectionReason - Reason for the objection
 */
export async function notifyReviewObjected(
  userId: string,
  teamId: string,
  taskId: string,
  taskTitle: string,
  objectorId: string,
  objectionReason: string
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  
  // Truncate objection reason if too long for notification
  const truncatedReason = objectionReason.length > 200 
    ? objectionReason.substring(0, 200) + '...'
    : objectionReason
  
  await sendNotification({
    eventType: 'review_objected',
    userId,
    teamId,
    title: '⚠️ Review Objection Raised',
    message: `An objection has been raised for task: *${taskTitle}*\n\n*Objection:* ${truncatedReason}\n\nTask ID: \`${taskId}\`\n\nView the review to see details and respond.`,
    actionUrl: `${webAppUrl}/teams/${teamId}/tasks/${taskId}/review`,
    metadata: { taskId, taskTitle, objectorId, objectionReason }
  })
}

/**
 * Notify user when governance proposal is created
 */
export async function notifyGovernanceProposalCreated(
  userId: string,
  teamId: string,
  proposalId: string,
  proposalTitle: string,
  proposalType: string
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  await sendNotification({
    eventType: 'governance_proposal_created',
    userId,
    teamId,
    title: '📢 Governance Proposal Created',
    message: `A new ${proposalType} proposal has been created: *${proposalTitle}*\n\nProposal ID: \`${proposalId}\`\n\nUse \`/cook object ${proposalId} -reason "reason"\` to object or view details in the web dashboard.`,
    actionUrl: `${webAppUrl}/teams/${teamId}/governance/proposals/${proposalId}`,
    metadata: { proposalId, proposalTitle, proposalType }
  })
}

/**
 * Notify user when voting starts
 */
export async function notifyVotingStarted(
  userId: string,
  teamId: string,
  votingId: string,
  proposalTitle: string
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  await sendNotification({
    eventType: 'voting_started',
    userId,
    teamId,
    title: '🗳️ Voting Started',
    message: `Voting has started for proposal: *${proposalTitle}*\n\nVoting ID: \`${votingId}\`\n\nUse \`/cook vote ${votingId} <option>\` to cast your vote.`,
    actionUrl: `${webAppUrl}/teams/${teamId}/governance/voting/${votingId}`,
    metadata: { votingId, proposalTitle }
  })
}

/**
 * Notify assignees and reviewers when task is moved to a new state
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 * 
 * @param userId - User ID to notify (contributor or reviewer)
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @param taskTitle - Task title
 * @param fromState - Previous task state
 * @param toState - New task state
 */
export async function notifyTaskMoved(
  userId: string,
  teamId: string,
  taskId: string,
  taskTitle: string,
  fromState: string,
  toState: string
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  
  // Format state names for display
  const stateEmojis: Record<string, string> = {
    'Backlog': '📋',
    'Ready': '✅',
    'In Progress': '🚀',
    'Review': '👀',
    'Done': '🎉'
  }
  
  const fromStateEmoji = stateEmojis[fromState] || '📋'
  const toStateEmoji = stateEmojis[toState] || '📋'
  
  await sendNotification({
    eventType: 'task_moved_to_review', // Reusing existing event type for task movements
    userId,
    teamId,
    title: '📊 Task Moved',
    message: `Task *${taskTitle}* has been moved:\n\n${fromStateEmoji} *${fromState}* → ${toStateEmoji} *${toState}*\n\nTask ID: \`${taskId}\`\n\nView the task in your dashboard.`,
    actionUrl: `${webAppUrl}/teams/${teamId}/tasks/${taskId}`,
    metadata: { taskId, taskTitle, fromState, toState }
  })
}

/**
 * Notify user when board visibility changes from Restricted to Team-Visible
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 * FR39: Notify assignees and reviewers when board visibility changes
 * 
 * @param userId - User ID to notify (assignee or reviewer)
 * @param teamId - Team ID
 * @param boardId - Board ID
 * @param boardName - Board name
 * @param fromVisibility - Previous visibility level
 * @param toVisibility - New visibility level
 */
export async function notifyBoardVisibilityChanged(
  userId: string,
  teamId: string,
  boardId: string,
  boardName: string,
  fromVisibility: string,
  toVisibility: string
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  
  await sendNotification({
    eventType: 'board_visibility_changed',
    userId,
    teamId,
    title: '📊 Board Visibility Changed',
    message: `Board *${boardName}* visibility has been updated:\n\n*${fromVisibility}* → *${toVisibility}*\n\nBoard ID: \`${boardId}\`\n\nYou now have access to view this board.`,
    actionUrl: `${webAppUrl}/teams/${teamId}/boards/${boardId}`,
    metadata: { boardId, boardName, fromVisibility, toVisibility }
  })
}

/**
 * Notify user when they are selected for a committee
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 * 
 * @param userId - User ID to notify (selected committee member)
 * @param teamId - Team ID
 * @param committeeId - Committee ID
 * @param committeeName - Committee name
 * @param numberOfSeats - Total number of seats on the committee
 */
export async function notifyCommitteeSelected(
  userId: string,
  teamId: string,
  committeeId: string,
  committeeName: string,
  numberOfSeats: number
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  await sendNotification({
    eventType: 'governance_proposal_created', // Reusing existing event type for governance notifications
    userId,
    teamId,
    title: '🎯 Committee Selection',
    message: `Congratulations! You have been selected for the *${committeeName}* committee via weighted lottery.\n\nCommittee ID: \`${committeeId}\`\nTotal seats: ${numberOfSeats}\n\nYour service term has been created. View committee details in the web dashboard.`,
    actionUrl: `${webAppUrl}/teams/${teamId}/governance/committees/${committeeId}`,
    metadata: { committeeId, committeeName, numberOfSeats }
  })
}

/**
 * Notify steward when a review dispute is escalated
 * 
 * Story 11B.4: Real-Time Notifications via Slack
 * Notify stewards when review dispute is escalated (Story 5.6)
 * 
 * @param stewardId - Steward user ID to notify
 * @param teamId - Team ID
 * @param reviewId - Review ID
 * @param taskId - Task ID
 * @param taskTitle - Task title
 * @param escalatedBy - User ID who escalated the dispute
 * @param escalationReason - Optional reason for escalation
 * @param objectionCount - Number of objections in the review
 */
export async function notifyReviewEscalated(
  stewardId: string,
  teamId: string,
  reviewId: string,
  taskId: string,
  taskTitle: string,
  escalatedBy: string,
  escalationReason?: string,
  objectionCount?: number
): Promise<void> {
  const webAppUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
  
  let message = `A review dispute has been escalated for task: *${taskTitle}*\n\n`
  message += `*Review ID:* \`${reviewId}\`\n`
  message += `*Task ID:* \`${taskId}\`\n`
  
  if (objectionCount !== undefined && objectionCount > 0) {
    message += `*Objections:* ${objectionCount}\n`
  }
  
  if (escalationReason) {
    message += `\n*Escalation reason:* ${escalationReason}\n`
  }
  
  message += `\nView the review to resolve the dispute.`
  
  await sendNotification({
    eventType: 'review_objected', // Reusing existing event type for review notifications
    userId: stewardId,
    teamId,
    title: '🚨 Review Dispute Escalated',
    message,
    actionUrl: `${webAppUrl}/teams/${teamId}/tasks/${taskId}/review`,
    metadata: { reviewId, taskId, taskTitle, escalatedBy, escalationReason, objectionCount }
  })
}

