'use client'

import { doc, updateDoc, serverTimestamp, getDoc } from 'firebase/firestore'
import { db } from './config'
import { getCurrentUser } from './auth'
import { logger } from '@/lib/utils/logger'

/**
 * Check if user has completed onboarding
 */
export async function hasCompletedOnboarding(userId: string): Promise<boolean> {
  try {
    const userRef = doc(db, 'users', userId)
    const userSnap = await getDoc(userRef)
    
    if (!userSnap.exists()) {
      return false
    }
    
    const userData = userSnap.data()
    return userData?.onboardingCompleted === true
  } catch (error) {
    logger.error('Error checking onboarding status', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

/**
 * Mark onboarding as completed
 * 
 * @param userId - Optional user ID. If not provided, uses getCurrentUser()
 */
export async function completeOnboarding(userId?: string): Promise<void> {
  let currentUserId: string
  
  if (userId) {
    currentUserId = userId
  } else {
    const currentUser = getCurrentUser()
    if (!currentUser) {
      throw new Error('User must be authenticated to complete onboarding')
    }
    currentUserId = currentUser.uid
  }

  try {
    const userRef = doc(db, 'users', currentUserId)
    const now = new Date().toISOString()
    
    await updateDoc(userRef, {
      onboardingCompleted: true,
      onboardingCompletedAt: now,
      updatedAt: serverTimestamp()
    })

    logger.info('Onboarding completed', { 
      userId: currentUserId,
      onboardingCompletedAt: now
    })
    
    // Verify the update was successful
    const userSnap = await getDoc(userRef)
    if (!userSnap.exists()) {
      throw new Error('User document not found after update')
    }
    const userData = userSnap.data()
    if (userData?.onboardingCompleted !== true) {
      logger.warn('Onboarding completion may not have been saved correctly', {
        userId: currentUserId,
        onboardingCompleted: userData?.onboardingCompleted
      })
    }
  } catch (error) {
    logger.error('Error completing onboarding', {
      userId: currentUserId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    throw error
  }
}

/**
 * Reset onboarding (for testing or if user wants to retake)
 */
export async function resetOnboarding(): Promise<void> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to reset onboarding')
  }

  try {
    const userRef = doc(db, 'users', currentUser.uid)
    await updateDoc(userRef, {
      onboardingCompleted: false,
      onboardingCompletedAt: null,
      updatedAt: serverTimestamp()
    })

    logger.info('Onboarding reset', { userId: currentUser.uid })
  } catch (error) {
    logger.error('Error resetting onboarding', {
      userId: currentUser.uid,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    throw error
  }
}

