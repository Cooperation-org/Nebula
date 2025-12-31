/**
 * GitHub Reviewer Enforcer
 * 
 * Enforces multiple reviewer requirements for high-COOK tasks
 * Prevents tasks from entering Review state without sufficient reviewers
 * 
 * Story 7.4: Require Multiple Reviewers for High-COOK Tasks
 */

export type TaskState = 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'

/**
 * Calculate required number of reviewers based on COOK value
 * Higher COOK values require more reviewers
 * Thresholds (FR14):
 * - COOK < 10: 1 reviewer
 * - COOK 10-50: 2 reviewers
 * - COOK > 50: 3 reviewers
 */
export function calculateRequiredReviewers(cookValue: number | undefined): number {
  if (cookValue === undefined || cookValue === 0) {
    return 1 // Default to 1 reviewer if no COOK value
  }
  
  if (cookValue < 10) {
    return 1
  } else if (cookValue <= 50) {
    return 2
  } else {
    return 3
  }
}

/**
 * Validate that task has sufficient reviewers before entering Review state
 * 
 * @param cookValue - Task COOK value
 * @param assignedReviewers - Array of assigned reviewer user IDs
 * @param targetState - Target state (should be 'Review')
 * @returns Object with isValid flag and error message if invalid
 */
export function validateReviewerRequirement(
  cookValue: number | undefined,
  assignedReviewers: string[],
  targetState: TaskState
): { isValid: boolean; errorMessage?: string; requiredReviewers: number } {
  // Only validate when moving to Review state
  if (targetState !== 'Review') {
    return { isValid: true, requiredReviewers: 0 }
  }

  const requiredReviewers = calculateRequiredReviewers(cookValue)
  const assignedCount = assignedReviewers.length

  if (assignedCount < requiredReviewers) {
    const errorMessage = 
      `Task requires ${requiredReviewers} reviewer(s) based on COOK value (${cookValue || 0}), ` +
      `but only ${assignedCount} assigned. ` +
      `Please assign at least ${requiredReviewers} reviewer(s) before moving to Review.`
    
    return {
      isValid: false,
      errorMessage,
      requiredReviewers
    }
  }

  return {
    isValid: true,
    requiredReviewers
  }
}

/**
 * Get human-readable message about reviewer requirements
 * Used for user notifications and GitHub issue comments
 */
export function getReviewerRequirementMessage(
  cookValue: number | undefined,
  assignedReviewers: string[]
): string {
  const requiredReviewers = calculateRequiredReviewers(cookValue)
  const assignedCount = assignedReviewers.length

  if (assignedCount >= requiredReviewers) {
    return `✅ Reviewer requirement met: ${assignedCount}/${requiredReviewers} reviewers assigned`
  }

  const needed = requiredReviewers - assignedCount
  return `⚠️ **Reviewer Requirement Not Met**

This task requires **${requiredReviewers} reviewer(s)** based on COOK value (${cookValue || 0}), but only **${assignedCount}** assigned.

**Required reviewers by COOK value:**
- COOK < 10: 1 reviewer
- COOK 10-50: 2 reviewers
- COOK > 50: 3 reviewers

**Action required:** Please assign ${needed} more reviewer(s) before moving this task to Review.`
}

