/**
 * GitHub to Task Mapper
 *
 * Maps GitHub Issue fields to Task schema fields
 * Handles bidirectional sync with Toolkit as canonical source
 *
 * Story 7.1: Map GitHub Issues to Tasks (FR11, FR12)
 */

import { logger } from '../../shared/logger'
import { mapGitHubUserToToolkitUser } from './github-user-mapper'
import { mapGitHubColumnToTaskState } from './github-column-mapper'
import { getFirestore } from 'firebase-admin/firestore'

const db = getFirestore()

// Type definitions for GitHub integration
// These should match the types in lib/schemas/task.ts
export type GitHubMetadata = {
  issueId?: number
  issueNumber?: number
  repository?: string
  repositoryOwner?: string
  projectItemId?: string
  projectId?: string
  projectColumnId?: string
  syncedAt?: string
}

export type CookSizeClass = 'S' | 'M' | 'L' | 'XL' | undefined
export type TaskType = 'Build' | 'Ops' | 'Governance' | 'Research' | undefined
export type TaskState = 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'

export type Task = {
  id: string
  title: string
  description?: string
  state: TaskState
  contributors: string[]
  reviewers?: string[]
  archived: boolean
  cookValue?: number
  cookState?: 'Draft' | 'Provisional' | 'Locked' | 'Final'
  cookAttribution?: 'self' | 'spend'
  github?: GitHubMetadata
  cookSizeClass?: CookSizeClass
  taskType?: TaskType
  createdAt: string
  updatedAt: string
  createdBy: string
  teamId: string
}

export type TaskUpdate = {
  title?: string
  description?: string
  state?: TaskState
  contributors?: string[]
  reviewers?: string[]
  archived?: boolean
  cookValue?: number
  cookState?: 'Draft' | 'Provisional' | 'Locked' | 'Final'
  cookAttribution?: 'self' | 'spend'
  github?: GitHubMetadata
  cookSizeClass?: CookSizeClass
  taskType?: TaskType
  updatedAt: string
}

/**
 * Map GitHub Issue to Task data structure
 *
 * Required GitHub fields (FR11):
 * - Issue ID
 * - Project Item Status
 * - Assignee(s)
 * - Linked Repository
 * - COOK metadata
 * - Reviewer(s)
 *
 * Optional fields (FR12):
 * - COOK size class (S/M/L/XL)
 * - Task type (Build/Ops/Governance/Research)
 *
 * @param issue - GitHub issue object
 * @param repository - GitHub repository object
 * @param teamId - Toolkit team ID
 * @param columnName - Optional GitHub Project column name (for state mapping)
 */
