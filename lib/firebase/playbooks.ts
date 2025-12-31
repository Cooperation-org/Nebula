'use client'

import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import { logger } from '@/lib/utils/logger'

/**
 * Playbook document schema
 * Playbooks are stored at teams/{teamId}/playbooks/{playbookId}
 */
export interface Playbook {
  id: string
  teamId: string
  name: string
  content: string
  category: 'task-creation' | 'review-assistance' | 'retrospective' | 'custom'
  version: number
  createdAt: string
  updatedAt: string
  createdBy: string
}

/**
 * Get playbooks for a team
 * 
 * @param teamId - Team ID
 * @param category - Optional category filter
 * @returns Array of playbooks
 */
export async function getTeamPlaybooks(
  teamId: string,
  category?: Playbook['category']
): Promise<Playbook[]> {
  const playbooksRef = collection(getFirestoreInstance(), 'teams', teamId, 'playbooks')
  const querySnapshot = await getDocs(playbooksRef)

  const playbooks: Playbook[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const playbook: Playbook = {
      id: doc.id,
      teamId: data.teamId,
      name: data.name,
      content: data.content,
      category: data.category || 'custom',
      version: data.version || 1,
      createdAt: data.createdAt?.toDate?.() 
        ? data.createdAt.toDate().toISOString() 
        : data.createdAt,
      updatedAt: data.updatedAt?.toDate?.() 
        ? data.updatedAt.toDate().toISOString() 
        : data.updatedAt,
      createdBy: data.createdBy || ''
    }
    
    // Filter by category if provided
    if (!category || playbook.category === category) {
      playbooks.push(playbook)
    }
  })

  return playbooks
}

/**
 * Get a specific playbook
 * 
 * @param teamId - Team ID
 * @param playbookId - Playbook ID
 * @returns Playbook or null if not found
 */
export async function getPlaybook(
  teamId: string,
  playbookId: string
): Promise<Playbook | null> {
  const playbookRef = doc(getFirestoreInstance(), 'teams', teamId, 'playbooks', playbookId)
  const playbookSnap = await getDoc(playbookRef)

  if (!playbookSnap.exists()) {
    return null
  }

  const data = playbookSnap.data()
  return {
    id: playbookSnap.id,
    teamId: data.teamId,
    name: data.name,
    content: data.content,
    category: data.category || 'custom',
    version: data.version || 1,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    createdBy: data.createdBy || ''
  }
}

/**
 * Get default playbooks (from filesystem)
 * These are the standard playbooks that come with the system
 * 
 * @param category - Optional category filter
 * @returns Array of playbook contents
 */
export async function getDefaultPlaybooks(
  category?: 'task-creation' | 'review-assistance' | 'retrospective'
): Promise<Array<{ name: string; content: string; category: string }>> {
  const playbooks: Array<{ name: string; content: string; category: string }> = []

  // Load default playbooks from filesystem
  // In a real implementation, these would be loaded from the filesystem
  // For now, we'll return empty and let the API route handle loading from files
  
  return playbooks
}

/**
 * Initialize default playbooks for a team
 * Copies default playbooks to team's playbook collection
 * 
 * @param teamId - Team ID
 * @returns Array of created playbooks
 */
export async function initializeDefaultPlaybooks(teamId: string): Promise<Playbook[]> {
  const { getCurrentUser } = await import('./auth')
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User not authenticated')
  }

  // This would typically load from filesystem or API
  // For now, we'll create empty playbooks that can be populated
  const defaultPlaybooks = [
    { name: 'Task Creation', category: 'task-creation' as const },
    { name: 'Review Assistance', category: 'review-assistance' as const },
    { name: 'Retrospective', category: 'retrospective' as const }
  ]

  const createdPlaybooks: Playbook[] = []

  for (const playbook of defaultPlaybooks) {
    // Check if playbook already exists
    const existing = await getTeamPlaybooks(teamId, playbook.category)
    if (existing.length > 0) {
      continue // Skip if already exists
    }

    // Load content from API (which will read from filesystem)
    try {
      const response = await fetch(`/api/playbooks/${playbook.category}`)
      if (response.ok) {
        const data = await response.json()
        const playbookContent = data.content || ''

        const playbookId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'playbooks'), '_').id
        const now = new Date().toISOString()

        const playbookDoc: Omit<Playbook, 'id'> = {
          teamId,
          name: playbook.name,
          content: playbookContent,
          category: playbook.category,
          version: 1,
          createdAt: now,
          updatedAt: now,
          createdBy: currentUser.uid
        }

        const playbookRef = doc(getFirestoreInstance(), 'teams', teamId, 'playbooks', playbookId)
        await setDoc(playbookRef, {
          ...playbookDoc,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        })

        createdPlaybooks.push({ id: playbookId, ...playbookDoc })

        logger.info('Default playbook initialized', {
          teamId,
          playbookId,
          category: playbook.category
        })
      }
    } catch (error) {
      logger.error('Error initializing default playbook', {
        teamId,
        category: playbook.category,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  return createdPlaybooks
}

