'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Box, Button, TextField, Typography, Alert, Container } from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import { getTeam } from '@/lib/firebase/teams'
import { createTeamRequest, getPendingRequestByUser } from '@/lib/firebase/team-requests'
import { getCurrentUser } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'
import { useAppStore } from '@/lib/stores/useAppStore'

export default function JoinTeamForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const setActiveTeamId = useAppStore(state => state.setActiveTeamId)
  const [teamId, setTeamId] = useState(searchParams.get('teamId') || '')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [teamName, setTeamName] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [hasPendingRequest, setHasPendingRequest] = useState(false)

  // If teamId is provided in URL, try to load team info and check for pending requests
  useEffect(() => {
    const loadTeamInfo = async () => {
      if (teamId) {
        try {
          const team = await getTeam(teamId)
          if (team) {
            setTeamName(team.name)
          }

          // Check if user already has a pending request
          try {
            const currentUser = getCurrentUser()
            if (currentUser) {
              const pendingRequest = await getPendingRequestByUser(
                teamId,
                currentUser.uid
              )
              setHasPendingRequest(!!pendingRequest)
            } else {
              setHasPendingRequest(false)
            }
          } catch {
            // User not authenticated or no pending request
            setHasPendingRequest(false)
          }
        } catch (err) {
          // Team not found or error - will be handled on submit
        }
      }
    }
    loadTeamInfo()
  }, [teamId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate inputs
      if (!teamId.trim()) {
        setError('Team ID is required')
        setLoading(false)
        return
      }

      // Create join request
      logger.info('Team join request attempt', { teamId })
      const request = await createTeamRequest(teamId.trim(), message.trim() || undefined)

      // Success - show success message
      logger.info('Team join request created', {
        requestId: request.id,
        teamId: request.teamId
      })

      // Redirect to My Requests page to see status
      router.push('/teams/my-requests')
    } catch (err: unknown) {
      logger.error('Team join failed', {
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      // Handle errors
      if (err instanceof Error) {
        if (err.message.includes('not found')) {
          setError('Team not found. Please check the team ID and try again.')
        } else if (err.message.includes('already a member')) {
          setError('You are already a member of this team.')
        } else {
          setError(err.message || 'Failed to join team. Please try again.')
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
            Join Team
          </Typography>
          <Typography variant='body2' color='text.secondary' textAlign='center'>
            Enter a team ID to submit a join request. The team admin will review your
            request.
          </Typography>

          {teamName && (
            <Alert severity='info' sx={{ width: '100%' }}>
              Requesting to join: <strong>{teamName}</strong>
            </Alert>
          )}

          {hasPendingRequest && (
            <Alert severity='warning' sx={{ width: '100%' }}>
              You already have a pending request for this team.
            </Alert>
          )}

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
              label='Team ID'
              type='text'
              value={teamId}
              onChange={e => setTeamId(e.target.value)}
              required
              fullWidth
              disabled={loading}
              autoFocus
              helperText='Enter the team ID from your invitation link or team code'
            />

            <TextField
              label='Optional message'
              type='text'
              value={message}
              onChange={e => setMessage(e.target.value)}
              fullWidth
              disabled={loading}
              multiline
              rows={3}
              helperText='Tell the team why you want to join (optional)'
            />

            <Button
              type='submit'
              variant='contained'
              fullWidth
              size='large'
              disabled={loading || hasPendingRequest}
              sx={{ mt: 2 }}
            >
              {loading
                ? 'Submitting Request...'
                : hasPendingRequest
                  ? 'Request Pending'
                  : 'Submit Join Request'}
            </Button>
          </Box>
        </Box>
      </Container>
    </AppLayout>
  )
}
