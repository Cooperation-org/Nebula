'use client'

import {
  doc,
  collection,
  setDoc,
  getDoc,
  serverTimestamp
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import { getCommitteeEligibleMembers } from './committeeEligibility'
import { selectCommitteeMembers, verifyLotteryResult, type WeightedLotteryResult } from '@/lib/utils/weightedLottery'
import { logger } from '@/lib/utils/logger'
import type { CommitteeEligibilityResult } from '@/lib/utils/committeeEligibility'

/**
 * Committee selection result stored in Firestore
 */
export interface CommitteeSelection {
  id: string
  teamId: string
  committeeName: string
  selectedMembers: string[]
  eligibleMembers: CommitteeEligibilityResult[]
  lotteryResult: WeightedLotteryResult
  createdAt: string
  createdBy: string
}

/**
 * Select committee members via weighted lottery
 * 
 * Story 9.4: Committee Selection via Weighted Lottery - Selection
 * 
 * @param teamId - Team ID
 * @param committeeName - Name of the committee
 * @param numberOfSeats - Number of committee seats to fill
 * @param seed - Optional seed for deterministic selection
 * @param createdBy - User ID who initiated the selection
 * @returns Committee selection result
 */
export async function selectCommittee(
  teamId: string,
  committeeName: string,
  numberOfSeats: number,
  seed?: string,
  createdBy?: string
): Promise<CommitteeSelection> {
  // Get eligible members (Story 9.3)
  const eligibleMembers = await getCommitteeEligibleMembers(teamId)

  if (eligibleMembers.length === 0) {
    throw new Error('No eligible members found for committee selection')
  }

  if (numberOfSeats > eligibleMembers.length) {
    throw new Error(`Cannot select ${numberOfSeats} members from ${eligibleMembers.length} eligible members`)
  }

  // Execute weighted lottery
  const lotteryResult = selectCommitteeMembers(eligibleMembers, numberOfSeats, seed)

  // Verify lottery result
  const isValid = verifyLotteryResult(lotteryResult, eligibleMembers)
  if (!isValid) {
    throw new Error('Lottery result verification failed')
  }

  // Create committee selection document
  const committeeId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'committees'), '_').id
  const now = new Date().toISOString()

  const committeeSelection: CommitteeSelection = {
    id: committeeId,
    teamId,
    committeeName,
    selectedMembers: lotteryResult.selectedMembers,
    eligibleMembers,
    lotteryResult,
    createdAt: now,
    createdBy: createdBy || 'system'
  }

  // Store in Firestore (teams/{teamId}/committees/{committeeId})
  const committeeRef = doc(getFirestoreInstance(), 'teams', teamId, 'committees', committeeId)
  await setDoc(committeeRef, {
    ...committeeSelection,
    createdAt: serverTimestamp()
  })

  // Story 9.5: Create service terms for selected members
  const { createServiceTerm } = await import('./serviceTerms')
  for (const contributorId of lotteryResult.selectedMembers) {
    try {
      await createServiceTerm(
        teamId,
        committeeId,
        committeeName,
        contributorId,
        now // Start date = selection date
      )
    } catch (error) {
      logger.error('Error creating service term for selected member', {
        teamId,
        committeeId,
        contributorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Continue with other members even if one fails
    }
  }

  // Log lottery execution
  logger.info('Committee selected via weighted lottery', {
    teamId,
    committeeId,
    committeeName,
    numberOfSeats,
    eligibleMembers: eligibleMembers.length,
    selectedMembers: lotteryResult.selectedMembers.length,
    lotterySeed: lotteryResult.lotterySeed,
    totalWeight: lotteryResult.totalWeight,
    selectionTimestamp: lotteryResult.selectionTimestamp,
    governanceByWorkflow: true, // FR32: No vote required
    auditable: true
  })

  // Story 9.10: Create audit log for committee selection
  try {
    const { createAuditLog } = await import('./auditLogs')
    // Collect COOK weights from eligible members
    const cookWeights: Record<string, number> = {}
    eligibleMembers.forEach(member => {
      cookWeights[member.contributorId] = member.activeCook
    })
    
    await createAuditLog(
      teamId,
      'committee_selected',
      createdBy || 'system',
      lotteryResult.selectedMembers, // participants
      'selected',
      {
        committeeId,
        committeeName,
        numberOfSeats,
        eligibleMembers: eligibleMembers.length,
        selectedMembers: lotteryResult.selectedMembers,
        lotterySeed: lotteryResult.lotterySeed,
        totalWeight: lotteryResult.totalWeight,
        selectionDetails: lotteryResult.selectionDetails
      },
      cookWeights,
      lotteryResult.totalWeight,
      committeeId,
      'committee',
      { governanceByWorkflow: true }
    )
  } catch (error) {
    logger.error('Error creating audit log for committee selection', {
      teamId,
      committeeId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue even if audit log creation fails
  }

  // Log detailed selection for transparency
  logger.info('Committee selection details', {
    teamId,
    committeeId,
    selectionDetails: lotteryResult.selectionDetails.map(detail => ({
      contributorId: detail.contributorId,
      activeCook: detail.activeCook,
      weight: detail.weight,
      selected: detail.selected,
      randomValue: detail.randomValue
    }))
  })

  // Notifications are sent automatically via Firestore trigger (onCommitteeSelected)
  // when the committee document is created (Story 11B)

  return committeeSelection
}

/**
 * Get committee selection by ID
 * 
 * @param teamId - Team ID
 * @param committeeId - Committee ID
 * @returns Committee selection or null if not found
 */
export async function getCommitteeSelection(
  teamId: string,
  committeeId: string
): Promise<CommitteeSelection | null> {
  const committeeRef = doc(getFirestoreInstance(), 'teams', teamId, 'committees', committeeId)
  const committeeSnap = await getDoc(committeeRef)

  if (!committeeSnap.exists()) {
    return null
  }

  const data = committeeSnap.data()
  const createdAt = data.createdAt?.toDate?.() 
    ? data.createdAt.toDate().toISOString() 
    : (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString())

  return {
    id: committeeSnap.id,
    teamId: data.teamId,
    committeeName: data.committeeName,
    selectedMembers: data.selectedMembers || [],
    eligibleMembers: data.eligibleMembers || [],
    lotteryResult: data.lotteryResult,
    createdAt,
    createdBy: data.createdBy || 'system'
  }
}

