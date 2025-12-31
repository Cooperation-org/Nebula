/**
 * Service Term Exclusion Utilities
 *
 * Provides functions to check exclusions based on service terms
 *
 * Story 9.5: Track Committee Service Terms
 */

import type { ServiceTerm } from '@/lib/types/serviceTerm'
import type { Team } from '@/lib/types/team'

/**
 * Check if a contributor is currently serving on a committee
 *
 * @param contributorId - Contributor user ID
 * @param activeServiceTerms - Array of active service terms
 * @returns True if contributor is currently serving
 */
export function isCurrentlyServing(
  contributorId: string,
  activeServiceTerms: ServiceTerm[]
): boolean {
  return activeServiceTerms.some(
    term => term.contributorId === contributorId && term.status === 'active'
  )
}

/**
 * Check if a contributor is in a cooling-off period
 *
 * @param contributorId - Contributor user ID
 * @param completedServiceTerms - Array of completed/terminated service terms
 * @param coolingOffPeriodDays - Cooling-off period in days (from team config)
 * @returns True if contributor is in cooling-off period
 */
export function isInCoolingOffPeriod(
  contributorId: string,
  completedServiceTerms: ServiceTerm[],
  coolingOffPeriodDays: number
): boolean {
  if (coolingOffPeriodDays <= 0) {
    return false // No cooling-off period configured
  }

  const now = new Date()
  const contributorTerms = completedServiceTerms.filter(
    term => term.contributorId === contributorId
  )

  for (const term of contributorTerms) {
    if (!term.endDate) {
      continue // Skip terms without end date
    }

    const endDate = new Date(term.endDate)
    const daysSinceEnd = Math.floor(
      (now.getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
    )

    if (daysSinceEnd >= 0 && daysSinceEnd < coolingOffPeriodDays) {
      return true // Still in cooling-off period
    }
  }

  return false
}

/**
 * Get exclusion reasons for a contributor based on service terms
 *
 * @param contributorId - Contributor user ID
 * @param activeServiceTerms - Array of active service terms
 * @param completedServiceTerms - Array of completed/terminated service terms
 * @param coolingOffPeriodDays - Cooling-off period in days (from team config)
 * @returns Array of exclusion reasons (empty if no exclusions)
 */
export function getServiceTermExclusions(
  contributorId: string,
  activeServiceTerms: ServiceTerm[],
  completedServiceTerms: ServiceTerm[],
  coolingOffPeriodDays: number
): string[] {
  const exclusions: string[] = []

  // Check if currently serving
  if (isCurrentlyServing(contributorId, activeServiceTerms)) {
    const servingCommittees = activeServiceTerms
      .filter(term => term.contributorId === contributorId && term.status === 'active')
      .map(term => term.committeeName)
    exclusions.push(`Currently serving on: ${servingCommittees.join(', ')}`)
  }

  // Check if in cooling-off period
  if (isInCoolingOffPeriod(contributorId, completedServiceTerms, coolingOffPeriodDays)) {
    const recentTerms = completedServiceTerms
      .filter(term => {
        if (!term.endDate) return false
        const endDate = new Date(term.endDate)
        const daysSinceEnd = Math.floor(
          (new Date().getTime() - endDate.getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysSinceEnd >= 0 && daysSinceEnd < coolingOffPeriodDays
      })
      .map(term => term.committeeName)
    exclusions.push(
      `In cooling-off period (${coolingOffPeriodDays} days) after serving on: ${recentTerms.join(', ')}`
    )
  }

  return exclusions
}
