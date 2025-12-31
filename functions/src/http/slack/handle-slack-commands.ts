/**
 * Slack Bot Command Handler
 *
 * Story 11A.1: Set Up Slack Bot with Basic Commands
 *
 * Handles Slack slash commands: /cook help, /cook create, /cook list
 * Authenticates users via Firebase Auth
 */

import { onRequest } from 'firebase-functions/v2/https'
import * as functions from 'firebase-functions'
import { logger } from '../../shared/logger'
// import { getAuth } from 'firebase-admin/auth' // Reserved for future use
import { initializeApp, getApps } from 'firebase-admin/app'
import { getFirestore, FieldValue, type Query } from 'firebase-admin/firestore'
import { z } from 'zod'
import {
  isTransitionAllowed,
  getAllowedNextStates,
  canUserUpdateTask,
  canUserMoveToState,
  getTaskFromFirestore,
  updateTaskInFirestore
} from './task-update-helpers'
import {
  getReviewByTaskId,
  approveReviewInFirestore,
  objectToReviewInFirestore,
  addReviewCommentInFirestore
} from './review-helpers'
// Governance helpers - imported when needed for vote/object commands
import {
  getGovernanceProposalFromFirestore,
  getVotingFromFirestore,
  getGovernanceWeightFromFirestore,
  castVoteInFirestore,
  addObjectionToProposalInFirestore
} from './governance-helpers'

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp()
}

// const auth = getAuth() // Reserved for future use
const db = getFirestore()

/**
 * Verify Slack request signature
 *
 * @param timestamp - Request timestamp
 * @param body - Request body
 * @param signature - Slack signature
 * @returns Whether signature is valid
 */
// Reserved for future signature verification
// @ts-ignore - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _verifySlackSignature(
  timestamp: string,
  body: string,
  signature: string
): boolean {
  // Access config from Firebase Functions config (legacy API, works until March 2026)
  const signingSecret =
    functions.config().slack?.signing_secret || process.env.SLACK_SIGNING_SECRET
  if (!signingSecret) {
    logger.warn('SLACK_SIGNING_SECRET not configured')
    return false
  }

  // Check timestamp (prevent replay attacks)
  const requestTime = parseInt(timestamp, 10)
  const currentTime = Math.floor(Date.now() / 1000)
  if (Math.abs(currentTime - requestTime) > 300) {
    // More than 5 minutes old
    logger.warn('Slack request timestamp too old', {
      requestTime,
      currentTime,
      difference: currentTime - requestTime
    })
    return false
  }

  // Create signature base string
  const sigBaseString = `v0:${timestamp}:${body}`

  // Create HMAC signature
  const crypto = require('crypto')
  const hmac = crypto.createHmac('sha256', signingSecret)
  hmac.update(sigBaseString)
  const computedSignature = `v0=${hmac.digest('hex')}`

  // Compare signatures (constant-time comparison)
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(computedSignature))
}

/**
 * Authenticate Slack user via Firebase Auth
 *
 * @param slackUserId - Slack user ID
 * @returns Firebase user ID or null if not authenticated
 */
async function authenticateSlackUser(slackUserId: string): Promise<string | null> {
  try {
    // Look up user by Slack user ID
    // Users should have their Slack user ID stored in their user document
    const usersRef = db.collection('users')
    const snapshot = await usersRef.where('slackUserId', '==', slackUserId).limit(1).get()

    if (snapshot.empty) {
      logger.warn('Slack user not found in Firebase', { slackUserId })
      return null
    }

    const userDoc = snapshot.docs[0]
    return userDoc.id
  } catch (error) {
    logger.error('Error authenticating Slack user', {
      slackUserId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Handle /cook help command
 */
function handleHelpCommand(): string {
  return `*Cooperation Toolkit Bot Commands*

\`/cook help\` - Show this help message
\`/cook create "Task title" -description "Description"\` - Create a new task
\`/cook list [state]\` - List your tasks (optionally filter by state)
\`/cook my-tasks [state]\` - Alias for list command
\`/cook update <task-id> <field> <value>\` - Update task field
\`/cook move <task-id> to <state>\` - Move task to new state
\`/cook task <task-id>\` - View task details
\`/cook show <task-id>\` - Alias for task command
\`/cook value <task-id>\` - View COOK value and state for a task
\`/cook my-cook\` - View your total COOK for active team
\`/cook assign <task-id> <cook-value>\` - Assign COOK value to a task
\`/cook set-cook <task-id> <value>\` - Alias for assign command
\`/cook review <task-id> approve\` - Approve a review
\`/cook review <task-id> object -reason "reason"\` - Object to a review
\`/cook review <task-id> comment "comment"\` - Add a comment to a review
\`/cook vote <proposal-id> <option>\` - Vote on a governance proposal
\`/cook object <proposal-id> -reason "reason"\` - Object to a governance proposal

*State Filters:*
• \`backlog\` - Tasks in backlog
• \`ready\` - Tasks ready to start
• \`in-progress\` - Tasks currently in progress
• \`review\` - Tasks in review
• \`done\` - Completed tasks

*Update Fields:*
• \`description\` - Update task description
• \`title\` - Update task title

*Examples:*
\`/cook create "Fix login bug" -description "User cannot log in"\`
\`/cook list in-progress\`
\`/cook update abc123 description "Updated description"\`
\`/cook move abc123 to review\`
\`/cook task abc123\`
\`/cook value abc123\`
\`/cook my-cook\`
\`/cook assign abc123 10\`
\`/cook review abc123 approve\`
\`/cook review abc123 object -reason "Missing tests"\`
\`/cook vote abc123 approve\`
\`/cook object abc123 -reason "Conflicts with team values"\`

For more information, visit the web dashboard.`
}

/**
 * Task creation schema for validation (Story 11A.2)
 * Simplified version matching lib/schemas/task.ts
 */
const slackTaskCreateSchema = z.object({
  title: z.string().min(1, 'Title is required').max(200, 'Title too long'),
  description: z.string().max(5000, 'Description too long').optional()
})

/**
 * Handle /cook create command
 *
 * Story 11A.2: Create Task via Slack Command
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook create
 * @returns Response message
 */
async function handleCreateCommand(userId: string, commandText: string): Promise<string> {
  try {
    // Parse command text
    // Format: "Task title" -description "Description"
    // Support both quoted and unquoted titles
    const titleMatch = commandText.match(
      /^"([^"]+)"|^([^-\s][^-]*?)(?=\s+-description|$)/
    )
    if (!titleMatch) {
      return '❌ Error: Task title is required.\n\n*Usage:* `/cook create "Task title" -description "Description"`\n*Example:* `/cook create "Fix login bug" -description "User cannot log in"`'
    }

    const title = (titleMatch[1] || titleMatch[2] || '').trim()

    if (!title) {
      return '❌ Error: Task title cannot be empty.\n\n*Usage:* `/cook create "Task title" -description "Description"`'
    }

    // Extract description if provided
    const descMatch = commandText.match(/-description\s+"([^"]+)"/)
    const description = descMatch ? descMatch[1].trim() : undefined

    // Validate with schema
    const validationResult = slackTaskCreateSchema.safeParse({ title, description })
    if (!validationResult.success) {
      const errors = validationResult.error.issues
        .map((e: { message: string }) => `• ${e.message}`)
        .join('\n')
      return `❌ Validation Error:\n${errors}\n\n*Usage:* \`/cook create "Task title" -description "Description"\``
    }

    const validatedData = validationResult.data

    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found. Please ensure you are logged in to the web dashboard.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}

    // Get first team (or allow user to specify team in future)
    const teamIds = Object.keys(teams)
    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team. Please join a team first via the web dashboard.'
    }

    // Use first team for now (Story 11A.2 - basic implementation)
    // In future, allow team selection: /cook create -team "Team Name" "Task title"
    const teamId = teamIds[0]

    // Verify team exists
    const teamDoc = await db.collection('teams').doc(teamId).get()
    if (!teamDoc.exists) {
      return '❌ Error: Team not found. Please contact support.'
    }

    const teamName = teamDoc.data()?.name || teamId

    // Create task document matching lib/firebase/tasks.ts structure
    const taskRef = db.collection('teams').doc(teamId).collection('tasks').doc()
    // const now = new Date().toISOString() // Reserved for future use

    const taskDoc = {
      title: validatedData.title,
      description: validatedData.description,
      state: 'Backlog', // New tasks start in Backlog (Epic 3, Story 3.1)
      contributors: [userId], // User is automatically assigned as contributor
      reviewers: [], // No reviewers initially
      archived: false,
      cookValue: undefined, // No COOK value initially
      cookState: 'Draft', // COOK starts in Draft state
      cookAttribution: undefined, // No attribution until COOK is assigned
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      createdBy: userId,
      teamId: teamId
    }

    await taskRef.set(taskDoc)

    logger.info('Task created via Slack', {
      userId,
      teamId,
      taskId: taskRef.id,
      title: validatedData.title,
      hasDescription: !!validatedData.description
    })

    return `✅ *Task created successfully!*

*Title:* ${validatedData.title}
${validatedData.description ? `*Description:* ${validatedData.description}` : ''}
*Team:* ${teamName}
*State:* Backlog
*Task ID:* \`${taskRef.id}\`

The task has been added to your team's backlog. View it in the web dashboard.`
  } catch (error) {
    logger.error('Error creating task via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })

    // Provide more specific error messages
    if (error instanceof z.ZodError) {
      const errors = error.issues
        .map((e: { message: string }) => `• ${e.message}`)
        .join('\n')
      return `❌ Validation Error:\n${errors}\n\n*Usage:* \`/cook create "Task title" -description "Description"\``
    }

    return '❌ Error: Failed to create task. Please try again or use the web dashboard.\n\n*Common issues:*\n• Task title must be 1-200 characters\n• Description must be 5000 characters or less\n• Ensure you are a member of at least one team'
  }
}

