/**
 * GitHub Webhook Handler
 * 
 * Handles GitHub webhook events for Issues and Projects
 * Maps GitHub Issues to Tasks in Firestore (canonical source)
 * 
 * Story 7.1: Map GitHub Issues to Tasks
 */

import { onRequest } from 'firebase-functions/v2/https'
import { logger } from '../../shared/logger'
import { mapGitHubIssueToTask, updateTaskFromGitHubIssue } from './github-mapper'
import { getTeamIdFromRepository } from './github-team-mapper'
import { mapGitHubColumnToTaskState } from './github-column-mapper'
import { getProjectColumn, moveProjectCard } from './github-projects-api'
import { isTransitionAllowed, type TaskState } from './github-transition-enforcer'
import { validateReviewerRequirement, getReviewerRequirementMessage } from './github-reviewer-enforcer'
import { getCircuitBreaker } from './github-circuit-breaker'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import { initializeApp } from 'firebase-admin/app'
import crypto from 'crypto'

// Initialize Firebase Admin if not already initialized
if (!getFirestore()) {
  initializeApp()
}

const db = getFirestore()

/**
 * GitHub webhook handler
 * Receives webhook events from GitHub and syncs to Firestore tasks
 */
export const handleGithubWebhook = onRequest(
  {
    cors: true,
    maxInstances: 10
  },
  async (request, response) => {
    try {
      // Verify webhook signature
      const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET
      if (webhookSecret) {
        const signature = request.headers['x-hub-signature-256'] as string
        if (!signature || !verifyWebhookSignature(request.body, signature, webhookSecret)) {
          logger.warn('Invalid GitHub webhook signature', {
            hasSignature: !!signature,
            hasSecret: !!webhookSecret
          })
          response.status(401).json({ error: 'Invalid webhook signature' })
          return
        }
      } else {
        logger.warn('GitHub webhook secret not configured - skipping signature verification')
      }

      const event = request.headers['x-github-event'] as string
      const deliveryId = request.headers['x-github-delivery'] as string

      if (!event || !deliveryId) {
        logger.warn('Invalid GitHub webhook request - missing headers', {
          headers: Object.keys(request.headers)
        })
        response.status(400).json({ error: 'Missing required GitHub webhook headers' })
        return
      }

      logger.info('GitHub webhook received', {
        event,
        deliveryId,
        action: request.body?.action
      })

      // Handle different event types
      switch (event) {
        case 'issues':
          await handleIssuesEvent(request.body, deliveryId)
          break
        case 'project_card':
          await handleProjectCardEvent(request.body, deliveryId)
          break
        case 'project':
          await handleProjectEvent(request.body, deliveryId)
          break
        default:
          logger.info('Unhandled GitHub webhook event type', {
            event,
            deliveryId
          })
      }

      // Always return 200 to acknowledge webhook receipt
      response.status(200).json({ received: true })
    } catch (error) {
      logger.error('Error processing GitHub webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })
      // Still return 200 to prevent GitHub from retrying
      // Errors are logged for investigation
      response.status(200).json({ received: true, error: 'Internal error logged' })
    }
  }
)

/**
 * Handle GitHub Issues events (opened, edited, closed, assigned, etc.)
 */
async function handleIssuesEvent(payload: any, deliveryId: string) {
  const action = payload.action
  const issue = payload.issue
  const repository = payload.repository

  if (!issue || !repository) {
    logger.warn('Invalid issues event payload', { action, deliveryId })
    return
  }

  logger.info('Processing GitHub Issues event', {
    action,
    issueId: issue.id,
    issueNumber: issue.number,
    repository: repository.full_name,
    deliveryId
  })

  // Extract team ID from repository mapping
  const teamId = await getTeamIdFromRepository(repository.full_name)
  if (!teamId) {
    logger.warn('No team mapping found for repository', {
      repository: repository.full_name,
      deliveryId
    })
    return
  }

  // Map GitHub Issue to Task
  const taskData = await mapGitHubIssueToTask(issue, repository, teamId)

  // Check if task already exists (by GitHub issue ID)
  const existingTaskQuery = await db
    .collection('teams')
    .doc(teamId)
    .collection('tasks')
    .where('github.issueId', '==', issue.id)
    .limit(1)
    .get()

  if (!existingTaskQuery.empty) {
    // Update existing task
    const existingTaskDoc = existingTaskQuery.docs[0]
    const taskId = existingTaskDoc.id

    logger.info('Updating existing task from GitHub Issue', {
      taskId,
      issueId: issue.id,
      issueNumber: issue.number,
      teamId
    })

    await updateTaskFromGitHubIssue(taskId, teamId, taskData, issue, repository)

    logger.info('Task updated from GitHub Issue', {
      taskId,
      issueId: issue.id,
      teamId,
      deliveryId
    })
  } else {
    // Create new task
    logger.info('Creating new task from GitHub Issue', {
      issueId: issue.id,
      issueNumber: issue.number,
      teamId
    })

    const taskRef = db.collection('teams').doc(teamId).collection('tasks').doc()
    await taskRef.set({
      ...taskData,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })

    logger.info('Task created from GitHub Issue', {
      taskId: taskRef.id,
      issueId: issue.id,
      teamId,
      deliveryId
    })
  }
}

/**
 * Handle GitHub Project Card events (moved between columns)
 * Story 7.2: Sync GitHub Project Columns to Task States
 */
async function handleProjectCardEvent(payload: any, deliveryId: string) {
  const action = payload.action
  const projectCard = payload.project_card
  const project = payload.project
  const repository = payload.repository

  if (!projectCard) {
    logger.warn('Invalid project_card event payload', { action, deliveryId })
    return
  }

  // Only handle moved events (cards moved between columns)
  if (action !== 'moved' && action !== 'created') {
    logger.info('Skipping project_card event - not a move or create action', {
      action,
      projectCardId: projectCard.id,
      deliveryId
    })
    return
  }

  logger.info('Processing GitHub Project Card event', {
    action,
    projectCardId: projectCard.id,
    columnId: projectCard.column_id,
    projectId: project?.id,
    deliveryId
  })

  // Get issue ID from project card content_url
  // Format: https://api.github.com/repos/owner/repo/issues/123
  const contentUrl = projectCard.content_url
  if (!contentUrl || !contentUrl.includes('/issues/')) {
    logger.warn('Project card does not reference an issue', {
      projectCardId: projectCard.id,
      contentUrl,
      deliveryId
    })
    return
  }

  // Extract issue number from content URL
  const issueNumberMatch = contentUrl.match(/\/issues\/(\d+)/)
  if (!issueNumberMatch) {
    logger.warn('Could not extract issue number from project card', {
      projectCardId: projectCard.id,
      contentUrl,
      deliveryId
    })
    return
  }

  const issueNumber = parseInt(issueNumberMatch[1], 10)

  // Get repository info
  if (!repository) {
    logger.warn('Repository not found in project_card event', {
      projectCardId: projectCard.id,
      deliveryId
    })
    return
  }

  // Get team ID from repository
  const teamId = await getTeamIdFromRepository(repository.full_name)
  if (!teamId) {
    logger.warn('No team mapping found for repository in project_card event', {
      repository: repository.full_name,
      deliveryId
    })
    return
  }

  // Find task by GitHub issue number
  const tasksRef = db.collection('teams').doc(teamId).collection('tasks')
  const taskQuery = await tasksRef
    .where('github.issueNumber', '==', issueNumber)
    .where('github.repository', '==', repository.name)
    .where('github.repositoryOwner', '==', repository.owner.login)
    .limit(1)
    .get()

  if (taskQuery.empty) {
    logger.warn('No task found for GitHub issue in project_card event', {
      issueNumber,
      repository: repository.full_name,
      teamId,
      deliveryId
    })
    return
  }

  const taskDoc = taskQuery.docs[0]
  const taskId = taskDoc.id
  const existingTask = taskDoc.data()

  // Get current and new column IDs
  const newColumnId = projectCard.column_id
  const previousColumnId = existingTask.github?.projectColumnId
    ? parseInt(existingTask.github.projectColumnId, 10)
    : null

  // Map column to task state
  // Note: We need the column name, not just the ID
  // For now, we'll need to fetch the column name from GitHub API
  // This is a limitation - we should store column mappings or fetch them

  // Check if this update came from Toolkit (to prevent circular sync)
  const isToolkitSync = existingTask.github?.syncedAt && 
    new Date(existingTask.github.syncedAt).getTime() > Date.now() - 5000 // Within last 5 seconds

  if (isToolkitSync) {
    logger.info('Skipping GitHub column sync - recent Toolkit sync detected', {
      taskId,
      issueNumber,
      newColumnId,
      deliveryId
    })
    return
  }

  // Fetch column name from GitHub API using column_id
  // This requires GitHub API token
  const githubToken = process.env.GITHUB_API_TOKEN
  if (!githubToken) {
    logger.warn('GitHub API token not configured - cannot fetch column name', {
      taskId,
      issueNumber,
      columnId: newColumnId,
      deliveryId
    })
    // Still update metadata even if we can't sync state
    await taskDoc.ref.update({
      'github.projectItemId': projectCard.id.toString(),
      'github.projectId': project?.id?.toString(),
      'github.projectColumnId': newColumnId.toString(),
      'github.syncedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    return
  }

  // Check circuit breaker state (Story 7.6)
  const circuitBreaker = getCircuitBreaker()
  if (!circuitBreaker.canExecute()) {
    logger.warn('GitHub circuit breaker is open - skipping webhook processing', {
      taskId,
      issueNumber,
      state: circuitBreaker.getState(),
      deliveryId
    })
    // Still update metadata to track the attempt
    await taskDoc.ref.update({
      'github.projectItemId': projectCard.id.toString(),
      'github.projectId': project?.id?.toString(),
      'github.projectColumnId': newColumnId.toString(),
      'github.syncedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
    return
  }

  try {
    const { Octokit } = await import('@octokit/rest')
    const octokit = new Octokit({ auth: githubToken })

    // Get column information using GitHub Projects API helper
    const column = await getProjectColumn(octokit, newColumnId)
    
    // Record success in circuit breaker
    circuitBreaker.recordSuccess()

    // Map column name to task state
    const newState = mapGitHubColumnToTaskState(column.name)
    if (!newState) {
      logger.warn('Could not map GitHub column to task state', {
        taskId,
        issueNumber,
        columnName: column.name,
        columnId: newColumnId,
        deliveryId
      })
      // Still update metadata
      await taskDoc.ref.update({
        'github.projectItemId': projectCard.id.toString(),
        'github.projectId': project?.id?.toString(),
        'github.projectColumnId': newColumnId.toString(),
        'github.syncedAt': new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      return
    }

    // Check if state actually changed
    const currentState = existingTask.state
    if (currentState === newState) {
      logger.debug('Task state unchanged - no update needed', {
        taskId,
        issueNumber,
        state: newState,
        deliveryId
      })
      // Still update metadata
      await taskDoc.ref.update({
        'github.projectItemId': projectCard.id.toString(),
        'github.projectId': project?.id?.toString(),
        'github.projectColumnId': newColumnId.toString(),
        'github.syncedAt': new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      return
    }

    // Detect potential desync (Story 7.7)
    // If GitHub state differs from Toolkit state, log for monitoring
    // Toolkit state is canonical (FR18), but we allow valid transitions from GitHub
    if (currentState !== newState) {
      logger.info('State difference detected between GitHub and Toolkit', {
        taskId,
        issueNumber,
        toolkitState: currentState,
        githubState: newState,
        columnName: column.name,
        deliveryId,
        note: 'Toolkit state is canonical (FR18) - GitHub state will be applied if transition is valid'
      })
    }

    // Validate transition is allowed (Story 7.3: Enforce Allowed Column Transitions)
    // Story 7.8: Handle unauthorized movements gracefully (allow visual movement, block COOK)
    if (!isTransitionAllowed(currentState as TaskState, newState as TaskState)) {
      logger.warn('Invalid state transition from GitHub column move - handling as unauthorized movement', {
        taskId,
        issueNumber,
        fromState: currentState,
        toState: newState,
        columnName: column.name,
        deliveryId
      })

      // Story 7.8: Handle unauthorized movement (allow visual, block COOK, notify)
      const { handleUnauthorizedMovement } = await import('./github-unauthorized-handler')
      await handleUnauthorizedMovement(
        octokit,
        teamId,
        taskId,
        issueNumber,
        repository.owner.login,
        repository.name,
        currentState as TaskState,
        newState as TaskState,
        newColumnId,
        projectCard.id
      )

      // Don't update task state - Toolkit state remains at previous valid state (FR19)
      // Metadata is updated by handleUnauthorizedMovement
      return
    }

    // Validate reviewer requirements before allowing transition to Review (Story 7.4, FR14)
    if (newState === 'Review') {
      const assignedReviewers = existingTask.reviewers || []
      const validation = validateReviewerRequirement(
        existingTask.cookValue,
        assignedReviewers,
        newState as TaskState
      )

      if (!validation.isValid) {
        logger.warn('Cannot move task to Review - insufficient reviewers', {
          taskId,
          issueNumber,
          cookValue: existingTask.cookValue,
          requiredReviewers: validation.requiredReviewers,
          assignedReviewers: assignedReviewers.length,
          deliveryId
        })

        // Move card back to previous column and notify user
        if (previousColumnId) {
          await moveProjectCard(octokit, projectCard.id, previousColumnId, 'bottom')
          
          // Add comment to GitHub issue explaining the rejection
          const requirementMessage = getReviewerRequirementMessage(
            existingTask.cookValue,
            assignedReviewers
          )
          
          await octokit.rest.issues.createComment({
            owner: repository.owner.login,
            repo: repository.name,
            issue_number: issueNumber,
            body: `⚠️ **Cannot Move to Review - Insufficient Reviewers**

${requirementMessage}

The card has been moved back to the previous column. Please assign the required reviewers before moving to Review.`
          })
        }

        // Don't update task state - requirement not met
        // Still update metadata
        await taskDoc.ref.update({
          'github.projectItemId': projectCard.id.toString(),
          'github.projectId': project?.id?.toString(),
          'github.projectColumnId': (previousColumnId ? previousColumnId.toString() : newColumnId.toString()),
          'github.syncedAt': new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })
        return
      }
    }

    // Prepare update object
    const updateData: any = {
      state: newState,
      'github.projectItemId': projectCard.id.toString(),
      'github.projectId': project?.id?.toString(),
      'github.projectColumnId': newColumnId.toString(),
      'github.syncedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    // Freeze COOK when task enters Review (Story 7.5, FR15)
    // COOK becomes Locked when task enters Review - this freezes provisional COOK
    if (newState === 'Review' && existingTask.cookValue !== undefined) {
      if (existingTask.cookState === 'Provisional' || existingTask.cookState === 'Draft') {
        updateData.cookState = 'Locked'
        logger.info('COOK frozen via GitHub: Provisional/Draft → Locked (Story 7.5, FR15)', {
          taskId,
          issueNumber,
          teamId,
          trigger: 'Task state changed to Review via GitHub',
          previousState: existingTask.cookState,
          cookValue: existingTask.cookValue,
          frozen: true,
          reviewGate: true,
          deliveryId
        })
      }
    }

    // Update task state
    await taskDoc.ref.update(updateData)

    logger.info('Task state updated from GitHub Project column', {
      taskId,
      issueNumber,
      fromState: currentState,
      toState: newState,
      columnName: column.name,
      deliveryId
    })
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const isNetworkError = errorMessage.includes('ECONNREFUSED') || 
                          errorMessage.includes('ETIMEDOUT') ||
                          errorMessage.includes('ENOTFOUND') ||
                          (error instanceof Error && 'status' in error && (error as any).status >= 500)

    logger.error('Error processing GitHub Project card event', {
      taskId,
      issueNumber,
      columnId: newColumnId,
      error: errorMessage,
      isNetworkError,
      circuitBreakerState: circuitBreaker.getState(),
      deliveryId
    })

    // Record failure in circuit breaker
    circuitBreaker.recordFailure()

    // Still update metadata even if state sync fails
    // This ensures we track the attempt and can retry later
    await taskDoc.ref.update({
      'github.projectItemId': projectCard.id.toString(),
      'github.projectId': project?.id?.toString(),
      'github.projectColumnId': newColumnId.toString(),
      'github.syncedAt': new Date().toISOString(),
      updatedAt: new Date().toISOString()
    })
  }
}

/**
 * Handle GitHub Project events
 * 
 * Handles project-level events (created, updated, closed, reopened, deleted)
 * Main use cases:
 * - Project deletion: Clean up task references
 * - Project updates: Track project metadata changes
 * - Audit logging: Log all project events for monitoring
 */
async function handleProjectEvent(payload: any, deliveryId: string) {
  const action = payload.action
  const project = payload.project
  const organization = payload.organization
  const repository = payload.repository

  if (!project) {
    logger.warn('Invalid project event payload', { action, deliveryId })
    return
  }

  const projectId = project.id?.toString()
  const projectName = project.name || 'Unknown'

  logger.info('Processing GitHub Project event', {
    action,
    projectId,
    projectName,
    deliveryId
  })

  // Handle different project actions
  switch (action) {
    case 'created':
      await handleProjectCreated(project, organization, repository, deliveryId)
      break
    case 'updated':
      await handleProjectUpdated(project, organization, repository, deliveryId)
      break
    case 'closed':
      await handleProjectClosed(project, organization, repository, deliveryId)
      break
    case 'reopened':
      await handleProjectReopened(project, organization, repository, deliveryId)
      break
    case 'deleted':
      await handleProjectDeleted(projectId, organization, repository, deliveryId)
      break
    default:
      logger.info('Unhandled project action', {
        action,
        projectId,
        deliveryId
      })
  }
}

/**
 * Handle project created event
 * Logs the event for audit purposes
 */
async function handleProjectCreated(
  project: any,
  organization: any,
  repository: any,
  deliveryId: string
): Promise<void> {
  logger.info('GitHub Project created', {
    projectId: project.id,
    projectName: project.name,
    organization: organization?.login,
    repository: repository?.full_name,
    deliveryId
  })
  // Future: Could store project metadata if needed
}

/**
 * Handle project updated event
 * Logs the event for audit purposes
 */
async function handleProjectUpdated(
  project: any,
  organization: any,
  repository: any,
  deliveryId: string
): Promise<void> {
  logger.info('GitHub Project updated', {
    projectId: project.id,
    projectName: project.name,
    organization: organization?.login,
    repository: repository?.full_name,
    changes: project.changes || {},
    deliveryId
  })
  // Future: Could update stored project metadata if needed
}

/**
 * Handle project closed event
 * Logs the event for audit purposes
 */
async function handleProjectClosed(
  project: any,
  organization: any,
  repository: any,
  deliveryId: string
): Promise<void> {
  logger.info('GitHub Project closed', {
    projectId: project.id,
    projectName: project.name,
    organization: organization?.login,
    repository: repository?.full_name,
    deliveryId
  })
  // Future: Could mark related tasks or update metadata
}

/**
 * Handle project reopened event
 * Logs the event for audit purposes
 */
async function handleProjectReopened(
  project: any,
  organization: any,
  repository: any,
  deliveryId: string
): Promise<void> {
  logger.info('GitHub Project reopened', {
    projectId: project.id,
    projectName: project.name,
    organization: organization?.login,
    repository: repository?.full_name,
    deliveryId
  })
  // Future: Could restore related tasks or update metadata
}

/**
 * Handle project deleted event
 * Cleans up task references to the deleted project
 */
async function handleProjectDeleted(
  projectId: string | undefined,
  organization: any,
  repository: any,
  deliveryId: string
): Promise<void> {
  if (!projectId) {
    logger.warn('Project ID missing in delete event', { deliveryId })
    return
  }

  logger.warn('GitHub Project deleted - cleaning up task references', {
    projectId,
    organization: organization?.login,
    repository: repository?.full_name,
    deliveryId
  })

  try {
    // Find all tasks that reference this project
    // Note: We need to search across all teams since we don't know which team(s) use this project
    const teamsRef = db.collection('teams')
    const teamsSnapshot = await teamsRef.get()

    let tasksUpdated = 0
    const batch = db.batch()
    let batchCount = 0
    const BATCH_LIMIT = 500 // Firestore batch limit

    for (const teamDoc of teamsSnapshot.docs) {
      const teamId = teamDoc.id
      const tasksRef = teamDoc.ref.collection('tasks')
      const tasksQuery = await tasksRef
        .where('github.projectId', '==', projectId)
        .get()

      for (const taskDoc of tasksQuery.docs) {
        // Update task to remove project reference
        // Keep other GitHub metadata (issueId, issueNumber, repository, etc.)
        const taskData = taskDoc.data()
        const existingGithub = taskData.github || {}
        
        // Remove project-related fields and add deletion marker
        const updatedGithub = {
          ...existingGithub,
          projectDeleted: true,
          projectDeletedAt: new Date().toISOString()
        }
        
        // Delete project fields using FieldValue.delete()
        batch.update(taskDoc.ref, {
          'github.projectId': FieldValue.delete(),
          'github.projectItemId': FieldValue.delete(),
          'github.projectColumnId': FieldValue.delete(),
          'github.projectDeleted': true,
          'github.projectDeletedAt': new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        batchCount++
        tasksUpdated++

        // Firestore batch limit is 500 operations
        if (batchCount >= BATCH_LIMIT) {
          await batch.commit()
          batchCount = 0
        }
      }
    }

    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit()
    }

    logger.info('Cleaned up task references to deleted project', {
      projectId,
      tasksUpdated,
      deliveryId
    })
  } catch (error) {
    logger.error('Error cleaning up task references for deleted project', {
      projectId,
      error: error instanceof Error ? error.message : 'Unknown error',
      deliveryId
    })
    // Don't throw - log error but don't fail webhook processing
  }
}

/**
 * Verify GitHub webhook signature
 * Uses HMAC SHA-256 to verify the webhook payload
 * 
 * @param payload - Webhook payload (as object, will be stringified)
 * @param signature - X-Hub-Signature-256 header value (format: "sha256=...")
 * @param secret - GitHub webhook secret
 * @returns True if signature is valid, false otherwise
 */
function verifyWebhookSignature(payload: any, signature: string, secret: string): boolean {
  try {
    // GitHub sends signature as "sha256=<hex>"
    const signatureHash = signature.replace('sha256=', '')
    
    // Stringify payload (handle both string and object)
    const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload)
    
    // Calculate expected signature
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(payloadString)
      .digest('hex')
    
    // Use timing-safe comparison to prevent timing attacks
    return crypto.timingSafeEqual(
      Buffer.from(signatureHash, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    )
  } catch (error) {
    logger.error('Error verifying webhook signature', {
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return false
  }
}

