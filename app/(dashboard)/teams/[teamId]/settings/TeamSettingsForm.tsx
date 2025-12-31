'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  Box,
  Button,
  TextField,
  Typography,
  Container,
  Alert,
  CircularProgress,
  Card,
  CardContent,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Grid,
  Paper
} from '@mui/material'
import { Save, Settings as SettingsIcon } from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import { getTeam, updateTeam } from '@/lib/firebase/teams'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'
import { usePermissions } from '@/lib/hooks/usePermissions'
import type { Team } from '@/lib/types/team'

export default function TeamSettingsForm() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string

  const { hasRole } = usePermissions()
  const isSteward = hasRole('Steward') || hasRole('Admin')

  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Basic info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  // COOK settings
  const [cookCap, setCookCap] = useState<string>('')
  const [cookDecayRate, setCookDecayRate] = useState<string>('')

  // Equity model
  const [equityModel, setEquityModel] = useState<'slicing' | 'proportional' | 'custom' | ''>('')

  // Committee settings
  const [committeeEligibilityWindowMonths, setCommitteeEligibilityWindowMonths] = useState<string>('')
  const [committeeMinimumActiveCook, setCommitteeMinimumActiveCook] = useState<string>('')
  const [committeeCoolingOffPeriodDays, setCommitteeCoolingOffPeriodDays] = useState<string>('')

  // Governance settings
  const [defaultObjectionWindowDays, setDefaultObjectionWindowDays] = useState<string>('')
  const [defaultObjectionThreshold, setDefaultObjectionThreshold] = useState<string>('')
  const [defaultVotingPeriodDays, setDefaultVotingPeriodDays] = useState<string>('')
  const [constitutionalVotingPeriodDays, setConstitutionalVotingPeriodDays] = useState<string>('')
  const [constitutionalApprovalThreshold, setConstitutionalApprovalThreshold] = useState<string>('')

  useEffect(() => {
    const loadTeam = async () => {
      if (!teamId) return

      try {
        setLoading(true)
        setError(null)

        // Check permissions
        const userDoc = await getCurrentUserDocument()
        if (!userDoc) {
          setError('Please log in to view team settings')
          setLoading(false)
          return
        }

        const userRole = userDoc.teams[teamId]
        if (userRole !== 'Steward' && userRole !== 'Admin') {
          setError('Only Stewards and Admins can view team settings')
          setLoading(false)
          return
        }

        const teamData = await getTeam(teamId)
        if (!teamData) {
          setError('Team not found')
          setLoading(false)
          return
        }

        setTeam(teamData)
        setName(teamData.name)
        setDescription(teamData.description || '')
        setCookCap(teamData.cookCap?.toString() || '')
        setCookDecayRate(teamData.cookDecayRate?.toString() || '')
        setEquityModel(teamData.equityModel || '')
        setCommitteeEligibilityWindowMonths(teamData.committeeEligibilityWindowMonths?.toString() || '')
        setCommitteeMinimumActiveCook(teamData.committeeMinimumActiveCook?.toString() || '')
        setCommitteeCoolingOffPeriodDays(teamData.committeeCoolingOffPeriodDays?.toString() || '')
        setDefaultObjectionWindowDays(teamData.defaultObjectionWindowDays?.toString() || '')
        setDefaultObjectionThreshold(teamData.defaultObjectionThreshold?.toString() || '')
        setDefaultVotingPeriodDays(teamData.defaultVotingPeriodDays?.toString() || '')
        setConstitutionalVotingPeriodDays(teamData.constitutionalVotingPeriodDays?.toString() || '')
        setConstitutionalApprovalThreshold(teamData.constitutionalApprovalThreshold?.toString() || '')
      } catch (err) {
        logger.error('Error loading team settings', {
          teamId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load team settings')
      } finally {
        setLoading(false)
      }
    }

    loadTeam()
  }, [teamId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setSaving(true)

    try {
      if (!team) {
        setError('Team not loaded')
        setSaving(false)
        return
      }

      // Validate inputs
      if (!name.trim()) {
        setError('Team name is required')
        setSaving(false)
        return
      }

      // Prepare updates
      const updates: Partial<Team> = {
        name: name.trim(),
        description: description.trim() || undefined,
        cookCap: cookCap.trim() ? parseFloat(cookCap.trim()) : undefined,
        cookDecayRate: cookDecayRate.trim() ? parseFloat(cookDecayRate.trim()) : undefined,
        equityModel: equityModel || undefined,
        committeeEligibilityWindowMonths: committeeEligibilityWindowMonths.trim()
          ? parseInt(committeeEligibilityWindowMonths.trim(), 10)
          : undefined,
        committeeMinimumActiveCook: committeeMinimumActiveCook.trim()
          ? parseFloat(committeeMinimumActiveCook.trim())
          : undefined,
        committeeCoolingOffPeriodDays: committeeCoolingOffPeriodDays.trim()
          ? parseInt(committeeCoolingOffPeriodDays.trim(), 10)
          : undefined,
        defaultObjectionWindowDays: defaultObjectionWindowDays.trim()
          ? parseInt(defaultObjectionWindowDays.trim(), 10)
          : undefined,
        defaultObjectionThreshold: defaultObjectionThreshold.trim()
          ? parseInt(defaultObjectionThreshold.trim(), 10)
          : undefined,
        defaultVotingPeriodDays: defaultVotingPeriodDays.trim()
          ? parseInt(defaultVotingPeriodDays.trim(), 10)
          : undefined,
        constitutionalVotingPeriodDays: constitutionalVotingPeriodDays.trim()
          ? parseInt(constitutionalVotingPeriodDays.trim(), 10)
          : undefined,
        constitutionalApprovalThreshold: constitutionalApprovalThreshold.trim()
          ? parseFloat(constitutionalApprovalThreshold.trim())
          : undefined
      }

      // Validate numeric fields
      if (updates.cookCap !== undefined && (isNaN(updates.cookCap) || updates.cookCap <= 0)) {
        setError('COOK cap must be a positive number')
        setSaving(false)
        return
      }

      if (updates.cookDecayRate !== undefined && (isNaN(updates.cookDecayRate) || updates.cookDecayRate < 0 || updates.cookDecayRate > 1)) {
        setError('COOK decay rate must be between 0 and 1 (0% to 100%)')
        setSaving(false)
        return
      }

      if (updates.constitutionalApprovalThreshold !== undefined && (isNaN(updates.constitutionalApprovalThreshold) || updates.constitutionalApprovalThreshold < 0 || updates.constitutionalApprovalThreshold > 100)) {
        setError('Constitutional approval threshold must be between 0 and 100')
        setSaving(false)
        return
      }

      await updateTeam(teamId, updates)
      setSuccess('Team settings updated successfully')
      logger.info('Team settings updated', { teamId })

      // Reload team data
      const updatedTeam = await getTeam(teamId)
      if (updatedTeam) {
        setTeam(updatedTeam)
      }
    } catch (err) {
      logger.error('Error updating team settings', {
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to update team settings')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth='lg'>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '60vh'
            }}
          >
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    )
  }

  if (!isSteward) {
    return (
      <AppLayout>
        <Container maxWidth='lg'>
          <Alert severity='error'>Only Stewards and Admins can view team settings</Alert>
        </Container>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Container maxWidth='lg' sx={{ py: 4 }}>
        <Box sx={{ mb: 4 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
            <SettingsIcon color='primary' />
            <Typography variant='h4' component='h1'>
              Team Settings
            </Typography>
          </Box>
          {team && (
            <Typography variant='body2' color='text.secondary'>
              Configure settings for {team.name}
            </Typography>
          )}
        </Box>

        {error && (
          <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert severity='success' sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
            {success}
          </Alert>
        )}

        <Box component='form' onSubmit={handleSubmit}>
          <Grid container spacing={3}>
            {/* Basic Information */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Basic Information
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label='Team Name'
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        fullWidth
                        disabled={saving}
                      />
                    </Grid>
                    <Grid size={{ xs: 12 }}>
                      <TextField
                        label='Description'
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        multiline
                        rows={3}
                        fullWidth
                        disabled={saving}
                        helperText='Optional description for your team'
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* COOK Settings */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    COOK Settings
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label='COOK Cap'
                        type='number'
                        value={cookCap}
                        onChange={(e) => setCookCap(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Maximum total COOK that can be issued (optional)'
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label='COOK Decay Rate'
                        type='number'
                        value={cookDecayRate}
                        onChange={(e) => setCookDecayRate(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Monthly decay rate (0-1, e.g., 0.05 = 5% per month)'
                        inputProps={{ min: 0, max: 1, step: 0.01 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Equity Model */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Equity Model
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <FormControl fullWidth>
                        <InputLabel>Equity Model</InputLabel>
                        <Select
                          value={equityModel}
                          onChange={(e) => setEquityModel(e.target.value as 'slicing' | 'proportional' | 'custom' | '')}
                          label='Equity Model'
                          disabled={saving}
                        >
                          <MenuItem value=''>Default</MenuItem>
                          <MenuItem value='slicing'>Slicing</MenuItem>
                          <MenuItem value='proportional'>Proportional</MenuItem>
                          <MenuItem value='custom'>Custom</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Committee Settings */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Committee Settings
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label='Eligibility Window (Months)'
                        type='number'
                        value={committeeEligibilityWindowMonths}
                        onChange={(e) => setCommitteeEligibilityWindowMonths(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Recent window for eligibility (e.g., 6 months)'
                        inputProps={{ min: 1, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label='Minimum Active COOK'
                        type='number'
                        value={committeeMinimumActiveCook}
                        onChange={(e) => setCommitteeMinimumActiveCook(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Minimum COOK required for eligibility'
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 4 }}>
                      <TextField
                        label='Cooling-Off Period (Days)'
                        type='number'
                        value={committeeCoolingOffPeriodDays}
                        onChange={(e) => setCommitteeCoolingOffPeriodDays(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Days after service ends before eligible again'
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Governance Settings */}
            <Grid size={{ xs: 12 }}>
              <Card>
                <CardContent>
                  <Typography variant='h6' gutterBottom>
                    Governance Settings
                  </Typography>
                  <Divider sx={{ mb: 3 }} />
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label='Default Objection Window (Days)'
                        type='number'
                        value={defaultObjectionWindowDays}
                        onChange={(e) => setDefaultObjectionWindowDays(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Default duration for objection windows'
                        inputProps={{ min: 1, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label='Default Objection Threshold'
                        type='number'
                        value={defaultObjectionThreshold}
                        onChange={(e) => setDefaultObjectionThreshold(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Number of objections required to trigger voting'
                        inputProps={{ min: 0, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label='Default Voting Period (Days)'
                        type='number'
                        value={defaultVotingPeriodDays}
                        onChange={(e) => setDefaultVotingPeriodDays(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Default duration for voting periods'
                        inputProps={{ min: 1, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label='Constitutional Voting Period (Days)'
                        type='number'
                        value={constitutionalVotingPeriodDays}
                        onChange={(e) => setConstitutionalVotingPeriodDays(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Voting period for constitutional challenges'
                        inputProps={{ min: 1, step: 1 }}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <TextField
                        label='Constitutional Approval Threshold (%)'
                        type='number'
                        value={constitutionalApprovalThreshold}
                        onChange={(e) => setConstitutionalApprovalThreshold(e.target.value)}
                        fullWidth
                        disabled={saving}
                        helperText='Minimum weighted vote percentage for approval (0-100)'
                        inputProps={{ min: 0, max: 100, step: 1 }}
                      />
                    </Grid>
                  </Grid>
                </CardContent>
              </Card>
            </Grid>

            {/* Submit Button */}
            <Grid size={{ xs: 12 }}>
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  variant='outlined'
                  onClick={() => router.back()}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type='submit'
                  variant='contained'
                  startIcon={saving ? <CircularProgress size={20} /> : <Save />}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </Button>
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </AppLayout>
  )
}

