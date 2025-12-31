import { z } from 'zod'

/**
 * Board visibility schema
 */
export const boardVisibilitySchema = z.enum(['Public', 'Team-Visible', 'Restricted'])

/**
 * Board column schema
 * Columns map to task states
 */
export const boardColumnSchema = z.object({
  id: z.string().min(1, 'Column ID is required'),
  name: z.string().min(1, 'Column name is required').max(100, 'Column name too long'),
  state: z.enum(['Backlog', 'Ready', 'In Progress', 'Review', 'Done']),
  order: z.number().int().min(0, 'Column order must be non-negative'),
  required: z.boolean().default(false) // Review gate is required
})

/**
 * Board document schema for Firestore
 * Boards are stored at teams/{teamId}/boards/{boardId}
 * Boards are view configurations over tasks, not separate task storage
 */
export const boardSchema = z.object({
  id: z.string().min(1, 'Board ID is required'),
  name: z.string().min(1, 'Board name is required').max(100, 'Board name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  teamId: z.string().min(1, 'Team ID is required'),
  columns: z.array(boardColumnSchema).min(1, 'Board must have at least one column'),
  visibility: boardVisibilitySchema.default('Team-Visible'),
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt'),
  createdBy: z.string().min(1, 'Created by user ID is required')
})

/**
 * Board document schema for Firestore (without id field, as it's the document ID)
 */
export const boardDocumentSchema = boardSchema.omit({ id: true })

/**
 * Board update schema (partial updates)
 */
export const boardUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  columns: z.array(boardColumnSchema).optional(),
  visibility: boardVisibilitySchema.optional(),
  updatedAt: z.string().datetime()
})

/**
 * Board create schema (for creating new boards)
 */
export const boardCreateSchema = z.object({
  name: z.string().min(1, 'Board name is required').max(100, 'Board name too long'),
  description: z.string().max(500, 'Description too long').optional()
})

/**
 * Default board columns
 * These map to task states and preserve the Review gate
 */
export const DEFAULT_BOARD_COLUMNS: Array<{
  name: string
  state: 'Backlog' | 'Ready' | 'In Progress' | 'Review' | 'Done'
  required: boolean
}> = [
  { name: 'Backlog', state: 'Backlog', required: false },
  { name: 'Ready', state: 'Ready', required: false },
  { name: 'In Progress', state: 'In Progress', required: false },
  { name: 'Review', state: 'Review', required: true }, // Review gate is required
  { name: 'Done', state: 'Done', required: false }
]

/**
 * Type inference from schemas
 */
export type BoardVisibility = z.infer<typeof boardVisibilitySchema>
export type BoardColumn = z.infer<typeof boardColumnSchema>
export type Board = z.infer<typeof boardSchema>
export type BoardDocument = z.infer<typeof boardDocumentSchema>
export type BoardUpdate = z.infer<typeof boardUpdateSchema>
export type BoardCreate = z.infer<typeof boardCreateSchema>
