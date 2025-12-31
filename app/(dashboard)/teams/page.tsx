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
  Chip,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material'
import {
  Add,
  Group,
  ArrowForward,
  PersonAdd
} from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import { useAuth } from '@/lib/hooks/useAuth'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { getTeam } from '@/lib/firebase/teams'
import { logger } from '@/lib/utils/logger'
import { useAppStore } from '@/lib/stores/useAppStore'
import type { Team } from '@/lib/types/team'
import type { User } from '@/lib/types/user'

interface TeamWithRole {
  team: Team
  role: string
}

export default function TeamsPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const activeTeamId = useAppStore((state) => state.activeTeamId)
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId)
  const [teams, setTeams] = useState<TeamWithRole[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    // Wait for auth to initialize
    if (authLoading) {
      return
    }

    const loadTeams = async () => {
      try {
        setLoading(true)
        setError(null)

        // Check if user is authenticated
        if (!user) {
          setError('Please log in to view your teams')
          setLoading(false)
          return
        }

        const userDoc = await getCurrentUserDocument()
        if (!userDoc) {
          setError('Please log in to view your teams')
          setLoading(false)
          return
        }

        // Load team information for all teams user belongs to
        const teamPromises = Object.entries(userDoc.teams).map(
          async ([teamId, role]): Promise<TeamWithRole | null> => {
            try {
              const team = await getTeam(teamId)
              return team ? { team, role: role as string } : null
            } catch (err) {
              logger.error('Error loading team', {
                teamId,
                error: err instanceof Error ? err.message : 'Unknown error'
              })
              return null
            }
          }
        )

        const teamResults = await Promise.all(teamPromises)
        const validTeams = teamResults.filter(
          (t): t is TeamWithRole => t !== null
        )

        setTeams(validTeams)

        // Set active team if not set and user has teams
        // Use a separate effect or check to avoid dependency issues
        if (validTeams.length > 0) {
          const currentActiveTeamId = useAppStore.getState().activeTeamId
          if (!currentActiveTeamId) {
            setActiveTeamId(validTeams[0].team.id)
          }
        }
      } catch (err) {
        logger.error('Error loading teams', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load teams. Please try again.')
      } finally {
        setLoading(false)
      }
    }

    loadTeams()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading]) // Re-run when auth state changes

  const handleTeamClick = (teamId: string) => {
    setActiveTeamId(teamId)
    router.push(`/teams/${teamId}/tasks`)
  }

  const handleCreateTeam = () => {
    router.push('/teams/create')
  }

  const handleJoinTeam = () => {
    router.push('/teams/join')
  }

  if (loading || authLoading) {
    return (
      <AppLayout>
        <Container maxWidth="lg" sx={{ py: 4 }}>
          <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Your Teams
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
            Manage your teams, tasks, and contributions. Select a team to get started.
          </Typography>

          <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
            <Button
              variant="contained"
              startIcon={<Add />}
              onClick={handleCreateTeam}
            >
              Create Team
            </Button>
            <Button
              variant="outlined"
              startIcon={<PersonAdd />}
              onClick={handleJoinTeam}
            >
              Join Team
            </Button>
          </Stack>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {teams.length === 0 ? (
          <Card>
            <CardContent>
              <Box textAlign="center" py={4}>
                <Group sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                <Typography variant="h6" gutterBottom>
                  No teams yet
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Create a new team or join an existing one to get started.
                </Typography>
                <Stack direction="row" spacing={2} justifyContent="center">
                  <Button
                    variant="contained"
                    startIcon={<Add />}
                    onClick={handleCreateTeam}
                  >
                    Create Team
                  </Button>
                  <Button
                    variant="outlined"
                    startIcon={<PersonAdd />}
                    onClick={handleJoinTeam}
                  >
                    Join Team
                  </Button>
                </Stack>
              </Box>
            </CardContent>
          </Card>
        ) : (
          <Grid container spacing={3}>
            {teams.map(({ team, role }) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={team.id}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    cursor: 'pointer',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 4
                    }
                  }}
                  onClick={() => handleTeamClick(team.id)}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                      <Typography variant="h6" component="h2" noWrap sx={{ flex: 1, mr: 1 }}>
                        {team.name}
                      </Typography>
                      <Chip
                        label={role}
                        size="small"
                        color="primary"
                        sx={{ height: 24, fontSize: '0.75rem' }}
                      />
                    </Box>
                    {team.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
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
                    <Box display="flex" gap={1} flexWrap="wrap">
                      <Chip
                        label={`Created ${new Date(team.createdAt).toLocaleDateString()}`}
                        size="small"
                        variant="outlined"
                      />
                    </Box>
                  </CardContent>
                  <CardActions sx={{ p: 2, pt: 0 }}>
                    <Button
                      size="small"
                      endIcon={<ArrowForward />}
                      onClick={(e) => {
                        e.stopPropagation()
                        handleTeamClick(team.id)
                      }}
                    >
                      Open Team
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </AppLayout>
  )
}

