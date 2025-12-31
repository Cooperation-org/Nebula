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
import { logger } from '@/lib/utils/logger'

/**
 * Policy change record schema
 * Tracks policy changes with versioning
 *
 * Story 9.8: Trigger Voting for Policy Changes
 */
export interface PolicyChange {
  id: string
  teamId: string
  proposalId: string
  votingId: string
  version: number
  policyName: string
  policyDescription: string
  previousVersion?: number // Reference to previous version
  changeType: 'created' | 'modified' | 'deleted'
  changeDetails: string
  adoptedAt: string // ISO datetime when policy change was adopted
  adoptedBy: string // User ID or 'voting' if adopted via voting
  createdAt: string
}

/**
 * Create a policy change record when a policy change is adopted
 *
 * @param teamId - Team ID
 * @param proposalId - Proposal ID
 * @param votingId - Voting ID
 * @param policyName - Policy name
 * @param policyDescription - Policy description
 * @param changeType - Type of change
 * @param changeDetails - Details of the change
 * @param adoptedBy - User ID or 'voting' if adopted via voting
 * @returns Created policy change record
 */
export async function createPolicyChange(
  teamId: string,
  proposalId: string,
  votingId: string,
  policyName: string,
  policyDescription: string,
  changeType: PolicyChange['changeType'],
  changeDetails: string,
  adoptedBy: string = 'voting'
): Promise<PolicyChange> {
  // Get latest version for this policy
  const latestVersion = await getLatestPolicyVersion(teamId, policyName)
  const newVersion = latestVersion ? latestVersion + 1 : 1

  const now = new Date().toISOString()
  const policyChangeId = doc(
    collection(getFirestoreInstance(), 'teams', teamId, 'policyChanges'),
    '_'
  ).id

  const policyChange: PolicyChange = {
    id: policyChangeId,
    teamId,
    proposalId,
    votingId,
    version: newVersion,
    policyName,
    policyDescription,
    previousVersion: latestVersion || undefined,
    changeType,
    changeDetails,
    adoptedAt: now,
    adoptedBy,
    createdAt: now
  }

  // Store in Firestore (teams/{teamId}/policyChanges/{policyChangeId})
  const policyChangeRef = doc(
    getFirestoreInstance(),
    'teams',
    teamId,
    'policyChanges',
    policyChangeId
  )
  await setDoc(policyChangeRef, {
    ...policyChange,
    createdAt: serverTimestamp(),
    adoptedAt: serverTimestamp()
  })

  logger.info('Policy change recorded', {
    policyChangeId,
    teamId,
    proposalId,
    votingId,
    policyName,
    version: newVersion,
    changeType,
    adoptedBy
  })

  // Story 9.10: Create audit log for policy change adoption
  try {
    const { createAuditLog } = await import('./auditLogs')
    await createAuditLog(
      teamId,
      'policy_change_adopted',
      adoptedBy,
      undefined, // participants (voters are tracked in voting audit log)
      'adopted',
      {
        policyChangeId,
        proposalId,
        votingId,
        policyName,
        version: newVersion,
        changeType,
        changeDetails
      },
      undefined, // cookWeights (tracked in voting audit log)
      undefined, // totalWeight (tracked in voting audit log)
      policyChangeId,
      'policy_change',
      { version: newVersion, previousVersion: latestVersion }
    )
  } catch (error) {
    logger.error('Error creating audit log for policy change adoption', {
      policyChangeId,
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue even if audit log creation fails
  }

  return policyChange
}

/**
 * Get latest version number for a policy
 *
 * @param teamId - Team ID
 * @param policyName - Policy name
 * @returns Latest version number or 0 if no previous versions
 */
export async function getLatestPolicyVersion(
  teamId: string,
  policyName: string
): Promise<number> {
  const policyChangesRef = collection(
    getFirestoreInstance(),
    'teams',
    teamId,
    'policyChanges'
  )
  const q = query(policyChangesRef, where('policyName', '==', policyName))
  const querySnapshot = await getDocs(q)

  let maxVersion = 0
  querySnapshot.forEach(doc => {
    const data = doc.data()
    const version = data.version || 0
    if (version > maxVersion) {
      maxVersion = version
    }
  })

  return maxVersion
}

/**
 * Get all policy changes for a team
 *
 * @param teamId - Team ID
 * @returns Array of policy changes
 */
export async function getTeamPolicyChanges(teamId: string): Promise<PolicyChange[]> {
  const policyChangesRef = collection(
    getFirestoreInstance(),
    'teams',
    teamId,
    'policyChanges'
  )
  const querySnapshot = await getDocs(policyChangesRef)

  const policyChanges: PolicyChange[] = []
  querySnapshot.forEach(doc => {
    const data = doc.data()
    const policyChange: PolicyChange = {
      id: doc.id,
      teamId: data.teamId,
      proposalId: data.proposalId,
      votingId: data.votingId,
      version: data.version || 1,
      policyName: data.policyName,
      policyDescription: data.policyDescription,
      previousVersion: data.previousVersion,
      changeType: data.changeType,
      changeDetails: data.changeDetails,
      adoptedAt: data.adoptedAt?.toDate?.()
        ? data.adoptedAt.toDate().toISOString()
        : data.adoptedAt,
      adoptedBy: data.adoptedBy || 'voting',
      createdAt: data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : data.createdAt
    }
    policyChanges.push(policyChange)
  })

  // Sort by version (newest first)
  return policyChanges.sort((a, b) => b.version - a.version)
}

/**
 * Get policy change history for a specific policy
 *
 * @param teamId - Team ID
 * @param policyName - Policy name
 * @returns Array of policy changes for the policy, sorted by version
 */
export async function getPolicyChangeHistory(
  teamId: string,
  policyName: string
): Promise<PolicyChange[]> {
  const policyChangesRef = collection(
    getFirestoreInstance(),
    'teams',
    teamId,
    'policyChanges'
  )
  const q = query(policyChangesRef, where('policyName', '==', policyName))
  const querySnapshot = await getDocs(q)

  const policyChanges: PolicyChange[] = []
  querySnapshot.forEach(doc => {
    const data = doc.data()
    const policyChange: PolicyChange = {
      id: doc.id,
      teamId: data.teamId,
      proposalId: data.proposalId,
      votingId: data.votingId,
      version: data.version || 1,
      policyName: data.policyName,
      policyDescription: data.policyDescription,
      previousVersion: data.previousVersion,
      changeType: data.changeType,
      changeDetails: data.changeDetails,
      adoptedAt: data.adoptedAt?.toDate?.()
        ? data.adoptedAt.toDate().toISOString()
        : data.adoptedAt,
      adoptedBy: data.adoptedBy || 'voting',
      createdAt: data.createdAt?.toDate?.()
        ? data.createdAt.toDate().toISOString()
        : data.createdAt
    }
    policyChanges.push(policyChange)
  })

  // Sort by version (newest first)
  return policyChanges.sort((a, b) => b.version - a.version)
}

/**
 * Get current version of a policy
 *
 * @param teamId - Team ID
 * @param policyName - Policy name
 * @returns Current policy change or null if policy doesn't exist
 */
export async function getCurrentPolicyVersion(
  teamId: string,
  policyName: string
): Promise<PolicyChange | null> {
  const history = await getPolicyChangeHistory(teamId, policyName)
  return history.length > 0 ? history[0] : null
}
