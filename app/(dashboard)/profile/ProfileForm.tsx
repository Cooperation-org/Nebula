'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Container,
  Card,
  CardContent,
  Divider,
  Chip,
  Avatar
} from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import {
  getCurrentUserDocument,
  updateUserProfile,
  getCurrentUser
} from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'
import type { User } from '@/lib/types/user'
import { getTeam } from '@/lib/firebase/teams'
import type { Team } from '@/lib/types/team'
import { useRouter } from 'next/navigation'
import { School } from '@mui/icons-material'

export default function ProfileForm() {
  const router = useRouter()
  const [user, setUser] = useState<User | null>(null)
  const [teams, setTeams] = useState<Array<{ team: Team; role: string }>>([])
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [photoURL, setPhotoURL] = useState('')
  const [slackUserId, setSlackUserId] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingProfile, setLoadingProfile] = useState(true)

  // Load user profile on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const userDoc = await getCurrentUserDocument()
        if (!userDoc) {
          setError('User profile not found')
          setLoadingProfile(false)
          return
        }

        setUser(userDoc)
        setDisplayName(userDoc.displayName)
        setEmail(userDoc.email)
        setPhotoURL(userDoc.photoURL || '')
        setSlackUserId(userDoc.slackUserId || '')

        // Load team information
        const teamPromises = Object.entries(userDoc.teams).map(
          async ([teamId, role]): Promise<{ team: Team; role: string } | null> => {
            try {
              const team = await getTeam(teamId)
              return team ? { team, role } : null
            } catch {
              return null
            }
          }
        )

        const teamResults = await Promise.all(teamPromises)
        setTeams(
          teamResults.filter(
            (t): t is { team: Team; role: string } => t !== null
          )
        )
      } catch (err) {
        logger.error('Error loading profile', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load profile')
      } finally {
        setLoadingProfile(false)
      }
    }

    loadProfile()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      // Validate inputs
      if (!displayName.trim()) {
        setError('Display name is required')
        setLoading(false)
        return
      }

      if (displayName.length > 100) {
        setError('Display name must be 100 characters or less')
        setLoading(false)
        return
      }

      if (!email.trim()) {
        setError('Email is required')
        setLoading(false)
        return
      }

      if (photoURL && photoURL.length > 0 && !photoURL.match(/^https?:\/\/.+/)) {
        setError('Photo URL must be a valid HTTP/HTTPS URL')
        setLoading(false)
        return
      }

      // Update profile
      logger.info('Profile update attempt', { userId: user?.id })
      const updatedUser = await updateUserProfile({
        displayName: displayName.trim(),
        email: email.trim(),
        photoURL: photoURL.trim() || undefined,
        slackUserId: slackUserId.trim() || undefined
      })

      setUser(updatedUser)
      setSuccess('Profile updated successfully')
      logger.info('Profile updated successfully', { userId: updatedUser.id })
    } catch (err: unknown) {
      logger.error('Profile update failed', {
        userId: user?.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      // Handle errors
      if (err instanceof Error) {
        setError(err.message || 'Failed to update profile. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (loadingProfile) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '60vh'
            }}
          >
            <Typography variant='body1' color='text.secondary'>
              Loading profile...
            </Typography>
          </Box>
        </Container>
      </AppLayout>
    )
  }

  if (!user) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Alert severity='error'>User profile not found</Alert>
        </Container>
      </AppLayout>
    )
  }

  const currentUser = getCurrentUser()

  return (
    <AppLayout>
      <Container maxWidth='md'>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            py: 4
          }}
        >
          <Typography variant='h4' component='h1' gutterBottom>
            My Profile
          </Typography>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Avatar
                  src={user.photoURL || undefined}
                  sx={{ width: 64, height: 64 }}
                >
                  {user.displayName.charAt(0).toUpperCase()}
                </Avatar>
                <Box>
                  <Typography variant='h6'>{user.displayName}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {user.email}
                  </Typography>
                </Box>
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box
                component='form'
                onSubmit={handleSubmit}
                sx={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2
                }}
              >
                {error && (
                  <Alert severity='error' onClose={() => setError(null)}>
                    {error}
                  </Alert>
                )}

                {success && (
                  <Alert severity='success' onClose={() => setSuccess(null)}>
                    {success}
                  </Alert>
                )}

                <TextField
                  label='Display Name'
                  type='text'
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  required
                  fullWidth
                  disabled={loading}
                  helperText={`${displayName.length}/100 characters`}
                />

                <TextField
                  label='Email'
                  type='email'
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  fullWidth
                  disabled={loading}
                />

                <TextField
                  label='Photo URL'
                  type='url'
                  value={photoURL}
                  onChange={(e) => setPhotoURL(e.target.value)}
                  fullWidth
                  disabled={loading}
                  helperText='Optional: URL to your profile photo'
                />

                <TextField
                  label='Slack User ID'
                  type='text'
                  value={slackUserId}
                  onChange={(e) => setSlackUserId(e.target.value)}
                  fullWidth
                  disabled={loading}
                  helperText={
                    slackUserId
                      ? '✅ Slack account linked. You can use /cook commands in Slack.'
                      : 'Enter your Slack User ID to enable Slack commands. Find it by running /cook help in Slack or check your Slack profile URL.'
                  }
                  placeholder='U1234567890'
                />

                <Button
                  type='submit'
                  variant='contained'
                  fullWidth
                  size='large'
                  disabled={loading}
                  sx={{ mt: 2 }}
                >
                  {loading ? 'Updating Profile...' : 'Update Profile'}
                </Button>
              </Box>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant='h6'>
                  Teams & Roles
                </Typography>
                <Button
                  variant='outlined'
                  startIcon={<School />}
                  onClick={() => router.push('/onboarding')}
                  size='small'
                >
                  Retake Tutorial
                </Button>
              </Box>
              <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                Your teams and roles across all teams you belong to
              </Typography>

              {teams.length === 0 ? (
                <Typography variant='body2' color='text.secondary'>
                  You are not a member of any teams yet.
                </Typography>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {teams.map(({ team, role }) => (
                    <Box
                      key={team.id}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        p: 2,
                        border: '1px solid',
                        borderColor: 'divider',
                        borderRadius: 1
                      }}
                    >
                      <Box>
                        <Typography variant='body1' fontWeight='medium'>
                          {team.name}
                        </Typography>
                        {team.description && (
                          <Typography variant='body2' color='text.secondary'>
                            {team.description}
                          </Typography>
                        )}
                      </Box>
                      <Chip label={role} color='primary' size='small' />
                    </Box>
                  ))}
                </Box>
              )}
            </CardContent>
          </Card>
        </Box>
      </Container>
    </AppLayout>
  )
}

