/**
 * Cloud Function to compute Merkle tree hash for attestation
 * 
 * Story 8.7: Compute Merkle Tree Hash for Attestation
 * 
 * Architecture requirement: Hash computation in Cloud Function
 */

import { onRequest } from 'firebase-functions/v2/https'
import { getFirestore } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'
import { logger } from '../../shared/logger'
import {
  computeAttestationMerkleRoot,
  computeParentHash,
  getPreviousAttestationMerkleRoot
} from '../../shared/merkleTree'

if (!getFirestore()) {
  initializeApp()
}

const db = getFirestore()

/**
 * Compute Merkle hash for an attestation
 * 
 * POST /compute-merkle-hash
 * Body: {
 *   attestationId: string
 * }
 * 
 * Or compute for new attestation:
 * Body: {
 *   taskId: string
 *   teamId: string
 *   contributorId: string
 *   cookValue: number
 *   attribution: 'self' | 'spend'
 *   reviewers: string[]
 *   issuedAt: string
 * }
 */
export const computeMerkleHash = onRequest(async (req, res) => {
  try {
    // Only allow POST
    if (req.method !== 'POST') {
      res.status(405).json({ error: 'Method not allowed' })
      return
    }

    const { attestationId, ...attestationData } = req.body

    let data: {
      taskId: string
      teamId: string
      contributorId: string
      cookValue: number
      attribution: 'self' | 'spend'
      reviewers: string[]
      issuedAt: string
    }

    // If attestationId is provided, fetch from Firestore
    if (attestationId) {
      const attestationDoc = await db.collection('attestations').doc(attestationId).get()
      
      if (!attestationDoc.exists) {
        res.status(404).json({ error: 'Attestation not found' })
        return
      }

      const attestation = attestationDoc.data()!
      data = {
        taskId: attestation.taskId,
        teamId: attestation.teamId,
        contributorId: attestation.contributorId,
        cookValue: attestation.cookValue,
        attribution: attestation.attribution,
        reviewers: attestation.reviewers || [],
        issuedAt: attestation.issuedAt?.toDate?.()?.toISOString() || attestation.issuedAt
      }
    } else {
      // Validate required fields
      if (!attestationData.taskId || !attestationData.teamId || !attestationData.contributorId ||
          !attestationData.cookValue || !attestationData.attribution || !attestationData.reviewers ||
          !attestationData.issuedAt) {
        res.status(400).json({ error: 'Missing required attestation fields' })
        return
      }

      data = attestationData
    }

    // Compute Merkle root
    const merkleRoot = computeAttestationMerkleRoot(data)

    // Get previous attestation's Merkle root for parent hash
    const previousMerkleRoot = await getPreviousAttestationMerkleRoot(data.contributorId, db)
    const parentHash = previousMerkleRoot ? computeParentHash(previousMerkleRoot) : undefined

    logger.info('Merkle hash computed for attestation', {
      attestationId: attestationId || 'new',
      taskId: data.taskId,
      contributorId: data.contributorId,
      merkleRoot,
      parentHash: parentHash || 'none',
      hasPrevious: previousMerkleRoot !== null
    })

    res.status(200).json({
      merkleRoot,
      parentHash
    })
  } catch (error) {
    logger.error('Error computing Merkle hash', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    res.status(500).json({
      error: 'Failed to compute Merkle hash',
      message: error instanceof Error ? error.message : 'Unknown error'
    })
  }
})

