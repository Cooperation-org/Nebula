/**
 * Governance Weight Utilities
 *
 * Provides functions to calculate governance weight from COOK totals
 *
 * Story 9.1: Calculate Governance Weight from COOK Totals
 */

import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import type { Team } from '@/lib/types/team'
import { getEffectiveCookWithCapAndDecay } from './cookCaps'

/**
 * Governance weight calculation result
 */
export interface GovernanceWeightResult {
  weight: number // Governance weight (effective COOK with cap and decay)
  rawCook: number // Raw COOK total (before cap and decay)
  effectiveCook: number // Effective COOK (after cap and decay)
  capApplied: boolean // Whether cap was applied
  decayApplied: boolean // Whether decay was applied
}

/**
 * Calculate governance weight from COOK ledger entries
 *
 * Governance weight = Effective COOK (with cap and decay applied)
 *
 * Process:
 * 1. Apply decay to historical COOK (if configured)
 * 2. Apply cap to decayed COOK (if configured)
 * 3. Result is governance weight
 *
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with cap and decay configuration
 * @returns Governance weight calculation result
 */
export async function calculateGovernanceWeight(
  entries: CookLedgerEntry[],
  team: Team | null
): Promise<GovernanceWeightResult> {
  // Get raw COOK total
  const rawCook = entries.reduce((sum, entry) => sum + entry.cookValue, 0)

  // Get effective COOK (with cap and decay applied)
  // This applies decay first, then cap
  const effectiveCook = await getEffectiveCookWithCapAndDecay(entries, team)

  // Check if cap or decay were applied
  const capApplied = team?.cookCap !== null && team?.cookCap !== undefined
  const decayApplied =
    team?.cookDecayRate !== null &&
    team?.cookDecayRate !== undefined &&
    (team?.cookDecayRate ?? 0) > 0

  return {
    weight: effectiveCook, // Governance weight = effective COOK
    rawCook,
    effectiveCook,
    capApplied,
    decayApplied
  }
}

/**
 * Get governance weight for a contributor in a team
 * This is a convenience function that calculates weight from entries
 *
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with cap and decay configuration
 * @returns Governance weight (number)
 */
export async function getGovernanceWeight(
  entries: CookLedgerEntry[],
  team: Team | null
): Promise<number> {
  const result = await calculateGovernanceWeight(entries, team)
  return result.weight
}
