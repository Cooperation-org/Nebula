/**
 * Server-side Firebase configuration
 * For use in Next.js API routes and server components
 * 
 * This file does NOT have 'use client' directive, so it can be used server-side
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore } from 'firebase/firestore'

// Firebase configuration interface
interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string
}

// Get Firebase configuration from environment variables
const getFirebaseConfig = (): FirebaseConfig => {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
  }

  // Validate config
  if (!config.apiKey || !config.authDomain || !config.projectId) {
    throw new Error(
      'Firebase configuration is missing. Please set NEXT_PUBLIC_FIREBASE_* environment variables.'
    )
  }

  return config
}

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp | undefined

export const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    const apps = getApps()
    if (apps.length === 0) {
      const config = getFirebaseConfig()
      app = initializeApp(config)
    } else {
      app = apps[0]
    }
  }
  return app
}

// Initialize Firestore
let firestore: Firestore | undefined

export const getFirestoreInstance = (): Firestore => {
  if (!firestore) {
    const firebaseApp = getFirebaseApp()
    firestore = getFirestore(firebaseApp)
  }
  return firestore
}

