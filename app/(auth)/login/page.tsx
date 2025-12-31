'use client'

import dynamic from 'next/dynamic'

// Dynamically import LoginForm with SSR disabled
// This prevents Firebase from initializing during build/SSR
const LoginForm = dynamic(() => import('./LoginForm'), {
  ssr: false
})

export default function LoginPage() {
  return <LoginForm />
}

