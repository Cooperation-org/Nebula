'use client'

import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  updateDoc,
  serverTimestamp,
  runTransaction
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import { getCurrentUser, getCurrentUserDocument } from './auth'
import { logger } from '@/lib/utils/logger'
import {
  teamRequestSchema,
  teamRequestDocumentSchema,
  teamRequestCreateSchema,
  teamRequestUpdateSchema,
  type TeamRequest,
  type TeamRequestCreate,
  type TeamRequestUpdate,
  type TeamRequestStatus
} from '@/lib/schemas/team-request'
import { joinTeam } from './teams'
import { requireAuth } from '@/lib/permissions/checks'
import { PermissionError, PermissionErrorCode } from '@/lib/permissions/types'
import { hasRoleOrHigher } from '@/lib/permissions/types'
import type { UserRole } from '@/lib/types/user'

/**
 * Create a team join request
 */
export async function createTeamRequest(
  teamId: string,
  message?: string
): Promise<TeamRequest> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to create a team request')
  }

  // Get user document
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check if user is already a member
  if (userDoc.teams?.[teamId]) {
    throw new Error('You are already a member of this team')
  }

  // Check if there's already a pending request
  const existingRequest = await getPendingRequestByUser(teamId, currentUser.uid)
  if (existingRequest) {
    throw new Error('You already have a pending request for this team')
  }

  // Validate request data
  const requestData: TeamRequestCreate = {
    teamId,
    message
  }
  const validatedData = teamRequestCreateSchema.parse(requestData)

  // Generate request ID
  const requestId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'joinRequests'), '_').id

  const now = new Date().toISOString()
  const requestDoc = {
    teamId: validatedData.teamId,
    userId: currentUser.uid,
    status: 'pending' as TeamRequestStatus,
    message: validatedData.message,
    requestedAt: now,
    createdAt: now,
    updatedAt: now
  }

  // Validate with Zod schema
  const validatedRequestDoc = teamRequestDocumentSchema.parse(requestDoc)

  // Store in Firestore
  const requestRef = doc(getFirestoreInstance(), 'teams', teamId, 'joinRequests', requestId)
  await setDoc(requestRef, {
    ...validatedRequestDoc,
    requestedAt: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  logger.info('Team join request created', {
    requestId,
    teamId,
    userId: currentUser.uid
  })

  const request: TeamRequest = {
    id: requestId,
    ...validatedRequestDoc
  }

  return request
}

/**
 * Get a team request by ID
 */
export async function getTeamRequest(
  teamId: string,
  requestId: string
): Promise<TeamRequest | null> {
  const requestRef = doc(getFirestoreInstance(), 'teams', teamId, 'joinRequests', requestId)
  const requestSnap = await getDoc(requestRef)

  if (!requestSnap.exists()) {
    return null
  }

  const data = requestSnap.data()
  const requestedAt = data.requestedAt?.toDate?.()?.toISOString() || data.requestedAt
  const reviewedAt = data.reviewedAt?.toDate?.()?.toISOString() || data.reviewedAt
  const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt
  const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt

  return teamRequestSchema.parse({
    id: requestSnap.id,
    teamId: data.teamId || teamId,
    userId: data.userId || '',
    status: data.status || 'pending',
    message: data.message,
    adminMessage: data.adminMessage,
    requestedAt: requestedAt || new Date().toISOString(),
    reviewedAt,
    reviewedBy: data.reviewedBy,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString()
  })
}

/**
 * Get pending request by user for a team
 */
export async function getPendingRequestByUser(
  teamId: string,
  userId: string
): Promise<TeamRequest | null> {
  const requestsRef = collection(getFirestoreInstance(), 'teams', teamId, 'joinRequests')
  const q = query(
    requestsRef,
    where('userId', '==', userId),
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  if (snapshot.empty) {
    return null
  }

  const doc = snapshot.docs[0]
  const data = doc.data()
  const requestedAt = data.requestedAt?.toDate?.()?.toISOString() || data.requestedAt
  const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt
  const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt

  return teamRequestSchema.parse({
    id: doc.id,
    teamId: data.teamId || teamId,
    userId: data.userId || userId,
    status: data.status || 'pending',
    message: data.message,
    adminMessage: data.adminMessage,
    requestedAt: requestedAt || new Date().toISOString(),
    reviewedAt: data.reviewedAt,
    reviewedBy: data.reviewedBy,
    createdAt: createdAt || new Date().toISOString(),
    updatedAt: updatedAt || new Date().toISOString()
  })
}

/**
 * Get all pending requests for a team (admin only)
 */
export async function getPendingTeamRequests(teamId: string): Promise<TeamRequest[]> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated')
  }

  // Check if user is admin or steward
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User document not found'
    )
  }

  const userRole = userDoc.teams?.[teamId] as UserRole | undefined
  if (!userRole || !hasRoleOrHigher(userRole, 'Steward')) {
    throw new PermissionError(
      PermissionErrorCode.INSUFFICIENT_ROLE,
      'Only team Stewards and Admins can view join requests'
    )
  }

  const requestsRef = collection(getFirestoreInstance(), 'teams', teamId, 'joinRequests')
  const q = query(
    requestsRef,
    where('status', '==', 'pending'),
    orderBy('requestedAt', 'desc')
  )

  const snapshot = await getDocs(q)
  const requests: TeamRequest[] = []

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data()
    const requestedAt = data.requestedAt?.toDate?.()?.toISOString() || data.requestedAt
    const reviewedAt = data.reviewedAt?.toDate?.()?.toISOString() || data.reviewedAt
    const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt

    try {
      requests.push(teamRequestSchema.parse({
        id: docSnap.id,
        teamId: data.teamId || teamId,
        userId: data.userId || '',
        status: data.status || 'pending',
        message: data.message,
        adminMessage: data.adminMessage,
        requestedAt: requestedAt || new Date().toISOString(),
        reviewedAt,
        reviewedBy: data.reviewedBy,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString()
      }))
    } catch (err) {
      logger.error('Error parsing team request', {
        requestId: docSnap.id,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  return requests
}

/**
 * Approve a team join request (admin only)
 */
export async function approveTeamRequest(
  teamId: string,
  requestId: string,
  adminMessage?: string
): Promise<TeamRequest> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated')
  }

  // Check permissions
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User document not found'
    )
  }

  const userRole = userDoc.teams?.[teamId] as UserRole | undefined
  if (!userRole || !hasRoleOrHigher(userRole, 'Steward')) {
    throw new PermissionError(
      PermissionErrorCode.INSUFFICIENT_ROLE,
      'Only team Stewards and Admins can approve join requests'
    )
  }

  // Get the request
  const request = await getTeamRequest(teamId, requestId)
  if (!request) {
    throw new Error('Team request not found')
  }

  if (request.status !== 'pending') {
    throw new Error(`Cannot approve request with status: ${request.status}`)
  }

  // Use transaction to update request and add user to team
  await runTransaction(getFirestoreInstance(), async (transaction) => {
    const requestRef = doc(getFirestoreInstance(), 'teams', teamId, 'joinRequests', requestId)
    const requestSnap = await transaction.get(requestRef)

    if (!requestSnap.exists()) {
      throw new Error('Team request not found')
    }

    const requestData = requestSnap.data()
    if (requestData.status !== 'pending') {
      throw new Error(`Cannot approve request with status: ${requestData.status}`)
    }

    // Update request status
    transaction.update(requestRef, {
      status: 'approved',
      adminMessage: adminMessage || null,
      reviewedAt: serverTimestamp(),
      reviewedBy: currentUser.uid,
      updatedAt: serverTimestamp()
    })
  })

  // Add user to team (outside transaction to avoid conflicts)
  try {
    await joinTeam(teamId, 'Contributor')
  } catch (err) {
    // If user is already a member, that's okay
    if (!(err instanceof Error && err.message.includes('already a member'))) {
      throw err
    }
  }

  logger.info('Team join request approved', {
    requestId,
    teamId,
    userId: request.userId,
    reviewedBy: currentUser.uid
  })

  // Return updated request
  const updatedRequest = await getTeamRequest(teamId, requestId)
  if (!updatedRequest) {
    throw new Error('Failed to retrieve updated request')
  }

  return updatedRequest
}

