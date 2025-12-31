'use client'

import { collection, getDocs, query, where } from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import { getCookLedgerEntries } from './cookLedger'
import { getTeam } from './teams'
import {
  getEligibleMembers,
  type CommitteeEligibilityResult
} from '@/lib/utils/committeeEligibility'
import { logger } from '@/lib/utils/logger'
import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import type { ServiceTerm } from '@/lib/schemas/serviceTerm'

/**
 * Get exclusions for committee eligibility
 *
 * Story 9.3: Committee Selection via Weighted Lottery - Eligibility
 * Story 9.5: Track Committee Service Terms - Exclusions
 *
 * Exclusions include:
 * - People already serving on committees (Story 9.5)
 * - People under proposal review (Story 9.6+)
 * - People in cooling-off periods (Story 9.5)
 *
 * @param teamId - Team ID
 * @returns Map of exclusion reasons (contributorId -> reasons[])
 */
export async function getCommitteeExclusions(
  teamId: string
): Promise<Map<string, string[]>> {
  const exclusions = new Map<string, string[]>()

  // Story 9.5: Check for people already serving on committees and in cooling-off periods
  const { getActiveServiceTerms, getServiceTermsForContributor } =
    await import('./serviceTerms')
  const { getServiceTermExclusions } = await import('@/lib/utils/serviceTermExclusions')
  const { getTeam } = await import('./teams')

  const team = await getTeam(teamId)
  const coolingOffPeriodDays = team?.committeeCoolingOffPeriodDays || 0

  // Get all service terms for the team
  const serviceTermsRef = collection(
    getFirestoreInstance(),
    'teams',
    teamId,
    'serviceTerms'
  )
  const querySnapshot = await getDocs(serviceTermsRef)

  const activeServiceTerms: ServiceTerm[] = []
  const completedServiceTerms: ServiceTerm[] = []

  querySnapshot.forEach(doc => {
    const data = doc.data()
    try {
      const serviceTerm = {
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate?.()
          ? data.startDate.toDate().toISOString()
          : data.startDate,
        endDate: data.endDate?.toDate?.()
          ? data.endDate.toDate().toISOString()
          : data.endDate,
        createdAt: data.createdAt?.toDate?.()
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()
          ? data.updatedAt.toDate().toISOString()
          : data.updatedAt
      } as ServiceTerm

      if (serviceTerm.status === 'active') {
        activeServiceTerms.push(serviceTerm)
      } else {
        completedServiceTerms.push(serviceTerm)
      }
    } catch (error) {
      logger.error('Error parsing service term for exclusions', {
        serviceTermId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  // Get unique contributor IDs from service terms
  const contributorIds = new Set<string>()
  activeServiceTerms.forEach(term => contributorIds.add(term.contributorId))
  completedServiceTerms.forEach(term => contributorIds.add(term.contributorId))

  // Check exclusions for each contributor
  for (const contributorId of contributorIds) {
    const contributorExclusions = getServiceTermExclusions(
      contributorId,
      activeServiceTerms,
      completedServiceTerms,
      coolingOffPeriodDays
    )

    if (contributorExclusions.length > 0) {
      exclusions.set(contributorId, contributorExclusions)
    }
  }

  // Story 9.6: Check for people under proposal review (objection window open)
  const { getTeamGovernanceProposals } = await import('./governanceProposals')
  const openProposals = await getTeamGovernanceProposals(teamId)
  const activeProposals = openProposals.filter(p => p.status === 'objection_window_open')

  // Get unique contributor IDs from active proposals (proposers and objectors)
  const proposalContributorIds = new Set<string>()
  activeProposals.forEach(proposal => {
    proposalContributorIds.add(proposal.proposedBy)
    proposal.objections.forEach(obj => proposalContributorIds.add(obj.objectorId))
  })

  // Add exclusions for people under proposal review
  for (const contributorId of proposalContributorIds) {
    const proposalExclusions = proposalContributorIds.has(contributorId)
      ? activeProposals
          .filter(
            p =>
              p.proposedBy === contributorId ||
              p.objections.some(obj => obj.objectorId === contributorId)
          )
          .map(p => `Under proposal review: ${p.title}`)
      : []

    if (proposalExclusions.length > 0) {
      const existingExclusions = exclusions.get(contributorId) || []
      exclusions.set(contributorId, [...existingExclusions, ...proposalExclusions])
    }
  }

  return exclusions
}

/**
 * Get eligible members for committee selection
 *
 * Story 9.3: Committee Selection via Weighted Lottery - Eligibility
 *
 * @param teamId - Team ID
 * @param exclusions - Optional map of exclusion reasons (contributorId -> reasons[])
 *   If not provided, will be calculated automatically
 *   Exclusions can include:
 *   - People already serving on committees
 *   - People under proposal review
 *   - People in cooling-off periods
 * @returns Array of eligible members with their eligibility details
 */
export async function getCommitteeEligibleMembers(
  teamId: string,
  exclusions?: Map<string, string[]>
): Promise<CommitteeEligibilityResult[]> {
  // Get exclusions if not provided
  const effectiveExclusions = exclusions || (await getCommitteeExclusions(teamId))
  // Get team configuration
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  // Get recent window from team config (default: 6 months)
  const recentWindowMonths = team.committeeEligibilityWindowMonths || 6
  const minimumActiveCook = team.committeeMinimumActiveCook || 0

  // Get all COOK ledger entries for the team
  const cookLedgerRef = collection(getFirestoreInstance(), 'teams', teamId, 'cookLedger')
  const querySnapshot = await getDocs(cookLedgerRef)

  // Group entries by contributor
  const contributorsEntries = new Map<string, CookLedgerEntry[]>()

  querySnapshot.forEach(doc => {
    const data = doc.data()
    const contributorId = data.contributorId
    if (!contributorsEntries.has(contributorId)) {
      contributorsEntries.set(contributorId, [])
    }

    const entry: CookLedgerEntry = {
      id: doc.id,
      taskId: data.taskId,
      teamId: data.teamId,
      contributorId: data.contributorId,
      cookValue: data.cookValue,
      attribution: data.attribution,
      issuedAt: data.issuedAt?.toDate?.()
        ? data.issuedAt.toDate().toISOString()
        : data.issuedAt
    }

    contributorsEntries.get(contributorId)!.push(entry)
  })

  // Get eligible members
  const eligibleMembers = getEligibleMembers(
    contributorsEntries,
    recentWindowMonths,
    exclusions,
    minimumActiveCook
  )

  // Log eligibility check
  logger.info('Committee eligibility checked', {
    teamId,
    recentWindowMonths,
    minimumActiveCook,
    totalContributors: contributorsEntries.size,
    eligibleMembers: eligibleMembers.length,
    excludedMembers: contributorsEntries.size - eligibleMembers.length
  })

  return eligibleMembers
}

/**
 * Check if a specific contributor is eligible for committee selection
 *
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @param exclusions - Optional exclusion reasons for this contributor
 * @returns Eligibility result
 */
export async function checkContributorEligibility(
  teamId: string,
  contributorId: string,
  exclusions: string[] = []
): Promise<CommitteeEligibilityResult> {
  // Get team configuration
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  // Get recent window from team config (default: 6 months)
  const recentWindowMonths = team.committeeEligibilityWindowMonths || 6
  const minimumActiveCook = team.committeeMinimumActiveCook || 0

  // Get COOK ledger entries for the contributor
  const entries = await getCookLedgerEntries(teamId, contributorId)

  // Create exclusions map
  const exclusionsMap = new Map<string, string[]>()
  if (exclusions.length > 0) {
    exclusionsMap.set(contributorId, exclusions)
  }

  // Check eligibility
  const { checkCommitteeEligibility } = await import('@/lib/utils/committeeEligibility')
  const eligibility = checkCommitteeEligibility(
    contributorId,
    entries,
    recentWindowMonths,
    exclusionsMap,
    minimumActiveCook
  )

  return eligibility
}
