'use client'

import dynamic from 'next/dynamic'

// Dynamically import EditTaskForm with SSR disabled
// This prevents Firebase from initializing during build/SSR
const EditTaskForm = dynamic(() => import('./EditTaskForm'), {
  ssr: false
})

export default function EditTaskPage() {
  return <EditTaskForm />
}

