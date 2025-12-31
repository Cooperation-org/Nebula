import type { TaskState } from '@/lib/types/task'

/**
 * Allowed task state transitions
 * Based on PRD: Backlog → Ready → In Progress → Review → Done
 * Skipping columns is disallowed by default
 */
export const ALLOWED_TRANSITIONS: Record<TaskState, TaskState[]> = {
  'Backlog': ['Ready'], // Can only go to Ready
  'Ready': ['In Progress'], // Can only go to In Progress
  'In Progress': ['Review'], // Can only go to Review
  'Review': ['Done'], // Can only go to Done
  'Done': [] // Terminal state (cannot transition from Done)
}

/**
 * Check if a task state transition is allowed
 * @param fromState Current task state
 * @param toState Desired task state
 * @returns true if transition is allowed, false otherwise
 */
export function isTransitionAllowed(fromState: TaskState, toState: TaskState): boolean {
  // Same state is always allowed (no-op)
  if (fromState === toState) {
    return true
  }

  // Check if transition is in allowed list
  const allowedStates = ALLOWED_TRANSITIONS[fromState]
  return allowedStates.includes(toState)
}

/**
 * Get allowed next states for a given current state
 * @param currentState Current task state
 * @returns Array of allowed next states
 */
export function getAllowedNextStates(currentState: TaskState): TaskState[] {
  return ALLOWED_TRANSITIONS[currentState]
}

/**
 * Validate a task state transition
 * @param fromState Current task state
 * @param toState Desired task state
 * @throws Error if transition is not allowed
 */
export function validateTransition(fromState: TaskState, toState: TaskState): void {
  if (!isTransitionAllowed(fromState, toState)) {
    const allowedStates = getAllowedNextStates(fromState)
    const allowedStatesStr = allowedStates.length > 0
      ? allowedStates.join(', ')
      : 'none (terminal state)'
    
    throw new Error(
      `Invalid task state transition: Cannot transition from "${fromState}" to "${toState}". ` +
      `Allowed next states: ${allowedStatesStr}`
    )
  }
}

/**
 * Get human-readable transition error message
 * @param fromState Current task state
 * @param toState Desired task state
 * @returns Error message string
 */
export function getTransitionErrorMessage(fromState: TaskState, toState: TaskState): string {
  if (fromState === toState) {
    return 'Task is already in this state'
  }

  const allowedStates = getAllowedNextStates(fromState)
  
  if (allowedStates.length === 0) {
    return `Task is in "${fromState}" state and cannot be moved to another state (terminal state)`
  }

  return `Cannot move task from "${fromState}" to "${toState}". ` +
    `Valid next states: ${allowedStates.join(', ')}`
}

