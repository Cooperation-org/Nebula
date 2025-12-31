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
import type { Task, TaskDocument, TaskCreate, TaskUpdate } from '@/lib/types/task'
import { taskDocumentSchema, taskSchema, taskCreateSchema } from '@/lib/schemas/task'
import { logger } from '@/lib/utils/logger'
import { getCurrentUser, getCurrentUserDocument } from './auth'
import { PermissionError, PermissionErrorCode, hasRoleOrHigher } from '@/lib/permissions/types'
import { requireAuth } from '@/lib/permissions/checks'
import type { UserRole } from '@/lib/types/user'

/**
 * Helper function to require team membership
 */
function requireTeamMember(userDoc: any, teamId: string): void {
  if (!userDoc.teams || !userDoc.teams[teamId]) {
    throw new PermissionError(
      PermissionErrorCode.NOT_TEAM_MEMBER,
      'User is not a member of this team'
    )
  }
}

/**
 * Helper function to remove undefined values from an object
 * Firestore doesn't allow undefined values - fields must be omitted or have a defined value
 */
function removeUndefined<T extends Record<string, any>>(obj: T): Partial<T> {
  const result: Partial<T> = {}
  for (const key in obj) {
    if (obj[key] !== undefined) {
      result[key] = obj[key]
    }
  }
  return result
}

/**
 * Create a new task
 * 
 * @param teamId - Team ID
 * @param taskData - Task creation data
 * @returns Created task
 */
export async function createTask(
  teamId: string,
  taskData: TaskCreate
): Promise<Task> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to create a task')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Validate task data
  const validatedData = taskCreateSchema.parse(taskData)

  // Generate task ID
  const taskId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'tasks'), '_').id

  const now = new Date().toISOString()
  const taskDoc: TaskDocument = {
    title: validatedData.title,
    description: validatedData.description,
    state: 'Backlog', // New tasks start in Backlog
    contributors: validatedData.contributors,
    reviewers: validatedData.reviewers,
    archived: false,
    // AI and playbook metadata (Story 10A.2)
    playbookReferences: validatedData.playbookReferences,
    playbookSuggestions: validatedData.playbookSuggestions,
    aiExtracted: validatedData.aiExtracted,
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser.uid,
    teamId
  }

  // Validate with Zod schema
  const validatedTaskDoc = taskDocumentSchema.parse(taskDoc)

  // Remove undefined values (Firestore doesn't allow undefined)
  const firestoreData = removeUndefined({
    ...validatedTaskDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  // Store in Firestore (teams/{teamId}/tasks/{taskId})
  const taskRef = doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId)
  await setDoc(taskRef, firestoreData)

  logger.info('Task created', {
    taskId,
    teamId,
    title: validatedData.title,
    createdBy: currentUser.uid,
    aiExtracted: validatedData.aiExtracted || false,
    playbookReferences: validatedData.playbookReferences?.length || 0
  })

  const task: Task = {
    id: taskId,
    ...validatedTaskDoc
  }

  return task
}

/**
 * Get a task by ID
 * 
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @returns Task or null if not found
 */
export async function getTask(teamId: string, taskId: string): Promise<Task | null> {
  const taskRef = doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId)
  const taskSnap = await getDoc(taskRef)

  if (!taskSnap.exists()) {
    return null
  }

  const data = taskSnap.data()
  const createdAt = data.createdAt?.toDate?.()?.toISOString() || data.createdAt
  const updatedAt = data.updatedAt?.toDate?.()?.toISOString() || data.updatedAt

  return taskSchema.parse({
    id: taskSnap.id,
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
}

/**
 * Get all tasks for a team
 * 
 * @param teamId - Team ID
 * @param includeArchived - Whether to include archived tasks (default: false)
 * @returns Array of tasks
 */
export async function getTeamTasks(
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
 * Update a task
 * 
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @param updates - Task update data
 * @returns Updated task
 */
export async function updateTask(
  teamId: string,
  taskId: string,
  updates: TaskUpdate
): Promise<Task> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to update a task')
  }

  // Get user document to verify team membership
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing task
  const existingTask = await getTask(teamId, taskId)
  if (!existingTask) {
    throw new Error('Task not found')
  }

  // Validate updates
  const validatedUpdates = { ...updates, updatedAt: new Date().toISOString() }

  // Remove undefined values (Firestore doesn't allow undefined)
  const firestoreUpdates = removeUndefined({
    ...validatedUpdates,
    updatedAt: serverTimestamp()
  })

  // Update task in Firestore
  const taskRef = doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId)
  await updateDoc(taskRef, firestoreUpdates)

  logger.info('Task updated', {
    taskId,
    teamId,
    updatedBy: currentUser.uid,
    updates: Object.keys(updates)
  })

  // Return updated task
  const updatedTask = await getTask(teamId, taskId)
  if (!updatedTask) {
    throw new Error('Task not found after update')
  }

  return updatedTask
}

