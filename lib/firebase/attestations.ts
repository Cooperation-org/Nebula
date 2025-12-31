'use client'

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import type { Attestation, AttestationDocument } from '@/lib/types/attestation'
import { attestationDocumentSchema, attestationSchema } from '@/lib/schemas/attestation'
import { logger } from '@/lib/utils/logger'

/**
 * Issue an attestation when a task is completed and COOK is issued
 *
 * Story 8.6: Issue Verifiable Attestation on Task Completion
 *
 * @param taskId - Task ID
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @param cookValue - COOK value issued
 * @param attribution - COOK attribution ('self' or 'spend')
 * @param reviewers - Array of reviewer user IDs
 * @param taskTitle - Optional task title for display
 * @param teamName - Optional team name for display
 * @param merkleRoot - Optional Merkle tree root hash (Story 8.7)
 * @param parentHash - Optional parent hash for chain structure (Story 8.7)
 * @returns Created attestation
 */
export async function issueAttestation(
  taskId: string,
  teamId: string,
  contributorId: string,
  cookValue: number,
  attribution: 'self' | 'spend',
  reviewers: string[],
  taskTitle?: string,
  teamName?: string,
  merkleRoot?: string,
  parentHash?: string
): Promise<Attestation> {
  // Validate inputs
  if (cookValue <= 0) {
    throw new Error('COOK value must be positive')
  }

  if (!attribution || (attribution !== 'self' && attribution !== 'spend')) {
    throw new Error('Attribution must be "self" or "spend"')
  }

  if (!reviewers || reviewers.length === 0) {
    throw new Error('At least one reviewer is required for attestation')
  }

  // Generate attestation ID
  const attestationId = doc(collection(getFirestoreInstance(), 'attestations'), '_').id

  const now = new Date().toISOString()
  const attestationDoc: AttestationDocument = {
    taskId,
    teamId,
    contributorId,
    cookValue,
    attribution,
    reviewers,
    merkleRoot,
    parentHash,
    issuedAt: now,
    taskTitle,
    teamName
  }

  // Validate with Zod schema
  const validatedDoc = attestationDocumentSchema.parse(attestationDoc)

  // Create attestation document in root collection (for portability - FR57)
  const attestationRef = doc(getFirestoreInstance(), 'attestations', attestationId)
  await setDoc(attestationRef, {
    ...validatedDoc,
    issuedAt: serverTimestamp()
  })

  // Log attestation issuance (FR55, NFR5)
  logger.info('Attestation issued', {
    attestationId,
    taskId,
    teamId,
    contributorId,
    cookValue,
    attribution,
    reviewers: reviewers.length,
    merkleRoot: merkleRoot ? 'present' : 'pending', // Story 8.7
    parentHash: parentHash ? 'present' : 'none',
    timestamp: now,
    portable: true // FR57
  })

  // Return attestation object with ID
  const attestation: Attestation = {
    id: attestationId,
    ...validatedDoc
  }

  return attestation
}

/**
 * Get all attestations for a contributor
 * Returns attestations across all teams (portability - FR57)
 *
 * @param contributorId - Contributor user ID
 * @returns Array of attestations, sorted by issuedAt (newest first)
 */
export async function getAttestationsForContributor(
  contributorId: string
): Promise<Attestation[]> {
  const attestationsRef = collection(getFirestoreInstance(), 'attestations')
  const q = query(
    attestationsRef,
    where('contributorId', '==', contributorId),
    orderBy('issuedAt', 'desc')
  )

  const querySnapshot = await getDocs(q)

  const attestations: Attestation[] = []
  querySnapshot.forEach(doc => {
    const data = doc.data()
    const attestation: Attestation = {
      id: doc.id,
      taskId: data.taskId,
      teamId: data.teamId,
      contributorId: data.contributorId,
      cookValue: data.cookValue,
      attribution: data.attribution,
      reviewers: data.reviewers || [],
      merkleRoot: data.merkleRoot,
      parentHash: data.parentHash,
      issuedAt: data.issuedAt?.toDate?.()
        ? data.issuedAt.toDate().toISOString()
        : data.issuedAt,
      taskTitle: data.taskTitle,
      teamName: data.teamName
    }

    // Validate with schema
    try {
      const validatedAttestation = attestationSchema.parse(attestation)
      attestations.push(validatedAttestation)
    } catch (error) {
      logger.warn('Invalid attestation skipped', {
        attestationId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return attestations
}

/**
 * Subscribe to attestations for a contributor (real-time updates)
 * Returns an unsubscribe function
 *
 * @param contributorId - Contributor user ID
 * @param callback - Callback function called with array of attestations whenever data changes
 * @returns Unsubscribe function
 */
export function subscribeToAttestations(
  contributorId: string,
  callback: (attestations: Attestation[]) => void
): () => void {
  const attestationsRef = collection(getFirestoreInstance(), 'attestations')
  const q = query(
    attestationsRef,
    where('contributorId', '==', contributorId),
    orderBy('issuedAt', 'desc')
  )

  const unsubscribe = onSnapshot(
    q,
    querySnapshot => {
      const attestations: Attestation[] = []
      querySnapshot.forEach(doc => {
        const data = doc.data()
        const attestation: Attestation = {
          id: doc.id,
          taskId: data.taskId,
          teamId: data.teamId,
          contributorId: data.contributorId,
          cookValue: data.cookValue,
          attribution: data.attribution,
          reviewers: data.reviewers || [],
          merkleRoot: data.merkleRoot,
          parentHash: data.parentHash,
          issuedAt: data.issuedAt?.toDate?.()
            ? data.issuedAt.toDate().toISOString()
            : data.issuedAt,
          taskTitle: data.taskTitle,
          teamName: data.teamName
        }

        // Validate with schema
        try {
          const validatedAttestation = attestationSchema.parse(attestation)
          attestations.push(validatedAttestation)
        } catch (error) {
          logger.warn('Invalid attestation skipped', {
            attestationId: doc.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })

      callback(attestations)
    },
    error => {
      logger.error('Error subscribing to attestations', {
        contributorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      callback([])
    }
  )

  return unsubscribe
}

/**
 * Get attestation by ID
 *
 * @param attestationId - Attestation ID
 * @returns Attestation or null if not found
 */
export async function getAttestation(attestationId: string): Promise<Attestation | null> {
  const attestationRef = doc(getFirestoreInstance(), 'attestations', attestationId)
  const attestationSnap = await getDoc(attestationRef)

  if (!attestationSnap.exists()) {
    return null
  }

  const data = attestationSnap.data()
  const attestation: Attestation = {
    id: attestationSnap.id,
    taskId: data.taskId,
    teamId: data.teamId,
    contributorId: data.contributorId,
    cookValue: data.cookValue,
    attribution: data.attribution,
    reviewers: data.reviewers || [],
    merkleRoot: data.merkleRoot,
    parentHash: data.parentHash,
    issuedAt: data.issuedAt?.toDate?.()
      ? data.issuedAt.toDate().toISOString()
      : data.issuedAt,
    taskTitle: data.taskTitle,
    teamName: data.teamName
  }

  // Validate with schema
  try {
    return attestationSchema.parse(attestation)
  } catch (error) {
    logger.warn('Invalid attestation data', {
      attestationId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}
