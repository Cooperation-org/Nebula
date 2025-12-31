'use client'

import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
  updateProfile
} from 'firebase/auth'
import { doc, getDoc, setDoc, Timestamp } from 'firebase/firestore'
import { authInstance, db } from './config'
import type { User, UserDocument } from '@/lib/types/user'
import { userDocumentSchema, userSchema, userUpdateSchema } from '@/lib/schemas/user'
import { logger } from '@/lib/utils/logger'

/**
 * Sign in with email and password
 */
export async function signIn(email: string, password: string): Promise<FirebaseUser> {
  const userCredential = await signInWithEmailAndPassword(authInstance, email, password)
  return userCredential.user
}

/**
 * Sign up with email and password
 * Creates Firebase Auth user and user document in Firestore
 */
export async function signUp(
  email: string,
  password: string,
  displayName: string
): Promise<FirebaseUser> {
  // Create Firebase Auth user
  const userCredential = await createUserWithEmailAndPassword(
    authInstance,
    email,
    password
  )

  // Update Firebase Auth profile
  await updateProfile(userCredential.user, { displayName })

  // Wait a brief moment to ensure auth token is propagated
  // This helps with Firestore rules that check authentication
  await new Promise(resolve => setTimeout(resolve, 100))

  // Create user document in Firestore
  const now = new Date()
  const userDoc: UserDocument = {
    displayName,
    email,
    teams: {}, // Empty teams map initially
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  }

  // Validate with Zod schema
  const validatedData = userDocumentSchema.parse(userDoc)

  // Create user document at users/{userId}
  // Convert ISO strings to Firestore Timestamps for rule validation
  // Firestore rules expect timestamp type, not ISO strings
  await setDoc(doc(db, 'users', userCredential.user.uid), {
    ...validatedData,
    createdAt: Timestamp.fromDate(now),
    updatedAt: Timestamp.fromDate(now)
  })

  return userCredential.user
}

/**
 * Sign out current user
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(authInstance)
}

/**
 * Send password reset email
 */
export async function resetPassword(email: string): Promise<void> {
  await sendPasswordResetEmail(authInstance, email)
}

/**
 * Get current authenticated user
 */
export function getCurrentUser(): FirebaseUser | null {
  return authInstance.currentUser
}

/**
 * Get user document from Firestore
 * Returns null if user document doesn't exist
 */
export async function getUserDocument(userId: string): Promise<User | null> {
  const userDocRef = doc(db, 'users', userId)
  const userDocSnap = await getDoc(userDocRef)

  if (!userDocSnap.exists()) {
    return null
  }

  const data = userDocSnap.data()

  // Convert Firestore Timestamp to ISO string
  const createdAt =
    data.createdAt?.toDate?.()?.toISOString() ||
    (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString())
  const updatedAt =
    data.updatedAt?.toDate?.()?.toISOString() ||
    (typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString())

  const user: User = {
    id: userId,
    displayName: data.displayName || '',
    email: data.email || '',
    photoURL: data.photoURL,
    teams: data.teams || {},
    githubUsername: data.githubUsername,
    slackUserId: data.slackUserId,
    createdAt,
    updatedAt
  }

  // Validate with Zod schema
  return userSchema.parse(user)
}

/**
 * Get current user's document from Firestore
 * Returns null if not authenticated or document doesn't exist
 */
export async function getCurrentUserDocument(): Promise<User | null> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    return null
  }
  return getUserDocument(currentUser.uid)
}

/**
 * Subscribe to authentication state changes
 * Returns unsubscribe function
 */
export function onAuthStateChange(
  callback: (user: FirebaseUser | null) => void
): () => void {
  return onAuthStateChanged(authInstance, callback)
}

/**
 * Check if user has role in team
 */
export function hasTeamRole(user: User, teamId: string, role: string): boolean {
  return user.teams[teamId] === role
}

/**
 * Check if user is member of team
 */
export function isTeamMember(user: User, teamId: string): boolean {
  return teamId in user.teams
}

/**
 * Get user's role in team
 * Returns null if user is not a member of the team
 */
export function getUserTeamRole(user: User, teamId: string): string | null {
  return user.teams[teamId] || null
}

/**
 * Update user profile
 * Updates displayName, email, and photoURL in Firestore user document
 * Note: Teams map cannot be updated directly by users (only via Cloud Functions)
 */
export async function updateUserProfile(updates: {
  displayName?: string
  email?: string
  photoURL?: string
  slackUserId?: string
}): Promise<User> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to update profile')
  }

  // Get current user document
  const currentUserDoc = await getCurrentUserDocument()
  if (!currentUserDoc) {
    throw new Error('User document not found')
  }

  // Prepare update data
  const now = new Date()
  const nowISO = now.toISOString()
  const updateData: Partial<UserDocument> = {
    updatedAt: nowISO
  }

  if (updates.displayName !== undefined) {
    updateData.displayName = updates.displayName
  }

  if (updates.email !== undefined) {
    updateData.email = updates.email
  }

  if (updates.photoURL !== undefined) {
    updateData.photoURL = updates.photoURL || undefined
  }

  if (updates.slackUserId !== undefined) {
    updateData.slackUserId = updates.slackUserId.trim() || undefined
  }

  // Validate with Zod schema
  const validatedData = userUpdateSchema.parse({
    ...updateData,
    updatedAt: nowISO
  })

  // Update user document in Firestore
  // Convert ISO string to Firestore Timestamp for rule validation
  const userRef = doc(db, 'users', currentUser.uid)
  await setDoc(
    userRef,
    {
      ...validatedData,
      updatedAt: Timestamp.fromDate(now)
    },
    { merge: true }
  )

  // Update Firebase Auth profile if displayName or photoURL changed
  if (updates.displayName !== undefined || updates.photoURL !== undefined) {
    await updateProfile(currentUser, {
      displayName: updates.displayName || currentUser.displayName || undefined,
      photoURL: updates.photoURL || currentUser.photoURL || undefined
    })
  }

  logger.info('User profile updated', {
    userId: currentUser.uid,
    updates: Object.keys(updates)
  })

  // Return updated user document
  const updatedUser = await getCurrentUserDocument()
  if (!updatedUser) {
    throw new Error('Failed to retrieve updated user document')
  }

  return updatedUser
}
