/**
 * AI Service Usage Log Schema
 * 
 * Tracks AI service usage for analytics and cost monitoring
 */

import { z } from 'zod'

/**
 * AI provider type
 */
export const aiProviderSchema = z.enum(['openai', 'anthropic', 'gemini'])

/**
 * AI function type
 */
export const aiFunctionTypeSchema = z.enum([
  'extract_task',
  'generate_review_summary',
  'generate_review_checklist',
  'generate_retrospective'
])

/**
 * AI usage log schema
 */
export const aiUsageLogSchema = z.object({
  id: z.string().min(1, 'Usage log ID is required'),
  teamId: z.string().min(1, 'Team ID is required').optional(),
  userId: z.string().min(1, 'User ID is required').optional(),
  provider: aiProviderSchema,
  model: z.string().min(1, 'Model name is required'),
  functionType: aiFunctionTypeSchema,
  success: z.boolean(),
  errorMessage: z.string().optional(),
  // Token usage (if available from API)
  promptTokens: z.number().int().min(0).optional(),
  completionTokens: z.number().int().min(0).optional(),
  totalTokens: z.number().int().min(0).optional(),
  // Input/output sizes (for cost estimation)
  inputSize: z.number().int().min(0).optional(), // Character count
  outputSize: z.number().int().min(0).optional(), // Character count
  // Cost estimation (optional, can be calculated later)
  estimatedCost: z.number().min(0).optional(), // In USD
  // Timestamp
  timestamp: z.string().datetime('Invalid ISO datetime for timestamp'),
  // Metadata
  metadata: z.record(z.string(), z.unknown()).optional() // Additional context
})

/**
 * AI usage log document schema for Firestore (without id field, as it's the document ID)
 */
export const aiUsageLogDocumentSchema = aiUsageLogSchema.omit({ id: true })

export type AIUsageLog = z.infer<typeof aiUsageLogSchema>
export type AIUsageLogDocument = z.infer<typeof aiUsageLogDocumentSchema>
export type AIProvider = z.infer<typeof aiProviderSchema>
export type AIFunctionType = z.infer<typeof aiFunctionTypeSchema>

