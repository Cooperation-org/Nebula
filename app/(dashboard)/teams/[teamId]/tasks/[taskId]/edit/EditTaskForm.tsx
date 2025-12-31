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
  CircularProgress
} from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import { getTask, updateTask, assignCookValue } from '@/lib/firebase/tasks'
import { getTeamMembers } from '@/lib/firebase/teams'
import { getReviewByTaskId, canCompleteReview } from '@/lib/firebase/reviews'
import { logger } from '@/lib/utils/logger'
import type { User } from '@/lib/types/user'
import type { Task, TaskUpdate, TaskState, CookState } from '@/lib/types/task'
import {
  getAllowedNextStates,
  getTransitionErrorMessage
} from '@/lib/utils/taskTransitions'

export default function EditTaskForm() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string
  const taskId = params?.taskId as string

  const [task, setTask] = useState<Task | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [state, setState] = useState<TaskState>('Backlog')
  const [contributors, setContributors] = useState<string[]>([])
  const [reviewers, setReviewers] = useState<string[]>([])
  const [cookValue, setCookValue] = useState<string>('')
  const [cookState, setCookState] = useState<CookState | ''>('')
  const [teamMembers, setTeamMembers] = useState<Array<{ user: User; role: string }>>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingTask, setLoadingTask] = useState(true)
  const [reviewStatus, setReviewStatus] = useState<{
    approved: boolean
    canComplete: boolean
  } | null>(null)

  // Load task and team members on mount
  useEffect(() => {
    const loadData = async () => {
      if (!teamId || !taskId) return

      try {
        // Load task
        const taskData = await getTask(teamId, taskId)
        if (!taskData) {
          setError('Task not found')
          setLoadingTask(false)
          return
        }

        setTask(taskData)
        setTitle(taskData.title)
        setDescription(taskData.description || '')
        setState(taskData.state)
        setContributors(taskData.contributors)
        setReviewers(taskData.reviewers || [])
        setCookValue(taskData.cookValue?.toString() || '')
        setCookState(taskData.cookState || '')

        // Load team members
        const members = await getTeamMembers(teamId)
        setTeamMembers(members)

        // Check review status if task is in Review state
        if (taskData.state === 'Review') {
          try {
            const review = await getReviewByTaskId(teamId, taskId)
            if (review) {
              setReviewStatus({
                approved: review.status === 'approved',
                canComplete: canCompleteReview(review)
              })
            }
          } catch (err) {
            logger.warn('Error loading review status', {
              teamId,
              taskId,
              error: err instanceof Error ? err.message : 'Unknown error'
            })
            // Don't fail if review doesn't exist yet
          }
        }
      } catch (err) {
        logger.error('Error loading task data', {
          teamId,
          taskId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load task')
      } finally {
        setLoadingTask(false)
      }
    }

    loadData()
  }, [teamId, taskId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
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
        parsedCookValue = parseFloat(cookValue.trim())
        if (isNaN(parsedCookValue) || parsedCookValue <= 0) {
          setError('COOK value must be a positive number')
          setLoading(false)
          return
        }
      }

      // Check if COOK can be edited (cannot edit if Provisional, Locked, or Final)
      if (
        task?.cookState === 'Provisional' ||
        task?.cookState === 'Locked' ||
        task?.cookState === 'Final'
      ) {
        if (cookValue.trim() && parseFloat(cookValue.trim()) !== task.cookValue) {
          const stateMessage =
            task.cookState === 'Final'
              ? 'COOK value cannot be edited after finalization'
              : task.cookState === 'Locked'
                ? 'COOK value is locked and cannot be edited during review'
                : 'COOK value is frozen while work is in progress'
          setError(stateMessage)
          setLoading(false)
          return
        }
      }

      // If COOK value is being set/changed, use assignCookValue function
      if (cookValue.trim() && parsedCookValue !== undefined) {
        const newCookValue = parsedCookValue
        const currentCookValue = task?.cookValue

        // If COOK value is new or changed, assign it
        if (currentCookValue !== newCookValue) {
          try {
            await assignCookValue(teamId, taskId, newCookValue)
          } catch (err) {
            if (err instanceof Error) {
              setError(err.message)
            } else {
              setError('Failed to assign COOK value')
            }
            setLoading(false)
            return
          }
        }
      }

      // Prepare update data (excluding COOK fields if they were handled separately)
      const updates: TaskUpdate = {
        title: title.trim(),
        description: description.trim() || undefined,
        state,
        contributors,
        reviewers: reviewers.length > 0 ? reviewers : undefined,
        updatedAt: new Date().toISOString()
      }

      logger.info('Task update attempt', { teamId, taskId, title: updates.title })
      const updatedTask = await updateTask(teamId, taskId, updates)

      setTask(updatedTask)
      setSuccess('Task updated successfully')
      logger.info('Task updated successfully', { taskId: updatedTask.id, teamId })

      // Optionally redirect after a short delay
      setTimeout(() => {
        router.push(`/teams/${teamId}/tasks`)
      }, 1500)
    } catch (err: unknown) {
      logger.error('Task update failed', {
        teamId,
        taskId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      // Handle errors
      if (err instanceof Error) {
        setError(err.message || 'Failed to update task. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  if (loadingTask) {
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
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    )
  }

  if (!task) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Alert severity='error'>Task not found</Alert>
        </Container>
      </AppLayout>
    )
  }

  // Get allowed next states for current task state
  const allowedNextStates = task ? getAllowedNextStates(task.state) : []
  const taskStates: TaskState[] = ['Backlog', 'Ready', 'In Progress', 'Review', 'Done']

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
            Edit Task
          </Typography>

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

            {success && (
              <Alert severity='success' onClose={() => setSuccess(null)}>
                {success}
              </Alert>
            )}

            {/* Review Status Alert */}
            {task?.state === 'Review' && reviewStatus && (
              <Alert
                severity={reviewStatus.canComplete ? 'success' : 'info'}
                sx={{ mb: 2 }}
              >
                {reviewStatus.canComplete
                  ? '✅ Review is approved! You can mark this task as Done.'
                  : '⏳ Review is pending. Waiting for all required reviewers to approve.'}
              </Alert>
            )}

            {/* Quick Action: Mark as Done */}
            {task?.state === 'Review' && reviewStatus?.canComplete && (
              <Box sx={{ mb: 2 }}>
                <Button
                  variant='contained'
                  color='success'
                  fullWidth
                  onClick={async () => {
                    setLoading(true)
                    setError(null)
                    try {
                      await updateTask(teamId, taskId, {
                        state: 'Done',
                        updatedAt: new Date().toISOString()
                      })
                      setSuccess(
                        'Task marked as Done! COOK will be issued to contributors.'
                      )
                      setTimeout(() => {
                        router.push(`/teams/${teamId}/tasks`)
                      }, 1500)
                    } catch (err) {
                      setError(
                        err instanceof Error ? err.message : 'Failed to mark task as Done'
                      )
                      setLoading(false)
                    }
                  }}
                  disabled={loading}
                >
                  ✓ Mark as Done (Review Approved)
                </Button>
              </Box>
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

            <FormControl fullWidth>
              <InputLabel>State</InputLabel>
              <Select
                value={state}
                onChange={e => {
                  const newState = e.target.value as TaskState
                  // Validate transition on client side
                  if (task && newState !== task.state) {
                    const allowedStates = getAllowedNextStates(task.state)
                    if (!allowedStates.includes(newState) && newState !== task.state) {
                      setError(getTransitionErrorMessage(task.state, newState))
                      return
                    }
                  }
                  setState(newState)
                  setError(null)
                }}
                label='State'
                disabled={loading}
              >
                {taskStates.map(s => {
                  const isCurrentState = s === task.state
                  const isAllowed = isCurrentState || allowedNextStates.includes(s)
                  return (
                    <MenuItem key={s} value={s} disabled={!isAllowed && !isCurrentState}>
                      {s}
                      {isCurrentState && ' (Current)'}
                      {!isAllowed && !isCurrentState && ' (Invalid transition)'}
                    </MenuItem>
                  )
                })}
              </Select>
              {state !== task.state && !allowedNextStates.includes(state) && (
                <Typography variant='caption' color='error' sx={{ mt: 0.5, ml: 1.75 }}>
                  {getTransitionErrorMessage(task.state, state)}
                </Typography>
              )}
            </FormControl>

            <TextField
              label='COOK Value'
              type='number'
              value={cookValue}
              onChange={e => setCookValue(e.target.value)}
              fullWidth
              disabled={
                loading ||
                task?.cookState === 'Provisional' ||
                task?.cookState === 'Locked' ||
                task?.cookState === 'Final'
              }
              helperText={
                task?.cookState === 'Final'
                  ? 'COOK value cannot be edited after finalization. COOK has been issued to contributors.'
                  : task?.cookState === 'Locked'
                    ? 'COOK value is locked and cannot be edited during review'
                    : task?.cookState === 'Provisional'
                      ? 'COOK value is frozen while work is in progress'
                      : cookState
                        ? `COOK State: ${cookState}${task?.cookAttribution ? ' | Attribution: ' + (task.cookAttribution === 'self' ? 'Self-COOK' : 'Spend-COOK') : ''}. Note: COOK is an estimate - you don't need to "own" COOK to assign it. COOK will be issued when the task is completed.`
                        : 'Enter estimated COOK value. This is an estimate - you don\'t need to "own" COOK to assign it. COOK will be issued to contributors when the task is completed and reviewed.'
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
              {loading ? 'Updating Task...' : 'Update Task'}
            </Button>
          </Box>
        </Box>
      </Container>
    </AppLayout>
  )
}
