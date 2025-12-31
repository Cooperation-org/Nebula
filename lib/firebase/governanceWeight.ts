'use client'

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import { getCookLedgerEntries } from './cookLedger'
import { getTeam } from './teams'
import { calculateGovernanceWeight } from '@/lib/utils/governanceWeight'
import type {
  GovernanceWeight,
  GovernanceWeightDocument
} from '@/lib/types/governanceWeight'
import {
  governanceWeightDocumentSchema,
  governanceWeightSchema
} from '@/lib/schemas/governanceWeight'
import { logger } from '@/lib/utils/logger'

/**
 * Calculate and store governance weight for a contributor in a team
 *
 * Story 9.1: Calculate Governance Weight from COOK Totals
 *
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @returns Updated governance weight
 */
export async function updateGovernanceWeight(
  teamId: string,
  contributorId: string
): Promise<GovernanceWeight> {
  // Get COOK ledger entries for the contributor
  const entries = await getCookLedgerEntries(teamId, contributorId)

  // Get team configuration (for cap and decay)
  const team = await getTeam(teamId)

  // Calculate governance weight
  const weightResult = await calculateGovernanceWeight(entries, team)

  // Create governance weight document
  const now = new Date().toISOString()
  const weightDoc: GovernanceWeightDocument = {
    teamId,
    weight: weightResult.weight,
    rawCook: weightResult.rawCook,
    effectiveCook: weightResult.effectiveCook,
    capApplied: weightResult.capApplied,
    decayApplied: weightResult.decayApplied,
    lastUpdated: now
  }

  // Validate with Zod schema
  const validatedDoc = governanceWeightDocumentSchema.parse(weightDoc)

  // Store in Firestore (teams/{teamId}/governanceWeights/{contributorId})
  const weightRef = doc(
    getFirestoreInstance(),
    'teams',
    teamId,
    'governanceWeights',
    contributorId
  )
  await setDoc(weightRef, {
    ...validatedDoc,
    lastUpdated: serverTimestamp()
  })

  // Log governance weight update
  logger.info('Governance weight updated', {
    teamId,
    contributorId,
    weight: weightResult.weight,
    rawCook: weightResult.rawCook,
    effectiveCook: weightResult.effectiveCook,
    capApplied: weightResult.capApplied,
    decayApplied: weightResult.decayApplied,
    timestamp: now
  })

  // Story 9.10: Create audit log for governance weight update
  try {
    const { createAuditLog } = await import('./auditLogs')
    await createAuditLog(
      teamId,
      'governance_weight_updated',
      'system',
      [contributorId], // participants
      'updated',
      {
        contributorId,
        weight: weightResult.weight,
        rawCook: weightResult.rawCook,
        effectiveCook: weightResult.effectiveCook,
        capApplied: weightResult.capApplied,
        decayApplied: weightResult.decayApplied
      },
      { [contributorId]: weightResult.weight }, // cookWeights
      weightResult.effectiveCook, // totalWeight
      contributorId,
      'governance_weight',
      { automatic: true }
    )
  } catch (error) {
    logger.error('Error creating audit log for governance weight update', {
      teamId,
      contributorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue even if audit log creation fails
  }

  // Story 9.2: Update team equity when governance weight is updated
  // Equity is calculated for all contributors together, so we update the whole team
  try {
    const { updateTeamEquity } = await import('./equity')
    await updateTeamEquity(teamId)
    logger.info('Team equity updated after governance weight update', {
      teamId,
      contributorId
    })
  } catch (error) {
    // Log error but don't fail governance weight update if equity update fails
    logger.error('Failed to update team equity after governance weight update', {
      teamId,
      contributorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Return governance weight object with contributorId
  const weight: GovernanceWeight = {
    contributorId,
    ...validatedDoc
  }

  return weight
}

/**
 * Get governance weight for a contributor in a team
 *
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @returns Governance weight or null if not found
 */
export async function getGovernanceWeight(
  teamId: string,
  contributorId: string
): Promise<GovernanceWeight | null> {
  const weightRef = doc(
    getFirestoreInstance(),
    'teams',
    teamId,
    'governanceWeights',
    contributorId
  )
  const weightSnap = await getDoc(weightRef)

  if (!weightSnap.exists()) {
    return null
  }

  const data = weightSnap.data()
  const weight: GovernanceWeight = {
    contributorId: weightSnap.id,
    teamId: data.teamId,
    weight: data.weight,
    rawCook: data.rawCook,
    effectiveCook: data.effectiveCook,
    capApplied: data.capApplied,
    decayApplied: data.decayApplied,
    lastUpdated: data.lastUpdated?.toDate?.()
      ? data.lastUpdated.toDate().toISOString()
      : data.lastUpdated
  }

  // Validate with schema
  try {
    return governanceWeightSchema.parse(weight)
  } catch (error) {
    logger.warn('Invalid governance weight data', {
      teamId,
      contributorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Get all governance weights for a team
 *
 * @param teamId - Team ID
 * @returns Array of governance weights for all contributors in the team
 */
export async function getTeamGovernanceWeights(
  teamId: string
): Promise<GovernanceWeight[]> {
  const weightsRef = collection(
    getFirestoreInstance(),
    'teams',
    teamId,
    'governanceWeights'
  )
  const querySnapshot = await getDocs(weightsRef)

  const weights: GovernanceWeight[] = []
  querySnapshot.forEach(doc => {
    const data = doc.data()
    const weight: GovernanceWeight = {
      contributorId: doc.id,
      teamId: data.teamId,
      weight: data.weight,
      rawCook: data.rawCook,
      effectiveCook: data.effectiveCook,
      capApplied: data.capApplied,
      decayApplied: data.decayApplied,
      lastUpdated: data.lastUpdated?.toDate?.()
        ? data.lastUpdated.toDate().toISOString()
        : data.lastUpdated
    }

    // Validate with schema
    try {
      const validatedWeight = governanceWeightSchema.parse(weight)
      weights.push(validatedWeight)
    } catch (error) {
      logger.warn('Invalid governance weight skipped', {
        teamId,
        contributorId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return weights
}
