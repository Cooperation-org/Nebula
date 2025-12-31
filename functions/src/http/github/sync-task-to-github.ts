/**
 * Sync Task State to GitHub Project Column
 * 
 * Syncs task state changes from Toolkit to GitHub Project columns
 * Toolkit state is canonical (FR18) - this syncs Toolkit → GitHub
 * 
 * Story 7.2: Sync GitHub Project Columns to Task States
 */

import { Octokit } from '@octokit/rest'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'
import { mapTaskStateToGitHubColumn, getPossibleGitHubColumnNames } from './github-column-mapper'
import { getProjectColumns, moveProjectCard, type ProjectColumn } from './github-projects-api'
import { getCircuitBreaker } from './github-circuit-breaker'
import { queueSyncOperation } from './github-retry-queue'

export type TaskState = 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'

const db = getFirestore()

/**
 * Sync task state change to GitHub Project column
 * 
 * @param teamId - Toolkit team ID
 * @param taskId - Toolkit task ID
 * @param newState - New task state
 * @param githubMetadata - GitHub metadata from task document
 */
export async function syncTaskStateToGitHub(
  teamId: string,
  taskId: string,
  newState: TaskState,
  githubMetadata: {
    issueId?: number
    issueNumber?: number
    repository?: string
    repositoryOwner?: string
    projectId?: string
    projectItemId?: string
    projectColumnId?: string
  }
): Promise<void> {
  // Check if task has GitHub integration
  if (!githubMetadata.issueNumber || !githubMetadata.repository || !githubMetadata.repositoryOwner) {
    logger.debug('Task does not have GitHub integration - skipping sync', {
      taskId,
      teamId
    })
    return
  }

  // Check if GitHub API token is configured
  const githubToken = process.env.GITHUB_API_TOKEN
  if (!githubToken) {
    logger.warn('GitHub API token not configured - cannot sync to GitHub', {
      taskId,
      teamId
    })
    return
  }

  // Check circuit breaker state (Story 7.6)
  const circuitBreaker = getCircuitBreaker()
  if (!circuitBreaker.canExecute()) {
    logger.warn('GitHub circuit breaker is open - queueing sync operation', {
      taskId,
      teamId,
      state: circuitBreaker.getState(),
      issueNumber: githubMetadata.issueNumber
    })

    // Queue operation for retry when GitHub recovers
    await queueSyncOperation(teamId, taskId, 'sync_state', {
      state: newState,
      metadata: githubMetadata
    })

    return
  }

  try {
    const octokit = new Octokit({ auth: githubToken })

    // Get project ID and item ID
    if (!githubMetadata.projectId || !githubMetadata.projectItemId) {
      logger.warn('Task missing GitHub Project metadata - cannot sync column', {
        taskId,
        teamId,
        issueNumber: githubMetadata.issueNumber
      })
      return
    }

    // Find the correct column in the GitHub Project
    const projectId = parseInt(githubMetadata.projectId, 10)
    const projectItemId = parseInt(githubMetadata.projectItemId, 10)

    // Get project columns using GitHub Projects API helper
    const columns = await getProjectColumns(octokit, projectId)

    // Find column matching the new task state
    const targetColumnName = mapTaskStateToGitHubColumn(newState)
    const possibleColumnNames = getPossibleGitHubColumnNames(newState)

    const targetColumn = columns.find((col: ProjectColumn) => 
      possibleColumnNames.some(name => 
        col.name.toLowerCase().trim() === name.toLowerCase().trim()
      )
    )

    if (!targetColumn) {
      logger.warn('No matching GitHub column found for task state', {
        taskId,
        teamId,
        newState,
        targetColumnName,
        availableColumns: columns.map((c: ProjectColumn) => c.name)
      })
      return
    }

    // Move project card to target column
    await moveProjectCard(octokit, projectItemId, targetColumn.id, 'bottom')

    // Update task's GitHub metadata with new column ID
    await db
      .collection('teams')
      .doc(teamId)
      .collection('tasks')
      .doc(taskId)
      .update({
        'github.projectColumnId': targetColumn.id.toString(),
        'github.syncedAt': new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })

    logger.info('Task state synced to GitHub Project column', {
      taskId,
      teamId,
      issueNumber: githubMetadata.issueNumber,
      fromState: githubMetadata.projectColumnId ? 'previous' : 'none',
      toState: newState,
      toColumn: targetColumn.name,
      toColumnId: targetColumn.id
    })

    // Record success in circuit breaker
    circuitBreaker.recordSuccess()
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isNetworkError = errorMessage.includes('ECONNREFUSED') || 
                          errorMessage.includes('ETIMEDOUT') ||
                          errorMessage.includes('ENOTFOUND') ||
                          (error instanceof Error && 'status' in error && (error as any).status >= 500)

    logger.error('Error syncing task state to GitHub Project', {
      taskId,
      teamId,
      issueNumber: githubMetadata.issueNumber,
      newState,
      error: errorMessage,
      isNetworkError,
      circuitBreakerState: circuitBreaker.getState()
    })

    // Record failure in circuit breaker
    circuitBreaker.recordFailure()

    // Queue operation for retry if it's a network/server error
    if (isNetworkError) {
      await queueSyncOperation(teamId, taskId, 'sync_state', {
        state: newState,
        metadata: githubMetadata
      })
    }

    // Don't throw - allow task state change to succeed even if GitHub sync fails
    // This ensures Toolkit remains functional during GitHub outages (Story 7.6)
  }
}

