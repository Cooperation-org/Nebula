import { NextRequest, NextResponse } from 'next/server'
import { generateReviewSummary, generateReviewChecklist } from '@/lib/utils/aiService'
import { getTask } from '@/lib/firebase/tasks'
import { getReviewByTaskId } from '@/lib/firebase/reviews'
import { logger } from '@/lib/utils/logger'

/**
 * API Route: Generate Review Summary or Checklist
 *
 * Story 10B.1: AI Review Assistance - Summaries
 * Story 10B.2: AI Review Assistance - Checklists
 *
 * POST /api/ai/review-assistance
 * Body: { taskId: string, teamId: string, type: 'summary' | 'checklist', userId?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { taskId, teamId, type = 'summary', userId } = body

    // Validate userId (optional for now, but recommended for logging)
    if (!userId || typeof userId !== 'string') {
      // Don't fail, but log warning
      logger.warn('Review assistance called without userId', { taskId, teamId })
    }

    if (!taskId || typeof taskId !== 'string') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Task ID is required', code: 'VALIDATION_ERROR' }
        },
        { status: 400 }
      )
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

    // Get task data
    const task = await getTask(teamId, taskId)
    if (!task) {
      return NextResponse.json(
        { success: false, error: { message: 'Task not found', code: 'NOT_FOUND' } },
        { status: 404 }
      )
    }

    // Verify task is in Review state
    if (task.state !== 'Review') {
      return NextResponse.json(
        {
          success: false,
          error: { message: 'Task must be in Review state', code: 'INVALID_STATE' }
        },
        { status: 400 }
      )
    }

    if (type === 'checklist') {
      // Generate review checklist using AI
      const checklist = await generateReviewChecklist(
        {
          title: task.title,
          description: task.description,
          taskType: task.taskType,
          cookValue: task.cookValue
        },
        teamId
      )

      logger.info('Review checklist generated', {
        userId: userId || 'unknown',
        teamId,
        taskId,
        itemsCount: checklist.items.length,
        rigorLevel: checklist.rigorLevel,
        taskType: checklist.taskType
      })

      return NextResponse.json({
        success: true,
        data: checklist
      })
    } else {
      // Generate review summary (Story 10B.1)
      // Get review data if available
      let reviewData
      try {
        const review = await getReviewByTaskId(teamId, taskId)
        if (review) {
          reviewData = {
            comments: review.comments,
            objections: review.objections,
            approvals: review.approvals
          }
        }
      } catch (error) {
        // Review might not exist yet, that's okay
        logger.warn('Review not found for task', { taskId, teamId })
      }

      // Generate review summary using AI
      const summary = await generateReviewSummary(
        {
          title: task.title,
          description: task.description,
          state: task.state,
          contributors: task.contributors,
          reviewers: task.reviewers,
          cookValue: task.cookValue,
          taskType: task.taskType,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt
        },
        reviewData,
        teamId
      )

      logger.info('Review summary generated', {
        userId: userId || 'unknown',
        teamId,
        taskId,
        hasTaskWork: !!summary.taskWork,
        hasChangesMade: !!summary.changesMade,
        keyDecisionsCount: summary.keyDecisions?.length || 0,
        hasContext: !!summary.context
      })

      return NextResponse.json({
        success: true,
        data: summary
      })
    }
  } catch (error) {
    logger.error('Error generating review assistance', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          message:
            error instanceof Error
              ? error.message
              : 'Failed to generate review assistance',
          code: 'GENERATION_ERROR'
        }
      },
      { status: 500 }
    )
  }
}
