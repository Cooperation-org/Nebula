import { collection, query, where, getDocs, orderBy } from 'firebase/firestore'
import { getFirestoreInstance } from './config-server'
import { logger } from '@/lib/utils/logger'
import { taskSchema } from '@/lib/schemas/task'
import type { Task } from '@/lib/types/task'
import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import type { Review } from '@/lib/types/review'

/**
 * Get all tasks for a team (server-compatible version)
 * 
 * @param teamId - Team ID
 * @param includeArchived - Whether to include archived tasks (default: false)
 * @returns Array of tasks
 */
async function getTeamTasks(
  teamId: string,
  includeArchived: boolean = false
): Promise<Task[]> {
  const tasksRef = collection(getFirestoreInstance(), 'teams', teamId, 'tasks')
  
  // Build query based on archived status
  const q = includeArchived
    ? query(tasksRef)
    : query(tasksRef, where('archived', '==', false))
  
  const querySnapshot = await getDocs(q)
  
  const tasks: Task[] = []
  for (const docSnap of querySnapshot.docs) {
    try {
      const data = docSnap.data()
      const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt
      const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
      
      const task = taskSchema.parse({
        id: docSnap.id,
        title: data.title || '',
        description: data.description,
        state: data.state || 'Backlog',
        contributors: data.contributors || [],
        reviewers: data.reviewers,
        archived: data.archived || false,
        cookValue: data.cookValue,
        cookState: data.cookState,
        cookAttribution: data.cookAttribution,
        github: data.github,
        cookSizeClass: data.cookSizeClass,
        taskType: data.taskType,
        requiredReviewers: data.requiredReviewers,
        playbookReferences: data.playbookReferences,
        playbookSuggestions: data.playbookSuggestions,
        aiExtracted: data.aiExtracted,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: updatedAt || new Date().toISOString(),
        createdBy: data.createdBy || '',
        teamId: data.teamId || teamId
      })
      
      tasks.push(task)
    } catch (err) {
      logger.error('Error parsing task', {
        taskId: docSnap.id,
        teamId,
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }
  
  return tasks
}

/**
 * Get all COOK ledger entries for a team
 * 
 * Story 10B.3: Generate Retrospectives via AI
 * 
 * @param teamId - Team ID
 * @returns Array of COOK ledger entries
 */
export async function getTeamCookLedgerEntries(teamId: string): Promise<CookLedgerEntry[]> {
  const cookLedgerRef = collection(getFirestoreInstance(), 'teams', teamId, 'cookLedger')
  const querySnapshot = await getDocs(cookLedgerRef)
  
  const entries: CookLedgerEntry[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const entry: CookLedgerEntry = {
      id: doc.id,
      taskId: data.taskId,
      teamId: data.teamId,
      contributorId: data.contributorId,
      cookValue: data.cookValue,
      attribution: data.attribution,
      issuedAt: data.issuedAt?.toDate?.() ? data.issuedAt.toDate().toISOString() : data.issuedAt
    }
    
    entries.push(entry)
  })
  
  // Sort by issuedAt (newest first)
  entries.sort((a, b) => {
    const dateA = new Date(a.issuedAt).getTime()
    const dateB = new Date(b.issuedAt).getTime()
    return dateB - dateA
  })
  
  return entries
}

/**
 * Get all reviews for a team
 * 
 * Story 10B.3: Generate Retrospectives via AI
 * 
 * @param teamId - Team ID
 * @returns Array of reviews
 */
export async function getTeamReviews(teamId: string): Promise<Review[]> {
  const reviewsRef = collection(getFirestoreInstance(), 'teams', teamId, 'reviews')
  const querySnapshot = await getDocs(reviewsRef)
  
  const reviews: Review[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    
    // Convert Firestore Timestamps to ISO strings
    const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt
    const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt
    const escalatedAt = data.escalatedAt
      ? (data.escalatedAt?.toDate?.()?.toISOString() || data.escalatedAt)
      : undefined
    
    const review: Review = {
      id: doc.id,
      taskId: data.taskId || '',
      teamId: data.teamId || teamId,
      status: data.status || 'pending',
      requiredReviewers: data.requiredReviewers || 1,
      approvals: data.approvals || [],
      objections: data.objections || [],
      comments: data.comments || [],
      checklist: data.checklist || undefined,
      escalated: data.escalated || false,
      escalatedTo: data.escalatedTo,
      escalatedAt,
      createdAt: createdAt || new Date().toISOString(),
      updatedAt: updatedAt || new Date().toISOString()
    }
    
    reviews.push(review)
  })
  
  return reviews
}

/**
 * Gather retrospective data for a team
 * 
 * Story 10B.3: Generate Retrospectives via AI
 * 
 * @param teamId - Team ID
 * @param startDate - Start date for retrospective period (ISO string)
 * @param endDate - End date for retrospective period (ISO string)
 * @returns Retrospective data
 */
export async function gatherRetrospectiveData(
  teamId: string,
  startDate: string,
  endDate: string
): Promise<{
  completedTasks: Array<{
    id: string
    title: string
    description?: string
    cookValue?: number
    taskType?: string
    contributors: string[]
    reviewers?: string[]
    createdAt: string
    updatedAt: string
  }>
  cookLedgerEntries: Array<{
    taskId: string
    contributorId: string
    cookValue: number
    issuedAt: string
  }>
  reviews: Array<{
    taskId: string
    status: string
    approvals: string[]
    objections: Array<{ reason: string }>
    comments: Array<{ comment: string }>
    createdAt: string
    updatedAt: string
  }>
  timeRange: {
    startDate: string
    endDate: string
  }
}> {
  const start = new Date(startDate)
  const end = new Date(endDate)

  // Get all tasks for the team
  const allTasks = await getTeamTasks(teamId, false) // non-archived tasks

  // Filter completed tasks within the time range
  const completedTasks = allTasks
    .filter(task => {
      if (task.state !== 'Done') return false
      const taskDate = new Date(task.updatedAt)
      return taskDate >= start && taskDate <= end
    })
    .map(task => ({
      id: task.id,
      title: task.title,
      description: task.description,
      cookValue: task.cookValue,
      taskType: task.taskType,
      contributors: task.contributors,
      reviewers: task.reviewers,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt
    }))

  // Get all COOK ledger entries for the team
  const allCookEntries = await getTeamCookLedgerEntries(teamId)

  // Filter COOK entries within the time range
  const cookLedgerEntries = allCookEntries
    .filter(entry => {
      const entryDate = new Date(entry.issuedAt)
      return entryDate >= start && entryDate <= end
    })
    .map(entry => ({
      taskId: entry.taskId,
      contributorId: entry.contributorId,
      cookValue: entry.cookValue,
      issuedAt: entry.issuedAt
    }))

  // Get all reviews for the team
  const allReviews = await getTeamReviews(teamId)

  // Filter reviews within the time range (based on creation or update date)
  const reviews = allReviews
    .filter(review => {
      const reviewDate = new Date(review.createdAt)
      return reviewDate >= start && reviewDate <= end
    })
    .map(review => ({
      taskId: review.taskId,
      status: review.status,
      approvals: review.approvals,
      objections: review.objections.map(obj => ({ reason: obj.reason })),
      comments: review.comments.map(comment => ({ comment: comment.comment })),
      createdAt: review.createdAt,
      updatedAt: review.updatedAt
    }))

  logger.info('Retrospective data gathered', {
    teamId,
    startDate,
    endDate,
    completedTasks: completedTasks.length,
    cookLedgerEntries: cookLedgerEntries.length,
    reviews: reviews.length
  })

  return {
    completedTasks,
    cookLedgerEntries,
    reviews,
    timeRange: {
      startDate,
      endDate
    }
  }
}

