/**
 * COOK Decay Utilities
 *
 * Provides functions to calculate and apply decay functions to historical COOK
 * Recent contributions have more weight than older ones
 *
 * Story 8.5: Apply COOK Decay Functions
 */

import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import type { Team } from '@/lib/types/team'

/**
 * COOK decay calculation result
 */
export interface CookDecayResult {
  rawCook: number // Total COOK without decay (historical accuracy)
  decayedCook: number // COOK with decay applied (for governance)
  decayAmount: number // Total amount of COOK lost to decay
  decayRate: number | null // The decay rate (null if no decay configured)
  entriesWithDecay: Array<{
    entry: CookLedgerEntry
    rawValue: number
    decayedValue: number
    decayApplied: number
    ageInMonths: number
  }>
}

/**
 * Calculate decay factor for an entry based on its age
 * Uses exponential decay: decayFactor = e^(-decayRate * ageInMonths)
 *
 * @param ageInMonths - Age of the entry in months
 * @param decayRate - Decay rate per month (e.g., 0.05 = 5% per month)
 * @returns Decay factor (0-1, where 1 = no decay, 0 = fully decayed)
 */
function calculateDecayFactor(ageInMonths: number, decayRate: number): number {
  if (decayRate <= 0) {
    return 1 // No decay
  }

  // Exponential decay: e^(-decayRate * ageInMonths)
  // This ensures older entries decay more
  return Math.exp(-decayRate * ageInMonths)
}

/**
 * Calculate COOK totals with decay applied
 *
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with decay configuration
 * @returns COOK decay calculation result
 */
export function calculateCookWithDecay(
  entries: CookLedgerEntry[],
  team: Team | null
): CookDecayResult {
  const rawCook = entries.reduce((sum, entry) => sum + entry.cookValue, 0)
  const decayRate = team?.cookDecayRate || null
  const now = new Date()

  if (!decayRate || decayRate <= 0) {
    // No decay configured - all COOK counts at full value
    return {
      rawCook,
      decayedCook: rawCook,
      decayAmount: 0,
      decayRate: null,
      entriesWithDecay: entries.map(entry => ({
        entry,
        rawValue: entry.cookValue,
        decayedValue: entry.cookValue,
        decayApplied: 0,
        ageInMonths: 0
      }))
    }
  }

  // Calculate decay for each entry
  let decayedCook = 0
  let totalDecayAmount = 0
  const entriesWithDecay = entries.map(entry => {
    const entryDate = new Date(entry.issuedAt)
    const ageInMonths =
      (now.getTime() - entryDate.getTime()) / (1000 * 60 * 60 * 24 * 30.44) // Average days per month

    const decayFactor = calculateDecayFactor(ageInMonths, decayRate)
    const decayedValue = entry.cookValue * decayFactor
    const decayApplied = entry.cookValue - decayedValue

    decayedCook += decayedValue
    totalDecayAmount += decayApplied

    return {
      entry,
      rawValue: entry.cookValue,
      decayedValue,
      decayApplied,
      ageInMonths
    }
  })

  return {
    rawCook,
    decayedCook,
    decayAmount: totalDecayAmount,
    decayRate,
    entriesWithDecay
  }
}

/**
 * Get effective COOK for governance (with decay applied)
 * This is the COOK that counts toward governance weight
 *
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with decay configuration
 * @returns Effective COOK amount (with decay)
 */
export function getEffectiveCookWithDecay(
  entries: CookLedgerEntry[],
  team: Team | null
): number {
  const result = calculateCookWithDecay(entries, team)
  return result.decayedCook
}

/**
 * Get raw COOK total (without decay)
 * This preserves historical accuracy
 *
 * @param entries - Array of COOK ledger entries for a contributor
 * @returns Raw COOK total
 */
export function getRawCook(entries: CookLedgerEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.cookValue, 0)
}
