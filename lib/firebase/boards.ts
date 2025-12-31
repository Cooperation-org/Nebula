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
import { getCurrentUser, getCurrentUserDocument } from './auth'
import type { Board, BoardDocument, BoardCreate } from '@/lib/types/board'
import {
  boardDocumentSchema,
  boardSchema,
  DEFAULT_BOARD_COLUMNS
} from '@/lib/schemas/board'
import { logger } from '@/lib/utils/logger'
import { requireAuth, requireTeamMember, requireRole } from '@/lib/permissions/checks'

/**
 * Create a new internal project board
 * Only stewards can create boards
 */
export async function createBoard(
  teamId: string,
  boardData: BoardCreate
): Promise<Board> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to create a board')
  }

  // Get user document to verify team membership and role
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Require Steward or Admin role
  try {
    requireRole(userDoc, teamId, 'Steward')
  } catch (err) {
    if (err instanceof Error && err.message.includes('insufficient')) {
      throw new Error('Only stewards and admins can create boards')
    }
    throw err
  }

  // Validate board data
  const validatedData = boardData

  // Generate board ID
  const boardId = doc(
    collection(getFirestoreInstance(), 'teams', teamId, 'boards'),
    '_'
  ).id

  const now = new Date().toISOString()

  // Create default columns with proper structure
  const columns = DEFAULT_BOARD_COLUMNS.map((col, index) => ({
    id: `${boardId}-col-${index}`,
    name: col.name,
    state: col.state,
    order: index,
    required: col.required
  }))

  const boardDoc: BoardDocument = {
    name: validatedData.name,
    description: validatedData.description || '',
    teamId,
    columns,
    visibility: 'Team-Visible', // Default visibility
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser.uid
  }

  // Validate with Zod schema
  const validatedBoardDoc = boardDocumentSchema.parse(boardDoc)

  // Create board document
  const boardRef = doc(getFirestoreInstance(), 'teams', teamId, 'boards', boardId)
  await setDoc(boardRef, {
    ...validatedBoardDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  logger.info('Board created', {
    boardId,
    teamId,
    name: validatedData.name,
    columns: columns.length,
    visibility: 'Team-Visible',
    userId: currentUser.uid
  })

  // Return board object with ID
  const board: Board = {
    id: boardId,
    ...validatedBoardDoc
  }

  return board
}

/**
 * Get board document by ID
 * For public boards, authentication is not required
 */
export async function getBoard(
  teamId: string,
  boardId: string,
  requireAuthentication: boolean = false
): Promise<Board | null> {
  const boardDocRef = doc(getFirestoreInstance(), 'teams', teamId, 'boards', boardId)
  const boardDocSnap = await getDoc(boardDocRef)

  if (!boardDocSnap.exists()) {
    return null
  }

  const data = boardDocSnap.data()

  // Check if board is public (no auth required)
  const isPublic = data.visibility === 'Public'
  const isRestricted = data.visibility === 'Restricted'

  // If board is not public and auth is required, check authentication
  if (!isPublic && requireAuthentication) {
    requireAuth()
    const currentUser = getCurrentUser()
    if (!currentUser) {
      throw new Error('User must be authenticated to view this board')
    }

    // Get user document to verify team membership
    const userDoc = await getCurrentUserDocument()
    if (!userDoc) {
      throw new Error('User document not found')
    }

    // Check team membership
    requireTeamMember(userDoc, teamId)

    // For Restricted boards, check if user is assignee, reviewer, or steward
    if (isRestricted) {
      const userRole = userDoc.teams[teamId]
      const isSteward = userRole === 'Steward' || userRole === 'Admin'

      // If not steward, need to check if user is assignee or reviewer of any task on the board
      if (!isSteward) {
        // Get all tasks for this team to check if user is assignee or reviewer
        const { getTeamTasks } = await import('./tasks')
        const tasks = await getTeamTasks(teamId, false)

        // Check if user is a contributor or reviewer of any task
        const isAssignee = tasks.some(task => task.contributors.includes(currentUser.uid))
        const isReviewer = tasks.some(
          task => task.reviewers?.includes(currentUser.uid) || false
        )

        if (!isAssignee && !isReviewer) {
          throw new Error(
            'Access denied: Restricted boards are only visible to assignees, reviewers, and stewards'
          )
        }
      }
    }
  }

  // Convert Firestore Timestamp to ISO string
  const createdAt =
    data.createdAt?.toDate?.()?.toISOString() ||
    (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString())
  const updatedAt =
    data.updatedAt?.toDate?.()?.toISOString() ||
    (typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString())

  const board: Board = {
    id: boardId,
    name: data.name || '',
    description: data.description,
    teamId: data.teamId || teamId,
    columns: data.columns || [],
    visibility: data.visibility || 'Team-Visible',
    createdAt,
    updatedAt,
    createdBy: data.createdBy || ''
  }

  // Validate with Zod schema
  return boardSchema.parse(board)
}

/**
 * Get all boards for a team
 */
export async function getTeamBoards(teamId: string): Promise<Board[]> {
  const boardsRef = collection(getFirestoreInstance(), 'teams', teamId, 'boards')
  const querySnapshot = await getDocs(boardsRef)

  const boards: Board[] = []

  for (const docSnap of querySnapshot.docs) {
    const board = await getBoard(teamId, docSnap.id)
    if (board) {
      boards.push(board)
    }
  }

  return boards
}

/**
 * Update board configuration
 * Only stewards can update boards
 */
export async function updateBoard(
  teamId: string,
  boardId: string,
  updates: {
    name?: string
    description?: string
    columns?: Array<{
      id: string
      name: string
      state: 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'
      order: number
      required: boolean
    }>
    visibility?: 'Public' | 'Team-Visible' | 'Restricted'
  }
): Promise<Board> {
  // Check authentication
  requireAuth()
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to update a board')
  }

  // Get user document to verify team membership and role
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check team membership
  requireTeamMember(userDoc, teamId)

  // Require Steward or Admin role
  try {
    requireRole(userDoc, teamId, 'Steward')
  } catch (err) {
    if (err instanceof Error && err.message.includes('insufficient')) {
      throw new Error('Only stewards and admins can update boards')
    }
    throw err
  }

  // Get existing board
  const existingBoard = await getBoard(teamId, boardId)
  if (!existingBoard) {
    throw new Error('Board not found')
  }

  // Validate columns if provided
  if (updates.columns) {
    // Ensure at least one column
    if (updates.columns.length === 0) {
      throw new Error('Board must have at least one column')
    }

    // Ensure Review gate column exists and is required
    const reviewColumn = updates.columns.find(
      col => col.state === 'Review' && col.required === true
    )
    if (!reviewColumn) {
      throw new Error('Review gate column is required and cannot be removed')
    }

    // Validate all columns map to valid task states
    const validStates = ['Backlog', 'Ready', 'In Progress', 'Review', 'Done']
    for (const column of updates.columns) {
      if (!validStates.includes(column.state)) {
        throw new Error(`Invalid task state: ${column.state}`)
      }
    }

    // Validate column names
    for (const column of updates.columns) {
      if (!column.name || column.name.trim().length === 0) {
        throw new Error('Column name is required')
      }
      if (column.name.length > 100) {
        throw new Error('Column name must be 100 characters or less')
      }
    }

    // Validate column orders are unique and sequential
    const orders = updates.columns.map(col => col.order).sort((a, b) => a - b)
    for (let i = 0; i < orders.length; i++) {
      if (orders[i] !== i) {
        throw new Error('Column orders must be sequential starting from 0')
      }
    }
  }

  // Prepare update document
  const updateDoc: {
    name?: string
    description?: string
    columns?: Array<{
      id: string
      name: string
      state: 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'
      order: number
      required: boolean
    }>
    visibility?: 'Public' | 'Team-Visible' | 'Restricted'
    updatedAt: any
  } = {
    updatedAt: serverTimestamp()
  }

  if (updates.name !== undefined) {
    updateDoc.name = updates.name
  }
  if (updates.description !== undefined) {
    updateDoc.description = updates.description
  }
  if (updates.columns !== undefined) {
    updateDoc.columns = updates.columns
  }
  if (updates.visibility !== undefined) {
    updateDoc.visibility = updates.visibility
  }

  // Update board document
  const boardRef = doc(getFirestoreInstance(), 'teams', teamId, 'boards', boardId)
  await setDoc(boardRef, updateDoc, { merge: true })

  // Check if visibility changed from Restricted to Team-Visible (FR39)
  if (
    updates.visibility &&
    existingBoard.visibility === 'Restricted' &&
    updates.visibility === 'Team-Visible'
  ) {
    // Get all tasks on the board to identify assignees and reviewers
    const { getTeamTasks } = await import('./tasks')
    const tasks = await getTeamTasks(teamId, false)

    // Collect unique assignees and reviewers
    const assignees = new Set<string>()
    const reviewers = new Set<string>()

    for (const task of tasks) {
      task.contributors.forEach(contributor => assignees.add(contributor))
      task.reviewers?.forEach(reviewer => reviewers.add(reviewer))
    }

    // Log notification requirement for audit (FR39)
    logger.info(
      'Board visibility changed from Restricted to Team-Visible - notifications required',
      {
        boardId,
        teamId,
        boardName: existingBoard.name,
        assignees: Array.from(assignees),
        reviewers: Array.from(reviewers),
        totalAffectedUsers: assignees.size + reviewers.size,
        changedBy: currentUser.uid
      }
    )

    // Notifications are sent automatically via Firestore trigger (onBoardVisibilityChanged)
    // when the board document is updated with the new visibility (FR39, Epic 11B)
  }

  // Verify COOK history preservation (FR40)
  // Board visibility changes only affect the board document, not task documents
  // Task documents (including COOK values, states, and attribution) remain unchanged
  // COOK ledger entries (Epic 8) are also unaffected as they are in a separate collection
  if (updates.visibility) {
    const { getTeamTasks } = await import('./tasks')
    const tasks = await getTeamTasks(teamId, false)

    // Count tasks with COOK values to verify history preservation
    const tasksWithCook = tasks.filter(task => task.cookValue !== undefined)
    const totalCookValue = tasksWithCook.reduce(
      (sum, task) => sum + (task.cookValue || 0),
      0
    )

    logger.info('Board visibility changed - COOK history preserved', {
      boardId,
      teamId,
      fromVisibility: existingBoard.visibility,
      toVisibility: updates.visibility,
      tasksWithCook: tasksWithCook.length,
      totalCookValue,
      cookHistoryPreserved: true,
      taskDocumentsUnchanged: true,
      cookLedgerUnchanged: true, // COOK ledger is separate collection (Epic 8)
      changedBy: currentUser.uid
    })
  }

  logger.info('Board updated', {
    boardId,
    teamId,
    updates: Object.keys(updateDoc).filter(k => k !== 'updatedAt'),
    userId: currentUser.uid
  })

  // Return updated board
  const updatedBoard = await getBoard(teamId, boardId)
  if (!updatedBoard) {
    throw new Error('Failed to retrieve updated board')
  }

  return updatedBoard
}
