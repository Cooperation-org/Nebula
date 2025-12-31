'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Box, CircularProgress, Typography } from '@mui/material'
import { useAuth } from '@/lib/hooks/useAuth'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'

/**
 * Dashboard redirect page
 *
 * This page acts as a smart redirect based on user state:
 * - If not authenticated → redirect to /login
 * - If onboarding not completed → redirect to /onboarding
 * - If onboarding completed → redirect to /teams
 */
export default function DashboardPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    // Wait for auth to initialize
    if (authLoading) {
      return
    }

    const checkAuthAndRedirect = async () => {
      try {
        // Check if user is authenticated
        if (!user) {
          logger.info('User not authenticated, redirecting to login')
          router.push('/login')
          return
        }

        // Check onboarding status
        const userDoc = await getCurrentUserDocument()
        if (!userDoc) {
          logger.warn('User document not found, redirecting to login')
          router.push('/login')
          return
        }

        // Redirect based on onboarding status
        // Check explicitly for true to handle undefined/null cases
        if (userDoc.onboardingCompleted === true) {
          logger.info('Onboarding completed, redirecting to teams', {
            userId: user.uid,
            onboardingCompletedAt: userDoc.onboardingCompletedAt
          })
          router.push('/teams')
        } else {
          logger.info('Onboarding not completed, redirecting to onboarding', {
            userId: user.uid,
            onboardingCompleted: userDoc.onboardingCompleted
          })
          router.push('/onboarding')
        }
      } catch (error) {
        logger.error('Error checking auth and redirecting', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        // On error, redirect to login as fallback
        router.push('/login')
      }
    }

    checkAuthAndRedirect()
  }, [router, user, authLoading])

  // Show loading state while checking auth
  if (authLoading) {
    return (
      <Box
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          gap: 2
        }}
      >
        <CircularProgress />
        <Typography variant='body2' color='text.secondary'>
          Loading your dashboard...
        </Typography>
      </Box>
    )
  }

  // While redirecting, show loading state
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 2
      }}
    >
      <CircularProgress />
      <Typography variant='body2' color='text.secondary'>
        Redirecting...
      </Typography>
    </Box>
  )
}
