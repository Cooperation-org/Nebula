/**
 * GitHub Transition Enforcer
 * 
 * Enforces allowed column transitions when GitHub Project cards are moved
 * Rejects invalid transitions and moves cards back to previous column
 * 
 * Story 7.3: Enforce Allowed Column Transitions in GitHub
 */

import { Octokit } from '@octokit/rest'
import { logger } from '../../shared/logger'
import { moveProjectCard, getProjectColumn } from './github-projects-api'

export type TaskState = 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'

/**
 * Allowed task state transitions
 * Based on PRD: Backlog → Ready → In Progress → Review → Done
 * Skipping columns is disallowed by default (FR13)
 */
const ALLOWED_TRANSITIONS: Record<TaskState, TaskState[]> = {
  'Backlog': ['Ready'],
  'Ready': ['In Progress'],
  'In Progress': ['Review'],
  'Review': ['Done'],
  'Done': [] // Terminal state
}

/**
 * Check if a task state transition is allowed
 */
export function isTransitionAllowed(fromState: TaskState, toState: TaskState): boolean {
  // Same state is always allowed (no-op)
  if (fromState === toState) {
    return true
  }

  // Check if transition is in allowed list
  const allowedStates = ALLOWED_TRANSITIONS[fromState] || []
  return allowedStates.includes(toState)
}

/**
 * Get allowed next states for a given current state
 */
export function getAllowedNextStates(currentState: TaskState): TaskState[] {
  return ALLOWED_TRANSITIONS[currentState] || []
}

/**
 * Get human-readable error message for invalid transition
 */
export function getTransitionErrorMessage(fromState: TaskState, toState: TaskState): string {
  const allowedStates = getAllowedNextStates(fromState)
  const allowedStatesStr = allowedStates.length > 0
    ? allowedStates.join(', ')
    : 'none (terminal state)'
  
  return `Invalid transition: Cannot move from "${fromState}" to "${toState}". Allowed next states: ${allowedStatesStr}`
}

/**
 * Reject invalid GitHub Project card transition
 * Moves card back to previous column and adds comment to issue
 * 
 * @param octokit - Octokit instance
 * @param cardId - GitHub Project card ID
 * @param previousColumnId - Previous column ID to move card back to
 * @param issueNumber - GitHub issue number
 * @param repositoryOwner - Repository owner
 * @param repository - Repository name
 * @param fromState - Previous task state
 * @param toState - Attempted task state
 */
export async function rejectInvalidTransition(
  octokit: Octokit,
  cardId: number,
  previousColumnId: number,
  issueNumber: number,
  repositoryOwner: string,
  repository: string,
  fromState: TaskState,
  toState: TaskState
): Promise<void> {
  try {
    // Move card back to previous column
    await moveProjectCard(octokit, cardId, previousColumnId, 'bottom')

    // Get previous column name for the comment
    const previousColumn = await getProjectColumn(octokit, previousColumnId)

    // Create error message
    const errorMessage = getTransitionErrorMessage(fromState, toState)
    const commentBody = `⚠️ **Invalid Column Transition Rejected**

The card was moved back because the transition is not allowed.

**Details:**
- Attempted: ${fromState} → ${toState}
- ${errorMessage}
- Card moved back to: **${previousColumn.name}**

**Allowed transitions:**
- Backlog → Ready
- Ready → In Progress
- In Progress → Review
- Review → Done

Skipping columns is not allowed. Please move cards sequentially through the workflow.`

    // Add comment to GitHub issue
    await octokit.rest.issues.createComment({
      owner: repositoryOwner,
      repo: repository,
      issue_number: issueNumber,
      body: commentBody
    })

    logger.info('Invalid GitHub transition rejected and card moved back', {
      cardId,
      issueNumber,
      repository: `${repositoryOwner}/${repository}`,
      fromState,
      toState,
      previousColumnId,
      previousColumnName: previousColumn.name
    })
  } catch (error) {
    logger.error('Error rejecting invalid GitHub transition', {
      cardId,
      issueNumber,
      repository: `${repositoryOwner}/${repository}`,
      fromState,
      toState,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Don't throw - we've already logged the error
  }
}

