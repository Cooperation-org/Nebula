'use client'

import dynamic from 'next/dynamic'

// Dynamically import OnboardingFlow with SSR disabled
const OnboardingFlow = dynamic(() => import('./OnboardingFlow'), {
  ssr: false
})

export default function OnboardingPage() {
  return <OnboardingFlow />
}
