'use client'

import { initializeApp, getApps, FirebaseApp } from 'firebase/app'
import { getFirestore, Firestore } from 'firebase/firestore'
import { getAuth, Auth } from 'firebase/auth'
import { getFunctions, Functions, connectFunctionsEmulator } from 'firebase/functions'

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
// These are safe to expose in client code (public config)
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

  // Return config without validation during build/SSR
  // Validation will happen at runtime when Firebase is actually initialized
  // This allows the build to complete even without env vars
  return config
}

// Initialize Firebase app (singleton pattern)
let app: FirebaseApp | undefined

export const getFirebaseApp = (): FirebaseApp => {
  if (!app) {
    const apps = getApps()
    if (apps.length === 0) {
      const config = getFirebaseConfig()
      // Validate config before initializing (only at runtime, not during build)
      if (typeof window !== 'undefined' && (!config.apiKey || !config.authDomain || !config.projectId)) {
        throw new Error(
          'Firebase configuration is missing. Please set NEXT_PUBLIC_FIREBASE_* environment variables.'
        )
      }
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

// Initialize Auth
let auth: Auth | undefined

export const getAuthInstance = (): Auth => {
  if (!auth) {
    const firebaseApp = getFirebaseApp()
    auth = getAuth(firebaseApp)
  }
  return auth
}

// Initialize Functions
let functions: Functions | undefined

export const getFunctionsInstance = (): Functions => {
  if (!functions) {
    const firebaseApp = getFirebaseApp()
    functions = getFunctions(firebaseApp)

    // Connect to emulator in development if configured
    if (
      process.env.NODE_ENV === 'development' &&
      process.env.NEXT_PUBLIC_FIREBASE_USE_EMULATOR === 'true'
    ) {
      const emulatorHost =
        process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST || 'localhost'
      const emulatorPort =
        parseInt(process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT || '5001', 10) || 5001
      connectFunctionsEmulator(functions, emulatorHost, emulatorPort)
    }
  }
  return functions
}

// Export initialized instances for convenience
// Note: These will only work in client-side code (browser)
// During SSR/build, they may not be available
export const db = getFirestoreInstance()
export const authInstance = getAuthInstance()
export const functionsInstance = getFunctionsInstance()

