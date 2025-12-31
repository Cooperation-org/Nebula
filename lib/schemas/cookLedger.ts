import { z } from 'zod'

/**
 * COOK ledger entry schema
 * Ledger entries are immutable and append-only
 * Stored at teams/{teamId}/cookLedger/{entryId}
 */
export const cookLedgerEntrySchema = z.object({
  id: z.string().min(1, 'Entry ID is required'),
  taskId: z.string().min(1, 'Task ID is required'),
  teamId: z.string().min(1, 'Team ID is required'),
  contributorId: z.string().min(1, 'Contributor ID is required'),
  cookValue: z.number().positive('COOK value must be positive'),
  attribution: z.enum(['self', 'spend']),
  issuedAt: z.string().datetime('Invalid ISO datetime for issuedAt')
})

/**
 * COOK ledger entry document schema for Firestore (without id field, as it's the document ID)
 */
export const cookLedgerEntryDocumentSchema = cookLedgerEntrySchema.omit({ id: true })

/**
 * Type inference from schemas
 */
export type CookLedgerEntry = z.infer<typeof cookLedgerEntrySchema>
export type CookLedgerEntryDocument = z.infer<typeof cookLedgerEntryDocumentSchema>
