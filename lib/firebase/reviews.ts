'use client'

import {
  doc,
  collection,
  setDoc,
  getDoc,
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import { getCurrentUser, getCurrentUserDocument } from './auth'
import type { Review, ReviewDocument } from '@/lib/types/review'
import { reviewDocumentSchema, reviewSchema } from '@/lib/schemas/review'
import { logger } from '@/lib/utils/logger'
import { requireAuth, requireTeamMember } from '@/lib/permissions/checks'
import { getTask } from './tasks'

/**
 * Calculate required number of reviewers based on COOK value
 * Higher COOK values require more reviewers
 * Thresholds can be configured per team, but defaults are:
 * - COOK < 10: 1 reviewer
 * - COOK 10-50: 2 reviewers
 * - COOK > 50: 3 reviewers
 */
export function calculateRequiredReviewers(cookValue: number | undefined): number {
  if (cookValue === undefined || cookValue === 0) {
    return 1 // Default to 1 reviewer if no COOK value
  }
  
  if (cookValue < 10) {
    return 1
  } else if (cookValue <= 50) {
    return 2
  } else {
    return 3
  }
}

/**
 * Create a review document when a task enters Review state
 * This is called automatically when task state transitions to Review
 */
export async function initiateReview(
  teamId: string,
  taskId: string
): Promise<Review> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to initiate review')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get task to verify it exists and is in Review state
  const task = await getTask(teamId, taskId)
  if (!task) {
    throw new Error('Task not found')
  }

  if (task.state !== 'Review') {
    throw new Error('Task must be in Review state to initiate review')
  }

  // Check if review already exists
  const existingReview = await getReviewByTaskId(teamId, taskId)
  if (existingReview) {
    logger.info('Review already exists for task', { taskId, teamId, reviewId: existingReview.id })
    return existingReview
  }

  // Calculate required reviewers based on COOK value
  const requiredReviewers = calculateRequiredReviewers(task.cookValue)

  // Verify that enough reviewers are assigned
  const assignedReviewers = task.reviewers || []
  if (assignedReviewers.length < requiredReviewers) {
    throw new Error(
      `Task requires ${requiredReviewers} reviewer(s) based on COOK value (${task.cookValue || 0}), ` +
      `but only ${assignedReviewers.length} assigned. ` +
      `Please assign at least ${requiredReviewers} reviewer(s) before moving to Review.`
    )
  }

  // Log review requirements for audit
  logger.info('Review requirements calculated', {
    taskId,
    teamId,
    cookValue: task.cookValue,
    requiredReviewers,
    assignedReviewers: assignedReviewers.length,
    thresholds: {
      low: '< 10 COOK: 1 reviewer',
      medium: '10-50 COOK: 2 reviewers',
      high: '> 50 COOK: 3 reviewers'
    }
  })

  // Generate review ID
  const reviewId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'reviews'), '_').id

  const now = new Date().toISOString()
  const reviewDoc: ReviewDocument = {
    taskId,
    teamId,
    status: 'pending',
    requiredReviewers,
    approvals: [],
    objections: [],
    comments: [],
    escalated: false,
    createdAt: now,
    updatedAt: now
  }

  // Validate with Zod schema
  const validatedReviewDoc = reviewDocumentSchema.parse(reviewDoc)

  // Create review document
  const reviewRef = doc(getFirestoreInstance(), 'teams', teamId, 'reviews', reviewId)
  await setDoc(reviewRef, {
    ...validatedReviewDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  logger.info('Review initiated', {
    reviewId,
    taskId,
    teamId,
    requiredReviewers,
    assignedReviewers: assignedReviewers.length,
    userId: currentUser.uid
  })

  // Notifications are sent automatically via Firestore trigger (onReviewInitiated)
  // when the review document is created (Epic 5, Story 5.1)

  // Return review object with ID
  const review: Review = {
    id: reviewId,
    ...validatedReviewDoc
  }

  return review
}

/**
 * Get review document by ID
 */
export async function getReview(
  teamId: string,
  reviewId: string
): Promise<Review | null> {
  const reviewDocRef = doc(getFirestoreInstance(), 'teams', teamId, 'reviews', reviewId)
  const reviewDocSnap = await getDoc(reviewDocRef)

  if (!reviewDocSnap.exists()) {
    return null
  }

  const data = reviewDocSnap.data()

  // Convert Firestore Timestamp to ISO string
  const createdAt =
    data.createdAt?.toDate?.()?.toISOString() ||
    (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString())
  const updatedAt =
    data.updatedAt?.toDate?.()?.toISOString() ||
    (typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString())
  const escalatedAt = data.escalatedAt
    ? (data.escalatedAt?.toDate?.()?.toISOString() ||
       (typeof data.escalatedAt === 'string' ? data.escalatedAt : undefined))
    : undefined
  const objectionWindowOpenedAt = data.objectionWindowOpenedAt
    ? (data.objectionWindowOpenedAt?.toDate?.()?.toISOString() ||
       (typeof data.objectionWindowOpenedAt === 'string' ? data.objectionWindowOpenedAt : undefined))
    : undefined
  const objectionWindowClosesAt = data.objectionWindowClosesAt
    ? (data.objectionWindowClosesAt?.toDate?.()?.toISOString() ||
       (typeof data.objectionWindowClosesAt === 'string' ? data.objectionWindowClosesAt : undefined))
    : undefined

  const review: Review = {
    id: reviewId,
    taskId: data.taskId || '',
    teamId: data.teamId || teamId,
    status: data.status || 'pending',
    requiredReviewers: data.requiredReviewers || 1,
    approvals: data.approvals || [],
    objections: data.objections || [],
    comments: data.comments || [],
    checklist: data.checklist || undefined, // Story 10B.2: AI Review Checklist
    escalated: data.escalated || false,
    escalatedTo: data.escalatedTo,
    escalatedBy: data.escalatedBy,
    escalatedAt,
    escalationReason: data.escalationReason,
    objectionWindowOpenedAt,
    objectionWindowClosesAt,
    objectionWindowDurationDays: data.objectionWindowDurationDays,
    createdAt,
    updatedAt
  }

  // Validate with Zod schema
  return reviewSchema.parse(review)
}

/**
 * Get review by task ID
 */
export async function getReviewByTaskId(
  teamId: string,
  taskId: string
): Promise<Review | null> {
  const reviewsRef = collection(getFirestoreInstance(), 'teams', teamId, 'reviews')
  const q = query(reviewsRef, where('taskId', '==', taskId))
  const querySnapshot = await getDocs(q)

  if (querySnapshot.empty) {
    return null
  }

  // Should only be one review per task
  const reviewDoc = querySnapshot.docs[0]
  return getReview(teamId, reviewDoc.id)
}

/**
 * Check if review has all required approvals
 */
export function hasAllRequiredApprovals(review: Review): boolean {
  return review.approvals.length >= review.requiredReviewers
}

/**
 * Check if review can be completed (all required reviewers approved, no objections)
 */
export function canCompleteReview(review: Review): boolean {
  return hasAllRequiredApprovals(review) && review.objections.length === 0 && review.status !== 'objected'
}

/**
 * Check if review has objections
 */
export function hasObjections(review: Review): boolean {
  return review.objections.length > 0 || review.status === 'objected'
}

/**
 * Get review progress information
 * Returns how many reviewers have approved out of required
 */
export function getReviewProgress(review: Review): {
  approvals: number
  required: number
  remaining: number
  progress: number // 0-100
} {
  const approvals = review.approvals.length
  const required = review.requiredReviewers
  const remaining = Math.max(0, required - approvals)
  const progress = required > 0 ? Math.round((approvals / required) * 100) : 0

  return {
    approvals,
    required,
    remaining,
    progress
  }
}

/**
 * Add a comment to a review
 * Comments are visible to task contributors and other reviewers
 */
export async function addReviewComment(
  teamId: string,
  reviewId: string,
  comment: string
): Promise<Review> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to add comments')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing review
  const existingReview = await getReview(teamId, reviewId)
  if (!existingReview) {
    throw new Error('Review not found')
  }

  // Get task to verify user is assigned as reviewer
  const task = await getTask(teamId, existingReview.taskId)
  if (!task) {
    throw new Error('Task not found')
  }

  // Verify user is assigned as reviewer
  const isReviewer = task.reviewers?.includes(currentUser.uid) || false
  const userRole = userDoc.teams[teamId]
  const isSteward = userRole === 'Steward' || userRole === 'Admin'

  if (!isReviewer && !isSteward) {
    throw new Error('Only assigned reviewers or stewards can add comments to reviews')
  }

  // Validate comment
  if (!comment.trim()) {
    throw new Error('Comment cannot be empty')
  }

  if (comment.length > 5000) {
    throw new Error('Comment must be 5000 characters or less')
  }

  // Create new comment object
  const newComment = {
    reviewerId: currentUser.uid,
    comment: comment.trim(),
    timestamp: new Date().toISOString()
  }

  // Add comment to existing comments array
  const updatedComments = [...(existingReview.comments || []), newComment]

  // Update review document
  const reviewRef = doc(getFirestoreInstance(), 'teams', teamId, 'reviews', reviewId)
  await setDoc(
    reviewRef,
    {
      comments: updatedComments,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  logger.info('Review comment added', {
    reviewId,
    taskId: existingReview.taskId,
    teamId,
    reviewerId: currentUser.uid,
    commentLength: comment.length
  })

  // Return updated review
  const updatedReview = await getReview(teamId, reviewId)
  if (!updatedReview) {
    throw new Error('Failed to retrieve updated review')
  }

  return updatedReview
}

/**
 * Approve a review
 * Records the reviewer's approval and updates review status if all required reviewers have approved
 */
export async function approveReview(
  teamId: string,
  reviewId: string
): Promise<Review> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to approve reviews')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing review
  const existingReview = await getReview(teamId, reviewId)
  if (!existingReview) {
    throw new Error('Review not found')
  }

  // Get task to verify user is assigned as reviewer
  const task = await getTask(teamId, existingReview.taskId)
  if (!task) {
    throw new Error('Task not found')
  }

  // Verify user is assigned as reviewer
  const isReviewer = task.reviewers?.includes(currentUser.uid) || false
  const userRole = userDoc.teams[teamId]
  const isSteward = userRole === 'Steward' || userRole === 'Admin'

  if (!isReviewer && !isSteward) {
    throw new Error('Only assigned reviewers or stewards can approve reviews')
  }

  // Check if reviewer has already approved
  if (existingReview.approvals.includes(currentUser.uid)) {
    throw new Error('You have already approved this review')
  }

  // Check if review is already approved or objected
  if (existingReview.status === 'approved') {
    throw new Error('Review is already approved')
  }

  if (existingReview.status === 'objected') {
    throw new Error('Cannot approve a review that has objections. Please resolve objections first.')
  }

  // Add approval to approvals array
  const updatedApprovals = [...existingReview.approvals, currentUser.uid]

  // Check if all required reviewers have approved
  const allApproved = updatedApprovals.length >= existingReview.requiredReviewers
  const newStatus: 'pending' | 'approved' = allApproved ? 'approved' : 'pending'

  // Update review document
  const reviewRef = doc(getFirestoreInstance(), 'teams', teamId, 'reviews', reviewId)
  await setDoc(
    reviewRef,
    {
      approvals: updatedApprovals,
      status: newStatus,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  logger.info('Review approved', {
    reviewId,
    taskId: existingReview.taskId,
    teamId,
    reviewerId: currentUser.uid,
    approvals: updatedApprovals.length,
    requiredReviewers: existingReview.requiredReviewers,
    allApproved,
    newStatus,
    // Approval provides implicit consent for governance (FR30, Story 6B.5)
    implicitConsent: true
  })

  // If all required reviewers approved, log that review is complete
  if (allApproved) {
    logger.info('Review completed - all required reviewers approved', {
      reviewId,
      taskId: existingReview.taskId,
      teamId,
      approvals: updatedApprovals.length,
      requiredReviewers: existingReview.requiredReviewers
    })
    // Next step in workflow is triggered automatically via Firestore trigger (onReviewApproved)
    // which handles COOK finalization and issuance (Epic 6B)
  }

  // Return updated review
  const updatedReview = await getReview(teamId, reviewId)
  if (!updatedReview) {
    throw new Error('Failed to retrieve updated review')
  }

  return updatedReview
}

/**
 * Raise an objection to a review
 * Records the objection, sets review status to "objected", and pauses workflow
 */
export async function objectToReview(
  teamId: string,
  reviewId: string,
  reason: string
): Promise<Review> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to raise objections')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing review
  const existingReview = await getReview(teamId, reviewId)
  if (!existingReview) {
    throw new Error('Review not found')
  }

  // Get task to verify user is assigned as reviewer
  const task = await getTask(teamId, existingReview.taskId)
  if (!task) {
    throw new Error('Task not found')
  }

  // Verify user is assigned as reviewer
  const isReviewer = task.reviewers?.includes(currentUser.uid) || false
  const userRole = userDoc.teams[teamId]
  const isSteward = userRole === 'Steward' || userRole === 'Admin'

  if (!isReviewer && !isSteward) {
    throw new Error('Only assigned reviewers or stewards can raise objections')
  }

  // Validate objection reason
  if (!reason.trim()) {
    throw new Error('Objection reason is required')
  }

  if (reason.length > 5000) {
    throw new Error('Objection reason must be 5000 characters or less')
  }

  // Check if reviewer has already raised an objection
  const existingObjection = existingReview.objections.find(
    obj => obj.reviewerId === currentUser.uid
  )
  if (existingObjection) {
    throw new Error('You have already raised an objection to this review')
  }

  // Check if review is already finalized
  if (existingReview.status === 'approved') {
    throw new Error('Cannot raise objection to an already approved review')
  }

  // Create new objection object
  const newObjection = {
    reviewerId: currentUser.uid,
    reason: reason.trim(),
    timestamp: new Date().toISOString()
  }

  // Add objection to existing objections array
  const updatedObjections = [...(existingReview.objections || []), newObjection]

  // Story 6B.6: Open objection window when first objection is raised
  const isFirstObjection = existingReview.objections.length === 0
  let objectionWindowOpenedAt: string | undefined
  let objectionWindowClosesAt: string | undefined
  let objectionWindowDurationDays: number | undefined

  if (isFirstObjection) {
    // Get team config for objection window duration
    const { getTeam } = await import('./teams')
    const team = await getTeam(teamId)
    const windowDuration = team?.defaultObjectionWindowDays || 7 // Default to 7 days

    const now = new Date().toISOString()
    const windowClosesAt = new Date()
    windowClosesAt.setDate(windowClosesAt.getDate() + windowDuration)
    const windowClosesAtISO = windowClosesAt.toISOString()

    objectionWindowOpenedAt = now
    objectionWindowClosesAt = windowClosesAtISO
    objectionWindowDurationDays = windowDuration

    logger.info('Opening objection window for review', {
      reviewId,
      teamId,
      taskId: existingReview.taskId,
      windowDuration,
      openedAt: now,
      closesAt: windowClosesAtISO
    })
  } else {
    // Objection window already open, preserve existing values
    objectionWindowOpenedAt = existingReview.objectionWindowOpenedAt
    objectionWindowClosesAt = existingReview.objectionWindowClosesAt
    objectionWindowDurationDays = existingReview.objectionWindowDurationDays
  }

  // Update review document - set status to "objected" and add objection
  const reviewRef = doc(getFirestoreInstance(), 'teams', teamId, 'reviews', reviewId)
  const updateData: any = {
    objections: updatedObjections,
    status: 'objected',
    updatedAt: serverTimestamp()
  }

  // Only set objection window fields if this is the first objection
  if (isFirstObjection) {
    updateData.objectionWindowOpenedAt = serverTimestamp()
    updateData.objectionWindowClosesAt = objectionWindowClosesAt
    updateData.objectionWindowDurationDays = objectionWindowDurationDays
  }

  await setDoc(reviewRef, updateData, { merge: true })

  logger.info('Review objection raised', {
    reviewId,
    taskId: existingReview.taskId,
    teamId,
    reviewerId: currentUser.uid,
    objectionCount: updatedObjections.length,
    reasonLength: reason.length,
    isFirstObjection,
    objectionWindowOpened: isFirstObjection,
    objectionWindowDurationDays: isFirstObjection ? objectionWindowDurationDays : undefined
  })

  // Return updated review
  const updatedReview = await getReview(teamId, reviewId)
  if (!updatedReview) {
    throw new Error('Failed to retrieve updated review')
  }

  return updatedReview
}

/**
 * Escalate a review dispute to stewards
 * Flags the dispute for steward review and records escalation details
 */
export async function escalateReviewDispute(
  teamId: string,
  reviewId: string,
  stewardId?: string,
  escalationReason?: string
): Promise<Review> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to escalate disputes')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing review
  const existingReview = await getReview(teamId, reviewId)
  if (!existingReview) {
    throw new Error('Review not found')
  }

  // Get task to verify user is involved (contributor or reviewer)
  const task = await getTask(teamId, existingReview.taskId)
  if (!task) {
    throw new Error('Task not found')
  }

  // Verify user is involved in the review (contributor, reviewer, or steward)
  const isContributor = task.contributors.includes(currentUser.uid)
  const isReviewer = task.reviewers?.includes(currentUser.uid) || false
  const userRole = userDoc.teams[teamId]
  const isSteward = userRole === 'Steward' || userRole === 'Admin'

  if (!isContributor && !isReviewer && !isSteward) {
    throw new Error('Only task contributors, reviewers, or stewards can escalate disputes')
  }

  // Check if review is already escalated
  if (existingReview.escalated) {
    throw new Error('Review dispute has already been escalated')
  }

  // If stewardId is provided, verify it's a steward
  let targetStewardId = stewardId
  if (targetStewardId) {
    const { getTeamMembers } = await import('./teams')
    const members = await getTeamMembers(teamId)
    const steward = members.find(m => m.user.id === targetStewardId && (m.role === 'Steward' || m.role === 'Admin'))
    if (!steward) {
      throw new Error('Specified steward not found or does not have steward/admin role')
    }
  } else {
    // If no steward specified, escalation is to all stewards
    // The first available steward will be recorded (or we can leave it null for "all stewards")
    targetStewardId = undefined
  }

  // Update review document - set escalated flag and status
  const reviewRef = doc(getFirestoreInstance(), 'teams', teamId, 'reviews', reviewId)
  await setDoc(
    reviewRef,
    {
      escalated: true,
      escalatedTo: targetStewardId,
      escalatedBy: currentUser.uid,
      escalatedAt: new Date().toISOString(),
      escalationReason: escalationReason,
      status: 'escalated',
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  logger.info('Review dispute escalated', {
    reviewId,
    taskId: existingReview.taskId,
    teamId,
    escalatedBy: currentUser.uid,
    escalatedTo: targetStewardId || 'all stewards',
    escalationReason: escalationReason || 'Not provided',
    hasObjections: existingReview.objections.length > 0,
    objectionCount: existingReview.objections.length,
    approvals: existingReview.approvals.length,
    requiredReviewers: existingReview.requiredReviewers
  })

  // Story 5.6: Initiate dispute resolution process
  // This may trigger voting if objection threshold is exceeded
  try {
    await initiateDisputeResolution(teamId, reviewId, existingReview, task, escalationReason)
  } catch (error) {
    // Log error but don't throw - escalation should still succeed
    logger.error('Error initiating dispute resolution process', {
      reviewId,
      teamId,
      taskId: existingReview.taskId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Return updated review
  const updatedReview = await getReview(teamId, reviewId)
  if (!updatedReview) {
    throw new Error('Failed to retrieve updated review')
  }

  return updatedReview
}

/**
 * Initiate dispute resolution process for an escalated review
 * 
 * Story 5.6: Initiate dispute resolution process when escalated
 * 
 * This function:
 * - Checks if objections exceed threshold (may trigger governance proposal/voting)
 * - Creates governance proposal if threshold exceeded
 * - Otherwise, stewards can resolve directly through workflow
 * 
 * @param teamId - Team ID
 * @param reviewId - Review ID
 * @param review - Review document
 * @param task - Task document
 * @param escalationReason - Optional reason for escalation
 */
async function initiateDisputeResolution(
  teamId: string,
  reviewId: string,
  review: Review,
  task: any,
  escalationReason?: string
): Promise<void> {
  // Get team configuration for objection threshold
  const { getTeam } = await import('./teams')
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  const objectionCount = review.objections.length
  const objectionThreshold = team.defaultObjectionThreshold ?? 0

  // Check if objection threshold is exceeded
  // If threshold is 0, stewards resolve directly (no proposal needed)
  // If threshold > 0 and objections exceed it, create governance proposal
  const thresholdExceeded = objectionThreshold > 0 && objectionCount >= objectionThreshold

  if (thresholdExceeded) {
    // Threshold exceeded - create governance proposal for dispute resolution
    logger.info('Objection threshold exceeded - creating governance proposal for dispute resolution', {
      reviewId,
      teamId,
      taskId: review.taskId,
      objectionCount,
      objectionThreshold
    })

    try {
      const { createGovernanceProposal } = await import('./governanceProposals')
      
      const taskTitle = task.title || 'Untitled Task'
      const proposalTitle = `Review Dispute Resolution: ${taskTitle}`
      const proposalDescription = `Review dispute escalated for task "${taskTitle}".\n\n` +
        `Review ID: ${reviewId}\n` +
        `Task ID: ${review.taskId}\n` +
        `Objections: ${objectionCount}\n` +
        `Required Reviewers: ${review.requiredReviewers}\n` +
        `Approvals: ${review.approvals.length}\n` +
        (escalationReason ? `Escalation Reason: ${escalationReason}\n` : '') +
        `\nThis proposal was automatically created because the objection threshold (${objectionThreshold}) was exceeded.`

      // Create governance proposal for dispute resolution
      // Use 'binding_decision' type for review disputes
      await createGovernanceProposal(
        teamId,
        'binding_decision',
        proposalTitle,
        proposalDescription,
        review.escalatedBy || 'system', // Use escalatedBy if available, otherwise 'system'
        team.defaultObjectionWindowDays, // Use team's default objection window
        objectionThreshold // Use team's default threshold
      )

      logger.info('Governance proposal created for review dispute', {
        reviewId,
        teamId,
        taskId: review.taskId,
        objectionCount,
        objectionThreshold
      })
    } catch (error) {
      logger.error('Error creating governance proposal for dispute resolution', {
        reviewId,
        teamId,
        taskId: review.taskId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      // Don't throw - stewards can still resolve manually
    }
  } else {
    // Threshold not exceeded - stewards can resolve directly through workflow
    logger.info('Objection threshold not exceeded - stewards can resolve dispute directly', {
      reviewId,
      teamId,
      taskId: review.taskId,
      objectionCount,
      objectionThreshold,
      resolutionMethod: 'steward_direct_resolution'
    })
  }

  // Log that dispute resolution process has been initiated
  logger.info('Dispute resolution process initiated', {
    reviewId,
    teamId,
    taskId: review.taskId,
    objectionCount,
    objectionThreshold,
    thresholdExceeded,
    resolutionMethod: thresholdExceeded ? 'governance_proposal' : 'steward_direct_resolution'
  })
}

/**
 * Update a review
 * 
 * Story 10B.2: AI Review Assistance - Checklists
 * 
 * @param teamId - Team ID
 * @param reviewId - Review ID
 * @param updates - Review update data
 * @returns Updated review
 */
export async function updateReview(
  teamId: string,
  reviewId: string,
  updates: {
    checklist?: Array<{
      id: string
      text: string
      category: string
      required: boolean
      checked: boolean
    }>
    updatedAt: string
  }
): Promise<Review> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to update reviews')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing review
  const existingReview = await getReview(teamId, reviewId)
  if (!existingReview) {
    throw new Error('Review not found')
  }

  // Update review document
  const reviewRef = doc(getFirestoreInstance(), 'teams', teamId, 'reviews', reviewId)
  await setDoc(
    reviewRef,
    {
      ...updates,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  logger.info('Review updated', {
    reviewId,
    taskId: existingReview.taskId,
    teamId,
    updatedBy: currentUser.uid,
    hasChecklist: !!updates.checklist
  })

  // Return updated review
  const updatedReview = await getReview(teamId, reviewId)
  if (!updatedReview) {
    throw new Error('Failed to retrieve updated review')
  }

  return updatedReview
}

