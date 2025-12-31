'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Box, Button, TextField, Typography, Alert, Link, Container } from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import { signUp } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'

export default function RegisterForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate inputs
      if (!email || !password || !displayName) {
        setError('All fields are required')
        setLoading(false)
        return
      }

      if (password.length < 6) {
        setError('Password must be at least 6 characters')
        setLoading(false)
        return
      }

      // Register user
      logger.info('Registration attempt', { email })
      await signUp(email, password, displayName)

      // Success - user is automatically logged in after signUp
      logger.info('Registration successful', { email })
      // Redirect to onboarding for new users
      router.push('/onboarding')
    } catch (err: unknown) {
      logger.error('Registration failed', {
        email,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      // Handle Firebase Auth errors
      if (err instanceof Error) {
        if (err.message.includes('email-already-in-use')) {
          setError('This email is already registered. Please log in instead.')
        } else if (err.message.includes('invalid-email')) {
          setError('Please enter a valid email address')
        } else if (err.message.includes('weak-password')) {
          setError('Password is too weak. Please use a stronger password.')
        } else {
          setError(err.message || 'Registration failed. Please try again.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
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
            Create Account
          </Typography>
          <Typography variant='body2' color='text.secondary' textAlign='center'>
            Register to start using the Cooperation Toolkit
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
              label='Display Name'
              type='text'
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              required
              fullWidth
              autoComplete='name'
              disabled={loading}
            />

            <TextField
              label='Email'
              type='email'
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              fullWidth
              autoComplete='email'
              disabled={loading}
            />

            <TextField
              label='Password'
              type='password'
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              fullWidth
              autoComplete='new-password'
              disabled={loading}
              helperText='Password must be at least 6 characters'
            />

            <Button
              type='submit'
              variant='contained'
              fullWidth
              size='large'
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>

            <Box sx={{ textAlign: 'center', mt: 2 }}>
              <Typography variant='body2' color='text.secondary'>
                Already have an account?{' '}
                <Link href='/login' underline='hover'>
                  Log in
                </Link>
              </Typography>
            </Box>
          </Box>
        </Box>
      </Container>
    </AppLayout>
  )
}
