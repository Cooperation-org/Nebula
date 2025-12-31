/**
 * Committee Eligibility Utilities
 * 
 * Provides functions to determine committee eligibility based on active COOK
 * 
 * Story 9.3: Committee Selection via Weighted Lottery - Eligibility
 */

import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import type { Team } from '@/lib/types/team'

/**
 * Committee eligibility result
 */
export interface CommitteeEligibilityResult {
  contributorId: string
  isEligible: boolean
  activeCook: number // COOK earned in recent window
  totalCook: number // Total COOK (for reference)
  recentWindowMonths: number // Recent window in months
  exclusionReasons: string[] // Reasons for exclusion (if not eligible)
}

/**
 * Calculate active COOK in recent time window
 * 
 * @param entries - Array of COOK ledger entries for a contributor
 * @param recentWindowMonths - Recent window in months (e.g., 6 for last 6 months)
 * @returns Active COOK earned in the recent window
 */
export function calculateActiveCook(
  entries: CookLedgerEntry[],
  recentWindowMonths: number
): number {
  if (recentWindowMonths <= 0) {
    // If window is 0 or negative, consider all COOK as active
    return entries.reduce((sum, entry) => sum + entry.cookValue, 0)
  }

  const now = new Date()
  const windowStart = new Date(now)
  windowStart.setMonth(windowStart.getMonth() - recentWindowMonths)

  // Sum COOK earned within the recent window
  return entries
    .filter((entry) => {
      const entryDate = new Date(entry.issuedAt)
      return entryDate >= windowStart
    })
    .reduce((sum, entry) => sum + entry.cookValue, 0)
}

/**
 * Check if a contributor has active COOK in recent window
 * 
 * @param entries - Array of COOK ledger entries for a contributor
 * @param recentWindowMonths - Recent window in months
 * @param minimumActiveCook - Minimum COOK required to be eligible (default: > 0)
 * @returns True if contributor has active COOK above minimum
 */
export function hasActiveCook(
  entries: CookLedgerEntry[],
  recentWindowMonths: number,
  minimumActiveCook: number = 0
): boolean {
  const activeCook = calculateActiveCook(entries, recentWindowMonths)
  return activeCook > minimumActiveCook
}

/**
 * Check committee eligibility for a contributor
 * 
 * @param contributorId - Contributor user ID
 * @param entries - Array of COOK ledger entries for the contributor
 * @param recentWindowMonths - Recent window in months (from team config)
 * @param exclusions - Map of exclusion reasons (contributorId -> reasons[])
 * @param minimumActiveCook - Minimum COOK required (default: > 0)
 * @returns Committee eligibility result
 */
export function checkCommitteeEligibility(
  contributorId: string,
  entries: CookLedgerEntry[],
  recentWindowMonths: number,
  exclusions: Map<string, string[]> = new Map(),
  minimumActiveCook: number = 0
): CommitteeEligibilityResult {
  const totalCook = entries.reduce((sum, entry) => sum + entry.cookValue, 0)
  const activeCook = calculateActiveCook(entries, recentWindowMonths)
  
  const exclusionReasons: string[] = []
  
  // Check if contributor has active COOK
  if (activeCook <= minimumActiveCook) {
    exclusionReasons.push(`Insufficient active COOK in recent ${recentWindowMonths} months (${activeCook.toFixed(2)} COOK)`)
  }
  
  // Check exclusions
  const contributorExclusions = exclusions.get(contributorId) || []
  exclusionReasons.push(...contributorExclusions)
  
  const isEligible = exclusionReasons.length === 0

  return {
    contributorId,
    isEligible,
    activeCook,
    totalCook,
    recentWindowMonths,
    exclusionReasons
  }
}

/**
 * Get all eligible members for committee selection
 * 
 * @param contributorsEntries - Map of contributor entries (contributorId -> entries[])
 * @param recentWindowMonths - Recent window in months (from team config)
 * @param exclusions - Map of exclusion reasons (contributorId -> reasons[])
 * @param minimumActiveCook - Minimum COOK required (default: > 0)
 * @returns Array of eligible members with their eligibility details
 */
export function getEligibleMembers(
  contributorsEntries: Map<string, CookLedgerEntry[]>,
  recentWindowMonths: number,
  exclusions: Map<string, string[]> = new Map(),
  minimumActiveCook: number = 0
): CommitteeEligibilityResult[] {
  const eligibilityResults: CommitteeEligibilityResult[] = []

  for (const [contributorId, entries] of contributorsEntries.entries()) {
    const eligibility = checkCommitteeEligibility(
      contributorId,
      entries,
      recentWindowMonths,
      exclusions,
      minimumActiveCook
    )
    eligibilityResults.push(eligibility)
  }

  // Return only eligible members
  return eligibilityResults.filter((result) => result.isEligible)
}

