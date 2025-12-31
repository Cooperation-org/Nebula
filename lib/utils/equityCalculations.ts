/**
 * Equity Calculation Utilities
 * 
 * Provides functions to calculate equity from COOK totals
 * Supports configurable models (slicing-style, etc.)
 * 
 * Story 9.2: Feed COOK Totals into Equity Calculations
 */

import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import type { Team } from '@/lib/types/team'
import { getEffectiveCookWithCapAndDecay } from './cookCaps'

/**
 * Equity calculation model type
 */
export type EquityModel = 'slicing' | 'proportional' | 'custom'

/**
 * Equity calculation result
 */
export interface EquityCalculationResult {
  contributorId: string
  equity: number // Equity percentage (0-100)
  effectiveCook: number // Effective COOK used for calculation
  rawCook: number // Raw COOK total
  model: EquityModel // Model used for calculation
  totalTeamCook: number // Total effective COOK for all contributors
  capApplied: boolean // Whether cap was applied
  decayApplied: boolean // Whether decay was applied
}

/**
 * Calculate equity using slicing-style model
 * 
 * Slicing model: Each contributor gets equity proportional to their COOK
 * as a percentage of total team COOK
 * 
 * @param contributorCook - Effective COOK for the contributor
 * @param totalTeamCook - Total effective COOK for all contributors
 * @returns Equity percentage (0-100)
 */
function calculateSlicingEquity(
  contributorCook: number,
  totalTeamCook: number
): number {
  if (totalTeamCook === 0) {
    return 0
  }
  
  // Equity = (contributor COOK / total team COOK) * 100
  return (contributorCook / totalTeamCook) * 100
}

/**
 * Calculate equity using proportional model
 * 
 * Proportional model: Similar to slicing, but can be normalized differently
 * For now, same as slicing - can be extended with different normalization
 * 
 * @param contributorCook - Effective COOK for the contributor
 * @param totalTeamCook - Total effective COOK for all contributors
 * @returns Equity percentage (0-100)
 */
function calculateProportionalEquity(
  contributorCook: number,
  totalTeamCook: number
): number {
  // For now, proportional is the same as slicing
  // Can be extended with different normalization if needed
  return calculateSlicingEquity(contributorCook, totalTeamCook)
}

/**
 * Calculate equity for a contributor
 * 
 * @param contributorId - Contributor user ID
 * @param contributorEntries - COOK ledger entries for the contributor
 * @param allContributorsCook - Map of all contributors' effective COOK (contributorId -> effectiveCook)
 * @param team - Team document with cap and decay configuration
 * @param model - Equity calculation model (default: 'slicing')
 * @returns Equity calculation result
 */
export async function calculateEquity(
  contributorId: string,
  contributorEntries: CookLedgerEntry[],
  allContributorsCook: Map<string, number>,
  team: Team | null,
  model: EquityModel = 'slicing'
): Promise<EquityCalculationResult> {
  // Get raw COOK total
  const rawCook = contributorEntries.reduce((sum, entry) => sum + entry.cookValue, 0)

  // Get effective COOK (with cap and decay applied)
  const effectiveCook = await getEffectiveCookWithCapAndDecay(contributorEntries, team)

  // Calculate total team COOK (sum of all contributors' effective COOK)
  const totalTeamCook = Array.from(allContributorsCook.values()).reduce((sum, cook) => sum + cook, 0)

  // Check if cap or decay were applied
  const capApplied = team?.cookCap !== null && team?.cookCap !== undefined
  const decayApplied = team?.cookDecayRate !== null && team?.cookDecayRate !== undefined && ((team?.cookDecayRate ?? 0) > 0)

  // Calculate equity based on model
  let equity: number
  switch (model) {
    case 'slicing':
      equity = calculateSlicingEquity(effectiveCook, totalTeamCook)
      break
    case 'proportional':
      equity = calculateProportionalEquity(effectiveCook, totalTeamCook)
      break
    case 'custom':
      // Custom model would be implemented by the team
      // For now, default to slicing
      equity = calculateSlicingEquity(effectiveCook, totalTeamCook)
      break
    default:
      equity = calculateSlicingEquity(effectiveCook, totalTeamCook)
  }

  return {
    contributorId,
    equity,
    effectiveCook,
    rawCook,
    model,
    totalTeamCook,
    capApplied,
    decayApplied
  }
}

/**
 * Calculate equity for all contributors in a team
 * 
 * @param contributorsCook - Map of contributor entries (contributorId -> entries[])
 * @param team - Team document with cap and decay configuration
 * @param model - Equity calculation model (default: 'slicing')
 * @returns Array of equity calculation results for all contributors
 */
export async function calculateTeamEquity(
  contributorsCook: Map<string, CookLedgerEntry[]>,
  team: Team | null,
  model: EquityModel = 'slicing'
): Promise<EquityCalculationResult[]> {
  // First, calculate effective COOK for all contributors
  const allContributorsCook = new Map<string, number>()
  
  for (const [contributorId, entries] of contributorsCook.entries()) {
    const effectiveCook = await getEffectiveCookWithCapAndDecay(entries, team)
    allContributorsCook.set(contributorId, effectiveCook)
  }

  // Then calculate equity for each contributor
  const equityResults: EquityCalculationResult[] = []
  
  for (const [contributorId, entries] of contributorsCook.entries()) {
    const result = await calculateEquity(
      contributorId,
      entries,
      allContributorsCook,
      team,
      model
    )
    equityResults.push(result)
  }

  return equityResults
}