export async function mapGitHubIssueToTask(
  issue: any,
  repository: any,
  teamId: string,
  columnName?: string
): Promise<Partial<Task>> {
  // Extract assignees (contributors)
  const contributors: string[] = []
  if (issue.assignees && Array.isArray(issue.assignees)) {
    for (const assignee of issue.assignees) {
      // Map GitHub user to Toolkit user ID
      const toolkitUserId = await mapGitHubUserToToolkitUser(assignee.login)
      if (toolkitUserId) {
        contributors.push(toolkitUserId)
      }
    }
  }

  // Extract reviewers from labels or custom fields
  // GitHub doesn't have native reviewer field, so we use labels like "reviewer:@username"
  const reviewers: string[] = []
  if (issue.labels && Array.isArray(issue.labels)) {
    for (const label of issue.labels) {
      if (label.name.startsWith('reviewer:')) {
        const githubUsername = label.name.replace('reviewer:', '')
        const toolkitUserId = await mapGitHubUserToToolkitUser(githubUsername)
        if (toolkitUserId) {
          reviewers.push(toolkitUserId)
        }
      }
    }
  }

  // Extract COOK value from issue body or labels
  // Format: "COOK: 100" or label "cook:100"
  let cookValue: number | undefined
  if (issue.body) {
    const cookMatch = issue.body.match(/COOK:\s*(\d+(?:\.\d+)?)/i)
    if (cookMatch) {
      cookValue = parseFloat(cookMatch[1])
    }
  }
  if (!cookValue && issue.labels) {
    for (const label of issue.labels) {
      if (label.name.startsWith('cook:')) {
        const cookStr = label.name.replace('cook:', '')
        cookValue = parseFloat(cookStr)
        break
      }
    }
  }

  // Extract COOK size class (S/M/L/XL) from labels
  let cookSizeClass: 'S' | 'M' | 'L' | 'XL' | undefined
  if (issue.labels) {
    for (const label of issue.labels) {
      const labelName = label.name.toLowerCase()
      if (labelName === 'cook:s' || labelName === 'size:s') {
        cookSizeClass = 'S'
      } else if (labelName === 'cook:m' || labelName === 'size:m') {
        cookSizeClass = 'M'
      } else if (labelName === 'cook:l' || labelName === 'size:l') {
        cookSizeClass = 'L'
      } else if (labelName === 'cook:xl' || labelName === 'size:xl') {
        cookSizeClass = 'XL'
      }
    }
  }

  // Extract task type (Build/Ops/Governance/Research) from labels
  let taskType: 'Build' | 'Ops' | 'Governance' | 'Research' | undefined
  if (issue.labels) {
    for (const label of issue.labels) {
      const labelName = label.name.toLowerCase()
      if (labelName === 'type:build' || labelName === 'build') {
        taskType = 'Build'
      } else if (labelName === 'type:ops' || labelName === 'ops') {
        taskType = 'Ops'
      } else if (labelName === 'type:governance' || labelName === 'governance') {
        taskType = 'Governance'
      } else if (labelName === 'type:research' || labelName === 'research') {
        taskType = 'Research'
      }
    }
  }

  // Map GitHub Project column to task state
  // If column name is provided, map it to task state; otherwise default to Backlog
  let state: TaskState = 'Backlog'
  if (columnName) {
    const mappedState = mapGitHubColumnToTaskState(columnName)
    if (mappedState) {
      state = mappedState
      logger.info('Mapped GitHub column to task state', {
        columnName,
        taskState: state
      })
    } else {
      logger.warn('Could not map GitHub column to task state, defaulting to Backlog', {
        columnName,
        issueId: issue.id,
        issueNumber: issue.number
      })
    }
  } else {
    logger.debug('No GitHub column name provided, defaulting task state to Backlog', {
      issueId: issue.id,
      issueNumber: issue.number
    })
  }

  // Build GitHub metadata
  const github: GitHubMetadata = {
    issueId: issue.id,
    issueNumber: issue.number,
    repository: repository.name,
    repositoryOwner: repository.owner.login,
    syncedAt: new Date().toISOString()
    // projectItemId, projectId, projectColumnId will be set when syncing with Projects (Story 7.2)
  }

  // Build task data
  const taskData: Partial<Task> = {
    title: issue.title || '',
    description: issue.body || undefined,
    state,
    contributors: contributors.length > 0 ? contributors : [], // Will need at least one contributor
    reviewers: reviewers.length > 0 ? reviewers : undefined,
    cookValue,
    cookSizeClass,
    taskType,
    github,
    teamId,
    createdBy: (await mapGitHubUserToToolkitUser(issue.user?.login)) || '', // Issue creator
    archived: issue.state === 'closed'
  }

  logger.info('Mapped GitHub Issue to Task', {
    issueId: issue.id,
    issueNumber: issue.number,
    repository: repository.full_name,
    teamId,
    contributors: taskData.contributors?.length || 0,
    reviewers: taskData.reviewers?.length || 0,
    cookValue: taskData.cookValue,
    cookSizeClass: taskData.cookSizeClass,
    taskType: taskData.taskType
  })

  return taskData
}

/**
 * Helper function to remove undefined values from an object
 * Firestore doesn't allow undefined values - fields must be omitted or have a defined value
 */
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Update existing task from GitHub Issue
 *
 * Uses Firestore Admin SDK to update the task document directly
 */
export async function updateTaskFromGitHubIssue(
  taskId: string,
  teamId: string,
  taskData: Partial<Task>,
  issue: any,
  repository: any
): Promise<void> {
  try {
    // Build update object (only include changed fields)
    const update: TaskUpdate = {
      title: taskData.title,
      description: taskData.description,
      state: taskData.state,
      contributors: taskData.contributors,
      reviewers: taskData.reviewers,
      cookValue: taskData.cookValue,
      cookSizeClass: taskData.cookSizeClass,
      taskType: taskData.taskType,
      github: taskData.github,
      archived: taskData.archived,
      updatedAt: new Date().toISOString()
    }

    // Remove undefined values (Firestore doesn't allow undefined)
    const firestoreUpdates = removeUndefined(update)

    // Update task in Firestore using Admin SDK
    const taskRef = db.collection('teams').doc(teamId).collection('tasks').doc(taskId)
    await taskRef.update(firestoreUpdates)

    logger.info('Task updated from GitHub Issue', {
      taskId,
      teamId,
      issueId: issue.id,
      issueNumber: issue.number,
      repository: repository.full_name,
      updateFields: Object.keys(firestoreUpdates)
    })
  } catch (error) {
    logger.error('Error updating task from GitHub Issue', {
      taskId,
      teamId,
      issueId: issue.id,
      issueNumber: issue.number,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

// User mapping is now imported from github-user-mapper.ts
