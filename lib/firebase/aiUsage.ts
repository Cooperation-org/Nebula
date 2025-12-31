/**
 * AI Service Usage Logging
 *
 * Tracks AI service usage for analytics and cost monitoring
 *
 * Story 10A.1: Store AI service usage data in Firestore collection for analysis
 */

import { doc, collection, setDoc, serverTimestamp } from 'firebase/firestore'
import { getFirestoreInstance } from './config-server'
import type {
  AIUsageLog,
  AIUsageLogDocument,
  AIProvider,
  AIFunctionType
} from '@/lib/schemas/aiUsage'
import { aiUsageLogDocumentSchema } from '@/lib/schemas/aiUsage'
import { logger } from '@/lib/utils/logger'

/**
 * Log AI service usage
 *
 * @param usageData - Usage data to log
 * @returns Promise that resolves when usage is logged
 */
export async function logAIUsage(usageData: {
  teamId?: string
  userId?: string
  provider: AIProvider
  model: string
  functionType: AIFunctionType
  success: boolean
  errorMessage?: string
  promptTokens?: number
  completionTokens?: number
  totalTokens?: number
  inputSize?: number
  outputSize?: number
  estimatedCost?: number
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    // Generate usage log ID
    const usageLogId = doc(collection(getFirestoreInstance(), 'aiUsageLogs'), '_').id
    const now = new Date().toISOString()

    const usageLogDoc: AIUsageLogDocument = {
      teamId: usageData.teamId,
      userId: usageData.userId,
      provider: usageData.provider,
      model: usageData.model,
      functionType: usageData.functionType,
      success: usageData.success,
      errorMessage: usageData.errorMessage,
      promptTokens: usageData.promptTokens,
      completionTokens: usageData.completionTokens,
      totalTokens: usageData.totalTokens,
      inputSize: usageData.inputSize,
      outputSize: usageData.outputSize,
      estimatedCost: usageData.estimatedCost,
      timestamp: now,
      metadata: usageData.metadata
    }

    const validatedDoc = aiUsageLogDocumentSchema.parse(usageLogDoc)

    // Store in Firestore (aiUsageLogs/{usageLogId})
    // Using root collection for cross-team analytics
    const usageLogRef = doc(getFirestoreInstance(), 'aiUsageLogs', usageLogId)
    await setDoc(usageLogRef, {
      ...validatedDoc,
      timestamp: serverTimestamp()
    })

    logger.info('AI usage logged', {
      usageLogId,
      provider: usageData.provider,
      model: usageData.model,
      functionType: usageData.functionType,
      success: usageData.success,
      totalTokens: usageData.totalTokens,
      teamId: usageData.teamId
    })
  } catch (error) {
    // Log error but don't throw - usage logging should not break AI service calls
    logger.error('Error logging AI usage', {
      provider: usageData.provider,
      model: usageData.model,
      functionType: usageData.functionType,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
