import { z } from 'zod'

/**
 * Committee service term schema
 * Tracks who served on committees, when, and for how long
 * 
 * Story 9.5: Track Committee Service Terms (FR62)
 */
export const serviceTermSchema = z.object({
  id: z.string().min(1, 'Service term ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  committeeId: z.string().min(1, 'Committee ID is required'),
  committeeName: z.string().min(1, 'Committee name is required'),
  contributorId: z.string().min(1, 'Contributor ID is required'),
  startDate: z.string().datetime('Invalid ISO datetime for startDate'),
  endDate: z.string().datetime('Invalid ISO datetime for endDate').optional(), // Optional if service is ongoing
  durationDays: z.number().int().min(0, 'Duration must be non-negative').optional(), // Calculated when endDate is set
  status: z.enum(['active', 'completed', 'terminated']), // active = currently serving, completed = normal end, terminated = early end
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt')
})

/**
 * Service term document schema for Firestore (without id field, as it's the document ID)
 */
export const serviceTermDocumentSchema = serviceTermSchema.omit({ id: true })

/**
 * Service term update schema
 */
export const serviceTermUpdateSchema = z.object({
  endDate: z.string().datetime().optional(),
  durationDays: z.number().int().min(0).optional(),
  status: z.enum(['active', 'completed', 'terminated']).optional(),
  updatedAt: z.string().datetime()
})

/**
 * Type inference from schemas
 */
export type ServiceTerm = z.infer<typeof serviceTermSchema>
export type ServiceTermDocument = z.infer<typeof serviceTermDocumentSchema>
export type ServiceTermUpdate = z.infer<typeof serviceTermUpdateSchema>

