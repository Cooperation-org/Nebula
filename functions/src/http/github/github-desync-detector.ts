/**
 * GitHub Desync Detector
 * 
 * Detects desync between GitHub Project state and Toolkit task state
 * Toolkit state is canonical (FR18) - GitHub should match Toolkit
 * 
 * Story 7.7: Reconcile Desync Between GitHub and Toolkit
 */

import { Octokit } from '@octokit/rest'
import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'
import { getProjectColumn } from './github-projects-api'
import { mapGitHubColumnToTaskState } from './github-column-mapper'

const db = getFirestore()

export type TaskState = 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'

export interface DesyncDetection {
  taskId: string
  teamId: string
  issueNumber: number
  toolkitState: TaskState
  githubColumnId: number | null
  githubColumnName: string | null
  githubState: TaskState | null
  isDesynced: boolean
  differences: string[]
}

/**
 * Detect desync between GitHub Project and Toolkit task state
 * 
 * @param teamId - Toolkit team ID
 * @param taskId - Toolkit task ID
 * @param githubMetadata - GitHub metadata from task document
 * @returns Desync detection result
 */
export async function detectDesync(
  teamId: string,
  taskId: string,
  githubMetadata: {
    issueId?: number
    issueNumber?: number
    repository?: string
    repositoryOwner?: string
    projectId?: string
    projectItemId?: string
    projectColumnId?: string
  }
): Promise<DesyncDetection | null> {
  // Check if task has GitHub integration
  if (!githubMetadata.issueNumber || !githubMetadata.repository || !githubMetadata.repositoryOwner) {
    return null
  }

  // Get task from Firestore
  const taskDoc = await db
    .collection('teams')
    .doc(teamId)
    .collection('tasks')
    .doc(taskId)
    .get()

  if (!taskDoc.exists) {
    logger.warn('Task not found for desync detection', { taskId, teamId })
    return null
  }

  const task = taskDoc.data()
  if (!task) {
    return null
  }

  const toolkitState = task.state as TaskState

  // Check if GitHub API token is configured
  const githubToken = process.env.GITHUB_API_TOKEN
  if (!githubToken) {
    logger.warn('GitHub API token not configured - cannot detect desync', {
      taskId,
      teamId
    })
    return null
  }

  try {
    const octokit = new Octokit({ auth: githubToken })

    // Get current GitHub Project column
    const githubColumnId = githubMetadata.projectColumnId
      ? parseInt(githubMetadata.projectColumnId, 10)
      : null

    let githubColumnName: string | null = null
    let githubState: TaskState | null = null

    if (githubColumnId) {
      try {
        const column = await getProjectColumn(octokit, githubColumnId)
        githubColumnName = column.name
        githubState = mapGitHubColumnToTaskState(column.name)
      } catch (error) {
        logger.warn('Could not fetch GitHub column for desync detection', {
          taskId,
          teamId,
          columnId: githubColumnId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    // Compare states
    const isDesynced = githubState !== null && githubState !== toolkitState
    const differences: string[] = []

    if (isDesynced) {
      differences.push(`State mismatch: Toolkit="${toolkitState}", GitHub="${githubState}"`)
    }

    // Check if column ID is missing (potential desync indicator)
    if (!githubColumnId) {
      differences.push('GitHub Project column ID missing')
    }

    const detection: DesyncDetection = {
      taskId,
      teamId,
      issueNumber: githubMetadata.issueNumber,
      toolkitState,
      githubColumnId,
      githubColumnName,
      githubState,
      isDesynced,
      differences
    }

    if (isDesynced) {
      logger.warn('Desync detected between GitHub and Toolkit', {
        taskId,
        teamId,
        issueNumber: githubMetadata.issueNumber,
        toolkitState,
        githubState,
        differences
      })
    }

    return detection
  } catch (error) {
    logger.error('Error detecting desync', {
      taskId,
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Reconcile desync by syncing Toolkit state to GitHub
 * Toolkit state is canonical (FR18) - GitHub is updated to match
 * 
 * @param teamId - Toolkit team ID
 * @param taskId - Toolkit task ID
 * @param githubMetadata - GitHub metadata from task document
 * @returns True if reconciliation succeeded, false otherwise
 */
export async function reconcileDesync(
  teamId: string,
  taskId: string,
  githubMetadata: {
    issueId?: number
    issueNumber?: number
    repository?: string
    repositoryOwner?: string
    projectId?: string
    projectItemId?: string
    projectColumnId?: string
  }
): Promise<boolean> {
  // Check if task has GitHub integration
  if (!githubMetadata.issueNumber || !githubMetadata.repository || !githubMetadata.repositoryOwner) {
    logger.warn('Task does not have GitHub integration - cannot reconcile', {
      taskId,
      teamId
    })
    return false
  }

  // Get task from Firestore
  const taskDoc = await db
    .collection('teams')
    .doc(teamId)
    .collection('tasks')
    .doc(taskId)
    .get()

  if (!taskDoc.exists) {
    logger.warn('Task not found for reconciliation', { taskId, teamId })
    return false
  }

  const task = taskDoc.data()
  if (!task) {
    return false
  }

  const toolkitState = task.state as TaskState

  // Check if GitHub API token is configured
  const githubToken = process.env.GITHUB_API_TOKEN
  if (!githubToken) {
    logger.warn('GitHub API token not configured - cannot reconcile', {
      taskId,
      teamId
    })
    return false
  }

  try {
    const octokit = new Octokit({ auth: githubToken })

    // Get project columns
    if (!githubMetadata.projectId || !githubMetadata.projectItemId) {
      logger.warn('Task missing GitHub Project metadata - cannot reconcile', {
        taskId,
        teamId,
        issueNumber: githubMetadata.issueNumber
      })
      return false
    }

    const projectId = parseInt(githubMetadata.projectId, 10)
    const projectItemId = parseInt(githubMetadata.projectItemId, 10)

    const { getProjectColumns } = await import('./github-projects-api')
    const columns = await getProjectColumns(octokit, projectId)

    // Find column matching Toolkit state
    const { getPossibleGitHubColumnNames } = await import('./github-column-mapper')
    const possibleColumnNames = getPossibleGitHubColumnNames(toolkitState)

    const targetColumn = columns.find((col: any) =>
      possibleColumnNames.some(name =>
        col.name.toLowerCase().trim() === name.toLowerCase().trim()
      )
    )

    if (!targetColumn) {
      logger.warn('No matching GitHub column found for Toolkit state', {
        taskId,
        teamId,
        toolkitState,
        availableColumns: columns.map((c: any) => c.name)
      })
      return false
    }

    // Move project card to target column
    const { moveProjectCard } = await import('./github-projects-api')
    await moveProjectCard(octokit, projectItemId, targetColumn.id, 'bottom')

    // Update task's GitHub metadata
    await taskDoc.ref.update({
      'github.projectColumnId': targetColumn.id.toString(),
      'github.syncedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    logger.info('Desync reconciled: Toolkit state synced to GitHub', {
      taskId,
      teamId,
      issueNumber: githubMetadata.issueNumber,
      toolkitState,
      githubColumn: targetColumn.name,
      githubColumnId: targetColumn.id,
      reconciliation: true
    })

    return true
  } catch (error) {
    logger.error('Error reconciling desync', {
      taskId,
      teamId,
      issueNumber: githubMetadata.issueNumber,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

