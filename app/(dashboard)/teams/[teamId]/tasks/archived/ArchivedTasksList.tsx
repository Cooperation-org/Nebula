'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import {
  Box,
  Button,
  Typography,
  Container,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Menu,
  MenuItem
} from '@mui/material'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import { AppLayout } from '@/components/AppLayout'
import { getTask, unarchiveTask } from '@/lib/firebase/tasks'
import { getTeam } from '@/lib/firebase/teams'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase/config'
import { logger } from '@/lib/utils/logger'
import type { Task } from '@/lib/types/task'
import type { Team } from '@/lib/types/team'
import Link from 'next/link'

export default function ArchivedTasksList() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string

  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<Team | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({})
  const [unarchivingTaskId, setUnarchivingTaskId] = useState<string | null>(null)

  // Load archived tasks on mount
  useEffect(() => {
    const loadTasks = async () => {
      if (!teamId) return

      try {
        // Load team info
        const teamData = await getTeam(teamId)
        if (!teamData) {
          setError('Team not found')
          setLoading(false)
          return
        }
        setTeam(teamData)

        // Load archived tasks
        const tasksRef = collection(getFirestoreInstance(), 'teams', teamId, 'tasks')
        const q = query(
          tasksRef,
          where('archived', '==', true),
          orderBy('updatedAt', 'desc')
        )
        const querySnapshot = await getDocs(q)

        const tasksList: Task[] = []
        for (const docSnap of querySnapshot.docs) {
          try {
            const task = await getTask(teamId, docSnap.id)
            if (task) {
              tasksList.push(task)
            }
          } catch (err) {
            logger.error('Error loading task', {
              taskId: docSnap.id,
              error: err instanceof Error ? err.message : 'Unknown error'
            })
          }
        }

        setTasks(tasksList)
      } catch (err) {
        logger.error('Error loading archived tasks', {
          teamId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load archived tasks')
      } finally {
        setLoading(false)
      }
    }

    loadTasks()
  }, [teamId])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, taskId: string) => {
    setAnchorEl({ ...anchorEl, [taskId]: event.currentTarget })
  }

  const handleMenuClose = (taskId: string) => {
    setAnchorEl({ ...anchorEl, [taskId]: null })
  }

  const handleUnarchive = async (taskId: string) => {
    handleMenuClose(taskId)
    setUnarchivingTaskId(taskId)

    try {
      await unarchiveTask(teamId, taskId)
      logger.info('Task unarchived', { taskId, teamId })

      // Reload tasks
      const tasksRef = collection(getFirestoreInstance(), 'teams', teamId, 'tasks')
      const q = query(
        tasksRef,
        where('archived', '==', true),
        orderBy('updatedAt', 'desc')
      )
      const querySnapshot = await getDocs(q)

      const tasksList: Task[] = []
      for (const docSnap of querySnapshot.docs) {
        try {
          const task = await getTask(teamId, docSnap.id)
          if (task) {
            tasksList.push(task)
          }
        } catch (err) {
          logger.error('Error loading task', {
            taskId: docSnap.id,
            error: err instanceof Error ? err.message : 'Unknown error'
          })
        }
      }

      setTasks(tasksList)
    } catch (err) {
      logger.error('Error unarchiving task', {
        taskId,
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError('Failed to unarchive task')
    } finally {
      setUnarchivingTaskId(null)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <Container maxWidth='lg'>
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

  if (error) {
    return (
      <AppLayout>
        <Container maxWidth='lg'>
          <Alert severity='error'>{error}</Alert>
        </Container>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <Container maxWidth='lg'>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
            py: 4
          }}
        >
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}
          >
            <Typography variant='h4' component='h1'>
              Archived Tasks - {team?.name || 'Tasks'}
            </Typography>
            <Button variant='outlined' component={Link} href={`/teams/${teamId}/tasks`}>
              Back to Active Tasks
            </Button>
          </Box>

          {tasks.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant='body1' color='text.secondary' align='center'>
                  No archived tasks.
                </Typography>
              </CardContent>
            </Card>
          ) : (
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2
              }}
            >
              {tasks.map(task => (
                <Card key={task.id}>
                  <CardContent>
                    <Box
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: 2
                      }}
                    >
                      <Box sx={{ flex: 1 }}>
                        <Typography variant='h6' component='h2' gutterBottom>
                          {task.title}
                        </Typography>
                        {task.description && (
                          <Typography
                            variant='body2'
                            color='text.secondary'
                            sx={{ mb: 2 }}
                          >
                            {task.description}
                          </Typography>
                        )}
                        <Box
                          sx={{
                            display: 'flex',
                            gap: 1,
                            flexWrap: 'wrap',
                            alignItems: 'center'
                          }}
                        >
                          <Chip
                            label={task.state}
                            size='small'
                            color='primary'
                            variant='outlined'
                          />
                          <Chip
                            label='Archived'
                            size='small'
                            color='default'
                            variant='outlined'
                          />
                          <Typography variant='caption' color='text.secondary'>
                            {task.contributors.length} contributor
                            {task.contributors.length !== 1 ? 's' : ''}
                          </Typography>
                          {task.reviewers && task.reviewers.length > 0 && (
                            <Typography variant='caption' color='text.secondary'>
                              {task.reviewers.length} reviewer
                              {task.reviewers.length !== 1 ? 's' : ''}
                            </Typography>
                          )}
                        </Box>
                      </Box>
                      <IconButton
                        onClick={e => handleMenuOpen(e, task.id)}
                        disabled={unarchivingTaskId === task.id}
                        size='small'
                      >
                        <MoreVertIcon />
                      </IconButton>
                      <Menu
                        anchorEl={anchorEl[task.id]}
                        open={Boolean(anchorEl[task.id])}
                        onClose={() => handleMenuClose(task.id)}
                      >
                        <MenuItem onClick={() => handleUnarchive(task.id)}>
                          Unarchive Task
                        </MenuItem>
                      </Menu>
                    </Box>
                  </CardContent>
                </Card>
              ))}
            </Box>
          )}
        </Box>
      </Container>
    </AppLayout>
  )
}
