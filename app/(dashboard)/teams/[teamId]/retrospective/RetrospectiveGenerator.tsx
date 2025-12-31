'use client'

import { useState } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  TextField,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Paper
} from '@mui/material'
import { AutoAwesome, ExpandMore, Edit, Save } from '@mui/icons-material'
import type { Retrospective } from '@/lib/utils/aiService'

interface RetrospectiveGeneratorProps {
  teamId: string
}

/**
 * Retrospective Generator Component
 *
 * Story 10B.3: Generate Retrospectives via AI
 *
 * Generates and displays AI-powered retrospectives for team reflection
 */
export default function RetrospectiveGenerator({ teamId }: RetrospectiveGeneratorProps) {
  const [retrospective, setRetrospective] = useState<Retrospective | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [editedRetrospective, setEditedRetrospective] = useState<Retrospective | null>(
    null
  )

  // Date range state
  const [startDate, setStartDate] = useState(() => {
    const date = new Date()
    date.setDate(date.getDate() - 30) // Default to last 30 days
    return date.toISOString().split('T')[0]
  })
  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0]
  })

  const handleGenerateRetrospective = async () => {
    setLoading(true)
    setError(null)
    setEditing(false)

    try {
      const response = await fetch('/api/ai/retrospective', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          teamId,
          startDate: `${startDate}T00:00:00Z`,
          endDate: `${endDate}T23:59:59Z`
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate retrospective')
      }

      setRetrospective(result.data)
      setEditedRetrospective(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate retrospective')
    } finally {
      setLoading(false)
    }
  }

  const handleStartEditing = () => {
    setEditing(true)
    setEditedRetrospective(retrospective ? { ...retrospective } : null)
  }

  const handleSave = () => {
    if (editedRetrospective) {
      setRetrospective(editedRetrospective)
      setEditing(false)
    }
  }

  const handleCancel = () => {
    setEditing(false)
    setEditedRetrospective(retrospective)
  }

  const displayRetrospective =
    editing && editedRetrospective ? editedRetrospective : retrospective

  return (
    <Card variant='outlined'>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
          <AutoAwesome color='primary' />
          <Typography variant='h5'>Team Retrospective</Typography>
        </Box>

        <Typography variant='body2' color='text.secondary' sx={{ mb: 3 }}>
          Generate an AI-powered retrospective to reflect on team performance and identify
          areas for improvement.
        </Typography>

        {/* Date Range Selection */}
        <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
          <TextField
            label='Start Date'
            type='date'
            value={startDate}
            onChange={e => setStartDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={loading}
          />
          <TextField
            label='End Date'
            type='date'
            value={endDate}
            onChange={e => setEndDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            disabled={loading}
          />
          <Button
            variant='contained'
            onClick={handleGenerateRetrospective}
            startIcon={loading ? <CircularProgress size={20} /> : <AutoAwesome />}
            disabled={loading || !startDate || !endDate}
            sx={{ minWidth: 200 }}
          >
            {loading ? 'Generating...' : 'Generate Retrospective'}
          </Button>
        </Box>

        {error && (
          <Alert severity='error' sx={{ mb: 3 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
            <Typography variant='body2' color='text.secondary' sx={{ ml: 2 }}>
              Analyzing team data and generating retrospective...
            </Typography>
          </Box>
        )}

        {displayRetrospective && (
          <Box>
            {/* Data Summary */}
            {displayRetrospective.dataSummary && (
              <Paper
                variant='outlined'
                sx={{ p: 2, mb: 3, bgcolor: 'background.default' }}
              >
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold', mb: 1 }}>
                  Data Summary
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  <Chip
                    label={`${displayRetrospective.dataSummary.completedTasks || 0} Tasks Completed`}
                  />
                  <Chip
                    label={`${displayRetrospective.dataSummary.totalCookIssued || 0} COOK Issued`}
                  />
                  <Chip
                    label={`${(displayRetrospective.dataSummary.averageCookPerTask || 0).toFixed(1)} Avg COOK/Task`}
                  />
                  <Chip
                    label={`${displayRetrospective.dataSummary.reviewCount || 0} Reviews`}
                  />
                  {displayRetrospective.dataSummary.averageReviewTime && (
                    <Chip
                      label={`${displayRetrospective.dataSummary.averageReviewTime.toFixed(1)}d Avg Review Time`}
                    />
                  )}
                </Box>
              </Paper>
            )}

            {/* Edit Controls */}
            {!editing && retrospective && (
              <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant='outlined'
                  size='small'
                  startIcon={<Edit />}
                  onClick={handleStartEditing}
                >
                  Edit Retrospective
                </Button>
              </Box>
            )}

            {editing && editedRetrospective && (
              <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
                <Button
                  variant='contained'
                  size='small'
                  startIcon={<Save />}
                  onClick={handleSave}
                >
                  Save Changes
                </Button>
                <Button variant='outlined' size='small' onClick={handleCancel}>
                  Cancel
                </Button>
              </Box>
            )}

            {/* Summary */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  Summary
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {editing && editedRetrospective ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={6}
                    value={editedRetrospective.summary}
                    onChange={e =>
                      setEditedRetrospective({
                        ...editedRetrospective,
                        summary: e.target.value
                      })
                    }
                  />
                ) : (
                  <Typography variant='body1' sx={{ whiteSpace: 'pre-wrap' }}>
                    {displayRetrospective.summary}
                  </Typography>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Accomplishments */}
            <Accordion defaultExpanded>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  Accomplishments ({displayRetrospective.accomplishments.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {editing && editedRetrospective ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={displayRetrospective.accomplishments.length * 2}
                    value={editedRetrospective.accomplishments.join('\n')}
                    onChange={e =>
                      setEditedRetrospective({
                        ...editedRetrospective,
                        accomplishments: e.target.value
                          .split('\n')
                          .filter(line => line.trim())
                      })
                    }
                    placeholder='One accomplishment per line'
                  />
                ) : (
                  <List>
                    {displayRetrospective.accomplishments.map((accomplishment, index) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemText primary={accomplishment} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Patterns */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  Patterns ({displayRetrospective.patterns.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {editing && editedRetrospective ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={displayRetrospective.patterns.length * 2}
                    value={editedRetrospective.patterns.join('\n')}
                    onChange={e =>
                      setEditedRetrospective({
                        ...editedRetrospective,
                        patterns: e.target.value.split('\n').filter(line => line.trim())
                      })
                    }
                    placeholder='One pattern per line'
                  />
                ) : (
                  <List>
                    {displayRetrospective.patterns.map((pattern, index) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemText primary={pattern} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Areas for Improvement */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  Areas for Improvement ({displayRetrospective.areasForImprovement.length}
                  )
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {editing && editedRetrospective ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={displayRetrospective.areasForImprovement.length * 2}
                    value={editedRetrospective.areasForImprovement.join('\n')}
                    onChange={e =>
                      setEditedRetrospective({
                        ...editedRetrospective,
                        areasForImprovement: e.target.value
                          .split('\n')
                          .filter(line => line.trim())
                      })
                    }
                    placeholder='One area per line'
                  />
                ) : (
                  <List>
                    {displayRetrospective.areasForImprovement.map((area, index) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemText primary={area} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>

            {/* Recommendations */}
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  Recommendations ({displayRetrospective.recommendations.length})
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                {editing && editedRetrospective ? (
                  <TextField
                    fullWidth
                    multiline
                    rows={displayRetrospective.recommendations.length * 2}
                    value={editedRetrospective.recommendations.join('\n')}
                    onChange={e =>
                      setEditedRetrospective({
                        ...editedRetrospective,
                        recommendations: e.target.value
                          .split('\n')
                          .filter(line => line.trim())
                      })
                    }
                    placeholder='One recommendation per line'
                  />
                ) : (
                  <List>
                    {displayRetrospective.recommendations.map((recommendation, index) => (
                      <ListItem key={index} sx={{ pl: 0 }}>
                        <ListItemText primary={recommendation} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
