'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Button,
  Container,
  Typography,
  Card,
  CardContent,
  CardActions,
  CircularProgress,
  Alert,
  Stack,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Divider
} from '@mui/material'
import { Check, Close, PersonAdd, Person } from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import {
  getPendingTeamRequests,
  approveTeamRequest,
  rejectTeamRequest
} from '@/lib/firebase/team-requests'
import { getCurrentUserDocument, getUserDocument } from '@/lib/firebase/auth'
import { getTeam } from '@/lib/firebase/teams'
import { logger } from '@/lib/utils/logger'
import type { TeamRequest } from '@/lib/schemas/team-request'
import type { User } from '@/lib/types/user'
import type { Team } from '@/lib/types/team'

export default function TeamRequestsPage() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string

  const [requests, setRequests] = useState<TeamRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [team, setTeam] = useState<Team | null>(null)
  const [users, setUsers] = useState<Record<string, User>>({})
  const [approveDialog, setApproveDialog] = useState<{
    open: boolean
    request: TeamRequest | null
  }>({ open: false, request: null })
  const [rejectDialog, setRejectDialog] = useState<{
    open: boolean
    request: TeamRequest | null
  }>({ open: false, request: null })
  const [adminMessage, setAdminMessage] = useState('')
  const [processing, setProcessing] = useState<string | null>(null)

  useEffect(() => {
    if (!teamId) return

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load team info
        const teamData = await getTeam(teamId)
        if (teamData) {
          setTeam(teamData)
        }

        // Load pending requests
        const requestsData = await getPendingTeamRequests(teamId)
        setRequests(requestsData)

        // Load user info for all requesters
        const userPromises = requestsData.map(req =>
          getUserDocument(req.userId).then(user => ({ userId: req.userId, user }))
        )
        const userResults = await Promise.all(userPromises)
        const usersMap: Record<string, User> = {}
        userResults.forEach(({ userId, user }) => {
          if (user) {
            usersMap[userId] = user
          }
        })
        setUsers(usersMap)
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error'
        logger.error('Error loading team requests', {
          teamId,
          error: errorMessage
        })

        // Check if it's a permission error
        if (errorMessage.includes('Stewards and Admins')) {
          setError('You do not have permission to view join requests. Only team Stewards and Admins can manage join requests.')
          // Redirect after 3 seconds
          setTimeout(() => {
            router.push(`/teams/${teamId}/tasks`)
          }, 3000)
        } else {
          setError(errorMessage)
        }
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teamId])

  const handleApprove = async () => {
    if (!approveDialog.request) return

    try {
      setProcessing(approveDialog.request.id)
      await approveTeamRequest(
        teamId,
        approveDialog.request.id,
        adminMessage || undefined
      )

      logger.info('Team request approved', {
        requestId: approveDialog.request.id,
        teamId
      })

      // Refresh requests
      const requestsData = await getPendingTeamRequests(teamId)
      setRequests(requestsData)

      setApproveDialog({ open: false, request: null })
      setAdminMessage('')
    } catch (err) {
      logger.error('Error approving request', {
        requestId: approveDialog.request.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to approve request')
    } finally {
      setProcessing(null)
    }
  }

  const handleReject = async () => {
    if (!rejectDialog.request) return

    try {
      setProcessing(rejectDialog.request.id)
      await rejectTeamRequest(teamId, rejectDialog.request.id, adminMessage || undefined)

      logger.info('Team request rejected', {
        requestId: rejectDialog.request.id,
        teamId
      })

      // Refresh requests
      const requestsData = await getPendingTeamRequests(teamId)
      setRequests(requestsData)

      setRejectDialog({ open: false, request: null })
      setAdminMessage('')
    } catch (err) {
      logger.error('Error rejecting request', {
        requestId: rejectDialog.request.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to reject request')
    } finally {
      setProcessing(null)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth='lg' sx={{ py: 4 }}>
          <Box
            display='flex'
            justifyContent='center'
            alignItems='center'
            minHeight='400px'
          >
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
            Join Requests
          </Typography>
          <Typography variant='body1' color='text.secondary'>
            {team ? `Review join requests for ${team.name}` : 'Review join requests'}
          </Typography>
        </Box>

        {error && (
          <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {requests.length === 0 ? (
          <Card>
            <CardContent>
              <Box textAlign='center' py={4}>
                <PersonAdd sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant='h6' gutterBottom>
                  No pending requests
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  All join requests have been reviewed.
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Stack spacing={2}>
            {requests.map(request => {
              const user = users[request.userId]

              return (
                <Card key={request.id}>
                  <CardContent>
                    <Box
                      display='flex'
                      justifyContent='space-between'
                      alignItems='flex-start'
                      mb={2}
                    >
                      <Box>
                        <Typography variant='h6' gutterBottom>
                          {user?.displayName || user?.email || 'Unknown User'}
                        </Typography>
                        <Typography variant='body2' color='text.secondary'>
                          {user?.email}
                        </Typography>
                      </Box>
                      <Chip label='Pending' color='warning' size='small' />
                    </Box>

                    {request.message && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant='body2' color='text.secondary' gutterBottom>
                          Message:
                        </Typography>
                        <Typography variant='body1'>{request.message}</Typography>
                      </Box>
                    )}

                    <Typography variant='caption' color='text.secondary'>
                      Requested: {new Date(request.requestedAt).toLocaleString()}
                    </Typography>
                  </CardContent>
                  <Divider />
                  <CardActions sx={{ p: 2 }}>
                    <Button
                      size='small'
                      variant='contained'
                      color='success'
                      startIcon={<Check />}
                      onClick={() => setApproveDialog({ open: true, request })}
                      disabled={processing === request.id}
                    >
                      Approve
                    </Button>
                    <Button
                      size='small'
                      variant='outlined'
                      color='error'
                      startIcon={<Close />}
                      onClick={() => setRejectDialog({ open: true, request })}
                      disabled={processing === request.id}
                    >
                      Reject
                    </Button>
                  </CardActions>
                </Card>
              )
            })}
          </Stack>
        )}

        {/* Approve Dialog */}
        <Dialog
          open={approveDialog.open}
          onClose={() => {
            setApproveDialog({ open: false, request: null })
            setAdminMessage('')
          }}
          maxWidth='sm'
          fullWidth
        >
          <DialogTitle>Approve Join Request</DialogTitle>
          <DialogContent>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
              Approve this user's request to join the team?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label='Optional message (visible to user)'
              value={adminMessage}
              onChange={e => setAdminMessage(e.target.value)}
              placeholder='Welcome to the team!'
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setApproveDialog({ open: false, request: null })
                setAdminMessage('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleApprove}
              variant='contained'
              color='success'
              disabled={processing === approveDialog.request?.id}
            >
              {processing === approveDialog.request?.id ? 'Approving...' : 'Approve'}
            </Button>
          </DialogActions>
        </Dialog>

        {/* Reject Dialog */}
        <Dialog
          open={rejectDialog.open}
          onClose={() => {
            setRejectDialog({ open: false, request: null })
            setAdminMessage('')
          }}
          maxWidth='sm'
          fullWidth
        >
          <DialogTitle>Reject Join Request</DialogTitle>
          <DialogContent>
            <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
              Reject this user's request to join the team?
            </Typography>
            <TextField
              fullWidth
              multiline
              rows={3}
              label='Optional reason (visible to user)'
              value={adminMessage}
              onChange={e => setAdminMessage(e.target.value)}
              placeholder='Please provide a reason for rejection...'
            />
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => {
                setRejectDialog({ open: false, request: null })
                setAdminMessage('')
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReject}
              variant='contained'
              color='error'
              disabled={processing === rejectDialog.request?.id}
            >
              {processing === rejectDialog.request?.id ? 'Rejecting...' : 'Reject'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </AppLayout>
  )
}
