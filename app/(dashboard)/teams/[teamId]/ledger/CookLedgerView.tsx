'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  Box,
  Card,
  CardContent,
  Typography,
  Container,
  CircularProgress,
  Alert,
  Chip,
  Divider,
  Grid,
  Paper
} from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import { useActiveTeamId } from '@/lib/stores/useAppStore'
import { subscribeToCookLedgerEntries } from '@/lib/firebase/cookLedger'
import { useAuth } from '@/lib/hooks/useAuth'
import { getTeam } from '@/lib/firebase/teams'
import {
  calculateCookWithCap,
  type CookCapResult
} from '@/lib/utils/cookCaps'
import {
  calculateCookWithDecay,
  type CookDecayResult
} from '@/lib/utils/cookDecay'
import {
  aggregateByMonth,
  aggregateByYear,
  formatMonthPeriod,
  getTotalCook,
  getTotalSelfCook,
  getTotalSpendCook,
  calculateOverallVelocity,
  calculateVelocityTrends,
  getCurrentMonthVelocity,
  type AggregatedPeriod,
  type CookVelocity
} from '@/lib/utils/cookLedgerAggregation'
import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import { logger } from '@/lib/utils/logger'

/**
 * COOK Ledger View Component
 * 
 * Displays COOK ledger entries with time-based aggregation (monthly and yearly)
 * 
 * Story 8.2: View COOK Ledger with Time-Based Aggregation
 */
