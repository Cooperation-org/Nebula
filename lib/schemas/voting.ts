import { z } from 'zod'

/**
 * Voting schema
 * Tracks COOK-weighted voting for governance proposals
 * 
 * Story 9.7: Trigger Voting When Threshold Exceeded (FR33)
 */

/**
 * Vote option schema
 */
export const voteOptionSchema = z.object({
  option: z.string().min(1, 'Vote option is required').max(100, 'Vote option too long'),
  label: z.string().min(1, 'Vote option label is required').max(200, 'Vote option label too long')
})

/**
 * Vote schema
 */
export const voteSchema = z.object({
  voterId: z.string().min(1, 'Voter ID is required'),
  option: z.string().min(1, 'Vote option is required'),
  governanceWeight: z.number().min(0, 'Governance weight must be non-negative'), // COOK-weighted vote
  timestamp: z.string().datetime('Invalid ISO datetime for timestamp')
})

/**
 * Voting status schema
 */
export const votingStatusSchema = z.enum([
  'open', // Voting period is open
  'closed', // Voting period is closed
  'tallying', // Votes are being tallied
  'completed' // Voting is completed and results are final
])

/**
 * Voting schema
 */
export const votingSchema = z.object({
  id: z.string().min(1, 'Voting ID is required'),
  proposalId: z.string().min(1, 'Proposal ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  title: z.string().min(1, 'Voting title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional(),
  options: z.array(voteOptionSchema).min(2, 'At least 2 vote options are required'),
  status: votingStatusSchema,
  // Voting period
  votingPeriodDays: z.number().int().positive('Voting period duration must be positive').optional(), // Default: 7 days
  votingOpenedAt: z.string().datetime('Invalid ISO datetime for votingOpenedAt').optional(),
  votingClosesAt: z.string().datetime('Invalid ISO datetime for votingClosesAt').optional(),
  // Votes
  votes: z.array(voteSchema).default([]),
  voteCount: z.number().int().min(0, 'Vote count must be non-negative').default(0),
  totalWeight: z.number().min(0, 'Total weight must be non-negative').default(0), // Total COOK-weighted votes
  // Results
  results: z.record(z.string(), z.object({
    option: z.string(),
    label: z.string(),
    voteCount: z.number().int().min(0),
    weightedVoteCount: z.number().min(0),
    percentage: z.number().min(0).max(100)
  })).optional(),
  winningOption: z.string().optional(),
  // Metadata
  createdAt: z.string().datetime('Invalid ISO datetime for createdAt'),
  updatedAt: z.string().datetime('Invalid ISO datetime for updatedAt'),
  completedAt: z.string().datetime('Invalid ISO datetime for completedAt').optional()
})

/**
 * Voting document schema for Firestore (without id field, as it's the document ID)
 */
export const votingDocumentSchema = votingSchema.omit({ id: true })

/**
 * Voting update schema
 */
export const votingUpdateSchema = z.object({
  status: votingStatusSchema.optional(),
  votes: z.array(voteSchema).optional(),
  voteCount: z.number().int().min(0).optional(),
  totalWeight: z.number().min(0).optional(),
  results: z.record(z.string(), z.object({
    option: z.string(),
    label: z.string(),
    voteCount: z.number().int().min(0),
    weightedVoteCount: z.number().min(0),
    percentage: z.number().min(0).max(100)
  })).optional(),
  winningOption: z.string().optional(),
  completedAt: z.string().datetime().optional(),
  updatedAt: z.string().datetime()
})

/**
 * Type inference from schemas
 */
export type VoteOption = z.infer<typeof voteOptionSchema>
export type Vote = z.infer<typeof voteSchema>
export type VotingStatus = z.infer<typeof votingStatusSchema>
export type Voting = z.infer<typeof votingSchema>
export type VotingDocument = z.infer<typeof votingDocumentSchema>
export type VotingUpdate = z.infer<typeof votingUpdateSchema>

