/**
 * GitHub Projects API Helper
 * 
 * Helper functions for interacting with GitHub Projects API
 * Handles both Projects (Classic) and Projects v2 APIs
 * 
 * Note: GitHub Projects (Classic) REST API endpoints
 * For Projects v2, we would need GraphQL API
 */

import { Octokit } from '@octokit/rest'
import { logger } from '../../shared/logger'

export interface ProjectColumn {
  id: number
  name: string
  [key: string]: any
}

export interface ProjectCard {
  id: number
  content_url?: string
  [key: string]: any
}

/**
 * Get project columns using GitHub Projects (Classic) API
 */
export async function getProjectColumns(
  octokit: Octokit,
  projectId: number
): Promise<ProjectColumn[]> {
  try {
    // GitHub Projects (Classic) REST API
    // Endpoint: GET /projects/:project_id/columns
    const response = await octokit.request('GET /projects/{project_id}/columns', {
      project_id: projectId,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        'Accept': 'application/vnd.github+json'
      }
    })

    return response.data as ProjectColumn[]
  } catch (error) {
    logger.error('Error fetching GitHub project columns', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Get project column by ID
 */
export async function getProjectColumn(
  octokit: Octokit,
  columnId: number
): Promise<ProjectColumn> {
  try {
    // GitHub Projects (Classic) REST API
    // Endpoint: GET /projects/columns/:column_id
    const response = await octokit.request('GET /projects/columns/{column_id}', {
      column_id: columnId,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        'Accept': 'application/vnd.github+json'
      }
    })

    return response.data as ProjectColumn
  } catch (error) {
    logger.error('Error fetching GitHub project column', {
      columnId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Move project card to a different column
 */
export async function moveProjectCard(
  octokit: Octokit,
  cardId: number,
  columnId: number,
  position: 'top' | 'bottom' | 'after:<card_id>' = 'bottom'
): Promise<void> {
  try {
    // GitHub Projects (Classic) REST API
    // Endpoint: POST /projects/columns/cards/:card_id/moves
    await octokit.request('POST /projects/columns/cards/{card_id}/moves', {
      card_id: cardId,
      column_id: columnId,
      position,
      headers: {
        'X-GitHub-Api-Version': '2022-11-28',
        'Accept': 'application/vnd.github+json'
      }
    })
  } catch (error) {
    logger.error('Error moving GitHub project card', {
      cardId,
      columnId,
      position,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

