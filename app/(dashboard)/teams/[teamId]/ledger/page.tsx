'use client'

import dynamic from 'next/dynamic'

// Dynamically import CookLedgerView with SSR disabled
// This prevents Firebase from initializing during build/SSR
const CookLedgerView = dynamic(() => import('./CookLedgerView'), {
  ssr: false
})

export default function CookLedgerPage() {
  return <CookLedgerView />
}
