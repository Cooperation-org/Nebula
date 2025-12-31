'use client'

import dynamic from 'next/dynamic'

// Dynamically import RegisterForm with SSR disabled
// This prevents Firebase from initializing during build/SSR
const RegisterForm = dynamic(() => import('./RegisterForm'), {
  ssr: false
})

export default function RegisterPage() {
  return <RegisterForm />
}
