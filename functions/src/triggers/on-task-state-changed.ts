/**
 * Firestore Trigger: Task State Changed
 *
 * Triggers when a task's state field changes
 * Syncs task state to GitHub Project column if task has GitHub integration
 *
 * Story 7.2: Sync GitHub Project Columns to Task States
 */

import { onDocumentUpdated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'
import { syncTaskStateToGitHub } from '../http/github/sync-task-to-github'

/**
 * Firestore trigger that fires when a task document is updated
 * Checks if state changed and syncs to GitHub if applicable
 */
export const onTaskStateChanged = onDocumentUpdated(
  'teams/{teamId}/tasks/{taskId}',
  async event => {
    const beforeData = event.data?.before.data()
    const afterData = event.data?.after.data()
    const taskId = event.params.taskId
    const teamId = event.params.teamId

    if (!beforeData || !afterData) {
      return
    }

    // Check if state changed
    const beforeState = beforeData.state
    const afterState = afterData.state

    if (beforeState === afterState) {
      // State didn't change, no sync needed
      return
    }

    logger.info('Task state changed detected', {
      taskId,
      teamId,
      fromState: beforeState,
      toState: afterState
    })

    // Check if task has GitHub integration
    const githubMetadata = afterData.github
    if (!githubMetadata) {
      logger.debug('Task does not have GitHub integration - skipping sync', {
        taskId,
        teamId
      })
      return
    }

    // Sync to GitHub Project column
    try {
      await syncTaskStateToGitHub(teamId, taskId, afterState, githubMetadata)
    } catch (error) {
      // Log error but don't throw - trigger should not fail
      logger.error('Error in onTaskStateChanged trigger', {
        taskId,
        teamId,
        fromState: beforeState,
        toState: afterState,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }
)
