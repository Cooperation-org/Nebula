/**
 * GitHub Column to Task State Mapper
 * 
 * Maps GitHub Project column names to Toolkit task states
 * Handles bidirectional sync with Toolkit as canonical source
 * 
 * Story 7.2: Sync GitHub Project Columns to Task States
 */

import { logger } from '../../shared/logger'

/**
 * Default column name to task state mapping
 * Column names are case-insensitive and trimmed
 */
const COLUMN_STATE_MAP: Record<string, 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'> = {
  'backlog': 'Backlog',
  'ready': 'Ready',
  'in progress': 'In Progress',
  'in-progress': 'In Progress',
  'review': 'Review',
  'done': 'Done',
  'completed': 'Done',
  'complete': 'Done'
}

/**
 * Map GitHub Project column name to task state
 * 
 * @param columnName - GitHub Project column name
 * @returns Task state if mapping exists, null otherwise
 */
export function mapGitHubColumnToTaskState(
  columnName: string
): 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done' | null {
  if (!columnName) {
    return null
  }

  // Normalize column name: lowercase, trim whitespace
  const normalized = columnName.toLowerCase().trim()

  // Check direct mapping
  if (COLUMN_STATE_MAP[normalized]) {
    return COLUMN_STATE_MAP[normalized]
  }

  // Try partial matching for common variations
  if (normalized.includes('backlog')) {
    return 'Backlog'
  }
  if (normalized.includes('ready') || normalized.includes('todo')) {
    return 'Ready'
  }
  if (normalized.includes('progress') || normalized.includes('working') || normalized.includes('active')) {
    return 'In Progress'
  }
  if (normalized.includes('review') || normalized.includes('testing') || normalized.includes('qa')) {
    return 'Review'
  }
  if (normalized.includes('done') || normalized.includes('complete') || normalized.includes('closed')) {
    return 'Done'
  }

  logger.warn('No task state mapping found for GitHub column', {
    columnName,
    normalized
  })

  return null
}

/**
 * Map task state to GitHub Project column name
 * 
 * @param taskState - Toolkit task state
 * @returns Suggested GitHub column name
 */
export function mapTaskStateToGitHubColumn(
  taskState: 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'
): string {
  const stateColumnMap: Record<string, string> = {
    'Backlog': 'Backlog',
    'Ready': 'Ready',
    'In Progress': 'In Progress',
    'Review': 'Review',
    'Done': 'Done'
  }

  return stateColumnMap[taskState] || taskState
}

/**
 * Get all possible GitHub column names for a task state
 * Useful for finding the correct column in a GitHub Project
 * 
 * @param taskState - Toolkit task state
 * @returns Array of possible column names
 */
export function getPossibleGitHubColumnNames(
  taskState: 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'
): string[] {
  const stateVariations: Record<string, string[]> = {
    'Backlog': ['Backlog', 'backlog', 'Backlog', 'To Do'],
    'Ready': ['Ready', 'ready', 'Ready', 'To Do', 'Todo'],
    'In Progress': ['In Progress', 'in progress', 'In Progress', 'In-Progress', 'Working', 'Active'],
    'Review': ['Review', 'review', 'Review', 'Testing', 'QA', 'In Review'],
    'Done': ['Done', 'done', 'Done', 'Completed', 'Complete', 'Closed']
  }

  return stateVariations[taskState] || [taskState]
}

