'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Link,
  Container
} from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import { signIn, getCurrentUserDocument } from '@/lib/firebase/auth'
import { useAuth } from '@/lib/hooks/useAuth'
import { logger } from '@/lib/utils/logger'

export default function LoginForm() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // Check if user is already logged in
  useEffect(() => {
    // Wait for auth to initialize
    if (authLoading) {
      return
    }

    const checkAuth = async () => {
      try {
        if (user) {
          // User is already logged in, load their document and redirect
          const userDoc = await getCurrentUserDocument()
          if (userDoc) {
            logger.info('User already authenticated', { userId: user.uid })
            router.push('/dashboard')
            return
          }
        }
      } catch (err) {
        logger.error('Error checking auth state', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }

    checkAuth()
  }, [router, user, authLoading])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate inputs
      if (!email || !password) {
        setError('Email and password are required')
        setLoading(false)
        return
      }

      // Sign in user
      logger.info('Login attempt', { email })
      const user = await signIn(email, password)

      // Load user document
      const userDoc = await getCurrentUserDocument()
      if (!userDoc) {
        logger.warn('User document not found after login', { userId: user.uid })
        setError('User account not found. Please contact support.')
        setLoading(false)
        return
      }

      // Success - redirect to dashboard
      logger.info('Login successful', { userId: user.uid, email })
      router.push('/dashboard')
    } catch (err: unknown) {
      logger.error('Login failed', {
        email,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      // Handle Firebase Auth errors
      if (err instanceof Error) {
        if (err.message.includes('user-not-found') || err.message.includes('wrong-password')) {
          setError('Invalid email or password. Please try again.')
        } else if (err.message.includes('invalid-email')) {
          setError('Please enter a valid email address')
        } else if (err.message.includes('too-many-requests')) {
          setError('Too many failed login attempts. Please try again later.')
        } else {
          setError(err.message || 'Login failed. Please try again.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  if (authLoading) {
    return (
      <AppLayout>
        <Container maxWidth='sm'>
          <Box
            sx={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '60vh'
            }}
          >
            <Typography variant='body1' color='text.secondary'>
              Checking authentication...
            </Typography>
          </Box>
        </Container>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Container maxWidth='sm'>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60vh',
            gap: 3
          }}
        >
          <Typography variant='h4' component='h1' gutterBottom>
            Log In
          </Typography>
          <Typography variant='body2' color='text.secondary' textAlign='center'>
            Sign in to access your teams and projects
          </Typography>

          <Box
            component='form'
            onSubmit={handleSubmit}
            sx={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              mt: 2
            }}
          >
            {error && (
              <Alert severity='error' onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <TextField
              label='Email'
              type='email'
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete='email'
              disabled={loading}
              autoFocus
            />

            <TextField
              label='Password'
              type='password'
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete='current-password'
              disabled={loading}
            />

            <Button
              type='submit'
              variant='contained'
              fullWidth
              size='large'
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant='body2' color='text.secondary'>
                Don't have an account?{' '}
                <Link href='/register' underline='hover'>
                  Create one
                </Link>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </AppLayout>
  )
}

