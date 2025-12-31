import { z } from 'zod'

/**
 * Team document schema for validation
 * Root collection: teams/{teamId}
 */
export const teamSchema = z.object({
  id: z.string().min(1, 'Team ID is required'),
  name: z.string().min(1, 'Team name is required').max(100, 'Team name too long'),
  description: z.string().max(500, 'Description too long').optional(),
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt'),
  createdBy: z.string().min(1, 'Created by user ID is required'),
  // COOK cap configuration (Story 8.4, FR53)
  cookCap: z.number().positive('COOK cap must be positive').optional(),
  // COOK decay configuration (Story 8.5, FR54)
  // Decay rate per month (e.g., 0.05 = 5% decay per month)
  // Uses exponential decay: decayFactor = e^(-decayRate * ageInMonths)
  cookDecayRate: z.number().min(0, 'Decay rate must be non-negative').max(1, 'Decay rate cannot exceed 100% per month').optional(),
  // Equity calculation model (Story 9.2, FR52)
  equityModel: z.enum(['slicing', 'proportional', 'custom']).optional(),
  // Committee eligibility configuration (Story 9.3, FR59)
  committeeEligibilityWindowMonths: z.number().int().positive('Eligibility window must be positive').optional(), // Recent window in months (e.g., 6 for last 6 months)
  committeeMinimumActiveCook: z.number().min(0, 'Minimum active COOK must be non-negative').optional(), // Minimum COOK required for eligibility (default: > 0)
  // Committee service configuration (Story 9.5, FR62)
  committeeCoolingOffPeriodDays: z.number().int().min(0, 'Cooling-off period must be non-negative').optional(), // Days after service ends before eligible again (default: 0)
  // Governance proposal configuration (Story 9.6, FR63)
  defaultObjectionWindowDays: z.number().int().positive('Objection window duration must be positive').optional(), // Default objection window duration (default: 7 days)
  defaultObjectionThreshold: z.number().int().min(0, 'Objection threshold must be non-negative').optional(), // Default objection threshold (default: 0, meaning any objection triggers voting)
  // Voting configuration (Story 9.7, FR33)
  defaultVotingPeriodDays: z.number().int().positive('Voting period duration must be positive').optional(), // Default voting period duration (default: 7 days)
  // Constitutional challenge configuration (Story 9.9)
  constitutionalVotingPeriodDays: z.number().int().positive('Constitutional voting period duration must be positive').optional(), // Voting period for constitutional challenges (default: 14 days, longer than regular voting)
  constitutionalApprovalThreshold: z.number().min(0).max(100, 'Approval threshold must be between 0 and 100').optional() // Minimum weighted vote percentage required for approval (default: 50%)
})

/**
 * Team document schema for Firestore (without id field, as it's the document ID)
 */
export const teamDocumentSchema = teamSchema.omit({ id: true })

/**
 * Partial team schema for updates (all fields optional except id)
 */
export const teamUpdateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  cookCap: z.number().positive('COOK cap must be positive').optional(),
  cookDecayRate: z.number().min(0).max(1).optional(),
  equityModel: z.enum(['slicing', 'proportional', 'custom']).optional(),
  committeeEligibilityWindowMonths: z.number().int().positive().optional(),
  committeeMinimumActiveCook: z.number().min(0).optional(),
  committeeCoolingOffPeriodDays: z.number().int().min(0).optional(),
  defaultObjectionWindowDays: z.number().int().positive().optional(),
  defaultObjectionThreshold: z.number().int().min(0).optional(),
  defaultVotingPeriodDays: z.number().int().positive().optional(),
  constitutionalVotingPeriodDays: z.number().int().positive().optional(),
  constitutionalApprovalThreshold: z.number().min(0).max(100).optional(),
  updatedAt: z.string().datetime()
})

/**
 * Type inference from schemas
 */
export type Team = z.infer<typeof teamSchema>
export type TeamDocument = z.infer<typeof teamDocumentSchema>
export type TeamUpdate = z.infer<typeof teamUpdateSchema>

