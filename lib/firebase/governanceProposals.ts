'use client'

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import type { GovernanceProposal, GovernanceProposalDocument, Objection } from '@/lib/types/governanceProposal'
import { governanceProposalDocumentSchema, governanceProposalSchema, governanceProposalUpdateSchema, type GovernanceProposalUpdate } from '@/lib/schemas/governanceProposal'
import { getTeam } from './teams'
import { getGovernanceWeight } from './governanceWeight'
import { logger } from '@/lib/utils/logger'
import type { VoteOption } from '@/lib/types/voting'

/**
 * Create a governance proposal
 * 
 * Story 9.6: Objection Windows Preceding Binding Decisions
 * 
 * @param teamId - Team ID
 * @param type - Proposal type
 * @param title - Proposal title
 * @param description - Proposal description
 * @param proposedBy - User ID who proposed
 * @param objectionWindowDurationDays - Optional objection window duration (defaults to team config)
 * @param objectionThreshold - Optional objection threshold (defaults to team config)
 * @returns Created governance proposal
 */
export async function createGovernanceProposal(
  teamId: string,
  type: GovernanceProposal['type'],
  title: string,
  description: string | undefined,
  proposedBy: string,
  objectionWindowDurationDays?: number,
  objectionThreshold?: number
): Promise<GovernanceProposal> {
  // Get team configuration
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  const now = new Date().toISOString()
  
  // Story 9.8: Policy changes skip objection window and go straight to voting
  // Story 9.9: Constitutional challenges also skip objection window and go straight to voting
  const isPolicyChange = type === 'policy_change'
  const isConstitutionalChallenge = type === 'constitutional_challenge'
  const skipObjectionWindow = isPolicyChange || isConstitutionalChallenge
  
  let proposalStatus: GovernanceProposal['status']
  let finalObjectionWindowDurationDays: number | undefined
  let objectionWindowOpenedAt: string | undefined
  let objectionWindowClosesAt: string | undefined
  let finalObjectionThreshold: number | undefined
  let votingTriggered: boolean
  let votingId: string | undefined

  if (skipObjectionWindow) {
    // Policy changes: Skip objection window, trigger voting immediately
    proposalStatus = 'voting_triggered'
    votingTriggered = true
    finalObjectionWindowDurationDays = undefined
    objectionWindowOpenedAt = undefined
    objectionWindowClosesAt = undefined
    finalObjectionThreshold = undefined
  } else {
    // Other proposals: Open objection window
    const windowDuration = objectionWindowDurationDays || team.defaultObjectionWindowDays || 7
    const threshold = objectionThreshold !== undefined ? objectionThreshold : (team.defaultObjectionThreshold ?? 0)
    
    // Calculate objection window close date
    const windowClosesAt = new Date(now)
    windowClosesAt.setDate(windowClosesAt.getDate() + windowDuration)
    const windowClosesAtISO = windowClosesAt.toISOString()
    
    proposalStatus = 'objection_window_open'
    votingTriggered = false
    finalObjectionWindowDurationDays = windowDuration
    objectionWindowOpenedAt = now
    objectionWindowClosesAt = windowClosesAtISO
    finalObjectionThreshold = threshold
  }

  // Generate proposal ID
  const proposalId = doc(collection(getFirestoreInstance(), 'governanceProposals'), '_').id

  const proposalDoc: GovernanceProposalDocument = {
    teamId,
    type,
    title,
    description,
    proposedBy,
    status: proposalStatus,
    objectionWindowDurationDays,
    objectionWindowOpenedAt,
    objectionWindowClosesAt,
    objectionThreshold,
    objections: [],
    objectionCount: 0,
    weightedObjectionCount: 0,
    votingTriggered,
    votingId,
    createdAt: now,
    updatedAt: now
  }

  const validatedDoc = governanceProposalDocumentSchema.parse(proposalDoc)

  // Store in Firestore (governanceProposals/{proposalId})
  const proposalRef = doc(getFirestoreInstance(), 'governanceProposals', proposalId)
  const setDocData: any = {
    ...validatedDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }
  
  // Only set objection window timestamps if they exist
  if (objectionWindowOpenedAt) {
    setDocData.objectionWindowOpenedAt = serverTimestamp()
  }
  if (objectionWindowClosesAt) {
    setDocData.objectionWindowClosesAt = serverTimestamp()
  }
  
  await setDoc(proposalRef, setDocData)

  if (skipObjectionWindow) {
    logger.info('Policy change proposal created - voting triggered automatically', {
      proposalId,
      teamId,
      type,
      title,
      proposedBy,
      status: 'voting_triggered',
      votingTriggered: true
    })

    // Story 9.8: Automatically create voting for policy changes
    try {
      const { createVoting } = await import('./voting')
      const defaultOptions: VoteOption[] = [
        { option: 'approve', label: 'Approve Policy Change' },
        { option: 'reject', label: 'Reject Policy Change' }
      ]
      
      const voting = await createVoting(
        proposalId,
        title,
        description,
        defaultOptions
      )
      
      // Update proposal with voting ID
      const proposalRef = doc(getFirestoreInstance(), 'governanceProposals', proposalId)
      await updateDoc(proposalRef, {
        votingId: voting.id,
        updatedAt: serverTimestamp()
      })
      
      // Update proposal document with voting ID
      proposalDoc.votingId = voting.id
    } catch (error) {
      logger.error('Error creating voting for policy change', {
        proposalId,
        teamId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Continue even if voting creation fails - it can be created manually
    }
  } else {
    logger.info('Governance proposal created with objection window', {
      proposalId,
      teamId,
      type,
      title,
      proposedBy,
      objectionWindowDurationDays: proposalDoc.objectionWindowDurationDays,
      objectionWindowClosesAt: proposalDoc.objectionWindowClosesAt,
      objectionThreshold: proposalDoc.objectionThreshold,
      status: 'objection_window_open'
    })
  }

  const proposal: GovernanceProposal = {
    id: proposalId,
    ...validatedDoc
  }

  return proposal
}

/**
 * Add an objection to a governance proposal
 * 
 * @param proposalId - Proposal ID
 * @param objectorId - User ID who is objecting
 * @param reason - Objection reason
 * @returns Updated governance proposal
 */
export async function addObjection(
  proposalId: string,
  objectorId: string,
  reason: string
): Promise<GovernanceProposal> {
  // Get existing proposal
  const proposalRef = doc(getFirestoreInstance(), 'governanceProposals', proposalId)
  const proposalSnap = await getDoc(proposalRef)

  if (!proposalSnap.exists()) {
    throw new Error('Governance proposal not found')
  }

  const data = proposalSnap.data()
  const existingProposal = governanceProposalSchema.parse({
    id: proposalSnap.id,
    ...data,
    objectionWindowOpenedAt: data.objectionWindowOpenedAt?.toDate?.() 
      ? data.objectionWindowOpenedAt.toDate().toISOString() 
      : data.objectionWindowOpenedAt,
    objectionWindowClosesAt: data.objectionWindowClosesAt?.toDate?.() 
      ? data.objectionWindowClosesAt.toDate().toISOString() 
      : data.objectionWindowClosesAt,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    resolvedAt: data.resolvedAt?.toDate?.() 
      ? data.resolvedAt.toDate().toISOString() 
      : data.resolvedAt
  })

  // Check if objection window is still open
  if (existingProposal.status !== 'objection_window_open') {
    throw new Error(`Objection window is not open. Current status: ${existingProposal.status}`)
  }

  const now = new Date()
  if (existingProposal.objectionWindowClosesAt) {
    const closesAt = new Date(existingProposal.objectionWindowClosesAt)
    if (now > closesAt) {
      throw new Error('Objection window has closed')
    }
  }

  // Check if user has already objected
  const hasObjected = existingProposal.objections.some(obj => obj.objectorId === objectorId)
  if (hasObjected) {
    throw new Error('You have already objected to this proposal')
  }

  // Get objector's governance weight (COOK-weighted objection)
  const governanceWeight = await getGovernanceWeight(existingProposal.teamId, objectorId)
  const weight = governanceWeight?.weight || 0

  // Create new objection
  const newObjection: Objection = {
    objectorId,
    reason: reason.trim(),
    timestamp: new Date().toISOString(),
    governanceWeight: weight
  }

  // Add objection to existing objections
  const updatedObjections = [...existingProposal.objections, newObjection]
  const updatedObjectionCount = updatedObjections.length
  const updatedWeightedObjectionCount = updatedObjections.reduce((sum, obj) => sum + (obj.governanceWeight || 0), 0)

  // Check if threshold is exceeded
  const threshold = existingProposal.objectionThreshold ?? 0
  const thresholdExceeded = updatedObjectionCount > threshold || updatedWeightedObjectionCount > threshold

  // Update proposal
  const update: GovernanceProposalUpdate = {
    objections: updatedObjections,
    objectionCount: updatedObjectionCount,
    weightedObjectionCount: updatedWeightedObjectionCount,
    votingTriggered: thresholdExceeded,
    status: thresholdExceeded ? 'voting_triggered' : existingProposal.status,
    updatedAt: new Date().toISOString()
  }

  const validatedUpdate = governanceProposalUpdateSchema.parse(update)

  await updateDoc(proposalRef, {
    ...validatedUpdate,
    updatedAt: serverTimestamp()
  })

  logger.info('Objection added to governance proposal', {
    proposalId,
    teamId: existingProposal.teamId,
    objectorId,
    objectionCount: updatedObjectionCount,
    weightedObjectionCount: updatedWeightedObjectionCount,
    threshold,
    thresholdExceeded,
    votingTriggered: thresholdExceeded
  })

  // Story 9.10: Create audit log for objection added
  try {
    const { createAuditLog } = await import('./auditLogs')
    await createAuditLog(
      existingProposal.teamId,
      'objection_added',
      objectorId,
      [objectorId], // participants
      thresholdExceeded ? 'threshold_exceeded' : 'objection_added',
      {
        proposalId,
        objectionCount: updatedObjectionCount,
        weightedObjectionCount: updatedWeightedObjectionCount,
        threshold,
        thresholdExceeded,
        reason: reason.trim()
      },
      { [objectorId]: weight }, // cookWeights
      updatedWeightedObjectionCount,
      proposalId,
      'proposal',
      { votingTriggered: thresholdExceeded }
    )
  } catch (error) {
    logger.error('Error creating audit log for objection added', {
      proposalId,
      objectorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue even if audit log creation fails
  }

  if (thresholdExceeded) {
    logger.info('Objection threshold exceeded - voting triggered', {
      proposalId,
      teamId: existingProposal.teamId,
      objectionCount: updatedObjectionCount,
      threshold,
      status: 'voting_triggered'
    })

    // Story 9.7: Automatically create voting when threshold is exceeded
    try {
      const { createVoting } = await import('./voting')
      const defaultOptions: VoteOption[] = [
        { option: 'approve', label: 'Approve' },
        { option: 'reject', label: 'Reject' }
      ]
      
      await createVoting(
        proposalId,
        existingProposal.title,
        existingProposal.description,
        defaultOptions
      )
    } catch (error) {
      logger.error('Error creating voting after threshold exceeded', {
        proposalId,
        teamId: existingProposal.teamId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Continue even if voting creation fails - it can be created manually
    }
  }

  // Return updated proposal
  const updatedProposal = await getGovernanceProposal(proposalId)
  if (!updatedProposal) {
    throw new Error('Failed to retrieve updated proposal')
  }

  return updatedProposal
}

/**
 * Close objection window (if no objections or below threshold)
 * 
 * @param proposalId - Proposal ID
 * @returns Updated governance proposal
 */
export async function closeObjectionWindow(
  proposalId: string
): Promise<GovernanceProposal> {
  // Get existing proposal
  const proposalRef = doc(getFirestoreInstance(), 'governanceProposals', proposalId)
  const proposalSnap = await getDoc(proposalRef)

  if (!proposalSnap.exists()) {
    throw new Error('Governance proposal not found')
  }

  const data = proposalSnap.data()
  const existingProposal = governanceProposalSchema.parse({
    id: proposalSnap.id,
    ...data,
    objectionWindowOpenedAt: data.objectionWindowOpenedAt?.toDate?.() 
      ? data.objectionWindowOpenedAt.toDate().toISOString() 
      : data.objectionWindowOpenedAt,
    objectionWindowClosesAt: data.objectionWindowClosesAt?.toDate?.() 
      ? data.objectionWindowClosesAt.toDate().toISOString() 
      : data.objectionWindowClosesAt,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    resolvedAt: data.resolvedAt?.toDate?.() 
      ? data.resolvedAt.toDate().toISOString() 
      : data.resolvedAt
  })

  if (existingProposal.status !== 'objection_window_open') {
    throw new Error(`Objection window is not open. Current status: ${existingProposal.status}`)
  }

  const threshold = existingProposal.objectionThreshold ?? 0
  const thresholdExceeded = existingProposal.objectionCount > threshold || existingProposal.weightedObjectionCount > threshold

  if (thresholdExceeded) {
    throw new Error('Cannot close objection window - threshold exceeded. Voting should be triggered.')
  }

  // Close objection window and approve proposal (governance-by-workflow)
  const update: GovernanceProposalUpdate = {
    status: 'approved',
    updatedAt: new Date().toISOString(),
    resolvedAt: new Date().toISOString()
  }

  const validatedUpdate = governanceProposalUpdateSchema.parse(update)

  await updateDoc(proposalRef, {
    ...validatedUpdate,
    updatedAt: serverTimestamp(),
    resolvedAt: serverTimestamp()
  })

  logger.info('Objection window closed - proposal approved', {
    proposalId,
    teamId: existingProposal.teamId,
    objectionCount: existingProposal.objectionCount,
    threshold,
    status: 'approved',
    governanceByWorkflow: true // FR30: No vote required if below threshold
  })

  // Story 9.10: Create audit log for objection window closed
  try {
    const { createAuditLog } = await import('./auditLogs')
    // Collect COOK weights from objections (if any)
    const cookWeights: Record<string, number> = {}
    existingProposal.objections.forEach(obj => {
      if (obj.governanceWeight) {
        cookWeights[obj.objectorId] = obj.governanceWeight
      }
    })
    
    await createAuditLog(
      existingProposal.teamId,
      'objection_window_closed',
      'system',
      existingProposal.objections.map(obj => obj.objectorId), // participants
      'approved',
      {
        proposalId,
        objectionCount: existingProposal.objectionCount,
        weightedObjectionCount: existingProposal.weightedObjectionCount,
        threshold,
        status: 'approved',
        governanceByWorkflow: true
      },
      cookWeights,
      existingProposal.weightedObjectionCount,
      proposalId,
      'proposal',
      { governanceByWorkflow: true }
    )
  } catch (error) {
    logger.error('Error creating audit log for objection window closed', {
      proposalId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue even if audit log creation fails
  }

  // Return updated proposal
  const updatedProposal = await getGovernanceProposal(proposalId)
  if (!updatedProposal) {
    throw new Error('Failed to retrieve updated proposal')
  }

  return updatedProposal
}

/**
 * Get governance proposal by ID
 * 
 * @param proposalId - Proposal ID
 * @returns Governance proposal or null if not found
 */
export async function getGovernanceProposal(
  proposalId: string
): Promise<GovernanceProposal | null> {
  const proposalRef = doc(getFirestoreInstance(), 'governanceProposals', proposalId)
  const proposalSnap = await getDoc(proposalRef)

  if (!proposalSnap.exists()) {
    return null
  }

  const data = proposalSnap.data()
  return governanceProposalSchema.parse({
    id: proposalSnap.id,
    ...data,
    objectionWindowOpenedAt: data.objectionWindowOpenedAt?.toDate?.() 
      ? data.objectionWindowOpenedAt.toDate().toISOString() 
      : data.objectionWindowOpenedAt,
    objectionWindowClosesAt: data.objectionWindowClosesAt?.toDate?.() 
      ? data.objectionWindowClosesAt.toDate().toISOString() 
      : data.objectionWindowClosesAt,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    resolvedAt: data.resolvedAt?.toDate?.() 
      ? data.resolvedAt.toDate().toISOString() 
      : data.resolvedAt
  })
}

/**
 * Get all governance proposals for a team
 * 
 * @param teamId - Team ID
 * @returns Array of governance proposals
 */
export async function getTeamGovernanceProposals(
  teamId: string
): Promise<GovernanceProposal[]> {
  const proposalsRef = collection(getFirestoreInstance(), 'governanceProposals')
  const q = query(proposalsRef, where('teamId', '==', teamId))
  const querySnapshot = await getDocs(q)

  const proposals: GovernanceProposal[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    try {
      const proposal = governanceProposalSchema.parse({
        id: doc.id,
        ...data,
        objectionWindowOpenedAt: data.objectionWindowOpenedAt?.toDate?.() 
          ? data.objectionWindowOpenedAt.toDate().toISOString() 
          : data.objectionWindowOpenedAt,
        objectionWindowClosesAt: data.objectionWindowClosesAt?.toDate?.() 
          ? data.objectionWindowClosesAt.toDate().toISOString() 
          : data.objectionWindowClosesAt,
        createdAt: data.createdAt?.toDate?.() 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() 
          ? data.updatedAt.toDate().toISOString() 
          : data.updatedAt,
        resolvedAt: data.resolvedAt?.toDate?.() 
          ? data.resolvedAt.toDate().toISOString() 
          : data.resolvedAt
      })
      proposals.push(proposal)
    } catch (error) {
      logger.error('Error parsing governance proposal', {
        proposalId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return proposals
}

/**
 * Update governance proposal status
 * 
 * @param proposalId - Proposal ID
 * @param status - New status
 * @returns Updated governance proposal
 */
export async function updateGovernanceProposalStatus(
  proposalId: string,
  status: GovernanceProposal['status']
): Promise<GovernanceProposal> {
  const proposalRef = doc(getFirestoreInstance(), 'governanceProposals', proposalId)
  const proposalSnap = await getDoc(proposalRef)

  if (!proposalSnap.exists()) {
    throw new Error('Governance proposal not found')
  }

  const update: GovernanceProposalUpdate = {
    status,
    updatedAt: new Date().toISOString(),
    resolvedAt: status === 'approved' || status === 'rejected' ? new Date().toISOString() : undefined
  }

  const validatedUpdate = governanceProposalUpdateSchema.parse(update)

  await updateDoc(proposalRef, {
    ...validatedUpdate,
    updatedAt: serverTimestamp(),
    resolvedAt: update.resolvedAt ? serverTimestamp() : undefined
  })

  logger.info('Governance proposal status updated', {
    proposalId,
    status,
    resolvedAt: update.resolvedAt
  })

  const updatedProposal = await getGovernanceProposal(proposalId)
  if (!updatedProposal) {
    throw new Error('Failed to retrieve updated proposal')
  }

  return updatedProposal
}
