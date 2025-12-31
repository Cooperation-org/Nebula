'use client'

import dynamic from 'next/dynamic'

// Dynamically import TasksList with SSR disabled
// This prevents Firebase from initializing during build/SSR
const TasksList = dynamic(() => import('./TasksList'), {
  ssr: false
})

export default function TasksPage() {
  return <TasksList />
}

