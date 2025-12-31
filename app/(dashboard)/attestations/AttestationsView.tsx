'use client'

import { useEffect, useState } from 'react'
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
  Paper,
  Button,
  IconButton,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Snackbar
} from '@mui/material'
import {
  ExpandMore as ExpandMoreIcon,
  ContentCopy as ContentCopyIcon,
  Download as DownloadIcon,
  Verified as VerifiedIcon,
  CheckCircle as CheckCircleIcon
} from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import { subscribeToAttestations } from '@/lib/firebase/attestations'
import { useAuth } from '@/lib/hooks/useAuth'
import type { Attestation } from '@/lib/types/attestation'
import { logger } from '@/lib/utils/logger'

/**
 * Attestations View Component
 *
 * Displays all attestations for the current user across all teams
 *
 * Story 8.8: View Attestations with Portability
 */
export default function AttestationsView() {
  const [attestations, setAttestations] = useState<Attestation[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Use auth hook to wait for Firebase Auth to initialize
  const { user, loading: authLoading } = useAuth()

  useEffect(() => {
    // Wait for auth to initialize
    if (authLoading) {
      return
    }

    // Check if user is authenticated
    if (!user) {
      setError('You must be logged in to view your attestations')
      setLoading(false)
      return
    }

    // Subscribe to attestations (real-time updates, across all teams - FR57)
    const unsubscribe = subscribeToAttestations(user.uid, updatedAttestations => {
      setAttestations(updatedAttestations)
      setLoading(false)
      setError(null)
    })

    return () => {
      unsubscribe()
    }
  }, [user, authLoading])

  const handleCopyAttestation = async (attestation: Attestation) => {
    try {
      const attestationJson = JSON.stringify(attestation, null, 2)
      await navigator.clipboard.writeText(attestationJson)
      logger.info('Attestation copied to clipboard', { attestationId: attestation.id })
      setSuccessMessage('Attestation copied to clipboard!')
    } catch (err) {
      logger.error('Failed to copy attestation', {
        attestationId: attestation.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError('Failed to copy attestation to clipboard')
    }
  }

  const handleExportAttestations = () => {
    if (!user) {
      setError('You must be logged in to export attestations')
      return
    }

    try {
      const exportData = {
        exportedAt: new Date().toISOString(),
        contributorId: user.uid,
        attestations
      }
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `attestations-${user.uid}-${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      logger.info('Attestations exported', { count: attestations.length })
      setSuccessMessage(
        `Successfully exported ${attestations.length} attestation${attestations.length !== 1 ? 's' : ''}!`
      )
    } catch (err) {
      logger.error('Failed to export attestations', {
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError('Failed to export attestations')
    }
  }

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

  // Group attestations by team for better organization
  const attestationsByTeam = attestations.reduce(
    (acc, attestation) => {
      const teamId = attestation.teamId
      if (!acc[teamId]) {
        acc[teamId] = []
      }
      acc[teamId].push(attestation)
      return acc
    },
    {} as Record<string, Attestation[]>
  )

  const totalCook = attestations.reduce((sum, a) => sum + a.cookValue, 0)
  const totalAttestations = attestations.length
  const teamsCount = Object.keys(attestationsByTeam).length

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
              <Typography variant='h4' component='h1' gutterBottom>
                My Attestations
              </Typography>
              <Typography variant='body1' color='text.secondary'>
                Portable proof of your contributions across all teams
              </Typography>
            </Box>
            {attestations.length > 0 && (
              <Button
                variant='outlined'
                startIcon={<DownloadIcon />}
                onClick={handleExportAttestations}
              >
                Export All
              </Button>
            )}
          </Box>

          {/* Summary Cards */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Total Attestations
                  </Typography>
                  <Typography variant='h4' component='div'>
                    {totalAttestations}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Total COOK
                  </Typography>
                  <Typography variant='h4' component='div' color='primary'>
                    {totalCook.toFixed(2)}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            <Grid size={{ xs: 12, sm: 4 }}>
              <Card>
                <CardContent>
                  <Typography variant='body2' color='text.secondary' gutterBottom>
                    Teams
                  </Typography>
                  <Typography variant='h4' component='div'>
                    {teamsCount}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          {/* Success Snackbar */}
          <Snackbar
            open={!!successMessage}
            autoHideDuration={6000}
            onClose={() => setSuccessMessage(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
          >
            <Alert
              onClose={() => setSuccessMessage(null)}
              severity='success'
              sx={{ width: '100%' }}
            >
              {successMessage}
            </Alert>
          </Snackbar>

          {attestations.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant='body1' color='text.secondary' align='center' py={4}>
                  No attestations yet. Complete tasks to start earning attestations!
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Attestations by Team */}
              {Object.entries(attestationsByTeam).map(([teamId, teamAttestations]) => (
                <Box key={teamId}>
                  <Typography variant='h5' component='h2' gutterBottom>
                    {teamAttestations[0].teamName || `Team ${teamId.substring(0, 8)}...`}
                  </Typography>
                  <Typography
                    variant='body2'
                    color='text.secondary'
                    gutterBottom
                    sx={{ mb: 2 }}
                  >
                    {teamAttestations.length} attestation
                    {teamAttestations.length !== 1 ? 's' : ''}
                  </Typography>
                  {teamAttestations.map(attestation => (
                    <Card key={attestation.id} sx={{ mb: 2 }}>
                      <CardContent>
                        <Box
                          sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            flexWrap: 'wrap',
                            gap: 2
                          }}
                        >
                          <Box sx={{ flex: 1 }}>
                            <Box
                              sx={{
                                display: 'flex',
                                gap: 1,
                                alignItems: 'center',
                                mb: 1
                              }}
                            >
                              <Typography variant='h6' component='h3'>
                                {attestation.taskTitle ||
                                  `Task ${attestation.taskId.substring(0, 8)}...`}
                              </Typography>
                              {attestation.merkleRoot && (
                                <Tooltip title='Cryptographically verified'>
                                  <CheckCircleIcon color='success' fontSize='small' />
                                </Tooltip>
                              )}
                            </Box>
                            <Typography
                              variant='body2'
                              color='text.secondary'
                              gutterBottom
                            >
                              Issued:{' '}
                              {new Date(attestation.issuedAt).toLocaleDateString(
                                'en-US',
                                {
                                  day: 'numeric',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                }
                              )}
                            </Typography>
                            <Box
                              sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}
                            >
                              <Chip
                                label={`${attestation.cookValue.toFixed(2)} COOK`}
                                size='small'
                                color='primary'
                              />
                              <Chip
                                label={
                                  attestation.attribution === 'self' ? 'Self' : 'Spend'
                                }
                                size='small'
                                color={
                                  attestation.attribution === 'self'
                                    ? 'primary'
                                    : 'secondary'
                                }
                                variant='outlined'
                              />
                              <Chip
                                label={`${attestation.reviewers.length} reviewer${attestation.reviewers.length !== 1 ? 's' : ''}`}
                                size='small'
                                variant='outlined'
                              />
                            </Box>
                          </Box>
                          <Box>
                            <Tooltip title='Copy attestation JSON'>
                              <IconButton
                                size='small'
                                onClick={() => handleCopyAttestation(attestation)}
                              >
                                <ContentCopyIcon fontSize='small' />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Box>

                        {/* Verification Information (Merkle hash) */}
                        {attestation.merkleRoot && (
                          <Accordion sx={{ mt: 2 }}>
                            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <VerifiedIcon color='success' fontSize='small' />
                                <Typography variant='body2' color='text.secondary'>
                                  Verification Information
                                </Typography>
                              </Box>
                            </AccordionSummary>
                            <AccordionDetails>
                              <Box
                                sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}
                              >
                                <Box>
                                  <Typography variant='caption' color='text.secondary'>
                                    Merkle Root:
                                  </Typography>
                                  <Typography
                                    variant='body2'
                                    component='code'
                                    sx={{
                                      display: 'block',
                                      wordBreak: 'break-all',
                                      fontFamily: 'monospace',
                                      fontSize: '0.75rem',
                                      bgcolor: 'action.hover',
                                      p: 1,
                                      borderRadius: 1,
                                      mt: 0.5
                                    }}
                                  >
                                    {attestation.merkleRoot}
                                  </Typography>
                                </Box>
                                {attestation.parentHash && (
                                  <Box>
                                    <Typography variant='caption' color='text.secondary'>
                                      Parent Hash (Chain Link):
                                    </Typography>
                                    <Typography
                                      variant='body2'
                                      component='code'
                                      sx={{
                                        display: 'block',
                                        wordBreak: 'break-all',
                                        fontFamily: 'monospace',
                                        fontSize: '0.75rem',
                                        bgcolor: 'action.hover',
                                        p: 1,
                                        borderRadius: 1,
                                        mt: 0.5
                                      }}
                                    >
                                      {attestation.parentHash}
                                    </Typography>
                                  </Box>
                                )}
                                <Typography
                                  variant='caption'
                                  color='text.secondary'
                                  sx={{ mt: 1 }}
                                >
                                  This attestation is cryptographically verifiable using
                                  the Merkle root hash. The parent hash links this
                                  attestation to the previous one in the chain.
                                </Typography>
                              </Box>
                            </AccordionDetails>
                          </Accordion>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </Box>
              ))}
            </>
          )}
        </Box>
      </Container>
    </AppLayout>
  )
}
