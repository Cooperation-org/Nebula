import { z } from 'zod'

/**
 * Task state schema
 * Based on PRD: Backlog → Ready → In Progress → Review → Done
 */
export const taskStateSchema = z.enum([
  'Backlog',
  'Ready',
  'In Progress',
  'Review',
  'Done'
])

/**
 * COOK state schema
 * Based on PRD: Draft → Provisional → Locked → Final
 */
export const cookStateSchema = z.enum(['Draft', 'Provisional', 'Locked', 'Final'])

/**
 * COOK size class schema (optional GitHub field)
 */
export const cookSizeClassSchema = z.enum(['S', 'M', 'L', 'XL']).optional()

/**
 * Task type schema (optional GitHub field)
 */
export const taskTypeSchema = z
  .enum(['Build', 'Ops', 'Governance', 'Research'])
  .optional()

/**
 * Unauthorized movement schema (Story 7.8, FR19)
 */
export const unauthorizedMovementSchema = z
  .object({
    detectedAt: z.string().datetime('Invalid ISO datetime for detectedAt'),
    fromState: z.string(),
    attemptedState: z.string(),
    githubColumnId: z.string(),
    reason: z.string(),
    blocked: z.boolean()
  })
  .optional()

/**
 * GitHub metadata schema (FR11, FR12)
 */
export const githubMetadataSchema = z
  .object({
    issueId: z.number().int().positive('GitHub Issue ID must be positive').optional(),
    issueNumber: z
      .number()
      .int()
      .positive('GitHub Issue number must be positive')
      .optional(),
    repository: z
      .string()
      .min(1, 'Repository name is required if GitHub metadata is present')
      .optional(),
    repositoryOwner: z
      .string()
      .min(1, 'Repository owner is required if GitHub metadata is present')
      .optional(),
    projectItemId: z
      .string()
      .min(1, 'GitHub Project Item ID is required if GitHub metadata is present')
      .optional(),
    projectId: z
      .string()
      .min(1, 'GitHub Project ID is required if GitHub metadata is present')
      .optional(),
    projectColumnId: z
      .string()
      .min(1, 'GitHub Project Column ID is required if GitHub metadata is present')
      .optional(),
    syncedAt: z.string().datetime('Invalid ISO datetime for syncedAt').optional(),
    unauthorizedMovement: unauthorizedMovementSchema
  })
  .optional()

/**
 * Task document schema for Firestore
 * Tasks are stored at teams/{teamId}/tasks/{taskId}
 */
export const taskSchema = z.object({
  id: z.string().min(1, 'Task ID is required'),
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  state: taskStateSchema,
  contributors: z.array(z.string()).min(1, 'At least one contributor is required'),
  reviewers: z.array(z.string()).optional(),
  archived: z.boolean().default(false),
  cookValue: z.number().positive('COOK value must be positive').optional(),
  cookState: cookStateSchema.optional(),
  cookAttribution: z.enum(['self', 'spend']).optional(),
  // GitHub integration fields (FR11, FR12)
  github: githubMetadataSchema,
  cookSizeClass: cookSizeClassSchema,
  taskType: taskTypeSchema,
  requiredReviewers: z.number().int().min(1).optional(),
  // AI and playbook metadata (Story 10A.2)
  playbookReferences: z.array(z.string()).optional(), // Array of playbook IDs or names referenced
  playbookSuggestions: z.array(z.string()).optional(), // Suggestions based on playbook patterns
  aiExtracted: z.boolean().optional(), // Flag indicating task was created via AI extraction
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt'),
  createdBy: z.string().min(1, 'Created by user ID is required'),
  teamId: z.string().min(1, 'Team ID is required')
})

/**
 * Task document schema for Firestore (without id field, as it's the document ID)
 */
export const taskDocumentSchema = taskSchema.omit({ id: true })

/**
 * Task update schema (partial updates)
 */
export const taskUpdateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().max(5000).optional(),
  state: taskStateSchema.optional(),
  contributors: z.array(z.string()).optional(),
  reviewers: z.array(z.string()).optional(),
  archived: z.boolean().optional(),
  cookValue: z.number().positive('COOK value must be positive').optional(),
  cookState: cookStateSchema.optional(),
  cookAttribution: z.enum(['self', 'spend']).optional(),
  // GitHub integration fields (FR11, FR12)
  github: githubMetadataSchema,
  cookSizeClass: cookSizeClassSchema,
  taskType: taskTypeSchema,
  updatedAt: z.string().datetime()
})

/**
 * Task create schema (for creating new tasks)
 */
export const taskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  contributors: z.array(z.string()).min(1, 'At least one contributor is required'),
  reviewers: z.array(z.string()).optional(),
  // AI and playbook metadata (Story 10A.2)
  playbookReferences: z.array(z.string()).optional(),
  playbookSuggestions: z.array(z.string()).optional(),
  aiExtracted: z.boolean().optional()
})

/**
 * Type inference from schemas
 */
export type TaskState = z.infer<typeof taskStateSchema>
export type CookState = z.infer<typeof cookStateSchema>
export type CookSizeClass = z.infer<typeof cookSizeClassSchema>
export type TaskType = z.infer<typeof taskTypeSchema>
export type GitHubMetadata = z.infer<typeof githubMetadataSchema>
export type Task = z.infer<typeof taskSchema>
export type TaskDocument = z.infer<typeof taskDocumentSchema>
export type TaskUpdate = z.infer<typeof taskUpdateSchema>
export type TaskCreate = z.infer<typeof taskCreateSchema>
