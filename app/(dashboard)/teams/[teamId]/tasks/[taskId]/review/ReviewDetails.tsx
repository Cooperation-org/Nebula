'use client'

import { useState, useEffect } from 'react'
import {
  Box,
  Typography,
  Alert,
  CircularProgress,
  Container,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Paper,
  LinearProgress
} from '@mui/material'
import {
  CheckCircle as CheckCircleIcon,
  Cancel as CancelIcon,
  Comment as CommentIcon,
  Person as PersonIcon
} from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import {
  getReviewByTaskId,
  approveReview,
  objectToReview,
  addReviewComment
} from '@/lib/firebase/reviews'
import { getTask } from '@/lib/firebase/tasks'
import { logger } from '@/lib/utils/logger'
import { useAuth } from '@/lib/hooks/useAuth'
import { usePermissions } from '@/lib/hooks/usePermissions'
import type { Review } from '@/lib/types/review'
import type { Task } from '@/lib/types/task'

interface ReviewDetailsProps {
  taskId: string
  teamId: string
}

/**
 * Review Details Component
 *
 * Displays review information and allows reviewers to interact with the review
 */
export default function ReviewDetails({ taskId, teamId }: ReviewDetailsProps) {
  const [review, setReview] = useState<Review | null>(null)
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  // Dialog states
  const [objectionDialogOpen, setObjectionDialogOpen] = useState(false)
  const [commentDialogOpen, setCommentDialogOpen] = useState(false)
  const [objectionReason, setObjectionReason] = useState('')
  const [commentText, setCommentText] = useState('')

  const { user } = useAuth()
  const { hasRoleOrHigher } = usePermissions()

  // Check if current user is a reviewer or steward
  const isReviewer = (user && task?.reviewers?.includes(user.uid)) || false
  const isSteward = hasRoleOrHigher('Steward')
  const canInteract = isReviewer || isSteward

  // Check if user has already approved
  const hasApproved = (user && review?.approvals.includes(user.uid)) || false

  // Check if user has already objected
  const hasObjected =
    (user && review?.objections.some(obj => obj.reviewerId === user.uid)) || false

  const loadReviewData = async () => {
    try {
      setError(null)
      const [reviewData, taskData] = await Promise.all([
        getReviewByTaskId(teamId, taskId),
        getTask(teamId, taskId)
      ])

      setReview(reviewData)
      setTask(taskData)
    } catch (err) {
      logger.error('Error loading review data', {
        taskId,
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError('Failed to load review data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadReviewData()
  }, [taskId, teamId])

  const handleApprove = async () => {
    if (!review || !user) return

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const updatedReview = await approveReview(teamId, review.id)
      setReview(updatedReview)
      setSuccess('Review approved successfully!')
      // Reload to get latest state
      await loadReviewData()
    } catch (err) {
      logger.error('Error approving review', {
        reviewId: review.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to approve review')
    } finally {
      setActionLoading(false)
    }
  }

  const handleObjectClick = () => {
    setObjectionDialogOpen(true)
  }

  const handleObjectSubmit = async () => {
    if (!review || !objectionReason.trim()) return

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const updatedReview = await objectToReview(teamId, review.id, objectionReason)
      setReview(updatedReview)
      setSuccess('Objection raised successfully!')
      setObjectionDialogOpen(false)
      setObjectionReason('')
      // Reload to get latest state
      await loadReviewData()
    } catch (err) {
      logger.error('Error raising objection', {
        reviewId: review.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to raise objection')
    } finally {
      setActionLoading(false)
    }
  }

  const handleCommentClick = () => {
    setCommentDialogOpen(true)
  }

  const handleCommentSubmit = async () => {
    if (!review || !commentText.trim()) return

    setActionLoading(true)
    setError(null)
    setSuccess(null)

    try {
      const updatedReview = await addReviewComment(teamId, review.id, commentText)
      setReview(updatedReview)
      setSuccess('Comment added successfully!')
      setCommentDialogOpen(false)
      setCommentText('')
      // Reload to get latest state
      await loadReviewData()
    } catch (err) {
      logger.error('Error adding comment', {
        reviewId: review.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError(err instanceof Error ? err.message : 'Failed to add comment')
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        </Container>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Alert severity='error'>{error}</Alert>
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

  if (task.state !== 'Review') {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Alert severity='warning'>
            This task is not in Review state. Current state: {task.state}
          </Alert>
        </Container>
      </AppLayout>
    )
  }

  return (
    <Box>
      <Typography variant='h5' component='h2' gutterBottom>
        Review Details
      </Typography>

      {success && (
        <Alert severity='success' sx={{ mb: 2 }} onClose={() => setSuccess(null)}>
          {success}
        </Alert>
      )}

      {error && (
        <Alert severity='error' sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {review ? (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Review Status Card */}
          <Card>
            <CardContent>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2
                }}
              >
                <Typography variant='h6'>
                  Review Status: <strong>{review.status}</strong>
                </Typography>
                <Chip
                  label={
                    review.status === 'approved'
                      ? 'Approved'
                      : review.status === 'objected'
                        ? 'Objected'
                        : 'Pending'
                  }
                  color={
                    review.status === 'approved'
                      ? 'success'
                      : review.status === 'objected'
                        ? 'error'
                        : 'warning'
                  }
                />
              </Box>

              {/* Progress Bar */}
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                  <Typography variant='body2' color='text.secondary'>
                    Approvals: {review.approvals.length} / {review.requiredReviewers}
                  </Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {Math.round(
                      (review.approvals.length / review.requiredReviewers) * 100
                    )}
                    %
                  </Typography>
                </Box>
                <LinearProgress
                  variant='determinate'
                  value={(review.approvals.length / review.requiredReviewers) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>

              {/* Action Buttons */}
              {canInteract && review.status !== 'approved' && (
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mt: 2 }}>
                  <Button
                    variant='contained'
                    color='success'
                    startIcon={<CheckCircleIcon />}
                    onClick={handleApprove}
                    disabled={
                      actionLoading || hasApproved || review.status === 'objected'
                    }
                  >
                    {hasApproved ? 'Already Approved' : 'Approve Review'}
                  </Button>
                  <Button
                    variant='contained'
                    color='error'
                    startIcon={<CancelIcon />}
                    onClick={handleObjectClick}
                    disabled={
                      actionLoading || hasObjected || review.status === 'objected'
                    }
                  >
                    {hasObjected ? 'Already Objected' : 'Raise Objection'}
                  </Button>
                  <Button
                    variant='outlined'
                    startIcon={<CommentIcon />}
                    onClick={handleCommentClick}
                    disabled={actionLoading}
                  >
                    Add Comment
                  </Button>
                </Box>
              )}

              {!canInteract && (
                <Alert severity='info' sx={{ mt: 2 }}>
                  Only assigned reviewers or stewards can interact with this review.
                </Alert>
              )}
            </CardContent>
          </Card>

          {/* Approvals List */}
          {review.approvals.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Approvals ({review.approvals.length})
                </Typography>
                <List>
                  {review.approvals.map((approverId, index) => (
                    <ListItem key={index}>
                      <CheckCircleIcon color='success' sx={{ mr: 1 }} />
                      <ListItemText
                        primary={`Reviewer ${approverId.substring(0, 8)}...`}
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Objections List */}
          {review.objections.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom color='error'>
                  Objections ({review.objections.length})
                </Typography>
                <List>
                  {review.objections.map((objection, index) => (
                    <ListItem key={index} alignItems='flex-start'>
                      <CancelIcon color='error' sx={{ mr: 1, mt: 0.5 }} />
                      <ListItemText
                        primary={`Reviewer ${objection.reviewerId.substring(0, 8)}...`}
                        secondary={
                          <Box>
                            <Typography
                              variant='body2'
                              color='text.secondary'
                              sx={{ mt: 1 }}
                            >
                              {objection.reason}
                            </Typography>
                            <Typography variant='caption' color='text.secondary'>
                              {new Date(objection.timestamp).toLocaleString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}

          {/* Comments List */}
          {review.comments.length > 0 && (
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Comments ({review.comments.length})
                </Typography>
                <List>
                  {review.comments.map((comment, index) => (
                    <Box key={index}>
                      <ListItem alignItems='flex-start'>
                        <CommentIcon sx={{ mr: 1, mt: 0.5 }} />
                        <ListItemText
                          primary={`Reviewer ${comment.reviewerId.substring(0, 8)}...`}
                          secondary={
                            <Box>
                              <Typography
                                variant='body2'
                                color='text.secondary'
                                sx={{ mt: 1 }}
                              >
                                {comment.comment}
                              </Typography>
                              <Typography variant='caption' color='text.secondary'>
                                {new Date(comment.timestamp).toLocaleString()}
                              </Typography>
                            </Box>
                          }
                        />
                      </ListItem>
                      {index < review.comments.length - 1 && <Divider />}
                    </Box>
                  ))}
                </List>
              </CardContent>
            </Card>
          )}
        </Box>
      ) : (
        <Alert severity='info'>
          Review not yet initiated. The review will be created automatically when the task
          enters Review state.
        </Alert>
      )}

      {/* Objection Dialog */}
      <Dialog
        open={objectionDialogOpen}
        onClose={() => setObjectionDialogOpen(false)}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Raise Objection</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Please provide a reason for your objection. This will pause the review
            workflow until the objection is resolved.
          </Typography>
          <TextField
            autoFocus
            margin='dense'
            label='Objection Reason'
            fullWidth
            multiline
            rows={4}
            value={objectionReason}
            onChange={e => setObjectionReason(e.target.value)}
            placeholder='Explain why you are objecting to this review...'
            helperText={`${objectionReason.length}/5000 characters`}
            inputProps={{ maxLength: 5000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setObjectionDialogOpen(false)
              setObjectionReason('')
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleObjectSubmit}
            variant='contained'
            color='error'
            disabled={!objectionReason.trim() || actionLoading}
          >
            {actionLoading ? 'Submitting...' : 'Raise Objection'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Comment Dialog */}
      <Dialog
        open={commentDialogOpen}
        onClose={() => setCommentDialogOpen(false)}
        maxWidth='sm'
        fullWidth
      >
        <DialogTitle>Add Comment</DialogTitle>
        <DialogContent>
          <Typography variant='body2' color='text.secondary' sx={{ mb: 2 }}>
            Add a comment to this review. Comments are visible to all reviewers and task
            contributors.
          </Typography>
          <TextField
            autoFocus
            margin='dense'
            label='Comment'
            fullWidth
            multiline
            rows={4}
            value={commentText}
            onChange={e => setCommentText(e.target.value)}
            placeholder='Add your comment...'
            helperText={`${commentText.length}/5000 characters`}
            inputProps={{ maxLength: 5000 }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => {
              setCommentDialogOpen(false)
              setCommentText('')
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleCommentSubmit}
            variant='contained'
            disabled={!commentText.trim() || actionLoading}
          >
            {actionLoading ? 'Submitting...' : 'Add Comment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  )
}
