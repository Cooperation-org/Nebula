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
  CircularProgress,
  IconButton,
  Paper,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteIcon from '@mui/icons-material/Delete'
import EditIcon from '@mui/icons-material/Edit'
import { AppLayout } from '@/components/AppLayout'
import { getBoard, updateBoard } from '@/lib/firebase/boards'
import { logger } from '@/lib/utils/logger'
import { usePermissions } from '@/lib/hooks/usePermissions'
import type { Board, BoardColumn, BoardVisibility } from '@/lib/types/board'
import type { TaskState } from '@/lib/types/task'

export default function EditBoardForm() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string
  const boardId = params?.boardId as string

  const { hasRole } = usePermissions()
  const isSteward = hasRole('Steward')

  const [board, setBoard] = useState<Board | null>(null)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<BoardVisibility>('Team-Visible')
  const [columns, setColumns] = useState<BoardColumn[]>([])
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingBoard, setLoadingBoard] = useState(true)
  const [editColumnDialog, setEditColumnDialog] = useState<{
    open: boolean
    column: BoardColumn | null
    index: number | null
  }>({ open: false, column: null, index: null })
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnState, setNewColumnState] = useState<TaskState>('Backlog')

  const validStates: TaskState[] = ['Backlog', 'Ready', 'In Progress', 'Review', 'Done']

  useEffect(() => {
    const loadBoard = async () => {
      if (!teamId || !boardId) return

      try {
        setLoadingBoard(true)
        const boardData = await getBoard(teamId, boardId)
        if (!boardData) {
          setError('Board not found')
          setLoadingBoard(false)
          return
        }

        setBoard(boardData)
        setName(boardData.name)
        setDescription(boardData.description || '')
        // Sort columns by order
        setColumns([...boardData.columns].sort((a, b) => a.order - b.order))
      } catch (err) {
        logger.error('Error loading board for edit', {
          teamId,
          boardId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load board')
      } finally {
        setLoadingBoard(false)
      }
    }

    loadBoard()
  }, [teamId, boardId])

  const handleAddColumn = () => {
    setNewColumnName('')
    setNewColumnState('Backlog')
    setEditColumnDialog({ open: true, column: null, index: null })
  }

  const handleEditColumn = (column: BoardColumn, index: number) => {
    setNewColumnName(column.name)
    setNewColumnState(column.state)
    setEditColumnDialog({ open: true, column, index })
  }

  const handleDeleteColumn = (index: number) => {
    const column = columns[index]
    if (column.required) {
      setError('Review gate column cannot be removed')
      return
    }

    const newColumns = columns.filter((_, i) => i !== index)
    // Reorder columns
    const reorderedColumns = newColumns.map((col, i) => ({
      ...col,
      order: i
    }))
    setColumns(reorderedColumns)
  }

  const handleSaveColumn = () => {
    if (!newColumnName.trim()) {
      setError('Column name is required')
      return
    }

    if (newColumnName.length > 100) {
      setError('Column name must be 100 characters or less')
      return
    }

    // Check if Review state is being used and ensure it's required
    const isReviewState = newColumnState === 'Review'
    if (isReviewState) {
      // Check if another column already has Review state
      const existingReviewColumn = columns.find(
        (col) => col.state === 'Review' && col.id !== editColumnDialog.column?.id
      )
      if (existingReviewColumn) {
        setError('Only one Review column is allowed')
        return
      }
    }

    if (editColumnDialog.index !== null) {
      // Edit existing column
      const updatedColumns = [...columns]
      updatedColumns[editColumnDialog.index] = {
        ...updatedColumns[editColumnDialog.index],
        name: newColumnName.trim(),
        state: newColumnState,
        required: isReviewState // Review state must be required
      }
      setColumns(updatedColumns)
    } else {
      // Add new column
      const newColumn: BoardColumn = {
        id: `col-${Date.now()}`,
        name: newColumnName.trim(),
        state: newColumnState,
        order: columns.length,
        required: isReviewState
      }
      setColumns([...columns, newColumn])
    }

    setEditColumnDialog({ open: false, column: null, index: null })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      // Client-side validation
      if (!name.trim()) {
        setError('Board name is required')
        setLoading(false)
        return
      }

      if (name.length > 100) {
        setError('Board name must be 100 characters or less')
        setLoading(false)
        return
      }

      if (description && description.length > 500) {
        setError('Description must be 500 characters or less')
        setLoading(false)
        return
      }

      if (columns.length === 0) {
        setError('Board must have at least one column')
        setLoading(false)
        return
      }

      // Ensure Review gate column exists
      const reviewColumn = columns.find((col) => col.state === 'Review' && col.required === true)
      if (!reviewColumn) {
        setError('Review gate column is required and cannot be removed')
        setLoading(false)
        return
      }

      // Log visibility change if it changed (FR38 - audit logging)
      if (board && visibility !== board.visibility) {
        logger.info('Board visibility changed', {
          boardId,
          teamId,
          fromVisibility: board.visibility,
          toVisibility: visibility
        })
      }

      // Update board
      await updateBoard(teamId, boardId, {
        name: name.trim(),
        description: description.trim() || undefined,
        visibility,
        columns: columns.map((col) => ({
          id: col.id,
          name: col.name,
          state: col.state,
          order: col.order,
          required: col.required
        }))
      })

      setSuccess('Board updated successfully!')
      logger.info('Board updated successfully', { boardId, teamId })
      
      // Redirect to board view after a short delay
      setTimeout(() => {
        router.push(`/teams/${teamId}/boards/${boardId}`)
      }, 1000)
    } catch (err: unknown) {
      logger.error('Board update failed', {
        teamId,
        boardId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })

      if (err instanceof Error) {
        setError(err.message || 'Failed to update board. Please try again.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
      setLoading(false)
    }
  }

  if (loadingBoard) {
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

  if (!board) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Alert severity='error'>Board not found</Alert>
        </Container>
      </AppLayout>
    )
  }

  if (!isSteward) {
    return (
      <AppLayout>
        <Container maxWidth='md'>
          <Alert severity='error'>
            Only stewards and admins can customize board columns
          </Alert>
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
            Edit Board: {board.name}
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

            <TextField
              label='Board Name'
              type='text'
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              fullWidth
              disabled={loading}
              autoFocus
              inputProps={{ maxLength: 100 }}
              helperText={`${name.length}/100 characters`}
            />

            <TextField
              label='Description'
              multiline
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              fullWidth
              disabled={loading}
              inputProps={{ maxLength: 500 }}
              helperText={`${description.length}/500 characters`}
            />

            <FormControl fullWidth>
              <InputLabel>Visibility</InputLabel>
              <Select
                value={visibility}
                onChange={(e) => setVisibility(e.target.value as BoardVisibility)}
                label='Visibility'
                disabled={loading}
              >
                <MenuItem value='Public'>
                  Public (External Read-Only) - Visible to anyone with the link
                </MenuItem>
                <MenuItem value='Team-Visible'>
                  Team-Visible (Default) - All team members can view
                </MenuItem>
                <MenuItem value='Restricted'>
                  Restricted (Need-to-Know) - Limited to assignees, reviewers, and stewards
                </MenuItem>
              </Select>
              <Typography variant='caption' color='text.secondary' sx={{ mt: 0.5, ml: 1.75 }}>
                {visibility === 'Public' && 'Task titles, states, and COOK totals are visible. Comments and reviewer identities are hidden.'}
                {visibility === 'Team-Visible' && 'All team members can view full task details, reviewers, and COOK states.'}
                {visibility === 'Restricted' && 'Visibility limited to assignees, reviewers, and stewards. Used for sensitive work.'}
              </Typography>
            </FormControl>

            <Box>
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  mb: 2
                }}
              >
                <Typography variant='h6'>Columns</Typography>
                <Button
                  startIcon={<AddIcon />}
                  onClick={handleAddColumn}
                  variant='outlined'
                  size='small'
                  disabled={loading}
                >
                  Add Column
                </Button>
              </Box>

              {columns.length === 0 ? (
                <Alert severity='info'>No columns. Add at least one column.</Alert>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {columns.map((column, index) => (
                    <Paper key={column.id} sx={{ p: 2 }}>
                      <Box
                        sx={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mb: 1 }}>
                            <Typography variant='subtitle1'>{column.name}</Typography>
                            <Chip
                              label={column.state}
                              size='small'
                              color='primary'
                              variant='outlined'
                            />
                            {column.required && (
                              <Chip
                                label='Required (Review Gate)'
                                size='small'
                                color='error'
                              />
                            )}
                          </Box>
                          <Typography variant='caption' color='text.secondary'>
                            Order: {column.order}
                          </Typography>
                        </Box>
                        <Box>
                          <IconButton
                            onClick={() => handleEditColumn(column, index)}
                            disabled={loading}
                            size='small'
                          >
                            <EditIcon />
                          </IconButton>
                          <IconButton
                            onClick={() => handleDeleteColumn(index)}
                            disabled={loading || column.required}
                            size='small'
                            color='error'
                          >
                            <DeleteIcon />
                          </IconButton>
                        </Box>
                      </Box>
                    </Paper>
                  ))}
                </Box>
              )}
            </Box>

            <Button
              type='submit'
              variant='contained'
              fullWidth
              size='large'
              disabled={loading}
              sx={{ mt: 2 }}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </Box>
        </Box>

        {/* Edit Column Dialog */}
        <Dialog
          open={editColumnDialog.open}
          onClose={() => setEditColumnDialog({ open: false, column: null, index: null })}
          maxWidth='sm'
          fullWidth
        >
          <DialogTitle>
            {editColumnDialog.index !== null ? 'Edit Column' : 'Add Column'}
          </DialogTitle>
          <DialogContent>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 2 }}>
              <TextField
                label='Column Name'
                value={newColumnName}
                onChange={(e) => setNewColumnName(e.target.value)}
                fullWidth
                required
                inputProps={{ maxLength: 100 }}
                helperText={`${newColumnName.length}/100 characters`}
              />
              <FormControl fullWidth>
                <InputLabel>Task State</InputLabel>
                <Select
                  value={newColumnState}
                  onChange={(e) => setNewColumnState(e.target.value as TaskState)}
                  label='Task State'
                >
                  {validStates.map((state) => (
                    <MenuItem key={state} value={state}>
                      {state}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
              {newColumnState === 'Review' && (
                <Alert severity='info'>
                  Review state columns are required and cannot be removed. This is the Review gate.
                </Alert>
              )}
            </Box>
          </DialogContent>
          <DialogActions>
            <Button
              onClick={() => setEditColumnDialog({ open: false, column: null, index: null })}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveColumn} variant='contained'>
              {editColumnDialog.index !== null ? 'Save' : 'Add'}
            </Button>
          </DialogActions>
        </Dialog>
      </Container>
    </AppLayout>
  )
}

