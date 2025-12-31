/**
 * GitHub Team Mapper
 *
 * Maps GitHub repositories to Toolkit team IDs
 * Uses Firestore configuration collection or environment variables
 */

import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'

const db = getFirestore()

/**
 * Repository to Team mapping configuration
 * Stored in Firestore at: teams/{teamId}/githubRepos/{repoFullName}
 * Or in a global config collection: githubRepoMappings/{repoFullName}
 */
interface RepoMapping {
  teamId: string
  repository: string
  repositoryOwner: string
  createdAt: string
  updatedAt: string
}

/**
 * Get team ID from repository full name (owner/repo)
 *
 * First checks Firestore githubRepoMappings collection
 * Falls back to environment variable configuration
 *
 * @param repositoryFullName - GitHub repository full name (e.g., "owner/repo")
 * @returns Team ID if mapping exists, null otherwise
 */
export async function getTeamIdFromRepository(
  repositoryFullName: string
): Promise<string | null> {
  if (!repositoryFullName) {
    return null
  }

  try {
    // Try Firestore mapping first
    const mappingRef = db.collection('githubRepoMappings').doc(repositoryFullName)
    const mappingDoc = await mappingRef.get()

    if (mappingDoc.exists) {
      const data = mappingDoc.data()
      const teamId = data?.teamId

      if (teamId) {
        logger.info('Found team mapping in Firestore', {
          repository: repositoryFullName,
          teamId
        })
        return teamId
      }
    }

    // Fall back to environment variable configuration
    // Format: GITHUB_REPO_TEAM_MAPPING=owner/repo:teamId,owner2/repo2:teamId2
    const envMapping = process.env.GITHUB_REPO_TEAM_MAPPING
    if (envMapping) {
      const mappings = envMapping.split(',')
      for (const mapping of mappings) {
        const [repo, teamId] = mapping.split(':')
        if (repo === repositoryFullName && teamId) {
          logger.info('Found team mapping in environment variable', {
            repository: repositoryFullName,
            teamId
          })
          return teamId
        }
      }
    }

    logger.warn('No team mapping found for repository', {
      repository: repositoryFullName
    })
    return null
  } catch (error) {
    logger.error('Error getting team ID from repository', {
      repository: repositoryFullName,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Create or update repository to team mapping
 *
 * @param repositoryFullName - GitHub repository full name (e.g., "owner/repo")
 * @param teamId - Toolkit team ID
 * @param repositoryOwner - Repository owner (for reference)
 */
export async function setRepositoryTeamMapping(
  repositoryFullName: string,
  teamId: string,
  repositoryOwner: string
): Promise<void> {
  try {
    const mappingRef = db.collection('githubRepoMappings').doc(repositoryFullName)
    const now = new Date().toISOString()

    const mapping: RepoMapping = {
      teamId,
      repository: repositoryFullName.split('/')[1] || repositoryFullName,
      repositoryOwner,
      createdAt: (await mappingRef.get()).exists
        ? (await mappingRef.get()).data()?.createdAt || now
        : now,
      updatedAt: now
    }

    await mappingRef.set(mapping, { merge: true })

    logger.info('Repository team mapping created/updated', {
      repository: repositoryFullName,
      teamId,
      repositoryOwner
    })
  } catch (error) {
    logger.error('Error setting repository team mapping', {
      repository: repositoryFullName,
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

/**
 * Get all repository mappings for a team
 *
 * @param teamId - Toolkit team ID
 * @returns Array of repository full names mapped to this team
 */
export async function getRepositoriesForTeam(teamId: string): Promise<string[]> {
  try {
    const mappingsRef = db.collection('githubRepoMappings')
    const querySnapshot = await mappingsRef.where('teamId', '==', teamId).get()

    const repositories: string[] = []
    querySnapshot.forEach(doc => {
      repositories.push(doc.id) // Document ID is the repository full name
    })

    logger.info('Retrieved repositories for team', {
      teamId,
      repositoryCount: repositories.length
    })

    return repositories
  } catch (error) {
    logger.error('Error getting repositories for team', {
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return []
  }
}