export default function CookLedgerView() {
  const params = useParams()
  const teamId = params.teamId as string
  const activeTeamId = useActiveTeamId()
  
  // Use activeTeamId from Zustand if available, otherwise fall back to URL param
  const effectiveTeamId = activeTeamId || teamId
  
  const [entries, setEntries] = useState<CookLedgerEntry[]>([])
  const [team, setTeam] = useState<import('@/lib/types/team').Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Use auth hook to wait for Firebase Auth to initialize
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    // Wait for auth to initialize
    if (authLoading) {
      return
    }

    // Check if user is authenticated
    if (!user) {
      setError('You must be logged in to view your COOK ledger')
      setLoading(false)
      return
    }

    // Load team data for cap configuration
    const loadTeam = async () => {
      try {
        const teamData = await getTeam(effectiveTeamId)
        setTeam(teamData)
      } catch (err) {
        logger.warn('Failed to load team data for COOK cap', {
          teamId: effectiveTeamId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        // Continue without team data - caps won't be applied
      }
    }

    loadTeam()

    // Subscribe to COOK ledger entries (real-time updates)
    const unsubscribe = subscribeToCookLedgerEntries(
      effectiveTeamId,
      user.uid,
      (updatedEntries) => {
        setEntries(updatedEntries)
        setLoading(false)
        setError(null)
      }
    )

    return () => {
      unsubscribe()
    }
  }, [effectiveTeamId, user, authLoading])

  if (loading || authLoading) {
    return (
      <AppLayout>
        <Container maxWidth='lg'>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '400px'
            }}
          >
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <Container maxWidth='lg'>
          <Alert severity='error' sx={{ mt: 2 }}>
            {error}
          </Alert>
        </Container>
      </AppLayout>
    )
  }

  // Aggregate entries
  const monthlyAggregation = aggregateByMonth(entries)
  const yearlyAggregation = aggregateByYear(entries)
  
  // Convert maps to sorted arrays
  const monthlyPeriods = Array.from(monthlyAggregation.values()).sort(
    (a, b) => b.period.localeCompare(a.period)
  )
  const yearlyPeriods = Array.from(yearlyAggregation.values()).sort(
    (a, b) => b.period.localeCompare(a.period)
  )

  // Calculate velocities
  const overallVelocity = calculateOverallVelocity(entries)
  const velocityTrends = calculateVelocityTrends(monthlyPeriods)
  const currentMonthVelocity = getCurrentMonthVelocity(monthlyPeriods)

  // Calculate COOK with cap and decay applied (Stories 8.4, 8.5)
  const capResult = calculateCookWithCap(entries, team)
  const decayResult = calculateCookWithDecay(entries, team)
  const totalCook = capResult.totalCook
  const totalSelfCook = getTotalSelfCook(entries)
  const totalSpendCook = getTotalSpendCook(entries)

  return (
    <AppLayout>
      <Container maxWidth='lg'>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            py: { xs: 2, sm: 3, md: 4 }
          }}
        >
          {/* Header */}
          <Box>
            <Typography variant='h4' component='h1' gutterBottom>
              COOK Ledger
            </Typography>
            <Typography variant='body1' color='text.secondary'>
              Your contribution history and COOK earnings
            </Typography>
          </Box>

          {/* Summary Cards */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Total COOK
                  </Typography>
                  <Typography variant='h4' component='div'>
                    {totalCook.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Self-COOK
                  </Typography>
                  <Typography variant='h4' component='div' color='primary'>
                    {totalSelfCook.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Spend-COOK
                  </Typography>
                  <Typography variant='h4' component='div' color='secondary'>
                    {totalSpendCook.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 6, md: 3 }}>
              <Card>
                <CardContent>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Overall Velocity
                  </Typography>
                  <Typography variant='h4' component='div' color='success.main'>
                    {overallVelocity.toFixed(2)}/mo
                  </Typography>
                  <Typography variant='caption' color='text.secondary'>
                    Average COOK per month
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Current Month Velocity */}
          {currentMonthVelocity && (
            <Card sx={{ bgcolor: 'action.hover' }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2
                  }}
                >
                  <Box>
                    <Typography variant='h6' component='h2' gutterBottom>
                      Current Month Velocity
                    </Typography>
                    <Typography variant='h4' component='div' color='primary'>
                      {currentMonthVelocity.velocity.toFixed(2)} COOK
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {formatMonthPeriod(currentMonthVelocity.period)}
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                    {currentMonthVelocity.trend === 'increasing' && (
                      <Chip
                        label='↑ Increasing'
                        color='success'
                        size='small'
                      />
                    )}
                    {currentMonthVelocity.trend === 'decreasing' && (
                      <Chip
                        label='↓ Decreasing'
                        color='warning'
                        size='small'
                      />
                    )}
                    {currentMonthVelocity.trend === 'stable' && (
                      <Chip
                        label='→ Stable'
                        color='default'
                        size='small'
                      />
                    )}
                    {currentMonthVelocity.trend === 'new' && (
                      <Chip
                        label='New'
                        color='info'
                        size='small'
                      />
                    )}
                    {currentMonthVelocity.previousVelocity !== undefined && (
                      <Typography variant='body2' color='text.secondary'>
                        Previous: {currentMonthVelocity.previousVelocity.toFixed(2)}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* COOK Cap Information */}
          {capResult.capAmount && (
            <Card sx={{ bgcolor: capResult.isCapped ? 'warning.light' : 'info.light' }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2
                  }}
                >
                  <Box>
                    <Typography variant='h6' component='h2' gutterBottom>
                      COOK Cap Status
                    </Typography>
                    <Typography variant='body1' component='div'>
                      <strong>Total COOK:</strong> {capResult.totalCook.toFixed(2)}
                    </Typography>
                    <Typography variant='body1' component='div'>
                      <strong>Effective COOK (for governance):</strong>{' '}
                      {capResult.cappedCook.toFixed(2)} / {capResult.capAmount.toFixed(2)}
                    </Typography>
                    {capResult.uncappedCook > 0 && (
                      <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                        {capResult.uncappedCook.toFixed(2)} COOK above cap (tracked but doesn't
                        count toward governance)
                      </Typography>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    {capResult.isCapped && (
                      <Chip
                        label='Cap Reached'
                        color='warning'
                        size='small'
                      />
                    )}
                    <Typography variant='h6' component='div' color={capResult.isCapped ? 'warning.main' : 'info.main'}>
                      {capResult.capPercentage.toFixed(1)}%
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      of cap used
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* COOK Decay Information */}
          {decayResult.decayRate && decayResult.decayRate > 0 && (
            <Card sx={{ bgcolor: 'action.hover' }}>
              <CardContent>
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 2
                  }}
                >
                  <Box>
                    <Typography variant='h6' component='h2' gutterBottom>
                      COOK Decay Status
                    </Typography>
                    <Typography variant='body1' component='div'>
                      <strong>Raw COOK (historical):</strong> {decayResult.rawCook.toFixed(2)}
                    </Typography>
                    <Typography variant='body1' component='div'>
                      <strong>Decayed COOK (for governance):</strong>{' '}
                      {decayResult.decayedCook.toFixed(2)}
                    </Typography>
                    {decayResult.decayAmount > 0 && (
                      <Typography variant='body2' color='text.secondary' sx={{ mt: 1 }}>
                        {decayResult.decayAmount.toFixed(2)} COOK lost to decay
                        ({((decayResult.decayAmount / decayResult.rawCook) * 100).toFixed(1)}%)
                      </Typography>
                    )}
                    <Typography variant='caption' color='text.secondary' sx={{ mt: 1, display: 'block' }}>
                      Decay rate: {(decayResult.decayRate * 100).toFixed(2)}% per month
                    </Typography>
                  </Box>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 1 }}>
                    <Typography variant='h6' component='div' color='info.main'>
                      {decayResult.decayedCook.toFixed(2)}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      Effective for governance
                    </Typography>
                  </Box>
                </Box>
              </CardContent>
            </Card>
          )}

          {entries.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant='body1' color='text.secondary' align='center' py={4}>
                  No COOK ledger entries yet. Complete tasks to start earning COOK!
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Yearly Aggregation */}
              {yearlyPeriods.length > 0 && (
                <Box>
                  <Typography variant='h5' component='h2' gutterBottom>
                    Yearly Summary
                  </Typography>
                  <Grid container spacing={2}>
                    {yearlyPeriods.map((yearPeriod) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={yearPeriod.period}>
                        <Card>
                          <CardContent>
                            <Typography variant='h6' component='h3' gutterBottom>
                              {yearPeriod.period}
                            </Typography>
                            <Typography variant='h4' component='div' gutterBottom>
                              {yearPeriod.totalCook.toFixed(2)} COOK
                            </Typography>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                              <Chip
                                label={`${yearPeriod.selfCook.toFixed(2)} Self`}
                                size='small'
                                color='primary'
                                variant='outlined'
                              />
                              <Chip
                                label={`${yearPeriod.spendCook.toFixed(2)} Spend`}
                                size='small'
                                color='secondary'
                                variant='outlined'
                              />
                              <Chip
                                label={`${yearPeriod.entryCount} entries`}
                                size='small'
                                variant='outlined'
                              />
                            </Box>
                          </CardContent>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              )}

              {/* Monthly Aggregation */}
              {monthlyPeriods.length > 0 && (
                <Box>
                  <Typography variant='h5' component='h2' gutterBottom>
                    Monthly Breakdown
                  </Typography>
                  {monthlyPeriods.map((monthPeriod) => {
                    const velocity = velocityTrends.find((v) => v.period === monthPeriod.period)
                    return (
                      <Card key={monthPeriod.period} sx={{ mb: 2 }}>
                        <CardContent>
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              mb: 2,
                              flexWrap: 'wrap',
                              gap: 2
                            }}
                          >
                            <Box>
                              <Typography variant='h6' component='h3'>
                                {formatMonthPeriod(monthPeriod.period)}
                              </Typography>
                              {velocity && (
                                <Box sx={{ display: 'flex', gap: 1, mt: 0.5, alignItems: 'center' }}>
                                  <Typography variant='body2' color='text.secondary'>
                                    Velocity: {velocity.velocity.toFixed(2)} COOK
                                  </Typography>
                                  {velocity.trend === 'increasing' && (
                                    <Chip
                                      label='↑'
                                      color='success'
                                      size='small'
                                      sx={{ height: 20 }}
                                    />
                                  )}
                                  {velocity.trend === 'decreasing' && (
                                    <Chip
                                      label='↓'
                                      color='warning'
                                      size='small'
                                      sx={{ height: 20 }}
                                    />
                                  )}
                                  {velocity.trend === 'stable' && (
                                    <Chip
                                      label='→'
                                      color='default'
                                      size='small'
                                      sx={{ height: 20 }}
                                    />
                                  )}
                                </Box>
                              )}
                            </Box>
                            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                              <Typography variant='h6' component='span'>
                                {monthPeriod.totalCook.toFixed(2)} COOK
                              </Typography>
                              <Chip
                                label={`${monthPeriod.selfCook.toFixed(2)} Self`}
                                size='small'
                                color='primary'
                                variant='outlined'
                              />
                              <Chip
                                label={`${monthPeriod.spendCook.toFixed(2)} Spend`}
                                size='small'
                                color='secondary'
                                variant='outlined'
                              />
                              <Chip
                                label={`${monthPeriod.entryCount} entries`}
                                size='small'
                                variant='outlined'
                              />
                            </Box>
                          </Box>
                        <Divider sx={{ my: 2 }} />
                        {/* Individual entries for this month */}
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {monthPeriod.entries.map((entry) => (
                            <Paper
                              key={entry.id}
                              variant='outlined'
                              sx={{ p: 2 }}
                            >
                              <Box
                                sx={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  flexWrap: 'wrap',
                                  gap: 1
                                }}
                              >
                                <Box>
                                  <Typography variant='body2' color='text.secondary'>
                                    {new Date(entry.issuedAt).toLocaleDateString('en-US', {
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}
                                  </Typography>
                                  <Typography variant='body2' color='text.secondary'>
                                    Task: {entry.taskId.substring(0, 8)}...
                                  </Typography>
                                </Box>
                                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                                  <Typography variant='h6' component='span'>
                                    {entry.cookValue.toFixed(2)} COOK
                                  </Typography>
                                  <Chip
                                    label={entry.attribution === 'self' ? 'Self' : 'Spend'}
                                    size='small'
                                    color={entry.attribution === 'self' ? 'primary' : 'secondary'}
                                  />
                                </Box>
                              </Box>
                            </Paper>
                          ))}
                        </Box>
                      </CardContent>
                    </Card>
                    )
                  })}
                </Box>
              )}
            </>
          )}
        </Box>
      </Container>
    </AppLayout>
  )
}

