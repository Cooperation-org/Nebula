'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Button,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Checkbox,
  FormControlLabel,
  Chip,
  Divider,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material'
import { AutoAwesome, ExpandMore, CheckCircle, RadioButtonUnchecked } from '@mui/icons-material'
import type { ReviewChecklist, ReviewChecklistItem } from '@/lib/utils/aiService'
import { getReviewByTaskId, updateReview } from '@/lib/firebase/reviews'
import { getCurrentUser } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'

interface ReviewChecklistProps {
  taskId: string
  teamId: string
  taskType?: string
  cookValue?: number
}

/**
 * Review Checklist Component
 * 
 * Story 10B.2: AI Review Assistance - Checklists
 * 
 * Displays AI-generated review checklist and allows reviewers to check off items
 */
export default function ReviewChecklistComponent({
  taskId,
  teamId,
  taskType,
  cookValue
}: ReviewChecklistProps) {
  const [checklist, setChecklist] = useState<ReviewChecklist | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(false)

  // Load existing checklist from review if available
  useEffect(() => {
    const loadExistingChecklist = async () => {
      try {
        const review = await getReviewByTaskId(teamId, taskId)
        if (review?.checklist && review.checklist.length > 0) {
          // Convert review checklist to ReviewChecklist format
          const existingChecklist: ReviewChecklist = {
            items: review.checklist.map(item => ({
              id: item.id,
              text: item.text,
              category: item.category,
              required: item.required,
              checked: item.checked
            })),
            taskType: taskType || 'Not specified',
            cookValue: cookValue,
            rigorLevel: 'standard' // Default, could be enhanced to store in review
          }
          setChecklist(existingChecklist)
          setExpanded(true)
        }
      } catch (err) {
        // Review might not exist yet, that's okay
        logger.warn('Could not load existing checklist', { taskId, teamId })
      }
    }

    loadExistingChecklist()
  }, [taskId, teamId, taskType, cookValue])

  const handleGenerateChecklist = async () => {
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
          teamId,
          type: 'checklist'
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to generate review checklist')
      }

      setChecklist(result.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate review checklist')
    } finally {
      setLoading(false)
    }
  }

  const handleToggleItem = async (itemId: string) => {
    if (!checklist) return

    const updatedItems = checklist.items.map(item =>
      item.id === itemId ? { ...item, checked: !item.checked } : item
    )

    const updatedChecklist: ReviewChecklist = {
      ...checklist,
      items: updatedItems
    }

    setChecklist(updatedChecklist)

    // Save checklist to review
    await saveChecklistToReview(updatedChecklist)
  }

  const saveChecklistToReview = async (checklistToSave: ReviewChecklist) => {
    setSaving(true)
    try {
      const review = await getReviewByTaskId(teamId, taskId)
      if (!review) {
        logger.warn('Review not found, cannot save checklist', { taskId, teamId })
        return
      }

      // Convert checklist to review format
      const checklistForReview = checklistToSave.items.map(item => ({
        id: item.id,
        text: item.text,
        category: item.category,
        required: item.required,
        checked: item.checked
      }))

      await updateReview(teamId, review.id, {
        checklist: checklistForReview,
        updatedAt: new Date().toISOString()
      })

      logger.info('Checklist saved to review', {
        taskId,
        teamId,
        reviewId: review.id,
        itemsCount: checklistForReview.length,
        checkedCount: checklistForReview.filter(item => item.checked).length
      })
    } catch (err) {
      logger.error('Error saving checklist to review', {
        taskId,
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      // Don't show error to user, just log it
    } finally {
      setSaving(false)
    }
  }

  // Group items by category
  const itemsByCategory = checklist
    ? checklist.items.reduce((acc, item) => {
        const category = item.category || 'General'
        if (!acc[category]) {
          acc[category] = []
        }
        acc[category].push(item)
        return acc
      }, {} as Record<string, ReviewChecklistItem[]>)
    : {}

  const checkedCount = checklist
    ? checklist.items.filter(item => item.checked).length
    : 0
  const totalCount = checklist ? checklist.items.length : 0
  const requiredCount = checklist
    ? checklist.items.filter(item => item.required).length
    : 0
  const requiredCheckedCount = checklist
    ? checklist.items.filter(item => item.required && item.checked).length
    : 0

  return (
    <Card variant='outlined' sx={{ mb: 2 }}>
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AutoAwesome color='primary' />
          <Typography variant='h6'>Review Checklist</Typography>
        </Box>

        <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
          Get an AI-generated checklist to guide your review based on task type and COOK value.
        </Typography>

        {!checklist && !loading && (
          <Button
            variant='contained'
            onClick={handleGenerateChecklist}
            startIcon={<AutoAwesome />}
            fullWidth
          >
            Generate Review Checklist
          </Button>
        )}

        {loading && (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
            <Typography variant='body2' color='text.secondary' sx={{ ml: 2 }}>
              Generating checklist...
            </Typography>
          </Box>
        )}

        {error && (
          <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {checklist && (
          <Box>
            <Accordion expanded={expanded} onChange={(_, isExpanded) => setExpanded(isExpanded)}>
              <AccordionSummary expandIcon={<ExpandMore />}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, width: '100%' }}>
                  <Typography variant='subtitle1' sx={{ fontWeight: 'bold' }}>
                    Review Checklist
                  </Typography>
                  <Chip
                    label={`${checkedCount}/${totalCount} checked`}
                    size='small'
                    color={checkedCount === totalCount ? 'success' : 'default'}
                  />
                  {checklist.rigorLevel && (
                    <Chip
                      label={`${checklist.rigorLevel} rigor`}
                      size='small'
                      variant='outlined'
                    />
                  )}
                </Box>
              </AccordionSummary>
              <AccordionDetails>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {/* Progress Summary */}
                  <Box>
                    <Typography variant='body2' color='text.secondary'>
                      Progress: {checkedCount} of {totalCount} items checked
                      {requiredCount > 0 && (
                        <span>
                          {' '}
                          ({requiredCheckedCount} of {requiredCount} required items)
                        </span>
                      )}
                    </Typography>
                  </Box>

                  <Divider />

                  {/* Checklist Items by Category */}
                  {Object.entries(itemsByCategory).map(([category, items]) => (
                    <Box key={category}>
                      <Typography variant='subtitle2' sx={{ fontWeight: 'bold', mb: 1 }}>
                        {category}
                      </Typography>
                      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                        {items.map(item => (
                          <FormControlLabel
                            key={item.id}
                            control={
                              <Checkbox
                                checked={item.checked}
                                onChange={() => handleToggleItem(item.id)}
                                disabled={saving}
                                icon={<RadioButtonUnchecked />}
                                checkedIcon={<CheckCircle />}
                              />
                            }
                            label={
                              <Box>
                                <Typography variant='body2'>{item.text}</Typography>
                                {item.required && (
                                  <Chip
                                    label='Required'
                                    size='small'
                                    color='primary'
                                    sx={{ mt: 0.5, height: 18, fontSize: '0.65rem' }}
                                  />
                                )}
                              </Box>
                            }
                            sx={{
                              alignItems: 'flex-start',
                              '& .MuiFormControlLabel-label': {
                                flex: 1
                              }
                            }}
                          />
                        ))}
                      </Box>
                      <Divider sx={{ mt: 2 }} />
                    </Box>
                  ))}

                  <Box sx={{ mt: 2, display: 'flex', gap: 2 }}>
                    <Button
                      variant='outlined'
                      size='small'
                      onClick={handleGenerateChecklist}
                      startIcon={<AutoAwesome />}
                    >
                      Regenerate Checklist
                    </Button>
                    {saving && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <CircularProgress size={16} />
                        <Typography variant='caption' color='text.secondary'>
                          Saving...
                        </Typography>
                      </Box>
                    )}
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

