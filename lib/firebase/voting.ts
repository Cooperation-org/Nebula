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
import type { Voting, VotingDocument, Vote, VoteOption } from '@/lib/types/voting'
import { votingDocumentSchema, votingSchema, votingUpdateSchema, type VotingUpdate } from '@/lib/schemas/voting'
import { getTeam } from './teams'
import { getGovernanceWeight } from './governanceWeight'
import { logger } from '@/lib/utils/logger'

/**
 * Create a voting instance for a governance proposal
 * 
 * Story 9.7: Trigger Voting When Threshold Exceeded (FR33)
 * 
 * @param proposalId - Proposal ID
 * @param title - Voting title
 * @param description - Voting description
 * @param options - Vote options (e.g., ['approve', 'reject'])
 * @param votingPeriodDays - Optional voting period duration (defaults to team config)
 * @returns Created voting instance
 */
export async function createVoting(
  proposalId: string,
  title: string,
  description: string | undefined,
  options: VoteOption[],
  votingPeriodDays?: number
): Promise<Voting> {
  // Get proposal to get team ID
  const { getGovernanceProposal } = await import('./governanceProposals')
  const proposal = await getGovernanceProposal(proposalId)
  
  if (!proposal) {
    throw new Error('Governance proposal not found')
  }

  if (proposal.status !== 'voting_triggered') {
    throw new Error(`Proposal status is not 'voting_triggered'. Current status: ${proposal.status}`)
  }

  // Get team configuration
  const team = await getTeam(proposal.teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  const now = new Date().toISOString()
  const periodDuration = votingPeriodDays || team.defaultVotingPeriodDays || 7

  // Calculate voting close date
  const votingClosesAt = new Date(now)
  votingClosesAt.setDate(votingClosesAt.getDate() + periodDuration)
  const votingClosesAtISO = votingClosesAt.toISOString()

  // Generate voting ID
  const votingId = doc(collection(getFirestoreInstance(), 'voting'), '_').id

  const votingDoc: VotingDocument = {
    proposalId,
    teamId: proposal.teamId,
    title,
    description,
    options,
    status: 'open',
    votingPeriodDays: periodDuration,
    votingOpenedAt: now,
    votingClosesAt: votingClosesAtISO,
    votes: [],
    voteCount: 0,
    totalWeight: 0,
    results: undefined,
    winningOption: undefined,
    createdAt: now,
    updatedAt: now
  }

  const validatedDoc = votingDocumentSchema.parse(votingDoc)

  // Store in Firestore (voting/{votingId})
  const votingRef = doc(getFirestoreInstance(), 'voting', votingId)
  await setDoc(votingRef, {
    ...validatedDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    votingOpenedAt: serverTimestamp(),
    votingClosesAt: serverTimestamp()
  })

  // Update proposal with voting ID
  const proposalRef = doc(getFirestoreInstance(), 'governanceProposals', proposalId)
  await updateDoc(proposalRef, {
    votingId: votingId,
    updatedAt: serverTimestamp()
  })

  logger.info('Voting created for governance proposal', {
    votingId,
    proposalId,
    teamId: proposal.teamId,
    title,
    options: options.map(opt => opt.option),
    votingPeriodDays: periodDuration,
    votingClosesAt: votingClosesAtISO,
    status: 'open',
    cookWeighted: true // FR33: COOK-weighted voting
  })

  // Story 9.10: Create audit log for voting creation
  try {
    const { createAuditLog } = await import('./auditLogs')
    await createAuditLog(
      proposal.teamId,
      'voting_created',
      proposal.proposedBy || 'system',
      undefined, // participants
      'voting_created',
      {
        votingId,
        proposalId,
        title,
        options: options.map(opt => opt.option),
        votingPeriodDays: periodDuration,
        votingClosesAt: votingClosesAtISO
      },
      undefined, // cookWeights
      undefined, // totalWeight
      votingId,
      'voting',
      { proposalType: proposal.type }
    )
  } catch (error) {
    logger.error('Error creating audit log for voting creation', {
      votingId,
      proposalId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    // Continue even if audit log creation fails
  }

  const voting: Voting = {
    id: votingId,
    ...validatedDoc
  }

  return voting
}

/**
 * Cast a vote in a voting instance
 * 
 * @param votingId - Voting ID
 * @param voterId - Voter user ID
 * @param option - Vote option
 * @returns Updated voting instance
 */
export async function castVote(
  votingId: string,
  voterId: string,
  option: string
): Promise<Voting> {
  // Get existing voting
  const votingRef = doc(getFirestoreInstance(), 'voting', votingId)
  const votingSnap = await getDoc(votingRef)

  if (!votingSnap.exists()) {
    throw new Error('Voting not found')
  }

  const data = votingSnap.data()
  const existingVoting = votingSchema.parse({
    id: votingSnap.id,
    ...data,
    votingOpenedAt: data.votingOpenedAt?.toDate?.() 
      ? data.votingOpenedAt.toDate().toISOString() 
      : data.votingOpenedAt,
    votingClosesAt: data.votingClosesAt?.toDate?.() 
      ? data.votingClosesAt.toDate().toISOString() 
      : data.votingClosesAt,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    completedAt: data.completedAt?.toDate?.() 
      ? data.completedAt.toDate().toISOString() 
      : data.completedAt
  })

  // Check if voting is open
  if (existingVoting.status !== 'open') {
    throw new Error(`Voting is not open. Current status: ${existingVoting.status}`)
  }

  const now = new Date()
  if (existingVoting.votingClosesAt) {
    const closesAt = new Date(existingVoting.votingClosesAt)
    if (now > closesAt) {
      throw new Error('Voting period has closed')
    }
  }

  // Validate vote option
  const validOption = existingVoting.options.some(opt => opt.option === option)
  if (!validOption) {
    throw new Error(`Invalid vote option: ${option}`)
  }

  // Check if user has already voted
  const hasVoted = existingVoting.votes.some(vote => vote.voterId === voterId)
  if (hasVoted) {
    throw new Error('You have already voted')
  }

  // Get voter's governance weight (COOK-weighted vote)
  const governanceWeight = await getGovernanceWeight(existingVoting.teamId, voterId)
  const weight = governanceWeight?.weight || 0

  // Create new vote
  const newVote: Vote = {
    voterId,
    option,
    governanceWeight: weight,
    timestamp: new Date().toISOString()
  }

  // Add vote to existing votes
  const updatedVotes = [...existingVoting.votes, newVote]
  const updatedVoteCount = updatedVotes.length
  const updatedTotalWeight = updatedVotes.reduce((sum, vote) => sum + vote.governanceWeight, 0)

  // Update voting
  const update: VotingUpdate = {
    votes: updatedVotes,
    voteCount: updatedVoteCount,
    totalWeight: updatedTotalWeight,
    updatedAt: new Date().toISOString()
  }

  const validatedUpdate = votingUpdateSchema.parse(update)

  await updateDoc(votingRef, {
    ...validatedUpdate,
    updatedAt: serverTimestamp()
  })

  logger.info('Vote cast in voting', {
    votingId,
    proposalId: existingVoting.proposalId,
    teamId: existingVoting.teamId,
    voterId,
    option,
    governanceWeight: weight,
    voteCount: updatedVoteCount,
    totalWeight: updatedTotalWeight
  })

  // Return updated voting
  const updatedVoting = await getVoting(votingId)
  if (!updatedVoting) {
    throw new Error('Failed to retrieve updated voting')
  }

  return updatedVoting
}

/**
 * Calculate voting results
 * 
 * @param votingId - Voting ID
 * @returns Updated voting with results
 */
export async function calculateVotingResults(
  votingId: string
): Promise<Voting> {
  // Get existing voting
  const votingRef = doc(getFirestoreInstance(), 'voting', votingId)
  const votingSnap = await getDoc(votingRef)

  if (!votingSnap.exists()) {
    throw new Error('Voting not found')
  }

  const data = votingSnap.data()
  const existingVoting = votingSchema.parse({
    id: votingSnap.id,
    ...data,
    votingOpenedAt: data.votingOpenedAt?.toDate?.() 
      ? data.votingOpenedAt.toDate().toISOString() 
      : data.votingOpenedAt,
    votingClosesAt: data.votingClosesAt?.toDate?.() 
      ? data.votingClosesAt.toDate().toISOString() 
      : data.votingClosesAt,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    completedAt: data.completedAt?.toDate?.() 
      ? data.completedAt.toDate().toISOString() 
      : data.completedAt
  })

  if (existingVoting.status !== 'open' && existingVoting.status !== 'closed') {
    throw new Error(`Voting is not in a state that can be tallied. Current status: ${existingVoting.status}`)
  }

  // Calculate results for each option
  const results: Record<string, {
    option: string
    label: string
    voteCount: number
    weightedVoteCount: number
    percentage: number
  }> = {}

  const totalWeight = existingVoting.totalWeight

  for (const optionDef of existingVoting.options) {
    const optionVotes = existingVoting.votes.filter(vote => vote.option === optionDef.option)
    const voteCount = optionVotes.length
    const weightedVoteCount = optionVotes.reduce((sum, vote) => sum + vote.governanceWeight, 0)
    const percentage = totalWeight > 0 ? (weightedVoteCount / totalWeight) * 100 : 0

    results[optionDef.option] = {
      option: optionDef.option,
      label: optionDef.label,
      voteCount,
      weightedVoteCount,
      percentage
    }
  }

  // Determine winning option (highest weighted vote count)
  const winningOption = Object.entries(results)
    .sort((a, b) => b[1].weightedVoteCount - a[1].weightedVoteCount)[0]?.[0]

  // Update voting with results
  const update: VotingUpdate = {
    status: 'completed',
    results,
    winningOption,
    completedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }

  const validatedUpdate = votingUpdateSchema.parse(update)

  await updateDoc(votingRef, {
    ...validatedUpdate,
    updatedAt: serverTimestamp(),
    completedAt: serverTimestamp()
  })

  // Update proposal status based on voting results
  const { getGovernanceProposal, updateGovernanceProposalStatus } = await import('./governanceProposals')
  const proposal = await getGovernanceProposal(existingVoting.proposalId)
  
  if (proposal) {
    // Determine if proposal is approved or rejected based on winning option
    // This is a simple implementation - in practice, you might want more sophisticated logic
    const isApproved = winningOption === 'approve' || winningOption === 'yes'
    
    // Story 9.9: Constitutional challenges require higher approval threshold
    let finalApprovalStatus = isApproved
    if (isApproved && proposal.type === 'constitutional_challenge') {
      const { getTeam } = await import('./teams')
      const team = await getTeam(proposal.teamId)
      const constitutionalThreshold = team?.constitutionalApprovalThreshold || 50 // Default 50%
      
      const approveResult = results['approve']
      const approvalPercentage = approveResult ? approveResult.percentage : 0
      
      if (approvalPercentage < constitutionalThreshold) {
        finalApprovalStatus = false
        logger.warn('Constitutional change did not meet approval threshold', {
          proposalId: proposal.id,
          votingId,
          teamId: proposal.teamId,
          approvalPercentage,
          requiredThreshold: constitutionalThreshold
        })
      }
    }
    
    // Only update proposal status if not already handled by constitutional change logic
    if (!(finalApprovalStatus && proposal.type === 'constitutional_challenge')) {
      await updateGovernanceProposalStatus(
        existingVoting.proposalId,
        finalApprovalStatus ? 'approved' : 'rejected'
      )
    }

    // Story 9.8: If policy change is approved, record it with versioning
    if (finalApprovalStatus && proposal.type === 'policy_change') {
      try {
        const { createPolicyChange } = await import('./policyChanges')
        await createPolicyChange(
          proposal.teamId,
          proposal.id,
          votingId,
          proposal.title, // Policy name
          proposal.description || '', // Policy description
          'modified', // Default to modified (could be enhanced to detect created/deleted)
          `Policy change adopted via voting. Proposal: ${proposal.title}`,
          'voting'
        )
      } catch (error) {
        logger.error('Error recording policy change after voting approval', {
          proposalId: proposal.id,
          votingId,
          teamId: proposal.teamId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        // Continue even if policy change recording fails
      }
    }

    // Story 9.9: If constitutional challenge is approved, record it with versioning
    if (finalApprovalStatus && proposal.type === 'constitutional_challenge') {
      try {
        const { createConstitutionalChange } = await import('./constitutionalChanges')
        
        // Get approval percentage from results
        const approveResult = results['approve']
        const approvalPercentage = approveResult ? approveResult.percentage : 0
        
        await createConstitutionalChange(
          proposal.teamId,
          proposal.id,
          votingId,
          proposal.title, // Rule name
          proposal.description || '', // Rule description
          'modified', // Default to modified (could be enhanced to detect created/deleted)
          `Constitutional change adopted via voting. Proposal: ${proposal.title}`,
          proposal.description || 'Constitutional rule change', // Implications
          approvalPercentage,
          'voting'
        )
        
        // Update proposal status to approved
        await updateGovernanceProposalStatus(
          existingVoting.proposalId,
          'approved'
        )
      } catch (error) {
        logger.error('Error recording constitutional change after voting approval', {
          proposalId: proposal.id,
          votingId,
          teamId: proposal.teamId,
          error: error instanceof Error ? error.message : 'Unknown error'
        })
        // Continue even if constitutional change recording fails
      }
    }
  }

  logger.info('Voting results calculated', {
    votingId,
    proposalId: existingVoting.proposalId,
    teamId: existingVoting.teamId,
    totalVotes: existingVoting.voteCount,
    totalWeight,
    winningOption,
    results: Object.entries(results).map(([option, result]) => ({
      option,
      label: result.label,
      voteCount: result.voteCount,
      weightedVoteCount: result.weightedVoteCount,
      percentage: result.percentage
    })),
    status: 'completed'
  })

  // Return updated voting
  const updatedVoting = await getVoting(votingId)
  if (!updatedVoting) {
    throw new Error('Failed to retrieve updated voting')
  }

  return updatedVoting
}

/**
 * Close voting period
 * 
 * @param votingId - Voting ID
 * @returns Updated voting
 */
export async function closeVoting(
  votingId: string
): Promise<Voting> {
  // Get existing voting
  const votingRef = doc(getFirestoreInstance(), 'voting', votingId)
  const votingSnap = await getDoc(votingRef)

  if (!votingSnap.exists()) {
    throw new Error('Voting not found')
  }

  const data = votingSnap.data()
  const existingVoting = votingSchema.parse({
    id: votingSnap.id,
    ...data,
    votingOpenedAt: data.votingOpenedAt?.toDate?.() 
      ? data.votingOpenedAt.toDate().toISOString() 
      : data.votingOpenedAt,
    votingClosesAt: data.votingClosesAt?.toDate?.() 
      ? data.votingClosesAt.toDate().toISOString() 
      : data.votingClosesAt,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    completedAt: data.completedAt?.toDate?.() 
      ? data.completedAt.toDate().toISOString() 
      : data.completedAt
  })

  if (existingVoting.status !== 'open') {
    throw new Error(`Voting is not open. Current status: ${existingVoting.status}`)
  }

  // Close voting
  const update: VotingUpdate = {
    status: 'closed',
    updatedAt: new Date().toISOString()
  }

  const validatedUpdate = votingUpdateSchema.parse(update)

  await updateDoc(votingRef, {
    ...validatedUpdate,
    updatedAt: serverTimestamp()
  })

  logger.info('Voting period closed', {
    votingId,
    proposalId: existingVoting.proposalId,
    teamId: existingVoting.teamId,
    voteCount: existingVoting.voteCount,
    totalWeight: existingVoting.totalWeight,
    status: 'closed'
  })

  // Calculate results
  return await calculateVotingResults(votingId)
}

/**
 * Get voting by ID
 * 
 * @param votingId - Voting ID
 * @returns Voting or null if not found
 */
export async function getVoting(
  votingId: string
): Promise<Voting | null> {
  const votingRef = doc(getFirestoreInstance(), 'voting', votingId)
  const votingSnap = await getDoc(votingRef)

  if (!votingSnap.exists()) {
    return null
  }

  const data = votingSnap.data()
  return votingSchema.parse({
    id: votingSnap.id,
    ...data,
    votingOpenedAt: data.votingOpenedAt?.toDate?.() 
      ? data.votingOpenedAt.toDate().toISOString() 
      : data.votingOpenedAt,
    votingClosesAt: data.votingClosesAt?.toDate?.() 
      ? data.votingClosesAt.toDate().toISOString() 
      : data.votingClosesAt,
    createdAt: data.createdAt?.toDate?.() 
      ? data.createdAt.toDate().toISOString() 
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.() 
      ? data.updatedAt.toDate().toISOString() 
      : data.updatedAt,
    completedAt: data.completedAt?.toDate?.() 
      ? data.completedAt.toDate().toISOString() 
      : data.completedAt
  })
}

/**
 * Get all voting instances for a team
 * 
 * @param teamId - Team ID
 * @returns Array of voting instances
 */
export async function getTeamVoting(
  teamId: string
): Promise<Voting[]> {
  const votingRef = collection(getFirestoreInstance(), 'voting')
  const q = query(votingRef, where('teamId', '==', teamId))
  const querySnapshot = await getDocs(q)

  const votingInstances: Voting[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    try {
      const voting = votingSchema.parse({
        id: doc.id,
        ...data,
        votingOpenedAt: data.votingOpenedAt?.toDate?.() 
          ? data.votingOpenedAt.toDate().toISOString() 
          : data.votingOpenedAt,
        votingClosesAt: data.votingClosesAt?.toDate?.() 
          ? data.votingClosesAt.toDate().toISOString() 
          : data.votingClosesAt,
        createdAt: data.createdAt?.toDate?.() 
          ? data.createdAt.toDate().toISOString() 
          : data.createdAt,
        updatedAt: data.updatedAt?.toDate?.() 
          ? data.updatedAt.toDate().toISOString() 
          : data.updatedAt,
        completedAt: data.completedAt?.toDate?.() 
          ? data.completedAt.toDate().toISOString() 
          : data.completedAt
      })
      votingInstances.push(voting)
    } catch (error) {
      logger.error('Error parsing voting', {
        votingId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return votingInstances
}

