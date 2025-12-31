/**
 * Task Update Helpers for Slack Commands
 *
 * Story 11A.4: Update Task via Slack Command
 *
 * Provides validation and helper functions for task updates
 */

import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'

const db = getFirestore()

/**
 * Allowed state transitions (PRD: Allowed Column Transitions)
 * Backlog → Ready → In Progress → Review → Done
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  Backlog: ['Ready'],
  Ready: ['In Progress'],
  'In Progress': ['Review'],
  Review: ['Done'],
  Done: [] // Done is terminal
}

/**
 * Check if a state transition is allowed
 *
 * @param fromState - Current state
 * @param toState - Target state
 * @returns Whether transition is allowed
 */
export function isTransitionAllowed(fromState: string, toState: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[fromState] || []
  return allowed.includes(toState)
}

/**
 * Get allowed next states for a given state
 *
 * @param currentState - Current task state
 * @returns Array of allowed next states
 */
export function getAllowedNextStates(currentState: string): string[] {
  return ALLOWED_TRANSITIONS[currentState] || []
}

/**
 * Check if user can update task
 * Based on Epic 6B, Story 6B.1: Contributors can move tasks they are assigned to
 *
 * @param userId - User ID
 * @param taskContributors - Array of contributor IDs
 * @param userRole - User's role in team
 * @returns Whether user can update task
 */
export function canUserUpdateTask(
  userId: string,
  taskContributors: string[],
  userRole: string
): boolean {
  // Contributors can update tasks they are assigned to
  if (taskContributors.includes(userId)) {
    return true
  }

  // Reviewers and Stewards can update tasks (with additional permissions for state changes)
  if (userRole === 'Reviewer' || userRole === 'Steward' || userRole === 'Admin') {
    return true
  }

  return false
}

/**
 * Check if user can move task to a specific state
 * Based on Epic 6B: Reviewers may move tasks into or out of Review
 *
 * @param userId - User ID
 * @param taskContributors - Array of contributor IDs
 * @param taskReviewers - Array of reviewer IDs
 * @param userRole - User's role in team
 * @param toState - Target state
 * @returns Whether user can move task to this state
 */
export function canUserMoveToState(
  userId: string,
  taskContributors: string[],
  taskReviewers: string[],
  userRole: string,
  toState: string
): boolean {
  // Stewards and Admins can move to any state
  if (userRole === 'Steward' || userRole === 'Admin') {
    return true
  }

  // Reviewers can move tasks into or out of Review
  if (toState === 'Review' || taskReviewers.includes(userId)) {
    if (userRole === 'Reviewer') {
      return true
    }
  }

  // Contributors can move tasks they are assigned to (except to Review, which requires Reviewer)
  if (taskContributors.includes(userId)) {
    if (toState !== 'Review') {
      return true
    }
  }

  return false
}

/**
 * Get task from Firestore
 *
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @returns Task document or null
 */
export async function getTaskFromFirestore(
  teamId: string,
  taskId: string
): Promise<any | null> {
  try {
    const taskDoc = await db
      .collection('teams')
      .doc(teamId)
      .collection('tasks')
      .doc(taskId)
      .get()
    if (!taskDoc.exists) {
      return null
    }
    return taskDoc.data()
  } catch (error) {
    logger.error('Error fetching task from Firestore', {
      teamId,
      taskId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Update task in Firestore
 *
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @param updates - Update fields
 * @returns Updated task data
 */
export async function updateTaskInFirestore(
  teamId: string,
  taskId: string,
  updates: Record<string, any>
): Promise<any> {
  const taskRef = db.collection('teams').doc(teamId).collection('tasks').doc(taskId)

  // Add updatedAt timestamp
  const updateData = {
    ...updates,
    updatedAt: new Date().toISOString()
  }

  await taskRef.update(updateData)

  // Return updated task
  const updatedDoc = await taskRef.get()
  return updatedDoc.data()
}
