'use client'

import dynamic from 'next/dynamic'

// Dynamically import JoinTeamForm with SSR disabled
// This prevents Firebase from initializing during build/SSR
const JoinTeamForm = dynamic(() => import('./JoinTeamForm'), {
  ssr: false
})

export default function JoinTeamPage() {
  return <JoinTeamForm />
}