/**
 * Reject a team join request (admin only)
 */
export async function rejectTeamRequest(
  teamId: string,
  requestId: string,
  adminMessage?: string
): Promise<TeamRequest> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated')
  }

  // Check permissions
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User document not found'
    )
  }

  const userRole = userDoc.teams?.[teamId] as UserRole | undefined
  if (!userRole || !hasRoleOrHigher(userRole, 'Steward')) {
    throw new PermissionError(
      PermissionErrorCode.INSUFFICIENT_ROLE,
      'Only team Stewards and Admins can reject join requests'
    )
  }

  // Get the request
  const request = await getTeamRequest(teamId, requestId)
  if (!request) {
    throw new Error('Team request not found')
  }

  if (request.status !== 'pending') {
    throw new Error(`Cannot reject request with status: ${request.status}`)
  }

  // Update request status
  const requestRef = doc(getFirestoreInstance(), 'teams', teamId, 'joinRequests', requestId)
  await updateDoc(requestRef, {
    status: 'rejected',
    adminMessage: adminMessage || null,
    reviewedAt: serverTimestamp(),
    reviewedBy: currentUser.uid,
    updatedAt: serverTimestamp()
  })

  logger.info('Team join request rejected', {
    requestId,
    teamId,
    userId: request.userId,
    reviewedBy: currentUser.uid
  })

  // Return updated request
  const updatedRequest = await getTeamRequest(teamId, requestId)
  if (!updatedRequest) {
    throw new Error('Failed to retrieve updated request')
  }

  return updatedRequest
}

/**
 * Cancel a team join request (user only)
 */
export async function cancelTeamRequest(
  teamId: string,
  requestId: string
): Promise<TeamRequest> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated')
  }

  // Get the request
  const request = await getTeamRequest(teamId, requestId)
  if (!request) {
    throw new Error('Team request not found')
  }

  // Check if user owns the request
  if (request.userId !== currentUser.uid) {
    throw new PermissionError(
      PermissionErrorCode.INSUFFICIENT_ROLE,
      'You can only cancel your own requests'
    )
  }

  if (request.status !== 'pending') {
    throw new Error(`Cannot cancel request with status: ${request.status}`)
  }

  // Update request status
  const requestRef = doc(getFirestoreInstance(), 'teams', teamId, 'joinRequests', requestId)
  await updateDoc(requestRef, {
    status: 'cancelled',
    updatedAt: serverTimestamp()
  })

  logger.info('Team join request cancelled', {
    requestId,
    teamId,
    userId: currentUser.uid
  })

  // Return updated request
  const updatedRequest = await getTeamRequest(teamId, requestId)
  if (!updatedRequest) {
    throw new Error('Failed to retrieve updated request')
  }

  return updatedRequest
}

