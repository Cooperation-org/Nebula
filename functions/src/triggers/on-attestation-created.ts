/**
 * Firestore Trigger: Compute Merkle hash when attestation is created
 *
 * Story 8.7: Compute Merkle Tree Hash for Attestation
 *
 * Architecture requirement: Hash computation in Cloud Function
 */

import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'
import { logger } from '../shared/logger'
import {
  computeAttestationMerkleRoot,
  computeParentHash,
  getPreviousAttestationMerkleRoot
} from '../shared/merkleTree'

if (!getFirestore()) {
  initializeApp()
}

const db = getFirestore()

/**
 * Trigger: When an attestation is created, compute Merkle hash if not present
 */
export const onAttestationCreated = onDocumentCreated(
  'attestations/{attestationId}',
  async event => {
    const attestationId = event.params.attestationId
    const attestationData = event.data?.data()

    if (!attestationData) {
      logger.warn('Attestation created without data', { attestationId })
      return
    }

    // If Merkle root already exists, skip computation
    if (attestationData.merkleRoot) {
      logger.info('Attestation already has Merkle root, skipping computation', {
        attestationId,
        merkleRoot: attestationData.merkleRoot
      })
      return
    }

    try {
      // Extract attestation data for Merkle root computation
      const issuedAt =
        attestationData.issuedAt?.toDate?.()?.toISOString() || attestationData.issuedAt

      const data = {
        taskId: attestationData.taskId,
        teamId: attestationData.teamId,
        contributorId: attestationData.contributorId,
        cookValue: attestationData.cookValue,
        attribution: attestationData.attribution,
        reviewers: attestationData.reviewers || [],
        issuedAt
      }

      // Compute Merkle root
      const merkleRoot = computeAttestationMerkleRoot(data)

      // Get previous attestation's Merkle root for parent hash
      // Exclude current attestation from query
      const previousMerkleRoot = await getPreviousAttestationMerkleRoot(
        data.contributorId,
        db,
        attestationId
      )
      const parentHash = previousMerkleRoot
        ? computeParentHash(previousMerkleRoot)
        : undefined

      // Update attestation with Merkle root and parent hash
      await db
        .collection('attestations')
        .doc(attestationId)
        .update({
          merkleRoot,
          parentHash: parentHash || null
        })

      logger.info('Merkle hash computed and stored for attestation', {
        attestationId,
        taskId: data.taskId,
        contributorId: data.contributorId,
        merkleRoot,
        parentHash: parentHash || 'none',
        hasPrevious: previousMerkleRoot !== null
      })
    } catch (error) {
      logger.error('Error computing Merkle hash for attestation', {
        attestationId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      // Don't throw - we don't want to fail the attestation creation
    }
  }
)
