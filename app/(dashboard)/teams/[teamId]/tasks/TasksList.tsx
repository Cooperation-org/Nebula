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
import { getTask, archiveTask } from '@/lib/firebase/tasks'
import { getTeam, getTeamMembers } from '@/lib/firebase/teams'
import { getUserDocument } from '@/lib/firebase/auth'
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { getFirestoreInstance } from '@/lib/firebase/config'
import { logger } from '@/lib/utils/logger'
import type { Task } from '@/lib/types/task'
import type { Team } from '@/lib/types/team'
import Link from 'next/link'

export default function TasksList() {
  const router = useRouter()
  const params = useParams()
  const teamId = params?.teamId as string

  const [tasks, setTasks] = useState<Task[]>([])
  const [team, setTeam] = useState<Team | null>(null)
  const [teamMembers, setTeamMembers] = useState<Map<string, string>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [anchorEl, setAnchorEl] = useState<{ [key: string]: HTMLElement | null }>({})
  const [archivingTaskId, setArchivingTaskId] = useState<string | null>(null)

  // Load tasks on mount
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

        // Load team members for display names
        const members = await getTeamMembers(teamId)
        const memberMap = new Map<string, string>()
        for (const member of members) {
          memberMap.set(member.user.id, member.user.displayName)
        }
        setTeamMembers(memberMap)

        // Load tasks
        const tasksRef = collection(
          getFirestoreInstance(),
          'teams',
          teamId,
          'tasks'
        )
        const q = query(
          tasksRef,
          where('archived', '==', false),
          orderBy('createdAt', 'desc')
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
        logger.error('Error loading tasks', {
          teamId,
          error: err instanceof Error ? err.message : 'Unknown error'
        })
        setError('Failed to load tasks')
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

  const handleArchive = async (taskId: string) => {
    handleMenuClose(taskId)
    setArchivingTaskId(taskId)

    try {
      await archiveTask(teamId, taskId)
      logger.info('Task archived', { taskId, teamId })
      
      // Reload tasks
      const tasksRef = collection(
        getFirestoreInstance(),
        'teams',
        teamId,
        'tasks'
      )
      const q = query(
        tasksRef,
        where('archived', '==', false),
        orderBy('createdAt', 'desc')
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
      logger.error('Error archiving task', {
        taskId,
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
      setError('Failed to archive task')
    } finally {
      setArchivingTaskId(null)
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
              {team?.name || 'Tasks'}
            </Typography>
            <Box sx={{ display: 'flex', gap: 2 }}>
              <Button
                variant='outlined'
                component={Link}
                href={`/teams/${teamId}/tasks/archived`}
              >
                View Archived
              </Button>
              <Button
                variant='contained'
                component={Link}
                href={`/teams/${teamId}/tasks/create`}
              >
                Create Task
              </Button>
            </Box>
          </Box>

          {tasks.length === 0 ? (
            <Card>
              <CardContent>
                <Typography variant='body1' color='text.secondary' align='center'>
                  No tasks yet. Create your first task to get started!
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
              {tasks.map((task) => (
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
                        <Typography
                          variant='h6'
                          component='h2'
                          gutterBottom
                          sx={{ cursor: 'pointer' }}
                          onClick={() =>
                            router.push(`/teams/${teamId}/tasks/${task.id}/edit`)
                          }
                        >
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
                          {task.cookValue !== undefined && (
                            <Chip
                              label={`COOK: ${task.cookValue}${task.cookState ? ` (${task.cookState})` : ''}${task.cookAttribution ? ` [${task.cookAttribution === 'self' ? 'Self' : 'Spend'}]` : ''}`}
                              size='small'
                              color={task.cookState === 'Locked' ? 'warning' : task.cookState === 'Final' ? 'success' : 'secondary'}
                              variant={task.cookState === 'Locked' ? 'filled' : 'outlined'}
                              title={
                                task.cookState === 'Final'
                                  ? 'COOK is finalized and cannot be edited'
                                  : task.cookState === 'Locked'
                                  ? 'COOK is locked and awaiting review'
                                  : task.cookAttribution === 'self'
                                  ? 'Self-COOK: Contributor assigned to themselves'
                                  : task.cookAttribution === 'spend'
                                  ? 'Spend-COOK: Assigned by others'
                                  : ''
                              }
                            />
                          )}
                          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                            <Typography variant='caption' color='text.secondary' sx={{ mr: 0.5 }}>
                              Contributors:
                            </Typography>
                            {task.contributors.map((userId) => (
                              <Chip
                                key={userId}
                                label={teamMembers.get(userId) || userId}
                                size='small'
                                variant='outlined'
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                            ))}
                          </Box>
                          {task.reviewers && task.reviewers.length > 0 && (
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mt: 0.5 }}>
                              <Typography variant='caption' color='text.secondary' sx={{ mr: 0.5 }}>
                                Reviewers:
                              </Typography>
                              {task.reviewers.map((userId) => (
                                <Chip
                                  key={userId}
                                  label={teamMembers.get(userId) || userId}
                                  size='small'
                                  variant='outlined'
                                  color='secondary'
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              ))}
                            </Box>
                          )}
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                        <Button
                          size='small'
                          variant='outlined'
                          onClick={() => router.push(`/teams/${teamId}/tasks/${task.id}/edit`)}
                        >
                          Edit
                        </Button>
                        <IconButton
                          onClick={(e) => handleMenuOpen(e, task.id)}
                          disabled={archivingTaskId === task.id}
                          size='small'
                        >
                          <MoreVertIcon />
                        </IconButton>
                        <Menu
                          anchorEl={anchorEl[task.id]}
                          open={Boolean(anchorEl[task.id])}
                          onClose={() => handleMenuClose(task.id)}
                        >
                          <MenuItem onClick={() => handleArchive(task.id)}>
                            Archive Task
                          </MenuItem>
                        </Menu>
                      </Box>
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

