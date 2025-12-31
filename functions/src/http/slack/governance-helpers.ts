/**
 * Governance Helpers for Slack Commands
 *
 * Story 11B.3: Governance Actions via Slack
 *
 * Provides helper functions for governance operations in Cloud Functions
 */

import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'

const db = getFirestore()

/**
 * Get governance proposal by ID
 *
 * @param proposalId - Proposal ID
 * @returns Proposal document or null
 */
export async function getGovernanceProposalFromFirestore(
  proposalId: string
): Promise<any | null> {
  try {
    const proposalRef = db.collection('governanceProposals').doc(proposalId)
    const proposalDoc = await proposalRef.get()

    if (!proposalDoc.exists) {
      return null
    }

    const data = proposalDoc.data()!
    return {
      id: proposalId,
      ...data
    }
  } catch (error) {
    logger.error('Error fetching governance proposal', {
      proposalId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Get voting instance by ID
 *
 * @param votingId - Voting ID
 * @returns Voting document or null
 */
export async function getVotingFromFirestore(votingId: string): Promise<any | null> {
  try {
    const votingRef = db.collection('voting').doc(votingId)
    const votingDoc = await votingRef.get()

    if (!votingDoc.exists) {
      return null
    }

    const data = votingDoc.data()!
    return {
      id: votingId,
      ...data
    }
  } catch (error) {
    logger.error('Error fetching voting instance', {
      votingId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Get governance weight for a user
 *
 * @param teamId - Team ID
 * @param userId - User ID
 * @returns Governance weight or 0
 */
export async function getGovernanceWeightFromFirestore(
  teamId: string,
  userId: string
): Promise<number> {
  try {
    const weightRef = db
      .collection('teams')
      .doc(teamId)
      .collection('governanceWeights')
      .doc(userId)
    const weightDoc = await weightRef.get()

    if (!weightDoc.exists) {
      return 0
    }

    const data = weightDoc.data()!
    return data.weight || 0
  } catch (error) {
    logger.error('Error fetching governance weight', {
      teamId,
      userId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return 0
  }
}

/**
 * Cast a vote in a voting instance
 *
 * @param votingId - Voting ID
 * @param userId - User ID casting vote
 * @param option - Vote option
 * @returns Updated voting document
 */
export async function castVoteInFirestore(
  votingId: string,
  userId: string,
  option: string
): Promise<any> {
  const votingRef = db.collection('voting').doc(votingId)
  const votingDoc = await votingRef.get()

  if (!votingDoc.exists) {
    throw new Error('Voting not found')
  }

  const votingData = votingDoc.data()!

  // Check if voting is open
  if (votingData.status !== 'open') {
    throw new Error(`Voting is not open. Current status: ${votingData.status}`)
  }

  // Check if voting period has closed
  if (votingData.votingClosesAt) {
    const closesAt = votingData.votingClosesAt.toDate
      ? votingData.votingClosesAt.toDate()
      : new Date(votingData.votingClosesAt)
    if (new Date() > closesAt) {
      throw new Error('Voting period has closed')
    }
  }

  // Validate option
  const validOptions = (votingData.options || []).map((opt: any) => opt.option || opt)
  if (!validOptions.includes(option)) {
    throw new Error(
      `Invalid vote option: ${option}. Valid options: ${validOptions.join(', ')}`
    )
  }

  // Check if user has already voted
  const existingVotes = votingData.votes || []
  const hasVoted = existingVotes.some((vote: any) => vote.voterId === userId)
  if (hasVoted) {
    throw new Error('You have already cast a vote in this voting')
  }

  // Get user's governance weight (COOK-weighted vote)
  const governanceWeight = await getGovernanceWeightFromFirestore(
    votingData.teamId,
    userId
  )

  // Create new vote
  const newVote = {
    voterId: userId,
    option,
    governanceWeight,
    timestamp: new Date().toISOString()
  }

  // Add vote to existing votes
  const updatedVotes = [...existingVotes, newVote]
  const updatedVoteCount = updatedVotes.length
  const updatedTotalWeight = updatedVotes.reduce(
    (sum, vote: any) => sum + (vote.governanceWeight || 0),
    0
  )

  // Update voting
  await votingRef.update({
    votes: updatedVotes,
    voteCount: updatedVoteCount,
    totalWeight: updatedTotalWeight,
    updatedAt: new Date().toISOString()
  })

  logger.info('Vote cast via Slack', {
    votingId,
    proposalId: votingData.proposalId,
    teamId: votingData.teamId,
    userId,
    option,
    governanceWeight,
    voteCount: updatedVoteCount,
    totalWeight: updatedTotalWeight
  })

  // Return updated voting
  const updatedDoc = await votingRef.get()
  return {
    id: votingId,
    ...updatedDoc.data()
  }
}

/**
 * Add an objection to a governance proposal
 *
 * @param proposalId - Proposal ID
 * @param userId - User ID objecting
 * @param reason - Objection reason
 * @returns Updated proposal document
 */
export async function addObjectionToProposalInFirestore(
  proposalId: string,
  userId: string,
  reason: string
): Promise<any> {
  const proposalRef = db.collection('governanceProposals').doc(proposalId)
  const proposalDoc = await proposalRef.get()

  if (!proposalDoc.exists) {
    throw new Error('Governance proposal not found')
  }

  const proposalData = proposalDoc.data()!

  // Check if objection window is open
  if (proposalData.status !== 'objection_window_open') {
    throw new Error(
      `Objection window is not open. Current status: ${proposalData.status}`
    )
  }

  // Check if objection window has closed
  if (proposalData.objectionWindowClosesAt) {
    const closesAt = proposalData.objectionWindowClosesAt.toDate
      ? proposalData.objectionWindowClosesAt.toDate()
      : new Date(proposalData.objectionWindowClosesAt)
    if (new Date() > closesAt) {
      throw new Error('Objection window has closed')
    }
  }

  // Validate reason
  if (!reason.trim()) {
    throw new Error('Objection reason is required')
  }

  if (reason.length > 1000) {
    throw new Error('Objection reason must be 1000 characters or less')
  }

  // Check if user has already objected
  const existingObjections = proposalData.objections || []
  const hasObjected = existingObjections.some((obj: any) => obj.objectorId === userId)
  if (hasObjected) {
    throw new Error('You have already objected to this proposal')
  }

  // Get user's governance weight (COOK-weighted objection)
  const governanceWeight = await getGovernanceWeightFromFirestore(
    proposalData.teamId,
    userId
  )

  // Create new objection
  const newObjection = {
    objectorId: userId,
    reason: reason.trim(),
    timestamp: new Date().toISOString(),
    governanceWeight
  }

  // Add objection to existing objections
  const updatedObjections = [...existingObjections, newObjection]
  const updatedObjectionCount = updatedObjections.length
  const updatedWeightedObjectionCount = updatedObjections.reduce(
    (sum: number, obj: any) => sum + (obj.governanceWeight || 0),
    0
  )

  // Check if threshold is exceeded
  const threshold = proposalData.objectionThreshold ?? 0
  const thresholdExceeded =
    updatedObjectionCount > threshold || updatedWeightedObjectionCount > threshold

  // Update proposal
  const update: any = {
    objections: updatedObjections,
    objectionCount: updatedObjectionCount,
    weightedObjectionCount: updatedWeightedObjectionCount,
    votingTriggered: thresholdExceeded,
    status: thresholdExceeded ? 'voting_triggered' : proposalData.status,
    updatedAt: new Date().toISOString()
  }

  await proposalRef.update(update)

  logger.info('Objection added to proposal via Slack', {
    proposalId,
    teamId: proposalData.teamId,
    userId,
    objectionCount: updatedObjectionCount,
    weightedObjectionCount: updatedWeightedObjectionCount,
    threshold,
    thresholdExceeded,
    votingTriggered: thresholdExceeded
  })

  // Return updated proposal
  const updatedDoc = await proposalRef.get()
  return {
    id: proposalId,
    ...updatedDoc.data()
  }
}
