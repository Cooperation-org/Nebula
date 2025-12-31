import { NextRequest, NextResponse } from 'next/server'
import { generateRetrospective } from '@/lib/utils/aiService'
import { gatherRetrospectiveData } from '@/lib/firebase/retrospectives'
import { logger } from '@/lib/utils/logger'

/**
 * API Route: Generate Retrospective
 *
 * Story 10B.3: Generate Retrospectives via AI
 *
 * POST /api/ai/retrospective
 * Body: { teamId: string, startDate: string, endDate: string, userId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { teamId, startDate, endDate, userId } = body

    // Validate userId (optional for now, but recommended for logging)
    if (!userId || typeof userId !== 'string') {
      // Don't fail, but log warning
      logger.warn('Retrospective generation called without userId', { teamId })
    }

    if (!teamId || typeof teamId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Team ID is required', code: 'VALIDATION_ERROR' }
        },
        { status: 400 }
      )
    }

    if (!startDate || typeof startDate !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Start date is required', code: 'VALIDATION_ERROR' }
        },
        { status: 400 }
      )
    }

    if (!endDate || typeof endDate !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'End date is required', code: 'VALIDATION_ERROR' }
        },
        { status: 400 }
      )
    }

    // Validate dates
    const start = new Date(startDate)
    const end = new Date(endDate)

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Invalid date format', code: 'VALIDATION_ERROR' }
        },
        { status: 400 }
      )
    }

    if (start > end) {
      return NextResponse.json(
        {
          success: false,
          error: {
            message: 'Start date must be before end date',
            code: 'VALIDATION_ERROR'
          }
        },
        { status: 400 }
      )
    }

    // Gather retrospective data
    const retrospectiveData = await gatherRetrospectiveData(teamId, startDate, endDate)

    // Generate retrospective using AI
    const retrospective = await generateRetrospective(retrospectiveData, teamId)

    logger.info('Retrospective generated', {
      userId: userId || 'unknown',
      teamId,
      startDate,
      endDate,
      accomplishments: retrospective.accomplishments.length,
      patterns: retrospective.patterns.length,
      areasForImprovement: retrospective.areasForImprovement.length,
      recommendations: retrospective.recommendations.length,
      completedTasks: retrospective.dataSummary.completedTasks,
      totalCookIssued: retrospective.dataSummary.totalCookIssued
    })

    return NextResponse.json({
      success: true,
      data: retrospective
    })
  } catch (error) {
    logger.error('Error generating retrospective', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error ? error.message : 'Failed to generate retrospective',
          code: 'GENERATION_ERROR'
        }
      },
      { status: 500 }
    )
  }
}
