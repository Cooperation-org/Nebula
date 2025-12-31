'use client'

import dynamic from 'next/dynamic'

// Dynamically import CreateTaskForm with SSR disabled
// This prevents Firebase from initializing during build/SSR
const CreateTaskForm = dynamic(() => import('./CreateTaskForm'), {
  ssr: false
})

export default function CreateTaskPage() {
  return <CreateTaskForm />
}
