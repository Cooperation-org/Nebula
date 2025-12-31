import { z } from 'zod'

/**
 * Governance weight document schema for validation
 * Stored at teams/{teamId}/governanceWeights/{contributorId}
 * 
 * Story 9.1: Calculate Governance Weight from COOK Totals
 */
export const governanceWeightSchema = z.object({
  contributorId: z.string().min(1, 'Contributor ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  weight: z.number().min(0, 'Governance weight must be non-negative'),
  rawCook: z.number().min(0, 'Raw COOK must be non-negative'),
  effectiveCook: z.number().min(0, 'Effective COOK must be non-negative'),
  capApplied: z.boolean(),
  decayApplied: z.boolean(),
  lastUpdated: z.string().datetime('Invalid ISO datetime for lastUpdated')
})

/**
 * Governance weight document schema for Firestore (without contributorId, as it's the document ID)
 */
export const governanceWeightDocumentSchema = governanceWeightSchema.omit({ contributorId: true })

/**
 * Type inference from schemas
 */
export type GovernanceWeight = z.infer<typeof governanceWeightSchema>
export type GovernanceWeightDocument = z.infer<typeof governanceWeightDocumentSchema>

