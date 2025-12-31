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
 * Constitutional change record schema
 * Tracks constitutional rule changes with versioning
 * 
 * Story 9.9: Trigger Voting for Constitutional Rule Challenges
 */
export interface ConstitutionalChange {
  id: string
  teamId: string
  proposalId: string
  votingId: string
  version: number
  ruleName: string
  ruleDescription: string
  previousVersion?: number // Reference to previous version
  changeType: 'created' | 'modified' | 'deleted'
  changeDetails: string
  implications: string // Description of implications of the change
  adoptedAt: string // ISO datetime when constitutional change was adopted
  adoptedBy: string // User ID or 'voting' if adopted via voting
  approvalPercentage: number // Weighted vote percentage that approved the change
  createdAt: string
}

/**
 * Create a constitutional change record when a constitutional change is adopted
 * 
 * @param teamId - Team ID
 * @param proposalId - Proposal ID
 * @param votingId - Voting ID
 * @param ruleName - Constitutional rule name
 * @param ruleDescription - Constitutional rule description
 * @param changeType - Type of change
 * @param changeDetails - Details of the change
 * @param implications - Implications of the change
 * @param approvalPercentage - Weighted vote percentage that approved the change
 * @param adoptedBy - User ID or 'voting' if adopted via voting
 * @returns Created constitutional change record
 */
export async function createConstitutionalChange(
  teamId: string,
  proposalId: string,
  votingId: string,
  ruleName: string,
  ruleDescription: string,
  changeType: ConstitutionalChange['changeType'],
  changeDetails: string,
  implications: string,
  approvalPercentage: number,
  adoptedBy: string = 'voting'
): Promise<ConstitutionalChange> {
  // Get latest version for this rule
  const latestVersion = await getLatestConstitutionalVersion(teamId, ruleName)
  const newVersion = latestVersion ? latestVersion + 1 : 1

  const now = new Date().toISOString()
  const constitutionalChangeId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'constitutionalChanges'), '_').id

  const constitutionalChange: ConstitutionalChange = {
    id: constitutionalChangeId,
    teamId,
    proposalId,
    votingId,
    version: newVersion,
    ruleName,
    ruleDescription,
    previousVersion: latestVersion || undefined,
    changeType,
    changeDetails,
    implications,
    adoptedAt: now,
    adoptedBy,
    approvalPercentage,
    createdAt: now
  }

  // Store in Firestore (teams/{teamId}/constitutionalChanges/{constitutionalChangeId})
  const constitutionalChangeRef = doc(getFirestoreInstance(), 'teams', teamId, 'constitutionalChanges', constitutionalChangeId)
  await setDoc(constitutionalChangeRef, {
    ...constitutionalChange,
    createdAt: serverTimestamp(),
    adoptedAt: serverTimestamp()
  })

  logger.info('Constitutional change recorded', {
    constitutionalChangeId,
    teamId,
    proposalId,
    votingId,
    ruleName,
    version: newVersion,
    changeType,
    approvalPercentage,
    adoptedBy,
    requiresHigherThreshold: true
  })

  // Story 9.10: Create audit log for constitutional change adoption
  try {
    const { createAuditLog } = await import('./auditLogs')
    await createAuditLog(
      teamId,
      'constitutional_change_adopted',
      adoptedBy,
      undefined, // participants (voters are tracked in voting audit log)
      'adopted',
      {
        constitutionalChangeId,
        proposalId,
        votingId,
        ruleName,
        version: newVersion,
        changeType,
        changeDetails,
        implications,
        approvalPercentage,
        requiresHigherThreshold: true
      },
      undefined, // cookWeights (tracked in voting audit log)
      undefined, // totalWeight (tracked in voting audit log)
      constitutionalChangeId,
      'constitutional_change',
      { version: newVersion, previousVersion: latestVersion, approvalPercentage }
    )
  } catch (error) {
    logger.error('Error creating audit log for constitutional change adoption', {
      constitutionalChangeId,
      teamId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue even if audit log creation fails
  }

  return constitutionalChange
}

/**
 * Get latest version number for a constitutional rule
 * 
 * @param teamId - Team ID
 * @param ruleName - Constitutional rule name
 * @returns Latest version number or 0 if no previous versions
 */
export async function getLatestConstitutionalVersion(
  teamId: string,
  ruleName: string
): Promise<number> {
  const constitutionalChangesRef = collection(getFirestoreInstance(), 'teams', teamId, 'constitutionalChanges')
  const q = query(
    constitutionalChangesRef,
    where('ruleName', '==', ruleName)
  )
  const querySnapshot = await getDocs(q)

  let maxVersion = 0
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const version = data.version || 0
    if (version > maxVersion) {
      maxVersion = version
    }
  })

  return maxVersion
}

