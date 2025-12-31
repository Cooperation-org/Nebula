import { NextRequest, NextResponse } from 'next/server'
import { extractTaskFromNaturalLanguage, logAIExtraction } from '@/lib/utils/aiService'
import { logger } from '@/lib/utils/logger'

// Note: This API route runs server-side, so it can access environment variables
// and filesystem for playbook loading

/**
 * API Route: Extract Task from Natural Language
 *
 * Story 10A.1: Natural Language Task Creation
 *
 * POST /api/ai/extract-task
 * Body: { description: string, teamId?: string, userId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { description, teamId, userId } = body

    // Validate userId (passed from client since getCurrentUser() is client-only)
    if (!userId || typeof userId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'User ID is required', code: 'UNAUTHORIZED' }
        },
        { status: 401 }
      )
    }

    if (
      !description ||
      typeof description !== 'string' ||
      description.trim().length === 0
    ) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Description is required', code: 'VALIDATION_ERROR' }
        },
        { status: 400 }
      )
    }

    // Extract task information using AI
    const extracted = await extractTaskFromNaturalLanguage(description, teamId)

    // Log extraction for improvement
    try {
      await logAIExtraction({
        input: description,
        output: extracted,
        model:
          process.env.OPENAI_MODEL ||
          process.env.ANTHROPIC_MODEL ||
          process.env.GEMINI_MODEL ||
          'unknown',
        timestamp: new Date().toISOString(),
        userId: userId,
        teamId: teamId,
        confidence: extracted.confidence
      })
    } catch (logError) {
      // Don't fail the request if logging fails
      logger.error('Error logging AI extraction', {
        error: logError instanceof Error ? logError.message : 'Unknown error',
        userId: userId,
        teamId: teamId
      })
    }

    logger.info('Task extracted from natural language', {
      userId: userId,
      teamId: teamId,
      title: extracted.title,
      hasDescription: !!extracted.description,
      hasCookValue: extracted.estimatedCookValue !== undefined,
      hasTaskType: extracted.taskType !== undefined,
      confidence: extracted.confidence
    })

    return NextResponse.json({
      success: true,
      data: extracted
    })
  } catch (error) {
    logger.error('Error extracting task from natural language', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to extract task information',
          code: 'EXTRACTION_ERROR'
        }
      },
      { status: 500 }
    )
  }
}
