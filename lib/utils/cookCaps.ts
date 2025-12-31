/**
 * COOK Caps Utilities
 * 
 * Provides functions to calculate and apply COOK caps to prevent dominance
 * 
 * Story 8.4: Apply COOK Caps to Prevent Dominance
 */

import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import type { Team } from '@/lib/types/team'

/**
 * COOK cap calculation result
 */
export interface CookCapResult {
  totalCook: number // Total COOK earned (uncapped)
  cappedCook: number // COOK that counts toward governance (capped)
  uncappedCook: number // COOK above cap (tracked but doesn't count)
  capAmount: number | null // The cap amount (null if no cap)
  isCapped: boolean // Whether contributor has reached the cap
  capPercentage: number // Percentage of cap used (0-100, or >100 if over cap)
}

/**
 * Calculate COOK totals with cap applied
 * 
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with cap configuration
 * @returns COOK cap calculation result
 */
export function calculateCookWithCap(
  entries: CookLedgerEntry[],
  team: Team | null
): CookCapResult {
  const totalCook = entries.reduce((sum, entry) => sum + entry.cookValue, 0)
  const capAmount = team?.cookCap || null

  if (!capAmount) {
    // No cap configured - all COOK counts
    return {
      totalCook,
      cappedCook: totalCook,
      uncappedCook: 0,
      capAmount: null,
      isCapped: false,
      capPercentage: 0
    }
  }

  // Apply cap: COOK above cap is tracked but doesn't count toward governance
  const cappedCook = Math.min(totalCook, capAmount)
  const uncappedCook = Math.max(0, totalCook - capAmount)
  const isCapped = totalCook >= capAmount
  const capPercentage = (totalCook / capAmount) * 100

  return {
    totalCook,
    cappedCook,
    uncappedCook,
    capAmount,
    isCapped,
    capPercentage
  }
}

/**
 * Get effective COOK for governance (capped amount)
 * This is the COOK that counts toward governance weight
 * Note: This applies only caps. For decay, use getEffectiveCookWithDecay from cookDecay.ts
 * For both cap and decay, apply decay first, then cap
 * 
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with cap configuration
 * @returns Effective COOK amount (capped)
 */
export function getEffectiveCook(
  entries: CookLedgerEntry[],
  team: Team | null
): number {
  const result = calculateCookWithCap(entries, team)
  return result.cappedCook
}

/**
 * Get effective COOK for governance (with both cap and decay applied)
 * Applies decay first, then cap
 * This is the COOK that counts toward governance weight
 * 
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with cap and decay configuration
 * @returns Effective COOK amount (with decay and cap)
 */
export async function getEffectiveCookWithCapAndDecay(
  entries: CookLedgerEntry[],
  team: Team | null
): Promise<number> {
  // Import decay utilities
  const { calculateCookWithDecay } = await import('./cookDecay')
  
  // Apply decay first
  const decayResult = calculateCookWithDecay(entries, team)
  
  // Create virtual entries with decayed values for cap calculation
  const decayedEntries: CookLedgerEntry[] = decayResult.entriesWithDecay.map((item) => ({
    ...item.entry,
    cookValue: item.decayedValue
  }))
  
  // Apply cap to decayed COOK
  const capResult = calculateCookWithCap(decayedEntries, team)
  
  return capResult.cappedCook
}

/**
 * Check if a contributor has reached their COOK cap
 * 
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with cap configuration
 * @returns True if contributor has reached or exceeded the cap
 */
export function isCookCapped(
  entries: CookLedgerEntry[],
  team: Team | null
): boolean {
  const result = calculateCookWithCap(entries, team)
  return result.isCapped
}

/**
 * Get the amount of COOK above the cap (uncapped COOK)
 * 
 * @param entries - Array of COOK ledger entries for a contributor
 * @param team - Team document with cap configuration
 * @returns Amount of COOK above cap
 */
export function getUncappedCook(
  entries: CookLedgerEntry[],
  team: Team | null
): number {
  const result = calculateCookWithCap(entries, team)
  return result.uncappedCook
}

