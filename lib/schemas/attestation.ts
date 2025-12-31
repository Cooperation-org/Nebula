import { z } from 'zod'

/**
 * Attestation document schema for validation
 * Root collection: attestations/{attestationId}
 * 
 * Story 8.6: Issue Verifiable Attestation on Task Completion
 * FR55, FR56, FR57: Portable, verifiable attestations
 */
export const attestationSchema = z.object({
  id: z.string().min(1, 'Attestation ID is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  contributorId: z.string().min(1, 'Contributor ID is required'),
  cookValue: z.number().positive('COOK value must be positive'),
  attribution: z.enum(['self', 'spend']),
  reviewers: z.array(z.string()).min(1, 'At least one reviewer is required'),
  // Merkle tree hash for cryptographic verification (Story 8.7)
  merkleRoot: z.string().optional(),
  parentHash: z.string().optional(), // Chain structure with previous attestations
  issuedAt: z.string().datetime('Invalid ISO datetime for issuedAt'),
  // Additional metadata for portability
  taskTitle: z.string().optional(), // For display purposes
  teamName: z.string().optional() // For display purposes
})

/**
 * Attestation document schema for Firestore (without id field, as it's the document ID)
 */
export const attestationDocumentSchema = attestationSchema.omit({ id: true })

/**
 * Type inference from schemas
 */
export type Attestation = z.infer<typeof attestationSchema>
export type AttestationDocument = z.infer<typeof attestationDocumentSchema>

