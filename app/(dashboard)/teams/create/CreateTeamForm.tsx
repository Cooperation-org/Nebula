'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Container
} from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import { createTeam } from '@/lib/firebase/teams'
import { logger } from '@/lib/utils/logger'
import { useAppStore } from '@/lib/stores/useAppStore'

export default function CreateTeamForm() {
  const router = useRouter()
  const setActiveTeamId = useAppStore((state) => state.setActiveTeamId)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate inputs
      if (!name.trim()) {
        setError('Team name is required')
        setLoading(false)
        return
      }

      if (name.length > 100) {
        setError('Team name must be 100 characters or less')
        setLoading(false)
        return
      }

      if (description && description.length > 500) {
        setError('Description must be 500 characters or less')
        setLoading(false)
        return
      }

      // Create team
      logger.info('Team creation attempt', { name })
      const team = await createTeam(name.trim(), description.trim() || undefined)

      // Set active team in store
      setActiveTeamId(team.id)

      // Success - redirect to team tasks page
      logger.info('Team created successfully', { teamId: team.id, name: team.name })
      router.push(`/teams/${team.id}/tasks`)
    } catch (err: unknown) {
      logger.error('Team creation failed', {
        name,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      // Handle errors
      if (err instanceof Error) {
        setError(err.message || 'Failed to create team. Please try again.')
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
            Create New Team
          </Typography>
          <Typography variant='body2' color='text.secondary' textAlign='center'>
            Create a team to organize work and collaborate with others
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
              label='Team Name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
              autoFocus
              helperText={`${name.length}/100 characters`}
            />

            <TextField
              label='Description'
              type='text'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={4}
              disabled={loading}
              helperText={`${description.length}/500 characters (optional)`}
            />

            <Button
              type='submit'
              variant='contained'
              fullWidth
              size='large'
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Creating Team...' : 'Create Team'}
            </Button>
          </Box>
        </Box>
      </Container>
    </AppLayout>
  )
}

