import { z } from 'zod'

/**
 * User role schema
 * Based on NFR4: Role-based access control (Contributor, Reviewer, Steward, Admin)
 */
export const userRoleSchema = z.enum(['Contributor', 'Reviewer', 'Steward', 'Admin'])

/**
 * Teams map schema: {teamId: role}
 * Validates that each team ID maps to a valid role
 */
export const userTeamsSchema = z.record(z.string(), userRoleSchema)

/**
 * User document schema for validation
 * Validates user data structure and ensures required fields are present
 */
export const userSchema = z.object({
  id: z.string().min(1, 'User ID is required'),
  displayName: z.string().min(1, 'Display name is required').max(100, 'Display name too long'),
  email: z.string().email('Invalid email address'),
  photoURL: z.string().url('Invalid photo URL').optional().or(z.literal('')),
  teams: userTeamsSchema,
  // GitHub integration: optional GitHub username for user mapping
  githubUsername: z.string().min(1, 'GitHub username must not be empty').optional(),
  // Slack integration (Story 11A.1)
  slackUserId: z.string().min(1, 'Slack user ID must not be empty').optional(),
  // Onboarding tracking
  onboardingCompleted: z.boolean().default(false).optional(),
  onboardingCompletedAt: z.string().datetime('Invalid ISO datetime for onboardingCompletedAt').optional(),
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt')
})

/**
 * User document schema for Firestore (without id field, as it's the document ID)
 */
export const userDocumentSchema = userSchema.omit({ id: true })

/**
 * Partial user schema for updates (all fields optional except id)
 */
export const userUpdateSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  photoURL: z.string().url().optional().or(z.literal('')),
  teams: userTeamsSchema.optional(),
  githubUsername: z.string().min(1).optional(),
  slackUserId: z.string().min(1).optional(),
  onboardingCompleted: z.boolean().optional(),
  onboardingCompletedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime()
})

/**
 * Type inference from schemas
 */
export type UserRole = z.infer<typeof userRoleSchema>
export type UserTeams = z.infer<typeof userTeamsSchema>
export type User = z.infer<typeof userSchema>
export type UserDocument = z.infer<typeof userDocumentSchema>
export type UserUpdate = z.infer<typeof userUpdateSchema>

