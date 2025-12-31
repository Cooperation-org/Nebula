'use client'

import { useState, useEffect } from 'react'
import { User as FirebaseUser } from 'firebase/auth'
import { getCurrentUser, onAuthStateChange } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'

/**
 * Hook to get current authenticated user
 * Waits for Firebase Auth to initialize and restore auth state
 *
 * @returns { user: FirebaseUser | null, loading: boolean }
 */
export function useAuth() {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Subscribe to auth state changes
    // This will fire immediately with current state, then on any changes
    const unsubscribe = onAuthStateChange(firebaseUser => {
      logger.debug('Auth state changed', {
        userId: firebaseUser?.uid || null,
        email: firebaseUser?.email || null
      })
      setUser(firebaseUser)
      setLoading(false)
    })

    // Also check immediately (in case auth state is already available)
    // This handles the case where Firebase has already restored state
    const currentUser = getCurrentUser()
    if (currentUser) {
      setUser(currentUser)
      setLoading(false)
    }

    return () => {
      unsubscribe()
    }
  }, [])

  return { user, loading }
}
