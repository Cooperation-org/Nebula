'use client'

import dynamic from 'next/dynamic'

// Dynamically import ArchivedTasksList with SSR disabled
// This prevents Firebase from initializing during build/SSR
const ArchivedTasksList = dynamic(() => import('./ArchivedTasksList'), {
  ssr: false
})

export default function ArchivedTasksPage() {
  return <ArchivedTasksList />
}
