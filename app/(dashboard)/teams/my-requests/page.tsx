'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Container,
  Typography,
  Card,
  CardContent,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Divider
} from '@mui/material'
import { HourglassEmpty, Cancel, CheckCircle } from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import { getMyPendingRequests, cancelTeamRequest } from '@/lib/firebase/team-requests'
import { logger } from '@/lib/utils/logger'
import type { TeamRequest } from '@/lib/schemas/team-request'

export default function MyRequestsPage() {
  const router = useRouter()
  const [requests, setRequests] = useState<Array<TeamRequest & { teamName?: string }>>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const loadRequests = async () => {
    try {
      setLoading(true)
      setError(null)

      const requestsData = await getMyPendingRequests()
      setRequests(requestsData)
    } catch (err) {
      logger.error('Error loading my requests', {
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to load requests')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRequests()
  }, [])

  const handleCancelRequest = async (teamId: string, requestId: string) => {
    try {
      setCancellingId(requestId)
      setError(null)
      setSuccess(null)

      await cancelTeamRequest(teamId, requestId)

      logger.info('Request cancelled', { requestId, teamId })
      setSuccess('Request cancelled successfully')

      // Reload requests
      await loadRequests()
    } catch (err) {
      logger.error('Error cancelling request', {
        requestId,
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to cancel request')
    } finally {
      setCancellingId(null)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth='lg' sx={{ py: 4 }}>
          <Box display='flex' justifyContent='center' alignItems='center' minHeight='400px'>
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Container maxWidth='lg' sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant='h4' component='h1' gutterBottom>
            My Team Join Requests
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            Track the status of your pending team join requests
          </Typography>
        </Box>

        {success && (
          <Alert severity='success' sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        {error && (
          <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {requests.length === 0 ? (
          <Card>
            <CardContent>
              <Box textAlign='center' py={4}>
                <CheckCircle sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant='h6' gutterBottom>
                  No pending requests
                </Typography>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
                  You don't have any pending team join requests at the moment.
                </Typography>
                <Button variant='contained' onClick={() => router.push('/teams/browse')}>
                  Browse Teams
                </Button>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {requests.map(request => (
              <Card key={request.id}>
                <CardContent>
                  <Box display='flex' justifyContent='space-between' alignItems='flex-start'>
                    <Box flex={1}>
                      <Box display='flex' alignItems='center' gap={1} mb={1}>
                        <Typography variant='h6'>
                          {request.teamName || request.teamId}
                        </Typography>
                        <Chip
                          label='Pending'
                          size='small'
                          color='warning'
                          icon={<HourglassEmpty />}
                        />
                      </Box>

                      {request.message && (
                        <>
                          <Divider sx={{ my: 2 }} />
                          <Typography variant='body2' color='text.secondary' sx={{ mb: 1 }}>
                            <strong>Your message:</strong>
                          </Typography>
                          <Typography variant='body2' sx={{ fontStyle: 'italic' }}>
                            "{request.message}"
                          </Typography>
                        </>
                      )}

                      <Divider sx={{ my: 2 }} />

                      <Typography variant='caption' color='text.secondary'>
                        Requested{' '}
                        {new Date(request.requestedAt).toLocaleDateString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </Typography>
                    </Box>

                    <Button
                      size='small'
                      variant='outlined'
                      color='error'
                      startIcon={<Cancel />}
                      onClick={() => handleCancelRequest(request.teamId, request.id)}
                      disabled={cancellingId === request.id}
                      sx={{ ml: 2 }}
                    >
                      {cancellingId === request.id ? 'Cancelling...' : 'Cancel Request'}
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <Typography variant='body2' color='text.secondary'>
            Team administrators will review your requests and respond soon.
          </Typography>
        </Box>
      </Container>
    </AppLayout>
  )
}
