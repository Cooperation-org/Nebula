'use client'

import dynamic from 'next/dynamic'
import { useParams } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Container, Box } from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import ReviewAssistance from './ReviewAssistance'
import ReviewChecklistComponent from './ReviewChecklist'
import { getTask } from '@/lib/firebase/tasks'

// Dynamically import review components with SSR disabled
// This prevents Firebase from initializing during build/SSR
const ReviewDetails = dynamic(() => import('./ReviewDetails'), {
  ssr: false
})

export default function ReviewPage() {
  const params = useParams()
  const teamId = params?.teamId as string
  const taskId = params?.taskId as string
  const [task, setTask] = useState<any>(null)

  useEffect(() => {
    const loadTask = async () => {
      try {
        const taskData = await getTask(teamId, taskId)
        setTask(taskData)
      } catch (error) {
        // Handle error
      }
    }
    loadTask()
  }, [teamId, taskId])

  return (
    <AppLayout>
      <Container maxWidth='md'>
        <Box sx={{ py: 4, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <ReviewAssistance taskId={taskId} teamId={teamId} />
          <ReviewChecklistComponent
            taskId={taskId}
            teamId={teamId}
            taskType={task?.taskType}
            cookValue={task?.cookValue}
          />
          <ReviewDetails taskId={taskId} teamId={teamId} />
        </Box>
      </Container>
    </AppLayout>
  )
}

