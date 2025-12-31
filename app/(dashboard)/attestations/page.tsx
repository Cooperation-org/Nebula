'use client'

import dynamic from 'next/dynamic'

// Dynamically import AttestationsView with SSR disabled
// This prevents Firebase from initializing during build/SSR
const AttestationsView = dynamic(() => import('./AttestationsView'), {
  ssr: false
})

export default function AttestationsPage() {
  return <AttestationsView />
}
