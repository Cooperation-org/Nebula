/**
 * Review Helpers for Slack Commands
 * 
 * Story 11B.2: Review Workflow via Slack
 * 
 * Provides helper functions for review operations in Cloud Functions
 */

import { getFirestore } from 'firebase-admin/firestore'
import { logger } from '../../shared/logger'

const db = getFirestore()

/**
 * Get review by task ID
 * 
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @returns Review document or null
 */
export async function getReviewByTaskId(
  teamId: string,
  taskId: string
): Promise<any | null> {
  try {
    const reviewsRef = db.collection('teams').doc(teamId).collection('reviews')
    const snapshot = await reviewsRef.where('taskId', '==', taskId).limit(1).get()
    
    if (snapshot.empty) {
      return null
    }
    
    const reviewDoc = snapshot.docs[0]
    const data = reviewDoc.data()
    
    return {
      id: reviewDoc.id,
      ...data
    }
  } catch (error) {
    logger.error('Error fetching review by task ID', {
      teamId,
      taskId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Approve a review
 * 
 * @param teamId - Team ID
 * @param reviewId - Review ID
 * @param userId - User ID approving the review
 * @returns Updated review document
 */
export async function approveReviewInFirestore(
  teamId: string,
  reviewId: string,
  userId: string
): Promise<any> {
  const reviewRef = db.collection('teams').doc(teamId).collection('reviews').doc(reviewId)
  const reviewDoc = await reviewRef.get()
  
  if (!reviewDoc.exists) {
    throw new Error('Review not found')
  }
  
  const reviewData = reviewDoc.data()!
  const currentApprovals = reviewData.approvals || []
  
  // Check if already approved
  if (currentApprovals.includes(userId)) {
    throw new Error('You have already approved this review')
  }
  
  // Check if review is already approved
  if (reviewData.status === 'approved') {
    throw new Error('Review is already approved')
  }
  
  // Check if review has objections
  if (reviewData.status === 'objected') {
    throw new Error('Cannot approve a review that has objections. Please resolve objections first.')
  }
  
  // Add approval
  const updatedApprovals = [...currentApprovals, userId]
  const requiredReviewers = reviewData.requiredReviewers || 1
  const allApproved = updatedApprovals.length >= requiredReviewers
  const newStatus = allApproved ? 'approved' : 'pending'
  
  // Update review
  await reviewRef.update({
    approvals: updatedApprovals,
    status: newStatus,
    updatedAt: new Date().toISOString()
  })
  
  logger.info('Review approved via Slack', {
    reviewId,
    taskId: reviewData.taskId,
    teamId,
    userId,
    approvals: updatedApprovals.length,
    requiredReviewers,
    allApproved
  })
  
  // Return updated review
  const updatedDoc = await reviewRef.get()
  return {
    id: reviewId,
    ...updatedDoc.data()
  }
}

/**
 * Object to a review
 * 
 * @param teamId - Team ID
 * @param reviewId - Review ID
 * @param userId - User ID objecting
 * @param reason - Objection reason
 * @returns Updated review document
 */
export async function objectToReviewInFirestore(
  teamId: string,
  reviewId: string,
  userId: string,
  reason: string
): Promise<any> {
  const reviewRef = db.collection('teams').doc(teamId).collection('reviews').doc(reviewId)
  const reviewDoc = await reviewRef.get()
  
  if (!reviewDoc.exists) {
    throw new Error('Review not found')
  }
  
  const reviewData = reviewDoc.data()!
  const currentObjections = reviewData.objections || []
  
  // Validate reason
  if (!reason.trim()) {
    throw new Error('Objection reason is required')
  }
  
  if (reason.length > 1000) {
    throw new Error('Objection reason must be 1000 characters or less')
  }
  
  // Check if already objected
  const existingObjection = currentObjections.find((obj: any) => obj.reviewerId === userId)
  if (existingObjection) {
    throw new Error('You have already raised an objection to this review')
  }
  
  // Check if review is already approved
  if (reviewData.status === 'approved') {
    throw new Error('Cannot raise objection to an already approved review')
  }
  
  // Add objection
  const newObjection = {
    reviewerId: userId,
    reason: reason.trim(),
    timestamp: new Date().toISOString()
  }
  
  const updatedObjections = [...currentObjections, newObjection]
  
  // Update review
  await reviewRef.update({
    objections: updatedObjections,
    status: 'objected',
    updatedAt: new Date().toISOString()
  })
  
  logger.info('Review objected via Slack', {
    reviewId,
    taskId: reviewData.taskId,
    teamId,
    userId,
    objectionCount: updatedObjections.length,
    reasonLength: reason.length
  })
  
  // Return updated review
  const updatedDoc = await reviewRef.get()
  return {
    id: reviewId,
    ...updatedDoc.data()
  }
}

/**
 * Add a comment to a review
 * 
 * @param teamId - Team ID
 * @param reviewId - Review ID
 * @param userId - User ID adding comment
 * @param comment - Comment text
 * @returns Updated review document
 */
export async function addReviewCommentInFirestore(
  teamId: string,
  reviewId: string,
  userId: string,
  comment: string
): Promise<any> {
  const reviewRef = db.collection('teams').doc(teamId).collection('reviews').doc(reviewId)
  const reviewDoc = await reviewRef.get()
  
  if (!reviewDoc.exists) {
    throw new Error('Review not found')
  }
  
  // Validate comment
  if (!comment.trim()) {
    throw new Error('Comment cannot be empty')
  }
  
  if (comment.length > 5000) {
    throw new Error('Comment must be 5000 characters or less')
  }
  
  const reviewData = reviewDoc.data()!
  const currentComments = reviewData.comments || []
  
  // Add comment
  const newComment = {
    reviewerId: userId,
    comment: comment.trim(),
    timestamp: new Date().toISOString()
  }
  
  const updatedComments = [...currentComments, newComment]
  
  // Update review
  await reviewRef.update({
    comments: updatedComments,
    updatedAt: new Date().toISOString()
  })
  
  logger.info('Review comment added via Slack', {
    reviewId,
    taskId: reviewData.taskId,
    teamId,
    userId,
    commentLength: comment.length
  })
  
  // Return updated review
  const updatedDoc = await reviewRef.get()
  return {
    id: reviewId,
    ...updatedDoc.data()
  }
}

