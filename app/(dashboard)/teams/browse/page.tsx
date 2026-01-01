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
  CardActions,
  Grid,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Stack,
  Chip
} from '@mui/material'
import { Search, Group, ArrowForward, PersonAdd, HourglassEmpty } from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter
} from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase/config'
import { getTeam } from '@/lib/firebase/teams'
import type { Team } from '@/lib/schemas/team'
import { createTeamRequest, getMyPendingRequests } from '@/lib/firebase/team-requests'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'
import { useAppStore } from '@/lib/stores/useAppStore'

const TEAMS_PER_PAGE = 12

export default function BrowseTeamsPage() {
  const router = useRouter()
  const setActiveTeamId = useAppStore(state => state.setActiveTeamId)
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [hydrated, setHydrated] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [userTeams, setUserTeams] = useState<Set<string>>(new Set())
  const [pendingRequests, setPendingRequests] = useState<Set<string>>(new Set())
  const [requestingTeamId, setRequestingTeamId] = useState<string | null>(null)

  useEffect(() => {
    const loadTeams = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load user's teams to show which ones they're already in
        const userDoc = await getCurrentUserDocument()
        if (userDoc?.teams) {
          setUserTeams(new Set(Object.keys(userDoc.teams)))
        }

        // Load user's pending requests
        try {
          const requests = await getMyPendingRequests()
          setPendingRequests(new Set(requests.map(r => r.teamId)))
        } catch (err) {
          // User might not be authenticated, that's okay
          logger.warn('Could not load pending requests', {
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }

        // Load public teams (for now, we'll load all teams)
        // In a real app, you might want to add a 'public' flag to teams
        const teamsRef = collection(getFirestoreInstance(), 'teams')
        const q = query(teamsRef, orderBy('createdAt', 'desc'), limit(TEAMS_PER_PAGE))
        const snapshot = await getDocs(q)

        const teamsList: Team[] = []
        for (const docSnap of snapshot.docs) {
          try {
            const team = await getTeam(docSnap.id)
            if (team) {
              teamsList.push(team)
            }
          } catch (err) {
            logger.error('Error loading team', {
              teamId: docSnap.id,
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }

        setTeams(teamsList)
      } catch (err) {
        logger.error('Error loading teams', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load teams. Please try again.')
      } finally {
        setLoading(false)
        setHydrated(true)
      }
    }

    loadTeams()
  }, [])

  const handleRequestJoin = async (teamId: string) => {
    try {
      setRequestingTeamId(teamId)
      setError(null)

      await createTeamRequest(teamId)

      logger.info('Team join request created', { teamId })

      // Update local state to reflect pending request
      setPendingRequests(prev => new Set([...prev, teamId]))

      // Redirect to My Requests page
      router.push('/teams/my-requests')
    } catch (err) {
      logger.error('Error creating team request', {
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      if (err instanceof Error) {
        if (err.message.includes('already a member')) {
          setError('You are already a member of this team.')
        } else if (err.message.includes('pending request')) {
          setError('You already have a pending request for this team.')
        } else {
          setError(err.message || 'Failed to submit join request. Please try again.')
        }
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setRequestingTeamId(null)
    }
  }

  const handleViewTeam = (teamId: string) => {
    setActiveTeamId(teamId)
    router.push(`/teams/${teamId}/tasks`)
  }

  const filteredTeams = teams.filter(team => {
    if (!searchQuery.trim()) return true
    const query = searchQuery.toLowerCase()
    return (
      team.name.toLowerCase().includes(query) ||
      team.description?.toLowerCase().includes(query)
    )
  })

  return (
    <AppLayout>
      <Container maxWidth='lg' sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant='h4' component='h1' gutterBottom>
            Browse Teams
          </Typography>
          <Typography variant='body1' color='text.secondary' sx={{ mb: 3 }}>
            Discover and join teams. Submit a join request to become a member.
          </Typography>

          <TextField
            fullWidth
            placeholder='Search teams by name or description...'
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position='start'>
                  <Search />
                </InputAdornment>
              )
            }}
            sx={{ mb: 3, maxWidth: 600 }}
          />
        </Box>

        {error && (
          <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading ? (
          <Box
            display='flex'
            justifyContent='center'
            alignItems='center'
            minHeight='400px'
          >
            <CircularProgress />
          </Box>
        ) : filteredTeams.length === 0 ? (
          <Card>
            <CardContent>
              <Box textAlign='center' py={4}>
                <Group sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant='h6' gutterBottom>
                  {searchQuery ? 'No teams found' : 'No teams available'}
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  {searchQuery
                    ? 'Try adjusting your search query.'
                    : 'Be the first to create a team!'}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {filteredTeams.map(team => {
              // Only show dynamic state after hydration to avoid mismatch
              const isMember = hydrated && userTeams.has(team.id)
              const hasPendingRequest = hydrated && pendingRequests.has(team.id)
              const isRequesting = requestingTeamId === team.id

              return (
                <Grid size={{ xs: 12, sm: 6, md: 4 }} key={team.id}>
                  <Card
                    sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      transition: 'transform 0.2s, box-shadow 0.2s',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: 4
                      }
                    }}
                  >
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Box
                        display='flex'
                        justifyContent='space-between'
                        alignItems='flex-start'
                        mb={2}
                      >
                        <Typography
                          variant='h6'
                          component='h2'
                          noWrap
                          sx={{ flex: 1, mr: 1 }}
                        >
                          {team.name}
                        </Typography>
                        {isMember && (
                          <Chip
                            label='Member'
                            size='small'
                            color='success'
                            sx={{ height: 24, fontSize: '0.75rem' }}
                          />
                        )}
                      </Box>
                      {team.description && (
                        <Typography
                          variant='body2'
                          color='text.secondary'
                          sx={{
                            mb: 2,
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden'
                          }}
                        >
                          {team.description}
                        </Typography>
                      )}
                      <Box display='flex' gap={1} flexWrap='wrap'>
                        <Chip
                          label={`Created ${new Date(team.createdAt).toLocaleDateString()}`}
                          size='small'
                          variant='outlined'
                        />
                      </Box>
                    </CardContent>
                    <CardActions sx={{ p: 2, pt: 0 }}>
                      {isMember ? (
                        <Button
                          size='small'
                          endIcon={<ArrowForward />}
                          onClick={() => handleViewTeam(team.id)}
                        >
                          Open Team
                        </Button>
                      ) : hasPendingRequest ? (
                        <Button
                          size='small'
                          variant='outlined'
                          startIcon={<HourglassEmpty />}
                          onClick={() => router.push('/teams/my-requests')}
                        >
                          Requested
                        </Button>
                      ) : (
                        <Button
                          size='small'
                          variant='contained'
                          startIcon={<PersonAdd />}
                          onClick={() => handleRequestJoin(team.id)}
                          disabled={isRequesting}
                        >
                          {isRequesting ? 'Requesting...' : 'Request to Join'}
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              )
            })}
          </Grid>
        )}
      </Container>
    </AppLayout>
  )
}
