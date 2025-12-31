import { z } from 'zod'

/**
 * Governance proposal schema
 * Tracks governance proposals, objection windows, and voting triggers
 * 
 * Story 9.6: Objection Windows Preceding Binding Decisions (FR63)
 */

/**
 * Objection schema
 */
export const objectionSchema = z.object({
  objectorId: z.string().min(1, 'Objector ID is required'),
  reason: z.string().min(1, 'Objection reason is required').max(1000, 'Objection reason too long'),
  timestamp: z.string().datetime('Invalid ISO datetime for timestamp'),
  governanceWeight: z.number().min(0, 'Governance weight must be non-negative').optional() // COOK-weighted objection
})

/**
 * Governance proposal status
 */
export const proposalStatusSchema = z.enum([
  'draft', // Proposal is being prepared
  'objection_window_open', // Objection window is open
  'objection_window_closed', // Objection window closed, below threshold
  'voting_triggered', // Objections exceeded threshold, voting triggered
  'approved', // Proposal approved (no objections or voting passed)
  'rejected', // Proposal rejected (voting failed)
  'withdrawn' // Proposal withdrawn
])

/**
 * Governance proposal type
 */
export const proposalTypeSchema = z.enum([
  'policy_change', // Policy change proposal
  'constitutional_challenge', // Constitutional rule challenge
  'binding_decision', // Other binding governance decision
  'committee_selection', // Committee selection (if objections raised)
  'other' // Other governance proposal
])

/**
 * Governance proposal schema
 */
export const governanceProposalSchema = z.object({
  id: z.string().min(1, 'Proposal ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  type: proposalTypeSchema,
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  proposedBy: z.string().min(1, 'Proposed by user ID is required'),
  status: proposalStatusSchema,
  // Objection window configuration
  objectionWindowDurationDays: z.number().int().positive('Objection window duration must be positive').optional(), // Default: 7 days
  objectionWindowOpenedAt: z.string().datetime('Invalid ISO datetime for objectionWindowOpenedAt').optional(),
  objectionWindowClosesAt: z.string().datetime('Invalid ISO datetime for objectionWindowClosesAt').optional(),
  objectionThreshold: z.number().int().min(0, 'Objection threshold must be non-negative').optional(), // Number of objections or weighted threshold
  // Objections
  objections: z.array(objectionSchema).default([]),
  objectionCount: z.number().int().min(0, 'Objection count must be non-negative').default(0),
  weightedObjectionCount: z.number().min(0, 'Weighted objection count must be non-negative').default(0), // COOK-weighted objections
  // Voting (triggered if threshold exceeded)
  votingTriggered: z.boolean().default(false),
  votingId: z.string().optional(), // Reference to voting document (Story 9.7)
  // Metadata
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt'),
  resolvedAt: z.string().datetime('Invalid ISO datetime for resolvedAt').optional()
})

/**
 * Governance proposal document schema for Firestore (without id field, as it's the document ID)
 */
export const governanceProposalDocumentSchema = governanceProposalSchema.omit({ id: true })

/**
 * Governance proposal update schema
 */
export const governanceProposalUpdateSchema = z.object({
  status: proposalStatusSchema.optional(),
  objectionWindowOpenedAt: z.string().datetime().optional(),
  objectionWindowClosesAt: z.string().datetime().optional(),
  objections: z.array(objectionSchema).optional(),
  objectionCount: z.number().int().min(0).optional(),
  weightedObjectionCount: z.number().min(0).optional(),
  votingTriggered: z.boolean().optional(),
  votingId: z.string().optional(),
  resolvedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime()
})

/**
 * Type inference from schemas
 */
export type Objection = z.infer<typeof objectionSchema>
export type ProposalStatus = z.infer<typeof proposalStatusSchema>
export type ProposalType = z.infer<typeof proposalTypeSchema>
export type GovernanceProposal = z.infer<typeof governanceProposalSchema>
export type GovernanceProposalDocument = z.infer<typeof governanceProposalDocumentSchema>
export type GovernanceProposalUpdate = z.infer<typeof governanceProposalUpdateSchema>

