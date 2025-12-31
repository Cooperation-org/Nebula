/**
 * Weighted Lottery Utilities
 *
 * Provides deterministic, auditable weighted lottery selection
 *
 * Story 9.4: Committee Selection via Weighted Lottery - Selection
 */

import type { CommitteeEligibilityResult } from './committeeEligibility'

/**
 * Weighted lottery selection result
 */
export interface WeightedLotteryResult {
  selectedMembers: string[] // Contributor IDs selected
  selectionDetails: Array<{
    contributorId: string
    activeCook: number
    weight: number
    cumulativeWeight: number
    randomValue: number
    selected: boolean
  }>
  lotterySeed: string // Deterministic seed for reproducibility
  totalWeight: number
  selectionTimestamp: string
}

/**
 * Generate a deterministic random number from a seed
 * Uses a simple linear congruential generator (LCG) for determinism
 *
 * @param seed - Seed value (string or number)
 * @param index - Index for generating multiple random numbers from same seed
 * @returns Random number between 0 and 1
 */
function seededRandom(seed: string | number, index: number = 0): number {
  // Convert seed to number if string
  let seedNum: number
  if (typeof seed === 'string') {
    // Hash string to number
    let hash = 0
    for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // Convert to 32-bit integer
    }
    seedNum = Math.abs(hash) + index
  } else {
    seedNum = seed + index
  }

  // LCG parameters (from Numerical Recipes)
  const a = 1664525
  const c = 1013904223
  const m = Math.pow(2, 32)

  // Generate random number
  const random = ((a * seedNum + c) % m) / m
  return random
}

/**
 * Select committee members via weighted lottery
 *
 * Selection probability is proportional to active COOK (FR60)
 * Algorithm is deterministic and auditable
 *
 * @param eligibleMembers - Array of eligible members with their active COOK
 * @param numberOfSeats - Number of committee seats to fill
 * @param seed - Optional seed for deterministic selection (default: current timestamp)
 * @returns Weighted lottery result with selected members and audit trail
 */
export function selectCommitteeMembers(
  eligibleMembers: CommitteeEligibilityResult[],
  numberOfSeats: number,
  seed?: string
): WeightedLotteryResult {
  if (eligibleMembers.length === 0) {
    throw new Error('No eligible members for committee selection')
  }

  if (numberOfSeats <= 0) {
    throw new Error('Number of seats must be positive')
  }

  if (numberOfSeats > eligibleMembers.length) {
    throw new Error(
      `Cannot select ${numberOfSeats} members from ${eligibleMembers.length} eligible members`
    )
  }

  // Generate deterministic seed if not provided
  const lotterySeed = seed || new Date().toISOString()
  const selectionTimestamp = new Date().toISOString()

  // Calculate total weight (sum of all active COOK)
  const totalWeight = eligibleMembers.reduce((sum, member) => sum + member.activeCook, 0)

  if (totalWeight === 0) {
    throw new Error('Total active COOK is zero - cannot perform weighted selection')
  }

  // Create selection details with weights
  const selectionDetails: WeightedLotteryResult['selectionDetails'] = []
  let cumulativeWeight = 0

  for (const member of eligibleMembers) {
    cumulativeWeight += member.activeCook
    selectionDetails.push({
      contributorId: member.contributorId,
      activeCook: member.activeCook,
      weight: member.activeCook,
      cumulativeWeight,
      randomValue: 0, // Will be set during selection
      selected: false
    })
  }

  // Select members using weighted lottery
  const selectedMembers: string[] = []
  const availableMembers = [...eligibleMembers]
  const availableDetails = [...selectionDetails]

  for (let seatIndex = 0; seatIndex < numberOfSeats; seatIndex++) {
    // Calculate current total weight (excluding already selected members)
    const currentTotalWeight = availableMembers.reduce(
      (sum, member) => sum + member.activeCook,
      0
    )

    if (currentTotalWeight === 0) {
      // If no weight left, select randomly from remaining members
      const randomIndex = Math.floor(
        seededRandom(lotterySeed, seatIndex) * availableMembers.length
      )
      const selected = availableMembers[randomIndex]
      selectedMembers.push(selected.contributorId)

      // Mark as selected in details
      const detailIndex = selectionDetails.findIndex(
        d => d.contributorId === selected.contributorId
      )
      if (detailIndex >= 0) {
        selectionDetails[detailIndex].randomValue = seededRandom(lotterySeed, seatIndex)
        selectionDetails[detailIndex].selected = true
      }

      // Remove from available pool
      availableMembers.splice(randomIndex, 1)
      availableDetails.splice(randomIndex, 1)
      continue
    }

    // Generate random value between 0 and current total weight
    const randomValue = seededRandom(lotterySeed, seatIndex) * currentTotalWeight

    // Find member whose cumulative weight range contains the random value
    let cumulative = 0
    let selectedIndex = -1

    for (let i = 0; i < availableMembers.length; i++) {
      cumulative += availableMembers[i].activeCook
      if (randomValue <= cumulative) {
        selectedIndex = i
        break
      }
    }

    // Fallback to last member if no match (shouldn't happen, but safety check)
    if (selectedIndex === -1) {
      selectedIndex = availableMembers.length - 1
    }

    const selected = availableMembers[selectedIndex]
    selectedMembers.push(selected.contributorId)

    // Mark as selected in details
    const detailIndex = selectionDetails.findIndex(
      d => d.contributorId === selected.contributorId
    )
    if (detailIndex >= 0) {
      selectionDetails[detailIndex].randomValue = randomValue
      selectionDetails[detailIndex].selected = true
    }

    // Remove selected member from available pool (no replacement - each member can only be selected once)
    availableMembers.splice(selectedIndex, 1)
    availableDetails.splice(selectedIndex, 1)
  }

  return {
    selectedMembers,
    selectionDetails,
    lotterySeed,
    totalWeight,
    selectionTimestamp
  }
}

/**
 * Verify lottery result (for audit purposes)
 *
 * @param result - Weighted lottery result to verify
 * @param eligibleMembers - Original eligible members
 * @returns True if result is valid
 */
export function verifyLotteryResult(
  result: WeightedLotteryResult,
  eligibleMembers: CommitteeEligibilityResult[]
): boolean {
  // Check that all selected members were eligible
  const eligibleIds = new Set(eligibleMembers.map(m => m.contributorId))
  for (const selectedId of result.selectedMembers) {
    if (!eligibleIds.has(selectedId)) {
      return false
    }
  }

  // Check that no member was selected twice
  const selectedSet = new Set(result.selectedMembers)
  if (selectedSet.size !== result.selectedMembers.length) {
    return false
  }

  // Check that total weight matches
  const calculatedTotalWeight = eligibleMembers.reduce(
    (sum, member) => sum + member.activeCook,
    0
  )
  if (Math.abs(calculatedTotalWeight - result.totalWeight) > 0.0001) {
    return false
  }

  return true
}
