import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { logger } from '@/lib/utils/logger'

/**
 * API Route: Get Default Playbook
 * 
 * Story 10A.2: Playbook-Aware Task Creation
 * 
 * GET /api/playbooks/[category]
 * Returns the default playbook content for the specified category
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ category: string }> }
) {
  try {
    const { category } = await params

    // Validate category
    const validCategories = ['task-creation', 'review-assistance', 'retrospective']
    if (!validCategories.includes(category)) {
      return NextResponse.json(
        { success: false, error: { message: 'Invalid playbook category', code: 'VALIDATION_ERROR' } },
        { status: 400 }
      )
    }

    // Read playbook file from filesystem
    const playbookPath = join(process.cwd(), 'features', 'ai', 'playbooks', `${category}.md`)
    
    try {
      const content = await readFile(playbookPath, 'utf-8')
      
      logger.info('Playbook retrieved', {
        category,
        size: content.length
      })

      return NextResponse.json({
        success: true,
        data: {
          category,
          content,
          name: category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        }
      })
    } catch (fileError) {
      logger.error('Error reading playbook file', {
        category,
        path: playbookPath,
        error: fileError instanceof Error ? fileError.message : 'Unknown error'
      })

      // Return empty content if file doesn't exist
      return NextResponse.json({
        success: true,
        data: {
          category,
          content: '',
          name: category.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')
        }
      })
    }
  } catch (error) {
    logger.error('Error retrieving playbook', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    return NextResponse.json(
      {
        success: false,
        error: {
          message: error instanceof Error ? error.message : 'Failed to retrieve playbook',
          code: 'PLAYBOOK_ERROR'
        }
      },
      { status: 500 }
    )
  }
}

