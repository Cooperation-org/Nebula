'use client'

import dynamic from 'next/dynamic'

// Dynamically import ProfileForm with SSR disabled
// This prevents Firebase from initializing during build/SSR
const ProfileForm = dynamic(() => import('./ProfileForm'), {
  ssr: false
})

export default function ProfilePage() {
  return <ProfileForm />
}
