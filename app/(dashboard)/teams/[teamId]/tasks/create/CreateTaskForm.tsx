'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Button,
  TextField,
  Typography,
  Alert,
  Container,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
  OutlinedInput,
  Card,
  CardContent,
  Divider,
  CircularProgress
} from '@mui/material'
import { AutoAwesome, Edit } from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import { createTask } from '@/lib/firebase/tasks'
import { getTeamMembers } from '@/lib/firebase/teams'
import { getCurrentUser } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'
import type { User } from '@/lib/types/user'
import type { TaskCreate } from '@/lib/types/task'

export default function CreateTaskForm() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [contributors, setContributors] = useState<string[]>([])
  const [reviewers, setReviewers] = useState<string[]>([])
  const [cookValue, setCookValue] = useState<string>('')
  const [teamMembers, setTeamMembers] = useState<Array<{ user: User; role: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingMembers, setLoadingMembers] = useState(true)

  // Natural language input state
  const [naturalLanguageInput, setNaturalLanguageInput] = useState('')
  const [extracting, setExtracting] = useState(false)
  const [extractionError, setExtractionError] = useState<string | null>(null)
  const [showNaturalLanguageInput, setShowNaturalLanguageInput] = useState(true)
  const [extractedInfo, setExtractedInfo] = useState<{
    title?: string
    description?: string
    estimatedCookValue?: number
    taskType?: 'Build' | 'Ops' | 'Governance' | 'Research'
    playbookReferences?: string[]
    playbookSuggestions?: string[]
  } | null>(null)

  // Load team members on mount
  useEffect(() => {
    const loadTeamMembers = async () => {
      if (!teamId) return

      try {
        const members = await getTeamMembers(teamId)
        setTeamMembers(members)
      } catch (err) {
        logger.error('Error loading team members', {
          teamId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load team members')
      } finally {
        setLoadingMembers(false)
      }
    }

    loadTeamMembers()
  }, [teamId])

  // Handle natural language extraction
  const handleExtractFromNaturalLanguage = async () => {
    if (!naturalLanguageInput.trim()) {
      setExtractionError('Please enter a task description')
      return
    }

    setExtracting(true)
    setExtractionError(null)

    try {
      // Get current user ID (client-side only)
      const currentUser = getCurrentUser()
      if (!currentUser) {
        setExtractionError('You must be logged in to use AI extraction')
        setExtracting(false)
        return
      }

      const response = await fetch('/api/ai/extract-task', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          description: naturalLanguageInput.trim(),
          teamId: teamId,
          userId: currentUser.uid
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to extract task information')
      }

      const extracted = result.data

      // Pre-fill form with extracted information
      if (extracted.title) {
        setTitle(extracted.title)
      }
      if (extracted.description) {
        setDescription(extracted.description)
      }
      if (extracted.estimatedCookValue !== undefined) {
        setCookValue(extracted.estimatedCookValue.toString())
      }

      // Store extracted info for display
      setExtractedInfo({
        title: extracted.title,
        description: extracted.description,
        estimatedCookValue: extracted.estimatedCookValue,
        taskType: extracted.taskType,
        playbookReferences: extracted.playbookReferences,
        playbookSuggestions: extracted.playbookSuggestions
      })

      // Hide natural language input and show form
      setShowNaturalLanguageInput(false)

      logger.info('Task information extracted from natural language', {
        teamId,
        hasTitle: !!extracted.title,
        hasDescription: !!extracted.description,
        hasCookValue: extracted.estimatedCookValue !== undefined,
        hasTaskType: extracted.taskType !== undefined,
        confidence: extracted.confidence
      })
    } catch (err) {
      logger.error('Error extracting task from natural language', {
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setExtractionError(
        err instanceof Error
          ? err.message
          : 'Failed to extract task information. Please try again.'
      )
    } finally {
      setExtracting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Validate inputs
      if (!title.trim()) {
        setError('Title is required')
        setLoading(false)
        return
      }

      if (title.length > 200) {
        setError('Title must be 200 characters or less')
        setLoading(false)
        return
      }

      if (description && description.length > 5000) {
        setError('Description must be 5000 characters or less')
        setLoading(false)
        return
      }

      if (contributors.length === 0) {
        setError('At least one contributor is required')
        setLoading(false)
        return
      }

      // Validate COOK value if provided
      let parsedCookValue: number | undefined
      if (cookValue.trim()) {
        parsedCookValue = Number.parseFloat(cookValue.trim())
        if (Number.isNaN(parsedCookValue) || parsedCookValue <= 0) {
          setError('COOK value must be a positive number')
          setLoading(false)
          return
        }
      }

      // Create task
      const taskData: TaskCreate = {
        title: title.trim(),
        description: description.trim() || undefined,
        contributors,
        reviewers: reviewers.length > 0 ? reviewers : undefined,
        // Story 10A.2: Include playbook references if task was AI-extracted
        playbookReferences: extractedInfo?.playbookReferences,
        playbookSuggestions: extractedInfo?.playbookSuggestions,
        aiExtracted: !!extractedInfo // Mark as AI-extracted if we have extracted info
      }

      logger.info('Task creation attempt', { teamId, title: taskData.title })
      const task = await createTask(teamId, taskData)

      // Assign COOK value if provided (this will set attribution automatically)
      if (parsedCookValue !== undefined) {
        try {
          const { assignCookValue } = await import('@/lib/firebase/tasks')
          await assignCookValue(teamId, task.id, parsedCookValue)
        } catch (err) {
          logger.error('Error assigning COOK value during task creation', {
            taskId: task.id,
            teamId,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
          // Continue even if COOK assignment fails - task is created
        }
      }

      // Success - redirect to task list or task detail
      logger.info('Task created successfully', { taskId: task.id, teamId })
      router.push(`/teams/${teamId}/tasks`)
    } catch (err: unknown) {
      logger.error('Task creation failed', {
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      // Handle errors
      if (err instanceof Error) {
        setError(err.message || 'Failed to create task. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  if (loadingMembers) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              minHeight: '60vh'
            }}
          >
            <Typography variant='body1' color='text.secondary'>
              Loading team members...
            </Typography>
          </Box>
        </Container>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Container maxWidth='md'>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            py: 4
          }}
        >
          <Typography variant='h4' component='h1' gutterBottom>
            Create Task
          </Typography>

          {/* Natural Language Input Section */}
          {showNaturalLanguageInput && (
            <Card variant='outlined' sx={{ mb: 3 }}>
              <CardContent>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AutoAwesome color='primary' />
                  <Typography variant='h6'>Create Task with Natural Language</Typography>
                </Box>
                <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
                  Describe your task in natural language, and AI will extract the
                  information for you.
                </Typography>
                <TextField
                  label='Task Description'
                  placeholder='e.g., "Create a login page with email and password authentication. This is a medium-sized task worth about 15 COOK."'
                  value={naturalLanguageInput}
                  onChange={e => setNaturalLanguageInput(e.target.value)}
                  fullWidth
                  multiline
                  rows={4}
                  disabled={extracting}
                  sx={{ mb: 2 }}
                />
                {extractionError && (
                  <Alert
                    severity='error'
                    sx={{ mb: 2 }}
                    onClose={() => setExtractionError(null)}
                  >
                    {extractionError}
                  </Alert>
                )}
                <Box sx={{ display: 'flex', gap: 2 }}>
                  <Button
                    variant='contained'
                    onClick={handleExtractFromNaturalLanguage}
                    disabled={extracting || !naturalLanguageInput.trim()}
                    startIcon={
                      extracting ? <CircularProgress size={20} /> : <AutoAwesome />
                    }
                  >
                    {extracting ? 'Extracting...' : 'Extract Task Information'}
                  </Button>
                  <Button
                    variant='outlined'
                    onClick={() => setShowNaturalLanguageInput(false)}
                    disabled={extracting}
                  >
                    Skip to Manual Entry
                  </Button>
                </Box>
              </CardContent>
            </Card>
          )}

          {/* Show extracted info if available */}
          {extractedInfo && !showNaturalLanguageInput && (
            <Alert
              severity='info'
              action={
                <Button
                  size='small'
                  startIcon={<Edit />}
                  onClick={() => setShowNaturalLanguageInput(true)}
                >
                  Re-extract
                </Button>
              }
              sx={{ mb: 2 }}
            >
              <Typography variant='body2'>
                <strong>Extracted Information:</strong> {extractedInfo.title}
                {extractedInfo.estimatedCookValue &&
                  ` • ${extractedInfo.estimatedCookValue} COOK`}
                {extractedInfo.taskType && ` • ${extractedInfo.taskType}`}
              </Typography>
              {/* Story 10A.2: Show playbook-aware indicators */}
              {(extractedInfo.playbookReferences?.length ||
                extractedInfo.playbookSuggestions?.length) && (
                <Box sx={{ mt: 1 }}>
                  <Typography
                    variant='caption'
                    color='text.secondary'
                    sx={{ display: 'block', mb: 0.5 }}
                  >
                    <strong>Playbook-Aware:</strong>
                  </Typography>
                  {extractedInfo.playbookReferences &&
                    extractedInfo.playbookReferences.length > 0 && (
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ display: 'block' }}
                      >
                        Referenced: {extractedInfo.playbookReferences.join(', ')}
                      </Typography>
                    )}
                  {extractedInfo.playbookSuggestions &&
                    extractedInfo.playbookSuggestions.length > 0 && (
                      <Typography
                        variant='caption'
                        color='text.secondary'
                        sx={{ display: 'block' }}
                      >
                        Suggestions: {extractedInfo.playbookSuggestions.join(', ')}
                      </Typography>
                    )}
                </Box>
              )}
              <Typography
                variant='caption'
                color='text.secondary'
                sx={{ display: 'block', mt: 1 }}
              >
                Review and edit the information below before creating the task.
              </Typography>
            </Alert>
          )}

          {!showNaturalLanguageInput && (
            <>
              <Divider sx={{ my: 2 }} />
              <Typography variant='h6' gutterBottom>
                Task Details
              </Typography>
            </>
          )}

          <Box
            component='form'
            onSubmit={handleSubmit}
            sx={{
              display: 'flex',
              flexDirection: 'column',
              gap: 3
            }}
          >
            {error && (
              <Alert severity='error' onClose={() => setError(null)}>
                {error}
              </Alert>
            )}

            <TextField
              label='Title'
              type='text'
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              fullWidth
              disabled={loading}
              autoFocus
              helperText={`${title.length}/200 characters`}
            />

            <TextField
              label='Description'
              type='text'
              value={description}
              onChange={e => setDescription(e.target.value)}
              fullWidth
              multiline
              rows={4}
              disabled={loading}
              helperText={`${description.length}/5000 characters`}
            />

            <TextField
              label='COOK Value'
              type='number'
              value={cookValue}
              onChange={e => setCookValue(e.target.value)}
              fullWidth
              disabled={loading}
              helperText={
                'Optional: Enter estimated COOK value for this task. This is an estimate - you don\'t need to "own" COOK to assign it. COOK will be issued to contributors when the task is completed and reviewed.'
              }
              inputProps={{ min: 0, step: 0.01 }}
            />

            <FormControl fullWidth>
              <InputLabel>Contributors *</InputLabel>
              <Select
                multiple
                value={contributors}
                onChange={e => setContributors(e.target.value as string[])}
                input={<OutlinedInput label='Contributors *' />}
                renderValue={selected => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map(userId => {
                      const member = teamMembers.find(m => m.user.id === userId)
                      return (
                        <Chip
                          key={userId}
                          label={member?.user.displayName || userId}
                          size='small'
                        />
                      )
                    })}
                  </Box>
                )}
                disabled={loading}
              >
                {teamMembers.map(member => (
                  <MenuItem key={member.user.id} value={member.user.id}>
                    {member.user.displayName} ({member.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl fullWidth>
              <InputLabel>Reviewers</InputLabel>
              <Select
                multiple
                value={reviewers}
                onChange={e => setReviewers(e.target.value as string[])}
                input={<OutlinedInput label='Reviewers' />}
                renderValue={selected => (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                    {selected.map(userId => {
                      const member = teamMembers.find(m => m.user.id === userId)
                      return (
                        <Chip
                          key={userId}
                          label={member?.user.displayName || userId}
                          size='small'
                        />
                      )
                    })}
                  </Box>
                )}
                disabled={loading}
              >
                {teamMembers.map(member => (
                  <MenuItem key={member.user.id} value={member.user.id}>
                    {member.user.displayName} ({member.role})
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <Button
              type='submit'
              variant='contained'
              fullWidth
              size='large'
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Creating Task...' : 'Create Task'}
            </Button>
          </Box>
        </Box>
      </Container>
    </AppLayout>
  )
}