/**
 * Assign COOK value to a task
 * 
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @param cookValue - COOK value to assign
 * @returns Updated task
 */
export async function assignCookValue(
  teamId: string,
  taskId: string,
  cookValue: number
): Promise<Task> {
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to assign COOK value')
  }

  // Get existing task
  const existingTask = await getTask(teamId, taskId)
  if (!existingTask) {
    throw new Error('Task not found')
  }

  // Validate COOK value
  if (cookValue <= 0) {
    throw new Error('COOK value must be positive')
  }

  // Update task with COOK value
  return await updateTask(teamId, taskId, {
    cookValue,
    cookState: 'Draft', // COOK starts in Draft state
    cookAttribution: 'self', // Default to self attribution
    updatedAt: new Date().toISOString()
  })
}

/**
 * Clear unauthorized movement flag (Steward only)
 * Allows COOK issuance to proceed after unauthorized movement is resolved
 * 
 * Story 7.8: Handle Unauthorized Column Movement in GitHub
 * 
 * @param teamId - Team ID
 * @param taskId - Task ID
 * @returns Updated task
 */
export async function clearUnauthorizedMovement(
  teamId: string,
  taskId: string
): Promise<Task> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to clear unauthorized movement flag')
  }

  // Get user document to verify team membership and role
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Check if user is Steward or higher (only Stewards can clear flags)
  const userRole = userDoc.teams?.[teamId] as UserRole | undefined
  if (!userRole || !hasRoleOrHigher(userRole, 'Steward')) {
    throw new PermissionError(
      PermissionErrorCode.INSUFFICIENT_ROLE,
      'Only Stewards can clear unauthorized movement flags'
    )
  }

  // Get existing task
  const existingTask = await getTask(teamId, taskId)
  if (!existingTask) {
    throw new Error('Task not found')
  }

  // Check if unauthorized movement flag exists
  if (!existingTask.github?.unauthorizedMovement?.blocked) {
    throw new Error('No unauthorized movement flag to clear')
  }

  // Clear the unauthorized movement flag
  const taskRef = doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId)
  await setDoc(
    taskRef,
    {
      'github.unauthorizedMovement': null,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  logger.info('Unauthorized movement flag cleared by Steward', {
    taskId,
    teamId,
    userId: currentUser.uid,
    userRole: userDoc.teams?.[teamId] || 'Contributor',
    previousUnauthorizedMovement: existingTask.github.unauthorizedMovement
  })

  // Return updated task
  const updatedTask = await getTask(teamId, taskId)
  if (!updatedTask) {
    throw new Error('Task not found after update')
  }

  return updatedTask
}

/**
 * Archive a task
 * Sets archived flag to true
 * Story 3.3: Archive Task
 */
export async function archiveTask(teamId: string, taskId: string): Promise<Task> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User must be authenticated to archive a task'
    )
  }

  // Get user document
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User document not found'
    )
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing task
  const existingTask = await getTask(teamId, taskId)
  if (!existingTask) {
    throw new Error('Task not found')
  }

  // Check if already archived
  if (existingTask.archived) {
    throw new Error('Task is already archived')
  }

  // Archive the task
  const taskRef = doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId)
  await updateDoc(taskRef, {
    archived: true,
    updatedAt: serverTimestamp()
  })

  logger.info('Task archived', {
    taskId,
    teamId,
    userId: currentUser.uid
  })

  // Return updated task
  const updatedTask = await getTask(teamId, taskId)
  if (!updatedTask) {
    throw new Error('Task not found after update')
  }

  return updatedTask
}

/**
 * Unarchive a task
 * Sets archived flag to false
 * Story 3.3: Archive Task
 */
export async function unarchiveTask(teamId: string, taskId: string): Promise<Task> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User must be authenticated to unarchive a task'
    )
  }

  // Get user document
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User document not found'
    )
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Get existing task
  const existingTask = await getTask(teamId, taskId)
  if (!existingTask) {
    throw new Error('Task not found')
  }

  // Check if already unarchived
  if (!existingTask.archived) {
    throw new Error('Task is not archived')
  }

  // Unarchive the task
  const taskRef = doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId)
  await updateDoc(taskRef, {
    archived: false,
    updatedAt: serverTimestamp()
  })

  logger.info('Task unarchived', {
    taskId,
    teamId,
    userId: currentUser.uid
  })

  // Return updated task
  const updatedTask = await getTask(teamId, taskId)
  if (!updatedTask) {
    throw new Error('Task not found after update')
  }

  return updatedTask
}
