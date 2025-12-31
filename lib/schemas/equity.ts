import { z } from 'zod'

/**
 * Equity document schema for validation
 * Stored at teams/{teamId}/equity/{contributorId}
 *
 * Story 9.2: Feed COOK Totals into Equity Calculations
 */
export const equitySchema = z.object({
  contributorId: z.string().min(1, 'Contributor ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  equity: z
    .number()
    .min(0, 'Equity must be non-negative')
    .max(100, 'Equity cannot exceed 100%'),
  effectiveCook: z.number().min(0, 'Effective COOK must be non-negative'),
  rawCook: z.number().min(0, 'Raw COOK must be non-negative'),
  model: z.enum(['slicing', 'proportional', 'custom']),
  totalTeamCook: z.number().min(0, 'Total team COOK must be non-negative'),
  capApplied: z.boolean(),
  decayApplied: z.boolean(),
  lastUpdated: z.string().datetime('Invalid ISO datetime for lastUpdated')
})

/**
 * Equity document schema for Firestore (without contributorId, as it's the document ID)
 */
export const equityDocumentSchema = equitySchema.omit({ contributorId: true })

/**
 * Type inference from schemas
 */
export type Equity = z.infer<typeof equitySchema>
export type EquityDocument = z.infer<typeof equityDocumentSchema>
