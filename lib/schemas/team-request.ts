import { z } from 'zod'

/**
 * Team join request status
 */
export const teamRequestStatusSchema = z.enum([
  'pending',    // Request submitted, awaiting admin approval
  'approved',   // Request approved by admin
  'rejected',   // Request rejected by admin
  'cancelled'   // Request cancelled by user
])

/**
 * Team join request schema
 * Stored at: teams/{teamId}/joinRequests/{requestId}
 */
export const teamRequestSchema = z.object({
  id: z.string().min(1, 'Request ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  userId: z.string().min(1, 'User ID is required'),
  status: teamRequestStatusSchema,
  message: z.string().max(500, 'Message too long').optional(), // Optional message from user
  adminMessage: z.string().max(500, 'Admin message too long').optional(), // Optional message from admin
  requestedAt: z.string().datetime('Invalid ISO datetime for requestedAt'),
  reviewedAt: z.string().datetime('Invalid ISO datetime for reviewedAt').optional(),
  reviewedBy: z.string().min(1, 'Reviewed by user ID is required').optional(), // Admin who reviewed
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt')
})

/**
 * Team join request document schema for Firestore (without id field)
 */
export const teamRequestDocumentSchema = teamRequestSchema.omit({ id: true })

/**
 * Team join request create schema
 */
export const teamRequestCreateSchema = z.object({
  teamId: z.string().min(1, 'Team ID is required'),
  message: z.string().max(500, 'Message too long').optional()
})

/**
 * Team join request update schema (for admin actions)
 */
export const teamRequestUpdateSchema = z.object({
  status: teamRequestStatusSchema,
  adminMessage: z.string().max(500, 'Admin message too long').optional(),
  reviewedAt: z.string().datetime(),
  reviewedBy: z.string().min(1, 'Reviewed by user ID is required')
})

/**
 * Type inference from schemas
 */
export type TeamRequestStatus = z.infer<typeof teamRequestStatusSchema>
export type TeamRequest = z.infer<typeof teamRequestSchema>
export type TeamRequestDocument = z.infer<typeof teamRequestDocumentSchema>
export type TeamRequestCreate = z.infer<typeof teamRequestCreateSchema>
export type TeamRequestUpdate = z.infer<typeof teamRequestUpdateSchema>

