/**
 * GitHub Unauthorized Movement Handler
 * 
 * Handles unauthorized column movements in GitHub Projects
 * Allows visual movement in GitHub but blocks COOK issuance and notifies reviewers/stewards
 * 
 * Story 7.8: Handle Unauthorized Column Movement in GitHub
 */

import { Octokit } from '@octokit/rest'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'
import { isTransitionAllowed } from './github-transition-enforcer'
import type { TaskState } from './github-transition-enforcer'
import { sendNotification } from '../slack/notifications'
import * as functions from 'firebase-functions'

const db = getFirestore()

/**
 * Get stewards (Steward or Admin role) for a team
 * Queries users collection for users with Steward or Admin role in the team
 * 
 * @param teamId - Team ID
 * @returns Array of user IDs who are stewards or admins
 */
async function getStewardsFromTeam(teamId: string): Promise<string[]> {
  try {
    // Query all users where teams map contains this teamId
    const usersRef = db.collection('users')
    const querySnapshot = await usersRef
      .where(`teams.${teamId}`, '!=', null)
      .get()

    const stewards: string[] = []

    querySnapshot.forEach((doc) => {
      const data = doc.data()
      const userRole = data.teams?.[teamId]
      
      // Check if user has Steward or Admin role
      if (userRole === 'Steward' || userRole === 'Admin') {
        stewards.push(doc.id)
      }
    })

    logger.debug('Fetched stewards from team', {
      teamId,
      stewardCount: stewards.length,
      stewardIds: stewards
    })

    return stewards
  } catch (error) {
    logger.error('Error fetching stewards from team', {
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Return empty array on error to avoid breaking the flow
    return []
  }
}

/**
 * Check if a GitHub column movement is unauthorized
 * Unauthorized movements include:
 * - Skipping columns (invalid transition)
 * - Moving without proper permissions (handled by role checks in Toolkit)
 * 
 * @param fromState - Current Toolkit task state
 * @param toState - Attempted GitHub column state
 * @returns True if movement is unauthorized
 */
export function isUnauthorizedMovement(
  fromState: TaskState,
  toState: TaskState
): boolean {
  // Check if transition is allowed
  // If not allowed, it's an unauthorized movement (skipping columns)
  return !isTransitionAllowed(fromState, toState)
}

/**
 * Handle unauthorized GitHub column movement
 * Allows visual movement in GitHub but:
 * - Does not update Toolkit state (remains at previous valid state)
 * - Flags task to block COOK issuance
 * - Notifies reviewers/stewards
 * - Informs user via GitHub issue comment
 * 
 * @param octokit - Octokit instance
 * @param teamId - Toolkit team ID
 * @param taskId - Toolkit task ID
 * @param issueNumber - GitHub issue number
 * @param repositoryOwner - Repository owner
 * @param repository - Repository name
 * @param fromState - Previous valid Toolkit state
 * @param toState - Attempted GitHub state (unauthorized)
 * @param githubColumnId - New GitHub column ID (allowed to remain)
 * @param projectCardId - GitHub Project card ID
 */
export async function handleUnauthorizedMovement(
  octokit: Octokit,
  teamId: string,
  taskId: string,
  issueNumber: number,
  repositoryOwner: string,
  repository: string,
  fromState: TaskState,
  toState: TaskState,
  githubColumnId: number,
  projectCardId: number
): Promise<void> {
  try {
    // Get task document
    const taskDoc = await db
      .collection('teams')
      .doc(teamId)
      .collection('tasks')
      .doc(taskId)
      .get()

    if (!taskDoc.exists) {
      logger.warn('Task not found for unauthorized movement handling', {
        taskId,
        teamId
      })
      return
    }

    const task = taskDoc.data()
    if (!task) {
      return
    }

    // Update task metadata to flag unauthorized movement
    // DO NOT update task state - it remains at previous valid state
    const unauthorizedMovement = {
      detectedAt: new Date().toISOString(),
      fromState,
      attemptedState: toState,
      githubColumnId: githubColumnId.toString(),
      reason: 'Invalid transition (skipped columns)',
      blocked: true
    }

    await taskDoc.ref.update({
      'github.unauthorizedMovement': unauthorizedMovement,
      'github.projectColumnId': githubColumnId.toString(), // Update column ID to reflect visual position
      'github.syncedAt': new Date().toISOString(), // Update sync timestamp
      updatedAt: new Date().toISOString()
    })

    // Get task details for notification
    const reviewers = task.reviewers || []
    const contributors = task.contributors || []
    const cookValue = task.cookValue || 0

    // Create notification message for GitHub issue comment
    const commentBody = `⚠️ **Unauthorized Column Movement Detected**

The card was moved to this column, but the transition is not allowed by workflow rules.

**Details:**
- **Previous State:** ${fromState}
- **Attempted State:** ${toState}
- **Issue:** Skipping columns is not allowed. Tasks must move sequentially: Backlog → Ready → In Progress → Review → Done

**Impact:**
- ✅ Movement allowed visually in GitHub
- ❌ **COOK issuance is blocked** for this task until the movement is corrected
- 📧 Reviewers and Stewards have been notified

**To Fix:**
1. Move the card back to the previous valid state (${fromState})
2. Move it sequentially through the workflow
3. A Steward can clear the unauthorized movement flag if needed

**Current Task Info:**
- COOK Value: ${cookValue}
- Contributors: ${contributors.length}
- Reviewers: ${reviewers.length}`

    // Add comment to GitHub issue
    await octokit.rest.issues.createComment({
      owner: repositoryOwner,
      repo: repository,
      issue_number: issueNumber,
      body: commentBody
    })

    // Log unauthorized movement
    logger.warn('Unauthorized GitHub column movement detected and flagged', {
      taskId,
      teamId,
      issueNumber,
      repository: `${repositoryOwner}/${repository}`,
      fromState,
      toState,
      githubColumnId,
      projectCardId,
      cookValue,
      reviewers: reviewers.length,
      contributors: contributors.length,
      cookIssuanceBlocked: true
    })

    // Fetch stewards from team document
    // Stewards are users with "Steward" or "Admin" role in the team
    const stewards = await getStewardsFromTeam(teamId)
    
    // Get app URL for notification links
    const appUrl = functions.config().app?.url || process.env.NEXT_PUBLIC_APP_URL || 'https://app.cooperationtoolkit.com'
    const taskUrl = `${appUrl}/teams/${teamId}/tasks/${taskId}`
    const taskTitle = task.title || `Task ${taskId.substring(0, 8)}...`
    
    // Notification message
    const notificationTitle = '⚠️ Unauthorized GitHub Column Movement Detected'
    const notificationMessage = `An unauthorized column movement was detected for task "${taskTitle}".

*Details:*
• Previous State: ${fromState}
• Attempted State: ${toState}
• Issue: Skipping columns is not allowed. Tasks must move sequentially.

*Impact:*
• Movement allowed visually in GitHub
• ❌ COOK issuance is blocked until corrected
• GitHub issue comment added with details

*To Fix:*
1. Move the card back to the previous valid state (${fromState})
2. Move it sequentially through the workflow
3. A Steward can clear the unauthorized movement flag if needed

*Task Info:*
• COOK Value: ${cookValue}
• Contributors: ${contributors.length}
• Reviewers: ${reviewers.length}`

    // Notify all reviewers
    const reviewerNotifications = reviewers.map(async (reviewerId: string) => {
      try {
        await sendNotification({
          userId: reviewerId,
          teamId,
          eventType: 'task_moved_to_review', // Reusing existing event type
          title: notificationTitle,
          message: notificationMessage,
          actionUrl: taskUrl,
          metadata: {
            taskId,
            issueNumber,
            repository: `${repositoryOwner}/${repository}`,
            fromState,
            toState,
            unauthorizedMovement: true
          }
        })
        logger.debug('Notification sent to reviewer', {
          reviewerId,
          taskId,
          teamId
        })
      } catch (error) {
        logger.error('Error sending notification to reviewer', {
          reviewerId,
          taskId,
          teamId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    // Notify all stewards
    const stewardNotifications = stewards.map(async (stewardId: string) => {
      try {
        await sendNotification({
          userId: stewardId,
          teamId,
          eventType: 'task_moved_to_review', // Reusing existing event type
          title: notificationTitle,
          message: notificationMessage,
          actionUrl: taskUrl,
          metadata: {
            taskId,
            issueNumber,
            repository: `${repositoryOwner}/${repository}`,
            fromState,
            toState,
            unauthorizedMovement: true,
            isSteward: true
          }
        })
        logger.debug('Notification sent to steward', {
          stewardId,
          taskId,
          teamId
        })
      } catch (error) {
        logger.error('Error sending notification to steward', {
          stewardId,
          taskId,
          teamId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    })

    // Send all notifications in parallel
    await Promise.allSettled([...reviewerNotifications, ...stewardNotifications])

    logger.info('Reviewers and stewards notified of unauthorized movement', {
      taskId,
      teamId,
      reviewersNotified: reviewers.length,
      stewardsNotified: stewards.length,
      issueNumber,
      repository: `${repositoryOwner}/${repository}`
    })
  } catch (error) {
    logger.error('Error handling unauthorized GitHub movement', {
      taskId,
      teamId,
      issueNumber,
      repository: `${repositoryOwner}/${repository}`,
      fromState,
      toState,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Don't throw - we've already logged the error
  }
}

