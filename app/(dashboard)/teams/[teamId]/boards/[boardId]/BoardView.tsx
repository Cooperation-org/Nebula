'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { collection, query, where, onSnapshot, orderBy } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase/config'
import {
  Box,
  Container,
  Typography,
  Paper,
  CircularProgress,
  Alert,
  Chip,
  Card,
  CardContent,
  Button
} from '@mui/material'
import EditIcon from '@mui/icons-material/Edit'
import { AppLayout } from '@/components/AppLayout'
import { getBoard } from '@/lib/firebase/boards'
import { getTeamMembers } from '@/lib/firebase/teams'
import { logger } from '@/lib/utils/logger'
import { usePermissions } from '@/lib/hooks/usePermissions'
import type { Board } from '@/lib/types/board'
import type { Task } from '@/lib/types/task'
import type { User } from '@/lib/types/user'

export default function BoardView() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string
  const boardId = params?.boardId as string

  const [board, setBoard] = useState<Board | null>(null)
  const [tasksByState, setTasksByState] = useState<Record<string, Task[]>>({})
  const [teamMembers, setTeamMembers] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { hasRole } = usePermissions()
  const isSteward = hasRole('Steward')

  useEffect(() => {
    if (!teamId || !boardId) return

    let unsubscribe: (() => void) | undefined

    const loadBoard = async () => {
      try {
        setLoading(true)
        setError(null)

        // Load board (require authentication for non-public boards)
        const boardData = await getBoard(teamId, boardId, true)
        if (!boardData) {
          setError('Board not found')
          setLoading(false)
          return
        }

        // Check Restricted board access
        if (boardData.visibility === 'Restricted') {
          // getBoard already checks Restricted access, but we can add additional UI checks here if needed
          // The access check is done in getBoard function
        }

        setBoard(boardData)

        // Load team members for display names
        try {
          const members = await getTeamMembers(teamId)
          const memberMap = new Map<string, string>()
          for (const member of members) {
            memberMap.set(member.user.id, member.user.displayName)
          }
          setTeamMembers(memberMap)
        } catch (err) {
          logger.error('Error loading team members for board', {
            teamId,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }

        // Set up real-time listener for tasks
        const tasksRef = collection(getFirestoreInstance(), 'teams', teamId, 'tasks')
        const q = query(
          tasksRef,
          where('archived', '==', false),
          orderBy('updatedAt', 'desc')
        )

        unsubscribe = onSnapshot(
          q,
          snapshot => {
            const tasksByStateData: Record<string, Task[]> = {
              Backlog: [],
              Ready: [],
              'In Progress': [],
              Review: [],
              Done: []
            }

            snapshot.forEach(docSnap => {
              const data = docSnap.data()

              // Convert Firestore Timestamp to ISO string
              const createdAt =
                data.createdAt?.toDate?.()?.toISOString() ||
                (typeof data.createdAt === 'string'
                  ? data.createdAt
                  : new Date().toISOString())
              const updatedAt =
                data.updatedAt?.toDate?.()?.toISOString() ||
                (typeof data.updatedAt === 'string'
                  ? data.updatedAt
                  : new Date().toISOString())

              const task: Task = {
                id: docSnap.id,
                title: data.title || '',
                description: data.description,
                state: data.state || 'Backlog',
                contributors: data.contributors || [],
                reviewers: data.reviewers || [],
                archived: data.archived || false,
                cookValue: data.cookValue,
                cookState: data.cookState,
                cookAttribution: data.cookAttribution,
                createdAt,
                updatedAt,
                createdBy: data.createdBy || '',
                teamId: data.teamId || teamId
              }

              // Group by state
              if (task.state in tasksByStateData) {
                tasksByStateData[task.state].push(task)
              } else {
                tasksByStateData['Backlog'].push(task)
              }
            })

            setTasksByState(tasksByStateData)
            setLoading(false)
          },
          err => {
            logger.error('Error in tasks snapshot', {
              teamId,
              boardId,
              error: err.message
            })
            setError('Failed to load tasks')
            setLoading(false)
          }
        )
      } catch (err) {
        logger.error('Error loading board', {
          teamId,
          boardId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load board')
        setLoading(false)
      }
    }

    loadBoard()

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [teamId, boardId])

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth='xl'>
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

  if (error || !board) {
    return (
      <AppLayout>
        <Container maxWidth='xl'>
          <Alert severity='error'>{error || 'Board not found'}</Alert>
        </Container>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Container maxWidth='xl'>
        <Box sx={{ py: 4 }}>
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              mb: 2
            }}
          >
            <Box>
              <Typography variant='h4' component='h1' gutterBottom>
                {board.name}
              </Typography>
              {board.description && (
                <Typography variant='body2' color='text.secondary' gutterBottom>
                  {board.description}
                </Typography>
              )}
            </Box>
            {isSteward && (
              <Button
                startIcon={<EditIcon />}
                variant='outlined'
                onClick={() => router.push(`/teams/${teamId}/boards/${boardId}/edit`)}
              >
                Edit Board
              </Button>
            )}
          </Box>

          {/* Board columns - responsive grid */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr', // Mobile: single column
                sm: 'repeat(2, 1fr)', // Tablet: 2 columns
                md: 'repeat(3, 1fr)', // Desktop: 3 columns
                lg: 'repeat(5, 1fr)' // Large: all 5 columns
              },
              gap: 2,
              mt: 4
            }}
          >
            {board.columns.map(column => {
              const tasks = tasksByState[column.state] || []
              return (
                <Paper
                  key={column.id}
                  sx={{
                    p: 2,
                    minHeight: '400px',
                    backgroundColor: column.required
                      ? 'background.paper'
                      : 'background.default'
                  }}
                >
                  <Box sx={{ mb: 2 }}>
                    <Typography variant='h6' component='h2'>
                      {column.name}
                      {column.required && (
                        <Chip
                          label='Required'
                          size='small'
                          color='primary'
                          sx={{ ml: 1 }}
                        />
                      )}
                    </Typography>
                    <Typography variant='caption' color='text.secondary'>
                      {tasks.length} task{tasks.length !== 1 ? 's' : ''}
                    </Typography>
                  </Box>

                  {/* Tasks in this column */}
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {tasks.map(task => (
                      <Card key={task.id} sx={{ cursor: 'pointer' }}>
                        <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                          <Typography variant='subtitle2' gutterBottom>
                            {task.title}
                          </Typography>
                          {task.description && (
                            <Typography
                              variant='caption'
                              color='text.secondary'
                              sx={{
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden'
                              }}
                            >
                              {task.description}
                            </Typography>
                          )}
                          <Box
                            sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}
                          >
                            {/* COOK value and state - visible for all visibility levels */}
                            {task.cookValue !== undefined && (
                              <Chip
                                label={`COOK: ${task.cookValue}${task.cookState ? ` (${task.cookState})` : ''}`}
                                size='small'
                                color='secondary'
                                variant='outlined'
                              />
                            )}
                            {/* Hide contributor names for public boards (FR34) */}
                            {board.visibility !== 'Public' &&
                              task.contributors.length > 0 && (
                                <Chip
                                  label={
                                    task.contributors.length === 1
                                      ? teamMembers.get(task.contributors[0]) ||
                                        task.contributors[0]
                                      : `${task.contributors.length} contributors`
                                  }
                                  size='small'
                                  variant='outlined'
                                />
                              )}
                            {/* Show contributor count only for public boards */}
                            {board.visibility === 'Public' &&
                              task.contributors.length > 0 && (
                                <Chip
                                  label={`${task.contributors.length} contributor${task.contributors.length !== 1 ? 's' : ''}`}
                                  size='small'
                                  variant='outlined'
                                />
                              )}
                            {/* Show reviewers for Team-Visible and Restricted boards (FR35) */}
                            {board.visibility !== 'Public' &&
                              task.reviewers &&
                              task.reviewers.length > 0 && (
                                <Chip
                                  label={
                                    task.reviewers.length === 1
                                      ? `Reviewer: ${teamMembers.get(task.reviewers[0]) || task.reviewers[0]}`
                                      : `${task.reviewers.length} reviewers`
                                  }
                                  size='small'
                                  variant='outlined'
                                  color='secondary'
                                />
                              )}
                          </Box>
                        </CardContent>
                      </Card>
                    ))}
                    {tasks.length === 0 && (
                      <Typography variant='body2' color='text.secondary' sx={{ p: 2 }}>
                        No tasks
                      </Typography>
                    )}
                  </Box>
                </Paper>
              )
            })}
          </Box>
        </Box>
      </Container>
    </AppLayout>
  )
}
