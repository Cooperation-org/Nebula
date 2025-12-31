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
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  Divider
} from '@mui/material'
import { AutoAwesome, ExpandMore } from '@mui/icons-material'
import type { ReviewSummary } from '@/lib/utils/aiService'

interface ReviewAssistanceProps {
  taskId: string
  teamId: string
}

/**
 * Review Assistance Component
 *
 * Story 10B.1: AI Review Assistance - Summaries
 *
 * Displays AI-generated review summary to help reviewers understand what to review
 */
export default function ReviewAssistance({ taskId, teamId }: ReviewAssistanceProps) {
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  const handleGenerateSummary = async () => {
    setLoading(true)
    setError(null)
    setExpanded(true)

    try {
      const response = await fetch('/api/ai/review-assistance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          taskId,
          teamId
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate review summary')
      }

      setSummary(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate review summary')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card variant='outlined' sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AutoAwesome color='primary' />
          <Typography variant='h6'>AI Review Assistance</Typography>
        </Box>

        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          Get an AI-generated summary to help you understand what to review.
        </Typography>

        {!summary && !loading && (
          <Button
            variant='contained'
            onClick={handleGenerateSummary}
            startIcon={<AutoAwesome />}
            fullWidth
          >
            Generate Review Summary
          </Button>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
            <Typography variant='body2' color='text.secondary' sx={{ ml: 2 }}>
              Generating summary...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {summary && (
          <Box>
            <Accordion
              expanded={expanded}
              onChange={(_, isExpanded) => setExpanded(isExpanded)}
            >
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                  Review Summary
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Overall Summary */}
                  <Box>
                    <Typography variant='subtitle2' sx={{ fontWeight: 'bold', mb: 1 }}>
                      Summary
                    </Typography>
                    <Typography variant='body2'>{summary.summary}</Typography>
                  </Box>

                  <Divider />

                  {/* Task Work */}
                  <Box>
                    <Typography variant='subtitle2' sx={{ fontWeight: 'bold', mb: 1 }}>
                      Task Work
                    </Typography>
                    <Typography variant='body2'>{summary.taskWork}</Typography>
                  </Box>

                  <Divider />

                  {/* Changes Made */}
                  <Box>
                    <Typography variant='subtitle2' sx={{ fontWeight: 'bold', mb: 1 }}>
                      Changes Made
                    </Typography>
                    <Typography variant='body2'>{summary.changesMade}</Typography>
                  </Box>

                  {/* Key Decisions */}
                  {summary.keyDecisions && summary.keyDecisions.length > 0 && (
                    <>
                      <Divider />
                      <Box>
                        <Typography
                          variant='subtitle2'
                          sx={{ fontWeight: 'bold', mb: 1 }}
                        >
                          Key Decisions
                        </Typography>
                        <List dense>
                          {summary.keyDecisions.map((decision, index) => (
                            <ListItem key={index} sx={{ pl: 0 }}>
                              <ListItemText
                                primary={decision}
                                primaryTypographyProps={{ variant: 'body2' }}
                              />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    </>
                  )}

                  <Divider />

                  {/* Context */}
                  <Box>
                    <Typography variant='subtitle2' sx={{ fontWeight: 'bold', mb: 1 }}>
                      Context
                    </Typography>
                    <Typography variant='body2'>{summary.context}</Typography>
                  </Box>

                  <Box sx={{ mt: 2 }}>
                    <Button
                      variant='outlined'
                      size='small'
                      onClick={handleGenerateSummary}
                      startIcon={<AutoAwesome />}
                    >
                      Regenerate Summary
                    </Button>
                  </Box>
                </Box>
              </AccordionDetails>
            </Accordion>
          </Box>
        )}
      </CardContent>
    </Card>
  )
}
