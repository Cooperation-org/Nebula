'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  FormControl,
  Select,
  MenuItem,
  SelectChangeEvent,
  Typography,
  Chip,
  CircularProgress
} from '@mui/material'
import { useAppStore } from '@/lib/stores/useAppStore'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { getTeam } from '@/lib/firebase/teams'
import { logger } from '@/lib/utils/logger'
import type { Team } from '@/lib/types/team'
import type { User } from '@/lib/types/user'

interface TeamOption {
  team: Team
  role: string
}

export function TeamSwitcher() {
  const router = useRouter()
  const activeTeamId = useAppStore(state => state.activeTeamId)
  const setActiveTeamId = useAppStore(state => state.setActiveTeamId)
  const [teams, setTeams] = useState<TeamOption[]>([])
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState<User | null>(null)

  // Load user teams on mount
  useEffect(() => {
    const loadTeams = async () => {
      try {
        const userDoc = await getCurrentUserDocument()
        if (!userDoc) {
          setLoading(false)
          return
        }

        setUser(userDoc)

        // Load team information for all teams user belongs to
        const teamPromises = Object.entries(userDoc.teams).map(
          async ([teamId, role]): Promise<TeamOption | null> => {
            try {
              const team = await getTeam(teamId)
              return team ? { team, role } : null
            } catch {
              return null
            }
          }
        )

        const teamResults = await Promise.all(teamPromises)
        const validTeams = teamResults.filter((t): t is TeamOption => t !== null)

        setTeams(validTeams)

        // Set active team if not set and user has teams
        if (!activeTeamId && validTeams.length > 0) {
          setActiveTeamId(validTeams[0].team.id)
        }
      } catch (err) {
        logger.error('Error loading teams for switcher', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      } finally {
        setLoading(false)
      }
    }

    loadTeams()
  }, [activeTeamId, setActiveTeamId])

  const handleTeamChange = (event: SelectChangeEvent<string>) => {
    const newTeamId = event.target.value

    if (newTeamId === activeTeamId) {
      return
    }

    logger.info('Team switched', {
      fromTeamId: activeTeamId,
      toTeamId: newTeamId
    })

    // Update active team in store
    setActiveTeamId(newTeamId)

    // Navigate to team tasks if on a team-specific page
    const currentPath = window.location.pathname
    if (
      currentPath.includes('/teams/') &&
      !currentPath.includes('/teams/create') &&
      !currentPath.includes('/teams/join') &&
      !currentPath.includes('/teams/browse')
    ) {
      router.push(`/teams/${newTeamId}/tasks`)
    }
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <CircularProgress size={16} />
        <Typography variant='body2' color='text.secondary'>
          Loading teams...
        </Typography>
      </Box>
    )
  }

  if (teams.length === 0) {
    return (
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <Typography variant='body2' color='text.secondary'>
          No teams
        </Typography>
      </Box>
    )
  }

  const selectedTeam = teams.find(t => t.team.id === activeTeamId)

  return (
    <FormControl
      size='small'
      sx={{
        minWidth: { xs: 150, sm: 200 },
        '& .MuiOutlinedInput-root': {
          backgroundColor: 'background.paper'
        }
      }}
    >
      <Select
        value={activeTeamId || ''}
        onChange={handleTeamChange}
        displayEmpty
        sx={{
          '& .MuiSelect-select': {
            display: 'flex',
            alignItems: 'center',
            gap: 1
          }
        }}
      >
        {teams.map(({ team, role }) => (
          <MenuItem key={team.id} value={team.id}>
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                width: '100%',
                gap: 1
              }}
            >
              <Typography variant='body2' noWrap sx={{ flex: 1 }}>
                {team.name}
              </Typography>
              <Chip
                label={role}
                size='small'
                color='primary'
                sx={{ height: 20, fontSize: '0.7rem' }}
              />
            </Box>
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  )
}