/**
 * Map state filter string to task state
 * Supports: backlog, ready, in-progress, review, done
 */
function parseStateFilter(filterText: string): string | null {
  if (!filterText) return null

  const normalized = filterText.toLowerCase().trim()
  const stateMap: Record<string, string> = {
    backlog: 'Backlog',
    ready: 'Ready',
    'in-progress': 'In Progress',
    inprogress: 'In Progress',
    review: 'Review',
    done: 'Done'
  }

  return stateMap[normalized] || null
}

/**
 * Format COOK value for display
 */
function formatCookValue(cookValue: number | undefined): string {
  if (cookValue === undefined || cookValue === null) {
    return 'No COOK'
  }
  return `${cookValue} COOK`
}

/**
 * Format contributors list for display
 */
// Reserved for future use
// @ts-ignore - Reserved for future use
// eslint-disable-next-line @typescript-eslint/no-unused-vars
async function _formatContributors(contributorIds: string[]): Promise<string> {
  if (!contributorIds || contributorIds.length === 0) {
    return 'None'
  }

  // Limit to first 3 contributors for display
  const displayIds = contributorIds.slice(0, 3)
  const moreCount = contributorIds.length - 3

  // Get display names (simplified - just show IDs for now)
  // In future, could fetch user documents for display names
  const contributors = displayIds.join(', ')
  const moreText = moreCount > 0 ? ` +${moreCount} more` : ''

  return `${contributors}${moreText}`
}

/**
 * Handle /cook list command
 *
 * Story 11A.3: View Tasks via Slack Command
 *
 * @param userId - Firebase user ID
 * @param filterText - Optional state filter (e.g., "in-progress")
 * @returns Response message
 */
