import { z } from 'zod'

/**
 * Audit Log Schema
 *
 * Story 9.10: Audit Logs for Governance Actions
 *
 * Logs all governance actions for transparency and auditability (FR29, NFR6)
 * Logs are immutable and stored in Firestore
 */

/**
 * Governance action types
 */
export const governanceActionTypeSchema = z.enum([
  'voting_created', // Voting instance created
  'vote_cast', // Vote cast in voting instance
  'voting_results_calculated', // Voting results calculated
  'committee_selected', // Committee selected via weighted lottery
  'policy_change_adopted', // Policy change adopted via voting
  'constitutional_change_adopted', // Constitutional change adopted via voting
  'governance_proposal_created', // Governance proposal created
  'objection_added', // Objection added to proposal
  'objection_window_closed', // Objection window closed
  'voting_triggered', // Voting triggered (by threshold or automatic)
  'governance_weight_updated', // Governance weight updated
  'equity_calculated', // Equity calculated
  'service_term_created', // Committee service term created
  'service_term_ended' // Committee service term ended
])

/**
 * Audit log entry schema
 */
export const auditLogSchema = z.object({
  id: z.string().min(1, 'Audit log ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  actionType: governanceActionTypeSchema,
  timestamp: z.string().datetime('Invalid ISO datetime for timestamp'), // UTC ISO 8601
  // Participants
  actorId: z.string().min(1, 'Actor ID is required'), // User who performed the action (or 'system' for automated actions)
  participants: z.array(z.string()).optional(), // Additional participants (e.g., voters, committee members)
  // Outcomes
  outcome: z.string().optional(), // Outcome description (e.g., 'approved', 'rejected', 'selected')
  outcomeDetails: z.record(z.string(), z.unknown()).optional(), // Detailed outcome data
  // COOK weights used (NFR6)
  cookWeights: z.record(z.string(), z.number()).optional(), // Map of participantId -> governance weight used
  totalWeight: z.number().min(0).optional(), // Total COOK weight involved
  // Context
  relatedEntityId: z.string().optional(), // Related entity (e.g., proposalId, votingId, committeeId)
  relatedEntityType: z.string().optional(), // Type of related entity (e.g., 'proposal', 'voting', 'committee')
  // Metadata
  metadata: z.record(z.string(), z.unknown()).optional() // Additional metadata
})

/**
 * Audit log document schema for Firestore (without id field, as it's the document ID)
 */
export const auditLogDocumentSchema = auditLogSchema.omit({ id: true })

/**
 * Type inference from schemas
 */
export type GovernanceActionType = z.infer<typeof governanceActionTypeSchema>
export type AuditLog = z.infer<typeof auditLogSchema>
export type AuditLogDocument = z.infer<typeof auditLogDocumentSchema>
