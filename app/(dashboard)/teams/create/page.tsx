'use client'

import dynamic from 'next/dynamic'

// Dynamically import CreateTeamForm with SSR disabled
// This prevents Firebase from initializing during build/SSR
const CreateTeamForm = dynamic(() => import('./CreateTeamForm'), {
  ssr: false
})

export default function CreateTeamPage() {
  return <CreateTeamForm />
}