async function handleListCommand(userId: string, filterText?: string): Promise<string> {
  try {
    // Get user's teams
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    // Use active team (first team) - Story 11A.3: respect active team context
    const teamId = teamIds[0]
    const teamDoc = await db.collection('teams').doc(teamId).get()
    if (!teamDoc.exists) {
      return '❌ Error: Team not found.'
    }

    const teamName = teamDoc.data()?.name || teamId

    // Parse state filter if provided
    const stateFilter = filterText ? parseStateFilter(filterText) : null
    if (filterText && !stateFilter) {
      return `❌ Invalid state filter: \`${filterText}\`\n\n*Valid states:* backlog, ready, in-progress, review, done\n*Usage:* \`/cook list in-progress\``
    }

    // Build query
    const tasksRef = db.collection('teams').doc(teamId).collection('tasks')

    let query: Query
    if (stateFilter) {
      // Query with state filter
      query = tasksRef
        .where('contributors', 'array-contains', userId)
        .where('archived', '==', false)
        .where('state', '==', stateFilter)
        .limit(20)
    } else {
      // Query without state filter
      query = tasksRef
        .where('contributors', 'array-contains', userId)
        .where('archived', '==', false)
        .limit(20)
    }

    const snapshot = await query.get()

    if (snapshot.empty) {
      const filterMsg = stateFilter ? ` with state \`${stateFilter}\`` : ''
      return `📋 You have no active tasks${filterMsg}.\n\n*Team:* ${teamName}\n\nUse \`/cook create "Task title"\` to create one!`
    }

    // Format tasks with details
    const tasks: Array<{
      id: string
      title: string
      state: string
      cookValue?: number
      contributors: string[]
    }> = []

    snapshot.forEach(doc => {
      const data = doc.data()
      tasks.push({
        id: doc.id,
        title: data.title || 'Untitled',
        state: data.state || 'Backlog',
        cookValue: data.cookValue,
        contributors: data.contributors || []
      })
    })

    // Sort by state (priority: In Progress > Review > Ready > Backlog > Done)
    const statePriority: Record<string, number> = {
      'In Progress': 1,
      Review: 2,
      Ready: 3,
      Backlog: 4,
      Done: 5
    }

    tasks.sort((a, b) => {
      const priorityA = statePriority[a.state] || 99
      const priorityB = statePriority[b.state] || 99
      if (priorityA !== priorityB) {
        return priorityA - priorityB
      }
      // If same priority, sort by title
      return a.title.localeCompare(b.title)
    })

    // Format task list
    const taskList = tasks
      .slice(0, 10) // Limit to 10 tasks in message
      .map(task => {
        const cookDisplay = formatCookValue(task.cookValue)
        const contributorsDisplay =
          task.contributors.length > 0
            ? `${task.contributors.length} contributor${task.contributors.length > 1 ? 's' : ''}`
            : 'No contributors'

        return `• *${task.title}*\n  State: \`${task.state}\` | ${cookDisplay} | ${contributorsDisplay}`
      })
      .join('\n\n')

    const moreText =
      tasks.length > 10
        ? `\n\n_... and ${tasks.length - 10} more task${tasks.length - 10 > 1 ? 's' : ''}_`
        : ''

    const filterDisplay = stateFilter ? ` (filtered: \`${stateFilter}\`)` : ''
    const stateCounts = tasks.reduce(
      (acc, task) => {
        acc[task.state] = (acc[task.state] || 0) + 1
        return acc
      },
      {} as Record<string, number>
    )

    const stateSummary = Object.entries(stateCounts)
      .map(([state, count]) => `${state}: ${count}`)
      .join(' | ')

    return `📋 *Your Tasks* - ${teamName}${filterDisplay}

${taskList}${moreText}

*Summary:* ${stateSummary}

Use \`/cook list [state]\` to filter by state (backlog, ready, in-progress, review, done)`
  } catch (error) {
    logger.error('Error listing tasks via Slack', {
      userId,
      filterText,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to retrieve tasks. Please try again or use the web dashboard.'
  }
}

/**
 * Handle /cook update command
 *
 * Story 11A.4: Update Task via Slack Command
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook update
 * @returns Response message
 */
async function handleUpdateCommand(userId: string, commandText: string): Promise<string> {
  try {
    // Parse command: <task-id> <field> <value>
    // Example: "abc123 description Updated description"
    const parts = commandText.trim().split(/\s+/)

    if (parts.length < 3) {
      return '❌ Error: Invalid command format.\n\n*Usage:* `/cook update <task-id> <field> <value>`\n*Example:* `/cook update abc123 description "Updated description"`'
    }

    const taskId = parts[0]
    const field = parts[1].toLowerCase()
    const value = parts.slice(2).join(' ').replace(/^"|"$/g, '') // Remove surrounding quotes if present

    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    const teamId = teamIds[0]
    const userRole = teams[teamId] || 'Contributor'

    // Get task
    const task = await getTaskFromFirestore(teamId, taskId)
    if (!task) {
      return `❌ Error: Task \`${taskId}\` not found in your active team.`
    }

    // Check permissions
    const taskContributors = task.contributors || []
    if (!canUserUpdateTask(userId, taskContributors, userRole)) {
      return '❌ Error: You do not have permission to update this task. You must be assigned as a contributor, reviewer, or steward.'
    }

    // Validate field
    const allowedFields = ['description', 'title']
    if (!allowedFields.includes(field)) {
      return `❌ Error: Invalid field \`${field}\`.\n\n*Allowed fields:* ${allowedFields.join(', ')}\n*Note:* Use \`/cook move <task-id> to <state>\` to change task state.`
    }

    // Validate value
    if (field === 'description' && value.length > 5000) {
      return '❌ Error: Description must be 5000 characters or less.'
    }
    if (field === 'title' && (value.length < 1 || value.length > 200)) {
      return '❌ Error: Title must be between 1 and 200 characters.'
    }

    // Update task
    const updates: Record<string, any> = {}
    if (field === 'description') {
      updates.description = value
    } else if (field === 'title') {
      updates.title = value
    }

    await updateTaskInFirestore(teamId, taskId, updates)

    logger.info('Task updated via Slack', {
      userId,
      teamId,
      taskId,
      field,
      valueLength: value.length
    })

    return `✅ *Task updated successfully!*

*Task ID:* \`${taskId}\`
*Field:* ${field}
*New Value:* ${value.length > 100 ? value.substring(0, 100) + '...' : value}

The task has been updated in your team's task list.`
  } catch (error) {
    logger.error('Error updating task via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to update task. Please try again or use the web dashboard.'
  }
}

/**
 * Handle /cook move command
 *
 * Story 11A.4: Update Task via Slack Command
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook move
 * @returns Response message
 */
async function handleMoveCommand(userId: string, commandText: string): Promise<string> {
  try {
    // Parse command: <task-id> to <state>
    // Example: "abc123 to review"
    const match = commandText.match(/^(\S+)\s+to\s+(\S+)$/i)

    if (!match) {
      return '❌ Error: Invalid command format.\n\n*Usage:* `/cook move <task-id> to <state>`\n*Example:* `/cook move abc123 to review`\n*Valid states:* backlog, ready, in-progress, review, done'
    }

    const taskId = match[1]
    const stateText = match[2]

    // Parse state
    const stateFilter = parseStateFilter(stateText)
    if (!stateFilter) {
      return `❌ Error: Invalid state \`${stateText}\`.\n\n*Valid states:* backlog, ready, in-progress, review, done`
    }

    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    const teamId = teamIds[0]
    const userRole = teams[teamId] || 'Contributor'

    // Get task
    const task = await getTaskFromFirestore(teamId, taskId)
    if (!task) {
      return `❌ Error: Task \`${taskId}\` not found in your active team.`
    }

    const currentState = task.state || 'Backlog'
    const taskContributors = task.contributors || []
    const taskReviewers = task.reviewers || []

    // Check if transition is allowed
    if (!isTransitionAllowed(currentState, stateFilter)) {
      const allowedStates = getAllowedNextStates(currentState)
      return `❌ Error: Cannot move task from \`${currentState}\` to \`${stateFilter}\`.\n\n*Current state:* ${currentState}\n*Allowed next states:* ${allowedStates.length > 0 ? allowedStates.join(', ') : 'None (task is complete)'}`
    }

    // Check permissions
    if (
      !canUserMoveToState(userId, taskContributors, taskReviewers, userRole, stateFilter)
    ) {
      if (stateFilter === 'Review') {
        return '❌ Error: Only reviewers or stewards can move tasks to Review state.'
      }
      return '❌ Error: You do not have permission to move this task to this state.'
    }

    // Update task state
    await updateTaskInFirestore(teamId, taskId, { state: stateFilter })

    logger.info('Task moved via Slack', {
      userId,
      teamId,
      taskId,
      fromState: currentState,
      toState: stateFilter,
      userRole
    })

    return `✅ *Task moved successfully!*

*Task ID:* \`${taskId}\`
*Title:* ${task.title || 'Untitled'}
*Previous State:* ${currentState}
*New State:* ${stateFilter}

The task has been moved in your team's task list.`
  } catch (error) {
    logger.error('Error moving task via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to move task. Please try again or use the web dashboard.'
  }
}

/**
 * Format date for display
 */
function formatDate(dateString: string | undefined): string {
  if (!dateString) return 'Not set'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  } catch {
    return dateString
  }
}

/**
 * Handle /cook task or /cook show command
 *
 * Story 11A.5: View Task Details via Slack Command
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook task or /cook show (should be task ID)
 * @returns Response message
 */
async function handleTaskDetailsCommand(
  userId: string,
  commandText: string
): Promise<string> {
  try {
    // Parse command: <task-id>
    const taskId = commandText.trim().split(/\s+/)[0]

    if (!taskId) {
      return '❌ Error: Task ID is required.\n\n*Usage:* `/cook task <task-id>` or `/cook show <task-id>`\n*Example:* `/cook task abc123`'
    }

    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    const teamId = teamIds[0]
    const userRole = teams[teamId] || 'Contributor'

    // Get task
    const task = await getTaskFromFirestore(teamId, taskId)
    if (!task) {
      return `❌ Error: Task \`${taskId}\` not found in your active team.`
    }

    // Check permissions - user must be contributor, reviewer, or have team access
    const taskContributors = task.contributors || []
    const taskReviewers = task.reviewers || []
    const isContributor = taskContributors.includes(userId)
    const isReviewer = taskReviewers.includes(userId)
    const isSteward = userRole === 'Steward' || userRole === 'Admin'

    // For Restricted visibility, only contributors/reviewers/stewards can view
    // For now, we allow any team member to view (Team-Visible is default)
    if (!isContributor && !isReviewer && !isSteward && userRole === 'Contributor') {
      // Check if task is in a restricted board (future enhancement)
      // For now, allow all team members to view
    }

    // Get team name
    const teamDoc = await db.collection('teams').doc(teamId).get()
    const teamName = teamDoc.data()?.name || teamId

    // Format task details
    const title = task.title || 'Untitled'
    const description = task.description || 'No description'
    const state = task.state || 'Backlog'
    const cookValue = task.cookValue ? `${task.cookValue} COOK` : 'Not assigned'
    const cookState = task.cookState || 'Draft'
    const createdAt = formatDate(task.createdAt)
    const updatedAt = formatDate(task.updatedAt)

    // Format contributors
    let contributorsText = 'None'
    if (taskContributors.length > 0) {
      // Get contributor display names (simplified - just show IDs for now)
      contributorsText = taskContributors.slice(0, 5).join(', ')
      if (taskContributors.length > 5) {
        contributorsText += ` +${taskContributors.length - 5} more`
      }
    }

    // Format reviewers
    let reviewersText = 'None'
    if (taskReviewers && taskReviewers.length > 0) {
      reviewersText = taskReviewers.slice(0, 5).join(', ')
      if (taskReviewers.length > 5) {
        reviewersText += ` +${taskReviewers.length - 5} more`
      }
    }

    // Format COOK attribution
    const attributionText = task.cookAttribution
      ? task.cookAttribution === 'self'
        ? 'Self-COOK'
        : 'Spend-COOK'
      : 'Not set'

    logger.info('Task details viewed via Slack', {
      userId,
      teamId,
      taskId
    })

    return `📋 *Task Details*

*Title:* ${title}
*Task ID:* \`${taskId}\`
*Team:* ${teamName}

*Description:*
${description.length > 300 ? description.substring(0, 300) + '...' : description}

*Status:*
• State: \`${state}\`
• COOK Value: ${cookValue}
• COOK State: \`${cookState}\`
• Attribution: ${attributionText}

*Assignments:*
• Contributors: ${contributorsText}
• Reviewers: ${reviewersText}

*Timestamps:*
• Created: ${createdAt}
• Updated: ${updatedAt}

View full details in the web dashboard.`
  } catch (error) {
    logger.error('Error viewing task details via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to retrieve task details. Please try again or use the web dashboard.'
  }
}

/**
 * Handle /cook value command
 *
 * Story 11A.6: View COOK Information via Slack
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook value (should be task ID)
 * @returns Response message
 */
async function handleCookValueCommand(
  userId: string,
  commandText: string
): Promise<string> {
  try {
    // Parse command: <task-id>
    const taskId = commandText.trim().split(/\s+/)[0]

    if (!taskId) {
      return '❌ Error: Task ID is required.\n\n*Usage:* `/cook value <task-id>`\n*Example:* `/cook value abc123`'
    }

    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    const teamId = teamIds[0]

    // Get task
    const task = await getTaskFromFirestore(teamId, taskId)
    if (!task) {
      return `❌ Error: Task \`${taskId}\` not found in your active team.`
    }

    // Check permissions - user must have access to task
    const taskContributors = task.contributors || []
    const taskReviewers = task.reviewers || []
    const userRole = teams[teamId] || 'Contributor'
    const isContributor = taskContributors.includes(userId)
    const isReviewer = taskReviewers.includes(userId)
    const isSteward = userRole === 'Steward' || userRole === 'Admin'

    if (!isContributor && !isReviewer && !isSteward) {
      return '❌ Error: You do not have permission to view COOK information for this task.'
    }

    // Get team name
    const teamDoc = await db.collection('teams').doc(teamId).get()
    const teamName = teamDoc.data()?.name || teamId

    // Format COOK information
    const title = task.title || 'Untitled'
    const cookValue =
      task.cookValue !== undefined ? `${task.cookValue} COOK` : 'Not assigned'
    const cookState = task.cookState || 'Draft'
    const attribution = task.cookAttribution
      ? task.cookAttribution === 'self'
        ? 'Self-COOK'
        : 'Spend-COOK'
      : 'Not set'

    // Check if COOK has been issued (in ledger)
    const cookLedgerRef = db.collection('teams').doc(teamId).collection('cookLedger')
    const ledgerQuery = cookLedgerRef
      .where('taskId', '==', taskId)
      .where('contributorId', '==', userId)
      .limit(1)
    const ledgerSnapshot = await ledgerQuery.get()
    const isIssued = !ledgerSnapshot.empty

    logger.info('COOK value viewed via Slack', {
      userId,
      teamId,
      taskId,
      cookValue: task.cookValue,
      cookState
    })

    let statusText = ''
    if (isIssued) {
      statusText = '✅ *COOK has been issued* (Final state)'
    } else if (cookState === 'Final') {
      statusText = '⏳ *COOK is Final* (awaiting issuance)'
    } else if (cookState === 'Locked') {
      statusText = '🔒 *COOK is Locked* (in Review)'
    } else if (cookState === 'Provisional') {
      statusText = '📝 *COOK is Provisional* (task in progress)'
    } else {
      statusText = '✏️ *COOK is Draft* (not yet assigned)'
    }

    return `💰 *COOK Information*

*Task:* ${title}
*Task ID:* \`${taskId}\`
*Team:* ${teamName}

*COOK Details:*
• Value: ${cookValue}
• State: \`${cookState}\`
• Attribution: ${attribution}
• Status: ${statusText}

${isIssued ? 'This COOK has been issued and recorded in your ledger.' : 'This COOK has not yet been issued.'}`
  } catch (error) {
    logger.error('Error viewing COOK value via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to retrieve COOK information. Please try again or use the web dashboard.'
  }
}

/**
 * Handle /cook my-cook command
 *
 * Story 11A.6: View COOK Information via Slack
 *
 * @param userId - Firebase user ID
 * @returns Response message
 */
async function handleMyCookCommand(userId: string): Promise<string> {
  try {
    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    const teamId = teamIds[0]

    // Get team name
    const teamDoc = await db.collection('teams').doc(teamId).get()
    const teamName = teamDoc.data()?.name || teamId

    // Get COOK ledger entries for user
    const cookLedgerRef = db.collection('teams').doc(teamId).collection('cookLedger')
    const ledgerQuery = cookLedgerRef.where('contributorId', '==', userId)
    const ledgerSnapshot = await ledgerQuery.get()

    // Calculate totals
    let totalCook = 0
    let selfCook = 0
    let spendCook = 0
    const entries: Array<{
      taskId: string
      cookValue: number
      attribution: string
      issuedAt: string
    }> = []

    ledgerSnapshot.forEach(doc => {
      const data = doc.data()
      const cookValue = data.cookValue || 0
      const attribution = data.attribution || 'self'
      const issuedAt =
        data.issuedAt?.toDate?.()?.toISOString() ||
        data.issuedAt ||
        new Date().toISOString()

      totalCook += cookValue
      if (attribution === 'self') {
        selfCook += cookValue
      } else {
        spendCook += cookValue
      }

      entries.push({
        taskId: data.taskId || '',
        cookValue,
        attribution,
        issuedAt
      })
    })

    // Sort by issuedAt (newest first)
    entries.sort((a, b) => {
      const dateA = new Date(a.issuedAt).getTime()
      const dateB = new Date(b.issuedAt).getTime()
      return dateB - dateA
    })

    logger.info('My COOK viewed via Slack', {
      userId,
      teamId,
      totalCook,
      entryCount: entries.length
    })

    if (entries.length === 0) {
      return `💰 *My COOK - ${teamName}*

*Total COOK:* 0

You haven't earned any COOK yet in this team. Complete tasks and get them reviewed to earn COOK!`
    }

    // Format recent entries (last 5)
    const recentEntries = entries
      .slice(0, 5)
      .map(entry => {
        const attributionIcon = entry.attribution === 'self' ? '👤' : '🎁'
        return `• ${attributionIcon} ${entry.cookValue} COOK (Task: \`${entry.taskId.substring(0, 8)}...\`)`
      })
      .join('\n')

    const moreEntriesText =
      entries.length > 5 ? `\n_... and ${entries.length - 5} more entries_` : ''

    return `💰 *My COOK - ${teamName}*

*Total COOK:* ${totalCook}
• Self-COOK: ${selfCook}
• Spend-COOK: ${spendCook}

*Recent Entries:*
${recentEntries}${moreEntriesText}

View full ledger in the web dashboard.`
  } catch (error) {
    logger.error('Error viewing my COOK via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to retrieve COOK information. Please try again or use the web dashboard.'
  }
}

/**
 * Handle /cook assign or /cook set-cook command
 *
 * Story 11B.1: COOK Management via Slack
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook assign or /cook set-cook
 * @returns Response message
 */
async function handleAssignCookCommand(
  userId: string,
  commandText: string
): Promise<string> {
  try {
    // Parse command: <task-id> <cook-value>
    // Example: "abc123 10" or "abc123 10.5"
    const parts = commandText.trim().split(/\s+/)

    if (parts.length < 2) {
      return '❌ Error: Invalid command format.\n\n*Usage:* `/cook assign <task-id> <cook-value>` or `/cook set-cook <task-id> <value>`\n*Example:* `/cook assign abc123 10`'
    }

    const taskId = parts[0]
    const cookValueText = parts[1]

    // Parse COOK value
    const cookValue = parseFloat(cookValueText)
    if (isNaN(cookValue) || cookValue <= 0) {
      return `❌ Error: Invalid COOK value \`${cookValueText}\`. COOK value must be a positive number.\n\n*Example:* \`/cook assign abc123 10\``
    }

    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    const teamId = teamIds[0]
    const userRole = teams[teamId] || 'Contributor'

    // Get task
    const task = await getTaskFromFirestore(teamId, taskId)
    if (!task) {
      return `❌ Error: Task \`${taskId}\` not found in your active team.`
    }

    // Check permissions
    // Contributors can assign COOK to tasks they are assigned to
    // Stewards and Admins can assign COOK to any task
    const taskContributors = task.contributors || []
    const isContributor = taskContributors.includes(userId)
    const isSteward = userRole === 'Steward' || userRole === 'Admin'

    if (!isContributor && !isSteward) {
      return '❌ Error: You do not have permission to assign COOK to this task. Only task contributors or stewards can assign COOK.'
    }

    // Check if COOK can be edited (must be in Draft or Provisional state)
    const currentCookState = task.cookState || 'Draft'
    if (currentCookState === 'Locked' || currentCookState === 'Final') {
      return `❌ Error: Cannot assign COOK. Task COOK is in \`${currentCookState}\` state and cannot be modified.\n\n*Current COOK state:* ${currentCookState}\n*COOK value:* ${task.cookValue || 'Not assigned'}`
    }

    // Determine attribution automatically
    // If user is a contributor, it's 'self', otherwise it's 'spend'
    // For stewards assigning COOK, we default to 'self' (can be enhanced later)
    const attribution: 'self' | 'spend' = isContributor ? 'self' : 'self' // Default to self for now

    // Determine COOK state based on task state
    // Draft → Provisional when task enters In Progress (handled automatically)
    // For now, we'll set it to Draft if task is in Backlog/Ready, or keep current state
    let newCookState = currentCookState
    const taskState = task.state || 'Backlog'
    if (taskState === 'In Progress' && currentCookState === 'Draft') {
      newCookState = 'Provisional'
    } else if (
      taskState === 'Review' &&
      (currentCookState === 'Draft' || currentCookState === 'Provisional')
    ) {
      newCookState = 'Locked'
    }

    // Update task with COOK value
    await updateTaskInFirestore(teamId, taskId, {
      cookValue,
      cookState: newCookState,
      cookAttribution: attribution
    })

    logger.info('COOK assigned via Slack', {
      userId,
      teamId,
      taskId,
      cookValue,
      attribution,
      cookState: newCookState,
      taskState,
      userRole
    })

    // Get team name
    const teamDoc = await db.collection('teams').doc(teamId).get()
    const teamName = teamDoc.data()?.name || teamId

    const attributionText = attribution === 'self' ? 'Self-COOK' : 'Spend-COOK'

    return `✅ *COOK assigned successfully!*

*Task:* ${task.title || 'Untitled'}
*Task ID:* \`${taskId}\`
*Team:* ${teamName}

*COOK Details:*
• Value: ${cookValue} COOK
• State: \`${newCookState}\`
• Attribution: ${attributionText}
• Task State: \`${taskState}\`

${newCookState === 'Locked' ? '⚠️ COOK is now Locked (task is in Review). It cannot be modified until review is complete.' : ''}
${newCookState === 'Provisional' ? '📝 COOK is Provisional (task is in progress).' : ''}
${newCookState === 'Draft' ? '✏️ COOK is Draft. It will become Provisional when task moves to In Progress.' : ''}`
  } catch (error) {
    logger.error('Error assigning COOK via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to assign COOK. Please try again or use the web dashboard.'
  }
}

/**
 * Handle /cook review command
 *
 * Story 11B.2: Review Workflow via Slack
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook review
 * @returns Response message
 */
/**
 * Handle vote command
 *
 * Story 11B.3: Governance Actions via Slack
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook vote
 * @returns Response message
 */
async function handleVoteCommand(userId: string, commandText: string): Promise<string> {
  try {
    // Parse command: <voting-id> <option>
    // Example: "abc123 approve" or "abc123 reject"
    const parts = commandText.trim().split(/\s+/)

    if (parts.length < 2) {
      return '❌ Error: Invalid command format.\n\n*Usage:* `/cook vote <voting-id> <option>`\n*Example:* `/cook vote abc123 approve`\n\n*Note:* Use `/cook list proposals` to see active voting instances.'
    }

    const votingId = parts[0]
    const option = parts.slice(1).join(' ').toLowerCase().trim()

    if (!votingId || !option) {
      return '❌ Error: Voting ID and option are required.\n\n*Usage:* `/cook vote <voting-id> <option>`'
    }

    // Get voting instance
    const voting = await getVotingFromFirestore(votingId)
    if (!voting) {
      return `❌ Error: Voting instance \`${votingId}\` not found.`
    }

    // Check if voting is open
    if (voting.status !== 'open') {
      return `❌ Error: Voting is not open. Current status: \`${voting.status}\`.`
    }

    // Check if voting period has closed
    if (voting.votingClosesAt) {
      const closesAt = voting.votingClosesAt.toDate
        ? voting.votingClosesAt.toDate()
        : new Date(voting.votingClosesAt)
      if (new Date() > closesAt) {
        return `❌ Error: Voting period has closed. Voting closed at ${closesAt.toLocaleString()}.`
      }
    }

    // Validate option
    const validOptions = (voting.options || []).map((opt: any) =>
      (opt.option || opt).toLowerCase()
    )
    if (!validOptions.includes(option)) {
      return `❌ Error: Invalid vote option: \`${option}\`.\n\n*Valid options:* ${validOptions.map((o: string) => `\`${o}\``).join(', ')}`
    }

    // Check if user has already voted
    const existingVotes = voting.votes || []
    const hasVoted = existingVotes.some((vote: any) => vote.voterId === userId)
    if (hasVoted) {
      const userVote = existingVotes.find((vote: any) => vote.voterId === userId)
      return `❌ Error: You have already cast a vote in this voting.\n\n*Your vote:* \`${userVote?.option || 'unknown'}\``
    }

    // Get user's governance weight
    const governanceWeight = await getGovernanceWeightFromFirestore(voting.teamId, userId)

    // Cast vote
    try {
      const updatedVoting = await castVoteInFirestore(votingId, userId, option)

      // Get proposal for context
      const proposal = voting.proposalId
        ? await getGovernanceProposalFromFirestore(voting.proposalId)
        : null

      const proposalTitle = proposal?.title || 'Unknown Proposal'
      const voteCount = updatedVoting.voteCount || 0
      const totalWeight = updatedVoting.totalWeight || 0

      // Format response
      return (
        `✅ *Vote cast successfully!*\n\n` +
        `*Proposal:* ${proposalTitle}\n` +
        `*Your vote:* \`${option}\`\n` +
        `*Your governance weight:* ${governanceWeight.toFixed(2)} COOK\n` +
        `*Total votes:* ${voteCount}\n` +
        `*Total weighted votes:* ${totalWeight.toFixed(2)} COOK\n\n` +
        `*Voting closes:* ${voting.votingClosesAt ? (voting.votingClosesAt.toDate ? voting.votingClosesAt.toDate().toLocaleString() : new Date(voting.votingClosesAt).toLocaleString()) : 'Not specified'}`
      )
    } catch (error) {
      logger.error('Error casting vote via Slack', {
        votingId,
        userId,
        option,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof Error) {
        return `❌ Error: ${error.message}`
      }
      return '❌ Error: Failed to cast vote. Please try again or use the web dashboard.'
    }
  } catch (error) {
    logger.error('Error handling vote command', {
      userId,
      commandText,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    if (error instanceof Error) {
      return `❌ Error: ${error.message}`
    }
    return '❌ Error: An unexpected error occurred. Please try again or use the web dashboard.'
  }
}

/**
 * Handle object command
 *
 * Story 11B.3: Governance Actions via Slack
 *
 * @param userId - Firebase user ID
 * @param commandText - Command text after /cook object
 * @returns Response message
 */
async function handleObjectCommand(userId: string, commandText: string): Promise<string> {
  try {
    // Parse command: <proposal-id> -reason "reason text" or <proposal-id> reason text
    // Example: "abc123 -reason \"Conflicts with team values\"" or "abc123 Conflicts with team values"
    const trimmed = commandText.trim()

    // Try to parse with -reason flag first
    const reasonFlagMatch = trimmed.match(/^(\S+)\s+-reason\s+"?([^"]+)"?$/)
    let proposalId: string
    let reason: string

    if (reasonFlagMatch) {
      proposalId = reasonFlagMatch[1]
      reason = reasonFlagMatch[2].trim()
    } else {
      // Parse without flag: <proposal-id> <reason>
      const parts = trimmed.split(/\s+/)
      if (parts.length < 2) {
        return '❌ Error: Invalid command format.\n\n*Usage:* `/cook object <proposal-id> -reason "reason"`\n*Example:* `/cook object abc123 -reason "Conflicts with team values"`\n\n*Note:* Use `/cook list proposals` to see active proposals.'
      }
      proposalId = parts[0]
      reason = parts.slice(1).join(' ').trim()
    }

    if (!proposalId || !reason) {
      return '❌ Error: Proposal ID and reason are required.\n\n*Usage:* `/cook object <proposal-id> -reason "reason"`'
    }

    // Validate reason length
    if (reason.length > 1000) {
      return '❌ Error: Objection reason must be 1000 characters or less.'
    }

    // Get proposal
    const proposal = await getGovernanceProposalFromFirestore(proposalId)
    if (!proposal) {
      return `❌ Error: Governance proposal \`${proposalId}\` not found.`
    }

    // Check if objection window is open
    if (proposal.status !== 'objection_window_open') {
      return `❌ Error: Objection window is not open. Current status: \`${proposal.status}\`.\n\n*Note:* Objections can only be raised during the objection window period.`
    }

    // Check if objection window has closed
    if (proposal.objectionWindowClosesAt) {
      const closesAt = proposal.objectionWindowClosesAt.toDate
        ? proposal.objectionWindowClosesAt.toDate()
        : new Date(proposal.objectionWindowClosesAt)
      if (new Date() > closesAt) {
        return `❌ Error: Objection window has closed. Window closed at ${closesAt.toLocaleString()}.`
      }
    }

    // Check if user has already objected
    const existingObjections = proposal.objections || []
    const hasObjected = existingObjections.some((obj: any) => obj.objectorId === userId)
    if (hasObjected) {
      const userObjection = existingObjections.find(
        (obj: any) => obj.objectorId === userId
      )
      return `❌ Error: You have already objected to this proposal.\n\n*Your objection:* ${userObjection?.reason || 'No reason provided'}`
    }

    // Get user's governance weight
    const governanceWeight = await getGovernanceWeightFromFirestore(
      proposal.teamId,
      userId
    )

    // Add objection
    try {
      const updatedProposal = await addObjectionToProposalInFirestore(
        proposalId,
        userId,
        reason
      )

      const objectionCount = updatedProposal.objectionCount || 0
      const weightedObjectionCount = updatedProposal.weightedObjectionCount || 0
      const threshold = proposal.objectionThreshold ?? 0
      const thresholdExceeded = updatedProposal.votingTriggered || false
      const objectionWindowClosesAt = proposal.objectionWindowClosesAt
        ? proposal.objectionWindowClosesAt.toDate
          ? proposal.objectionWindowClosesAt.toDate()
          : new Date(proposal.objectionWindowClosesAt)
        : null

      // Format response
      let response =
        `✅ *Objection raised successfully!*\n\n` +
        `*Proposal:* ${proposal.title || 'Unknown'}\n` +
        `*Your objection:* ${reason}\n` +
        `*Your governance weight:* ${governanceWeight.toFixed(2)} COOK\n` +
        `*Total objections:* ${objectionCount}\n` +
        `*Total weighted objections:* ${weightedObjectionCount.toFixed(2)} COOK\n` +
        `*Objection threshold:* ${threshold}\n\n`

      if (thresholdExceeded) {
        response += `⚠️ *Threshold exceeded!* Voting has been triggered.\n\n`
      } else {
        const remaining = Math.max(0, threshold - weightedObjectionCount)
        response += `*Remaining until threshold:* ${remaining.toFixed(2)} COOK\n\n`
      }

      if (objectionWindowClosesAt) {
        response += `*Objection window closes:* ${objectionWindowClosesAt.toLocaleString()}`
      } else {
        response += `*Objection window:* Open`
      }

      return response
    } catch (error) {
      logger.error('Error adding objection via Slack', {
        proposalId,
        userId,
        reason,
        error: error instanceof Error ? error.message : 'Unknown error'
      })

      if (error instanceof Error) {
        return `❌ Error: ${error.message}`
      }
      return '❌ Error: Failed to add objection. Please try again or use the web dashboard.'
    }
  } catch (error) {
    logger.error('Error handling object command', {
      userId,
      commandText,
      error: error instanceof Error ? error.message : 'Unknown error'
    })

    if (error instanceof Error) {
      return `❌ Error: ${error.message}`
    }
    return '❌ Error: An unexpected error occurred. Please try again or use the web dashboard.'
  }
}

async function handleReviewCommand(userId: string, commandText: string): Promise<string> {
  try {
    // Parse command: <task-id> <action> [options]
    // Examples:
    // "abc123 approve"
    // "abc123 object -reason \"reason text\""
    // "abc123 comment \"comment text\""
    const parts = commandText.trim().split(/\s+/)

    if (parts.length < 2) {
      return '❌ Error: Invalid command format.\n\n*Usage:*\n• `/cook review <task-id> approve`\n• `/cook review <task-id> object -reason "reason"`\n• `/cook review <task-id> comment "comment"`'
    }

    const taskId = parts[0]
    const action = parts[1].toLowerCase()

    // Get user's active team
    const userDoc = await db.collection('users').doc(userId).get()
    if (!userDoc.exists) {
      return '❌ Error: User not found.'
    }

    const userData = userDoc.data()
    const teams = userData?.teams || {}
    const teamIds = Object.keys(teams)

    if (teamIds.length === 0) {
      return '❌ Error: You are not a member of any team.'
    }

    const teamId = teamIds[0]
    const userRole = teams[teamId] || 'Contributor'

    // Get task
    const task = await getTaskFromFirestore(teamId, taskId)
    if (!task) {
      return `❌ Error: Task \`${taskId}\` not found in your active team.`
    }

    // Check if task is in Review state
    if (task.state !== 'Review') {
      return `❌ Error: Task is not in Review state. Current state: \`${task.state}\`\n\nTasks must be in Review state to perform review actions.`
    }

    // Get review
    const review = await getReviewByTaskId(teamId, taskId)
    if (!review) {
      return `❌ Error: Review not found for task \`${taskId}\`. The review may not have been initiated yet.`
    }

    // Check permissions - user must be assigned as reviewer or be a steward
    const taskReviewers = task.reviewers || []
    const isReviewer = taskReviewers.includes(userId)
    const isSteward = userRole === 'Steward' || userRole === 'Admin'

    if (!isReviewer && !isSteward) {
      return '❌ Error: You are not assigned as a reviewer for this task. Only assigned reviewers or stewards can perform review actions.'
    }

    // Handle different actions
    switch (action) {
      case 'approve': {
        try {
          const updatedReview = await approveReviewInFirestore(teamId, review.id, userId)
          const approvals = updatedReview.approvals || []
          const requiredReviewers = updatedReview.requiredReviewers || 1
          const allApproved = approvals.length >= requiredReviewers

          let response = `✅ *Review approved!*

*Task:* ${task.title || 'Untitled'}
*Task ID:* \`${taskId}\`
*Review Status:* ${allApproved ? '✅ Approved (all reviewers)' : '⏳ Pending'}
*Approvals:* ${approvals.length} / ${requiredReviewers} required`

          if (allApproved) {
            response += `\n\n🎉 *All required reviewers have approved!*\nThe review is complete. COOK finalization will be triggered when the task moves to Done.`
          } else {
            response += `\n\nWaiting for ${requiredReviewers - approvals.length} more reviewer${requiredReviewers - approvals.length > 1 ? 's' : ''} to approve.`
          }

          return response
        } catch (error) {
          if (error instanceof Error) {
            return `❌ Error: ${error.message}`
          }
          throw error
        }
      }

      case 'object': {
        // Parse reason: -reason "reason text"
        const reasonMatch = commandText.match(/-reason\s+"([^"]+)"/)
        if (!reasonMatch) {
          return '❌ Error: Objection reason is required.\n\n*Usage:* `/cook review <task-id> object -reason "reason text"`\n*Example:* `/cook review abc123 object -reason "Missing test coverage"`'
        }

        const reason = reasonMatch[1]

        try {
          const updatedReview = await objectToReviewInFirestore(
            teamId,
            review.id,
            userId,
            reason
          )
          const objections = updatedReview.objections || []

          return `⚠️ *Review objection raised!*

*Task:* ${task.title || 'Untitled'}
*Task ID:* \`${taskId}\`
*Review Status:* Objected
*Objection Reason:* ${reason}

*Total Objections:* ${objections.length}

The review workflow has been paused. Objections must be resolved before the task can proceed.`
        } catch (error) {
          if (error instanceof Error) {
            return `❌ Error: ${error.message}`
          }
          throw error
        }
      }

      case 'comment': {
        // Parse comment: "comment text"
        const commentMatch = commandText.match(/comment\s+"([^"]+)"/)
        if (!commentMatch) {
          return '❌ Error: Comment text is required.\n\n*Usage:* `/cook review <task-id> comment "comment text"`\n*Example:* `/cook review abc123 comment "Looks good, but consider adding error handling"`'
        }

        const comment = commentMatch[1]

        try {
          await addReviewCommentInFirestore(teamId, review.id, userId, comment)

          return `💬 *Review comment added!*

*Task:* ${task.title || 'Untitled'}
*Task ID:* \`${taskId}\`
*Comment:* ${comment}

Your comment has been added to the review.`
        } catch (error) {
          if (error instanceof Error) {
            return `❌ Error: ${error.message}`
          }
          throw error
        }
      }

      default:
        return `❌ Error: Unknown review action \`${action}\`.\n\n*Valid actions:* approve, object, comment\n*Usage:*\n• \`/cook review <task-id> approve\`\n• \`/cook review <task-id> object -reason "reason"\`\n• \`/cook review <task-id> comment "comment"\``
    }
  } catch (error) {
    logger.error('Error handling review command via Slack', {
      userId,
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    })
    return '❌ Error: Failed to process review action. Please try again or use the web dashboard.'
  }
}

/**
 * Slack command handler HTTP function
 *
 * Story 11A.1: Set Up Slack Bot with Basic Commands
 */
export const handleSlackCommands = onRequest(
  {
    cors: true,
    maxInstances: 10,
    invoker: 'public' // Allow unauthenticated invocations (Slack doesn't send auth headers)
  },
  async (request, response) => {
    try {
      // Verify request method
      if (request.method !== 'POST') {
        response.status(405).json({ error: 'Method not allowed' })
        return
      }

      // Slack sends URL-encoded form data, not JSON
      // For signature verification, we need the raw body
      // Note: Firebase Functions v2 automatically parses form data, so we need to reconstruct
      // For now, we'll verify signature is present but skip detailed verification in v1
      // In production, use raw body middleware or verify differently
      const timestamp = request.headers['x-slack-request-timestamp'] as string
      const signature = request.headers['x-slack-signature'] as string

      if (!timestamp || !signature) {
        logger.warn('Missing Slack signature headers', {
          hasTimestamp: !!timestamp,
          hasSignature: !!signature
        })
        response.status(401).json({ error: 'Unauthorized' })
        return
      }

      // Note: Full signature verification requires raw body
      // For v1, we verify signature header exists and timestamp is recent
      const requestTime = parseInt(timestamp, 10)
      const currentTime = Math.floor(Date.now() / 1000)
      if (Math.abs(currentTime - requestTime) > 300) {
        logger.warn('Slack request timestamp too old', {
          requestTime,
          currentTime,
          difference: currentTime - requestTime
        })
        response.status(401).json({ error: 'Request too old' })
        return
      }

      // Parse Slack command payload (URL-encoded form data)
      // Firebase Functions v2 parses this automatically
      const payload = request.body || {}
      const command = payload.command // e.g., '/cook'
      const text = payload.text || '' // Command text after /cook
      const slackUserId = payload.user_id
      const responseUrl = payload.response_url

      // Validate payload
      if (!command || !slackUserId) {
        logger.warn('Invalid Slack command payload', {
          hasCommand: !!command,
          hasUserId: !!slackUserId,
          body: JSON.stringify(payload)
        })
        response.status(400).json({
          response_type: 'ephemeral',
          text: '❌ Error: Invalid command payload. Please try again.'
        })
        return
      }

      logger.info('Slack command received', {
        command,
        text,
        slackUserId,
        responseUrl: !!responseUrl
      })

      // Authenticate user
      const userId = await authenticateSlackUser(slackUserId)
      if (!userId) {
        response.status(200).json({
          response_type: 'ephemeral',
          text: '❌ Error: You are not authenticated. Please link your Slack account in the web dashboard.'
        })
        return
      }

      // Parse subcommand
      const parts = text.trim().split(/\s+/)
      const subcommand = parts[0]?.toLowerCase() || 'help'
      const subcommandText = parts.slice(1).join(' ')

      let responseText: string

      switch (subcommand) {
        case 'help':
          responseText = handleHelpCommand()
          break
        case 'create':
          responseText = await handleCreateCommand(userId, subcommandText)
          break
        case 'list':
        case 'my-tasks':
          // Support both /cook list and /cook my-tasks
          // subcommandText may contain state filter (e.g., "in-progress")
          responseText = await handleListCommand(userId, subcommandText)
          break
        case 'update':
          responseText = await handleUpdateCommand(userId, subcommandText)
          break
        case 'move':
          responseText = await handleMoveCommand(userId, subcommandText)
          break
        case 'task':
        case 'show':
          // Support both /cook task and /cook show
          responseText = await handleTaskDetailsCommand(userId, subcommandText)
          break
        case 'value':
          responseText = await handleCookValueCommand(userId, subcommandText)
          break
        case 'my-cook':
          responseText = await handleMyCookCommand(userId)
          break
        case 'assign':
        case 'set-cook':
          // Support both /cook assign and /cook set-cook
          responseText = await handleAssignCookCommand(userId, subcommandText)
          break
        case 'review':
          responseText = await handleReviewCommand(userId, subcommandText)
          break
        case 'vote':
          responseText = await handleVoteCommand(userId, subcommandText)
          break
        case 'object':
          responseText = await handleObjectCommand(userId, subcommandText)
          break
        default:
          responseText = `❌ Unknown command: \`${subcommand}\`. Use \`/cook help\` for available commands.`
      }

      // Send response
      response.status(200).json({
        response_type: 'ephemeral', // Only visible to the user who ran the command
        text: responseText
      })
    } catch (error) {
      logger.error('Error handling Slack command', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      })

      response.status(200).json({
        response_type: 'ephemeral',
        text: '❌ Error: An unexpected error occurred. Please try again or use the web dashboard.'
      })
    }
  }
)