/**
 * Get all constitutional changes for a team
 * 
 * @param teamId - Team ID
 * @returns Array of constitutional changes
 */
export async function getTeamConstitutionalChanges(
  teamId: string
): Promise<ConstitutionalChange[]> {
  const constitutionalChangesRef = collection(getFirestoreInstance(), 'teams', teamId, 'constitutionalChanges')
  const querySnapshot = await getDocs(constitutionalChangesRef)

  const constitutionalChanges: ConstitutionalChange[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const constitutionalChange: ConstitutionalChange = {
      id: doc.id,
      teamId: data.teamId,
      proposalId: data.proposalId,
      votingId: data.votingId,
      version: data.version || 1,
      ruleName: data.ruleName,
      ruleDescription: data.ruleDescription,
      previousVersion: data.previousVersion,
      changeType: data.changeType,
      changeDetails: data.changeDetails,
      implications: data.implications,
      adoptedAt: data.adoptedAt?.toDate?.() 
        ? data.adoptedAt.toDate().toISOString() 
        : data.adoptedAt,
      adoptedBy: data.adoptedBy || 'voting',
      approvalPercentage: data.approvalPercentage || 0,
      createdAt: data.createdAt?.toDate?.() 
        ? data.createdAt.toDate().toISOString() 
        : data.createdAt
    }
    constitutionalChanges.push(constitutionalChange)
  })

  // Sort by version (newest first)
  return constitutionalChanges.sort((a, b) => b.version - a.version)
}

/**
 * Get constitutional change history for a specific rule
 * 
 * @param teamId - Team ID
 * @param ruleName - Constitutional rule name
 * @returns Array of constitutional changes for the rule, sorted by version
 */
export async function getConstitutionalChangeHistory(
  teamId: string,
  ruleName: string
): Promise<ConstitutionalChange[]> {
  const constitutionalChangesRef = collection(getFirestoreInstance(), 'teams', teamId, 'constitutionalChanges')
  const q = query(
    constitutionalChangesRef,
    where('ruleName', '==', ruleName)
  )
  const querySnapshot = await getDocs(q)

  const constitutionalChanges: ConstitutionalChange[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const constitutionalChange: ConstitutionalChange = {
      id: doc.id,
      teamId: data.teamId,
      proposalId: data.proposalId,
      votingId: data.votingId,
      version: data.version || 1,
      ruleName: data.ruleName,
      ruleDescription: data.ruleDescription,
      previousVersion: data.previousVersion,
      changeType: data.changeType,
      changeDetails: data.changeDetails,
      implications: data.implications,
      adoptedAt: data.adoptedAt?.toDate?.() 
        ? data.adoptedAt.toDate().toISOString() 
        : data.adoptedAt,
      adoptedBy: data.adoptedBy || 'voting',
      approvalPercentage: data.approvalPercentage || 0,
      createdAt: data.createdAt?.toDate?.() 
        ? data.createdAt.toDate().toISOString() 
        : data.createdAt
    }
    constitutionalChanges.push(constitutionalChange)
  })

  // Sort by version (newest first)
  return constitutionalChanges.sort((a, b) => b.version - a.version)
}

/**
 * Get current version of a constitutional rule
 * 
 * @param teamId - Team ID
 * @param ruleName - Constitutional rule name
 * @returns Current constitutional change or null if rule doesn't exist
 */
export async function getCurrentConstitutionalVersion(
  teamId: string,
  ruleName: string
): Promise<ConstitutionalChange | null> {
  const history = await getConstitutionalChangeHistory(teamId, ruleName)
  return history.length > 0 ? history[0] : null
}

