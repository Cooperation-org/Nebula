/**
 * Merkle Tree Utilities
 * 
 * Provides functions to compute Merkle tree hashes for attestations
 * 
 * Story 8.7: Compute Merkle Tree Hash for Attestation
 */

import * as crypto from 'crypto'

/**
 * Compute SHA-256 hash of a string
 */
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex')
}

/**
 * Compute Merkle root hash for an attestation
 * 
 * The Merkle root is computed from the attestation data:
 * - taskId
 * - teamId
 * - contributorId
 * - cookValue
 * - attribution
 * - reviewers (sorted)
 * - issuedAt
 * 
 * This creates a deterministic hash that can be verified later
 * 
 * @param attestationData - Attestation data object
 * @returns Merkle root hash (hex string)
 */
export function computeAttestationMerkleRoot(attestationData: {
  taskId: string
  teamId: string
  contributorId: string
  cookValue: number
  attribution: 'self' | 'spend'
  reviewers: string[]
  issuedAt: string
}): string {
  // Sort reviewers to ensure deterministic hashing
  const sortedReviewers = [...attestationData.reviewers].sort()
  
  // Create a canonical representation of the attestation
  // This ensures deterministic hashing regardless of field order
  const canonicalData = JSON.stringify({
    taskId: attestationData.taskId,
    teamId: attestationData.teamId,
    contributorId: attestationData.contributorId,
    cookValue: attestationData.cookValue,
    attribution: attestationData.attribution,
    reviewers: sortedReviewers,
    issuedAt: attestationData.issuedAt
  })
  
  // Compute hash
  return sha256(canonicalData)
}

/**
 * Compute parent hash for chain structure
 * 
 * The parent hash is the Merkle root of the previous attestation
 * This creates a chain structure where each attestation references the previous one
 * 
 * @param previousMerkleRoot - Merkle root of the previous attestation
 * @returns Parent hash (hex string)
 */
export function computeParentHash(previousMerkleRoot: string): string {
  // For chain structure, parent hash is simply the previous Merkle root
  // This creates a linked chain of attestations
  return previousMerkleRoot
}

/**
 * Get the most recent attestation's Merkle root for a contributor
 * This is used to compute the parent hash for the next attestation
 * 
 * @param contributorId - Contributor user ID
 * @param db - Firestore database instance
 * @param excludeAttestationId - Optional attestation ID to exclude from query (current attestation)
 * @returns Most recent Merkle root or null if no previous attestations
 */
export async function getPreviousAttestationMerkleRoot(
  contributorId: string,
  db: FirebaseFirestore.Firestore,
  excludeAttestationId?: string
): Promise<string | null> {
  const attestationsRef = db.collection('attestations')
  let query = attestationsRef
    .where('contributorId', '==', contributorId)
    .orderBy('issuedAt', 'desc')
    .limit(2) // Get 2 to exclude current if needed
  
  const snapshot = await query.get()
  
  if (snapshot.empty) {
    return null
  }
  
  // If excludeAttestationId is provided, skip the first result if it matches
  let latestDoc = snapshot.docs[0]
  if (excludeAttestationId && latestDoc.id === excludeAttestationId && snapshot.docs.length > 1) {
    latestDoc = snapshot.docs[1]
  }
  
  const latestAttestation = latestDoc.data()
  return latestAttestation.merkleRoot || null
}

/**
 * Verify attestation Merkle root
 * 
 * Recomputes the Merkle root from attestation data and compares with stored root
 * 
 * @param attestationData - Attestation data object
 * @param storedMerkleRoot - Stored Merkle root to verify against
 * @returns True if Merkle root matches, false otherwise
 */
export function verifyAttestationMerkleRoot(
  attestationData: {
    taskId: string
    teamId: string
    contributorId: string
    cookValue: number
    attribution: 'self' | 'spend'
    reviewers: string[]
    issuedAt: string
  },
  storedMerkleRoot: string
): boolean {
  const computedRoot = computeAttestationMerkleRoot(attestationData)
  return computedRoot === storedMerkleRoot
}

