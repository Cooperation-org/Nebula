/**
 * GitHub User Mapper
 * 
 * Maps GitHub usernames to Toolkit user IDs
 * Uses Firestore users collection with githubUsername field
 */

import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp, getApps } from 'firebase-admin/app'
import { logger } from '../../shared/logger'

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp()
}

const db = getFirestore()

/**
 * Map GitHub username to Toolkit user ID
 * Queries Firestore users collection for matching githubUsername
 */
export async function mapGitHubUserToToolkitUser(githubUsername: string): Promise<string | null> {
  if (!githubUsername) {
    return null
  }

  try {
    // Query users collection for matching githubUsername
    const usersRef = db.collection('users')
    const querySnapshot = await usersRef
      .where('githubUsername', '==', githubUsername)
      .limit(1)
      .get()

    if (querySnapshot.empty) {
      logger.warn('No Toolkit user found for GitHub username', {
        githubUsername
      })
      return null
    }

    const userDoc = querySnapshot.docs[0]
    const userId = userDoc.id

    logger.info('Mapped GitHub username to Toolkit user', {
      githubUsername,
      userId
    })

    return userId
  } catch (error) {
    logger.error('Error mapping GitHub username to Toolkit user', {
      githubUsername,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Map multiple GitHub usernames to Toolkit user IDs
 * Returns a map of GitHub username -> Toolkit user ID
 */
export async function mapGitHubUsersToToolkitUsers(
  githubUsernames: string[]
): Promise<Map<string, string>> {
  const mapping = new Map<string, string>()

  // Query all users with GitHub usernames in the provided list
  // Note: Firestore 'in' queries are limited to 10 items, so we batch if needed
  const batchSize = 10
  for (let i = 0; i < githubUsernames.length; i += batchSize) {
    const batch = githubUsernames.slice(i, i + batchSize)
    
    try {
      const usersRef = db.collection('users')
      const querySnapshot = await usersRef
        .where('githubUsername', 'in', batch)
        .get()

      querySnapshot.forEach((doc) => {
        const data = doc.data()
        if (data.githubUsername) {
          mapping.set(data.githubUsername, doc.id)
        }
      })
    } catch (error) {
      logger.error('Error batch mapping GitHub usernames', {
        batch,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  logger.info('Mapped GitHub usernames to Toolkit users', {
    totalRequested: githubUsernames.length,
    totalMapped: mapping.size
  })

  return mapping
}

