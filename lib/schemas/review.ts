import { z } from 'zod'

/**
 * Review status schema
 */
export const reviewStatusSchema = z.enum([
  'pending',
  'approved',
  'objected',
  'escalated',
  'resolved'
])

/**
 * Review document schema for Firestore
 * Reviews are stored at teams/{teamId}/reviews/{reviewId}
 */
export const reviewSchema = z.object({
  id: z.string().min(1, 'Review ID is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  status: reviewStatusSchema,
  requiredReviewers: z.number().int().positive('Required reviewers must be positive'),
  approvals: z.array(z.string()).default([]),
  objections: z
    .array(
      z.object({
        reviewerId: z.string().min(1, 'Reviewer ID is required'),
        reason: z.string().min(1, 'Objection reason is required'),
        timestamp: z.string().datetime('Invalid ISO datetime for timestamp')
      })
    )
    .default([]),
  comments: z
    .array(
      z.object({
        reviewerId: z.string().min(1, 'Reviewer ID is required'),
        comment: z.string().min(1, 'Comment is required'),
        timestamp: z.string().datetime('Invalid ISO datetime for timestamp')
      })
    )
    .default([]),
  // AI Review Checklist (Story 10B.2)
  checklist: z
    .array(
      z.object({
        id: z.string().min(1, 'Checklist item ID is required'),
        text: z.string().min(1, 'Checklist item text is required'),
        category: z.string().min(1, 'Category is required'),
        required: z.boolean(),
        checked: z.boolean()
      })
    )
    .optional(),
  escalated: z.boolean().default(false),
  escalatedTo: z.string().optional(),
  escalatedBy: z.string().optional(), // User ID who escalated
  escalatedAt: z.string().datetime('Invalid ISO datetime for escalatedAt').optional(),
  escalationReason: z.string().optional(), // Reason for escalation
  // Objection window fields
  objectionWindowOpenedAt: z
    .string()
    .datetime('Invalid ISO datetime for objectionWindowOpenedAt')
    .optional(),
  objectionWindowClosesAt: z
    .string()
    .datetime('Invalid ISO datetime for objectionWindowClosesAt')
    .optional(),
  objectionWindowDurationDays: z.number().int().positive().optional(),
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt')
})

/**
 * Review document schema for Firestore (without id field, as it's the document ID)
 */
export const reviewDocumentSchema = reviewSchema.omit({ id: true })

/**
 * Review update schema (partial updates)
 */
export const reviewUpdateSchema = z.object({
  status: reviewStatusSchema.optional(),
  approvals: z.array(z.string()).optional(),
  objections: z
    .array(
      z.object({
        reviewerId: z.string().min(1, 'Reviewer ID is required'),
        reason: z.string().min(1, 'Objection reason is required'),
        timestamp: z.string().datetime('Invalid ISO datetime for timestamp')
      })
    )
    .optional(),
  comments: z
    .array(
      z.object({
        reviewerId: z.string().min(1, 'Reviewer ID is required'),
        comment: z.string().min(1, 'Comment is required'),
        timestamp: z.string().datetime('Invalid ISO datetime for timestamp')
      })
    )
    .optional(),
  // AI Review Checklist (Story 10B.2)
  checklist: z
    .array(
      z.object({
        id: z.string().min(1, 'Checklist item ID is required'),
        text: z.string().min(1, 'Checklist item text is required'),
        category: z.string().min(1, 'Category is required'),
        required: z.boolean(),
        checked: z.boolean()
      })
    )
    .optional(),
  escalated: z.boolean().optional(),
  escalatedTo: z.string().optional(),
  escalatedBy: z.string().optional(), // User ID who escalated
  escalatedAt: z.string().datetime('Invalid ISO datetime for escalatedAt').optional(),
  escalationReason: z.string().optional(), // Reason for escalation
  // Objection window fields
  objectionWindowOpenedAt: z
    .string()
    .datetime('Invalid ISO datetime for objectionWindowOpenedAt')
    .optional(),
  objectionWindowClosesAt: z
    .string()
    .datetime('Invalid ISO datetime for objectionWindowClosesAt')
    .optional(),
  objectionWindowDurationDays: z.number().int().positive().optional(),
  updatedAt: z.string().datetime()
})

/**
 * Type inference from schemas
 */
export type ReviewStatus = z.infer<typeof reviewStatusSchema>
export type Review = z.infer<typeof reviewSchema>
export type ReviewDocument = z.infer<typeof reviewDocumentSchema>
export type ReviewUpdate = z.infer<typeof reviewUpdateSchema>
