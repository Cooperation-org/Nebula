/**
 * AI Service Utility
 *
 * Story 10A.1: Natural Language Task Creation
 *
 * Provides AI service integration for natural language processing
 * Supports OpenAI (default), Anthropic, and Google Gemini (configurable via environment variables)
 *
 * All AI service calls log usage data to Firestore for analytics
 */

// Import usage logging (dynamic import to avoid client/server boundary issues)
let logAIUsage:
  | ((usageData: {
      teamId?: string
      userId?: string
      provider: 'openai' | 'anthropic' | 'gemini'
      model: string
      functionType:
        | 'extract_task'
        | 'generate_review_summary'
        | 'generate_review_checklist'
        | 'generate_retrospective'
      success: boolean
      errorMessage?: string
      promptTokens?: number
      completionTokens?: number
      totalTokens?: number
      inputSize?: number
      outputSize?: number
      estimatedCost?: number
      metadata?: Record<string, unknown>
    }) => Promise<void>)
  | null = null

async function getLogAIUsage() {
  if (!logAIUsage) {
    try {
      const module = await import('@/lib/firebase/aiUsage')
      logAIUsage = module.logAIUsage
    } catch (error) {
      // Silently fail - usage logging is optional
      console.warn('Failed to load AI usage logging:', error)
    }
  }
  return logAIUsage
}

/**
 * Helper function to log AI usage after successful API call
 */
async function logUsageAfterSuccess(
  provider: 'openai' | 'anthropic' | 'gemini',
  model: string,
  functionType:
    | 'extract_task'
    | 'generate_review_summary'
    | 'generate_review_checklist'
    | 'generate_retrospective',
  teamId: string | undefined,
  apiResponse: any,
  inputSize: number,
  outputSize: number,
  metadata?: Record<string, unknown>
): Promise<void> {
  const logUsage = await getLogAIUsage()
  if (!logUsage) return

  // Extract token usage from API response (varies by provider)
  let promptTokens: number | undefined
  let completionTokens: number | undefined
  let totalTokens: number | undefined

  if (provider === 'openai' && apiResponse.usage) {
    promptTokens = apiResponse.usage.prompt_tokens
    completionTokens = apiResponse.usage.completion_tokens
    totalTokens = apiResponse.usage.total_tokens
  } else if (provider === 'anthropic' && apiResponse.usage) {
    promptTokens = apiResponse.usage.input_tokens
    completionTokens = apiResponse.usage.output_tokens
    totalTokens = (promptTokens || 0) + (completionTokens || 0)
  }
  // Gemini doesn't provide token usage in the response

  logUsage({
    teamId,
    provider,
    model,
    functionType,
    success: true,
    promptTokens,
    completionTokens,
    totalTokens,
    inputSize,
    outputSize,
    metadata
  }).catch(() => {
    // Silently fail - usage logging should not break the function
  })
}

/**
 * Helper function to log AI usage after error
 */
async function logUsageAfterError(
  provider: 'openai' | 'anthropic' | 'gemini',
  model: string,
  functionType:
    | 'extract_task'
    | 'generate_review_summary'
    | 'generate_review_checklist'
    | 'generate_retrospective',
  teamId: string | undefined,
  error: unknown,
  inputSize?: number
): Promise<void> {
  const logUsage = await getLogAIUsage()
  if (!logUsage) return

  logUsage({
    teamId,
    provider,
    model,
    functionType,
    success: false,
    errorMessage: error instanceof Error ? error.message : 'Unknown error',
    inputSize
  }).catch(() => {
    // Silently fail
  })
}

export interface TaskExtraction {
  title: string
  description?: string
  estimatedCookValue?: number
  taskType?: 'Build' | 'Ops' | 'Governance' | 'Research'
  confidence?: number // 0-1 confidence score
  playbookReferences?: string[] // Array of playbook IDs or names that were referenced
  playbookSuggestions?: string[] // Suggestions based on playbook patterns
}

export interface AIExtractionLog {
  input: string
  output: TaskExtraction
  model: string
  timestamp: string
  userId?: string
  teamId?: string
  confidence?: number
}

/**
 * Extract task information from natural language description
 *
 * @param description - Natural language description of the task
 * @param teamId - Optional team ID for context
 * @returns Extracted task information
 */
export async function extractTaskFromNaturalLanguage(
  description: string,
  teamId?: string
): Promise<TaskExtraction> {
  // This function should only be called from server-side (API routes)
  // Environment variables are only available server-side
  const aiProvider = process.env.AI_PROVIDER || 'openai'

  // Determine API key based on provider
  let apiKey: string | undefined
  if (aiProvider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
  } else if (aiProvider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY
  } else if (aiProvider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY
  }

  if (!apiKey) {
    throw new Error(
      `AI API key not configured for provider '${aiProvider}'. Please set ${aiProvider.toUpperCase()}_API_KEY or AI_API_KEY environment variable.`
    )
  }

  if (aiProvider === 'openai') {
    return extractTaskWithOpenAI(description, apiKey, teamId)
  } else if (aiProvider === 'anthropic') {
    return extractTaskWithAnthropic(description, apiKey, teamId)
  } else if (aiProvider === 'gemini') {
    return extractTaskWithGemini(description, apiKey, teamId)
  } else {
    throw new Error(
      `Unsupported AI provider: ${aiProvider}. Supported providers: openai, anthropic, gemini`
    )
  }
}

/**
 * Extract task information using OpenAI
 */
async function extractTaskWithOpenAI(
  description: string,
  apiKey: string,
  teamId?: string
): Promise<TaskExtraction> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'

  // Use OpenAI API key from parameter (passed from environment)
  const openaiApiKey = apiKey || process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Get relevant playbooks for task creation (Story 10B.4: Comprehensive Playbook-Aware AI)
  const playbookContent = await getRelevantPlaybooks(teamId, 'task-creation')
  const playbookContext = playbookContent
    ? `\n\n## Team Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the task follows team practices and standards. Reference specific playbook sections when making suggestions.`
    : ''

  const systemPrompt = `You are a task extraction assistant for a cooperation toolkit. Extract task information from natural language descriptions.

Extract the following information:
- title: A concise, clear task title (required)
- description: A detailed description of the task (optional, can be same as input if no additional detail)
- estimatedCookValue: An estimated COOK value (1-100, optional, only if clearly indicated)
- taskType: One of: Build, Ops, Governance, Research (optional, infer from context)
- playbookReferences: Array of playbook sections or guidelines that were referenced (optional)
- playbookSuggestions: Array of suggestions based on playbook patterns (optional)

COOK value guidelines:
- Small tasks: 1-10 COOK
- Medium tasks: 11-30 COOK
- Large tasks: 31-60 COOK
- Extra large tasks: 61-100 COOK

Task type guidelines:
- Build: Development, coding, feature implementation
- Ops: Infrastructure, deployment, operations
- Governance: Policy, process, organizational work
- Research: Investigation, analysis, learning${playbookContext}

Return a JSON object with the extracted information. Only include fields that can be reasonably inferred. If playbooks are provided, ensure the task structure follows playbook guidelines and reference relevant sections.`

  const userPrompt = `Extract task information from this description:\n\n${description}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3 // Lower temperature for more consistent extraction
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const extracted = JSON.parse(content) as TaskExtraction

    // Validate and normalize
    if (!extracted.title || extracted.title.trim().length === 0) {
      // Fallback: use description as title
      extracted.title = description.substring(0, 200).trim()
    }

    // Ensure title is not too long
    if (extracted.title.length > 200) {
      extracted.title = extracted.title.substring(0, 197) + '...'
    }

    // Validate COOK value if provided
    if (extracted.estimatedCookValue !== undefined) {
      if (extracted.estimatedCookValue < 1) {
        extracted.estimatedCookValue = 1
      } else if (extracted.estimatedCookValue > 100) {
        extracted.estimatedCookValue = 100
      }
    }

    // Validate task type if provided
    if (
      extracted.taskType &&
      !['Build', 'Ops', 'Governance', 'Research'].includes(extracted.taskType)
    ) {
      extracted.taskType = undefined
    }

    // Log usage
    const logUsage = await getLogAIUsage()
    if (logUsage) {
      const usage = data.usage || {}
      const inputSize = (systemPrompt + userPrompt).length
      const outputSize = content.length

      logUsage({
        teamId,
        provider: 'openai',
        model,
        functionType: 'extract_task',
        success: true,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        inputSize,
        outputSize,
        metadata: {
          extractedTitle: extracted.title,
          hasDescription: !!extracted.description,
          hasCookValue: extracted.estimatedCookValue !== undefined,
          taskType: extracted.taskType
        }
      }).catch(() => {
        // Silently fail - usage logging should not break the function
      })
    }

    return extracted
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'openai',
      model,
      'extract_task',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic extraction from description
    console.error('Error extracting task with OpenAI:', error)
    return {
      title: description.substring(0, 200).trim() || 'New Task',
      description: description.length > 200 ? description : undefined,
      confidence: 0.5
    }
  }
}

/**
 * Extract task information using Anthropic
 */
async function extractTaskWithAnthropic(
  description: string,
  apiKey: string,
  teamId?: string
): Promise<TaskExtraction> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'

  // Use Anthropic API key from parameter (passed from environment)
  const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured')
  }

  // Get relevant playbooks
  const playbookContent = await getRelevantPlaybooks(teamId, 'task-creation')
  const playbookContext = playbookContent
    ? `\n\n## Team Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the task follows team practices and standards. Reference specific playbook sections when making suggestions.`
    : ''

  const systemPrompt = `You are a task extraction assistant for a cooperation toolkit. Extract task information from natural language descriptions.

Extract the following information:
- title: A concise, clear task title (required)
- description: A detailed description of the task (optional, can be same as input if no additional detail)
- estimatedCookValue: An estimated COOK value (1-100, optional, only if clearly indicated)
- taskType: One of: Build, Ops, Governance, Research (optional, infer from context)
- playbookReferences: Array of playbook sections or guidelines that were referenced (optional)
- playbookSuggestions: Array of suggestions based on playbook patterns (optional)

COOK value guidelines:
- Small tasks: 1-10 COOK
- Medium tasks: 11-30 COOK
- Large tasks: 31-60 COOK
- Extra large tasks: 61-100 COOK

Task type guidelines:
- Build: Development, coding, feature implementation
- Ops: Infrastructure, deployment, operations
- Governance: Policy, process, organizational work
- Research: Investigation, analysis, learning${playbookContext}

Return a JSON object with the extracted information. Only include fields that can be reasonably inferred. If playbooks are provided, ensure the task structure follows playbook guidelines and reference relevant sections.`

  const userPrompt = `Extract task information from this description:\n\n${description}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 1000
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.content[0]?.text

    if (!content) {
      throw new Error('No content in Anthropic response')
    }

    // Extract JSON from response (may include markdown code blocks)
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response')
    }

    const extracted = JSON.parse(jsonMatch[0]) as TaskExtraction

    // Validate and normalize (same as OpenAI)
    if (!extracted.title || extracted.title.trim().length === 0) {
      extracted.title = description.substring(0, 200).trim()
    }

    if (extracted.title.length > 200) {
      extracted.title = extracted.title.substring(0, 197) + '...'
    }

    if (extracted.estimatedCookValue !== undefined) {
      if (extracted.estimatedCookValue < 1) {
        extracted.estimatedCookValue = 1
      } else if (extracted.estimatedCookValue > 100) {
        extracted.estimatedCookValue = 100
      }
    }

    if (
      extracted.taskType &&
      !['Build', 'Ops', 'Governance', 'Research'].includes(extracted.taskType)
    ) {
      extracted.taskType = undefined
    }

    // Log usage
    await logUsageAfterSuccess(
      'anthropic',
      model,
      'extract_task',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        extractedTitle: extracted.title,
        hasDescription: !!extracted.description,
        hasCookValue: extracted.estimatedCookValue !== undefined,
        taskType: extracted.taskType
      }
    )

    return extracted
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'anthropic',
      model,
      'extract_task',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic extraction from description
    console.error('Error extracting task with Anthropic:', error)
    return {
      title: description.substring(0, 200).trim() || 'New Task',
      description: description.length > 200 ? description : undefined,
      confidence: 0.5
    }
  }
}

/**
 * Extract task information using Google Gemini
 */
async function extractTaskWithGemini(
  description: string,
  apiKey: string,
  teamId?: string
): Promise<TaskExtraction> {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro'

  // Use Gemini API key from parameter (passed from environment)
  const geminiApiKey = apiKey || process.env.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured')
  }

  // Get relevant playbooks for task creation
  const playbookContent = await getRelevantPlaybooks(teamId, 'task-creation')
  const playbookContext = playbookContent
    ? `\n\n## Team Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the task follows team practices and standards. Reference specific playbook sections when making suggestions.`
    : ''

  const systemPrompt = `You are a task extraction assistant for a cooperation toolkit. Extract task information from natural language descriptions.

Extract the following information:
- title: A concise, clear task title (required)
- description: A detailed description of the task (optional, can be same as input if no additional detail)
- estimatedCookValue: An estimated COOK value (1-100, optional, only if clearly indicated)
- taskType: One of: Build, Ops, Governance, Research (optional, infer from context)
- playbookReferences: Array of playbook sections or guidelines that were referenced (optional)
- playbookSuggestions: Array of suggestions based on playbook patterns (optional)

COOK value guidelines:
- Small tasks: 1-10 COOK
- Medium tasks: 11-30 COOK
- Large tasks: 31-60 COOK
- Extra large tasks: 61-100 COOK

Task type guidelines:
- Build: Development, coding, feature implementation
- Ops: Infrastructure, deployment, operations
- Governance: Policy, process, organizational work
- Research: Investigation, analysis, learning${playbookContext}

Return a JSON object with the extracted information. Only include fields that can be reasonably inferred. If playbooks are provided, ensure the task structure follows playbook guidelines and reference relevant sections.`

  const userPrompt = `Extract task information from this description:\n\n${description}`

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1000,
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error('No content in Gemini response')
    }

    // Parse JSON response
    let extracted: TaskExtraction
    try {
      extracted = JSON.parse(content) as TaskExtraction
    } catch (parseError) {
      // Fallback: try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response')
      }
      extracted = JSON.parse(jsonMatch[0]) as TaskExtraction
    }

    // Validate and normalize (same as OpenAI and Anthropic)
    if (!extracted.title || extracted.title.trim().length === 0) {
      extracted.title = description.substring(0, 200).trim()
    }

    if (extracted.title.length > 200) {
      extracted.title = extracted.title.substring(0, 197) + '...'
    }

    if (extracted.estimatedCookValue !== undefined) {
      if (extracted.estimatedCookValue < 1) {
        extracted.estimatedCookValue = 1
      } else if (extracted.estimatedCookValue > 100) {
        extracted.estimatedCookValue = 100
      }
    }

    if (
      extracted.taskType &&
      !['Build', 'Ops', 'Governance', 'Research'].includes(extracted.taskType)
    ) {
      extracted.taskType = undefined
    }

    return extracted
  } catch (error) {
    // Fallback: return basic extraction from description
    console.error('Error extracting task with Gemini:', error)
    return {
      title: description.substring(0, 200).trim() || 'New Task',
      description: description.length > 200 ? description : undefined,
      confidence: 0.5
    }
  }
}

/**
 * Log AI extraction for improvement
 *
 * Note: This function is for logging extraction results for ML improvement.
 * Usage analytics (tokens, costs, etc.) are automatically logged via logUsageAfterSuccess/logUsageAfterError.
 *
 * @param log - Extraction log data
 */
export async function logAIExtraction(log: AIExtractionLog): Promise<void> {
  // Store in Firestore for analysis and improvement
  // This can be enhanced to store extraction results for ML model improvement
  // For now, we'll log to console
  // Usage analytics are handled separately via the usage logging system

  console.log('AI Extraction Log:', JSON.stringify(log, null, 2))

  // Future enhancement: Store extraction results in teams/{teamId}/aiExtractionLogs/{logId}
  // for ML model improvement and extraction quality analysis
}

/**
 * Review summary interface
 * Story 10B.1: AI Review Assistance - Summaries
 */
export interface ReviewSummary {
  taskWork: string // Summary of what work was done
  changesMade: string // Summary of changes made
  keyDecisions: string[] // Array of key decisions made
  context: string // Context about the task and its purpose
  summary: string // Overall concise summary
}

/**
 * Review checklist item interface
 * Story 10B.2: AI Review Assistance - Checklists
 */
export interface ReviewChecklistItem {
  id: string // Unique identifier for the checklist item
  text: string // Checklist item text
  category: string // Category (e.g., 'Code Quality', 'Security', 'Documentation')
  required: boolean // Whether this item is required (based on COOK value)
  checked: boolean // Whether the item has been checked off
}

/**
 * Review checklist interface
 * Story 10B.2: AI Review Assistance - Checklists
 */
export interface ReviewChecklist {
  items: ReviewChecklistItem[] // Array of checklist items
  taskType: string // Task type this checklist is for
  cookValue: number | undefined // COOK value this checklist is based on
  rigorLevel: 'basic' | 'standard' | 'rigorous' | 'comprehensive' // Rigor level based on COOK value
}

/**
 * Generate review summary for a task
 *
 * Story 10B.1: AI Review Assistance - Summaries
 *
 * @param taskData - Task data including title, description, state, etc.
 * @param reviewData - Review data including comments, objections, etc.
 * @param teamId - Team ID for context
 * @returns Review summary
 */
export async function generateReviewSummary(
  taskData: {
    title: string
    description?: string
    state: string
    contributors: string[]
    reviewers?: string[]
    cookValue?: number
    taskType?: string
    createdAt: string
    updatedAt: string
  },
  reviewData?: {
    comments?: Array<{ reviewerId: string; comment: string; timestamp: string }>
    objections?: Array<{ reviewerId: string; reason: string; timestamp: string }>
    approvals?: string[]
  },
  teamId?: string
): Promise<ReviewSummary> {
  const aiProvider = process.env.AI_PROVIDER || 'openai'

  // Determine API key based on provider
  let apiKey: string | undefined
  if (aiProvider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
  } else if (aiProvider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY
  }

  if (!apiKey) {
    throw new Error(
      `AI API key not configured for provider '${aiProvider}'. Please set ${aiProvider.toUpperCase()}_API_KEY or AI_API_KEY environment variable.`
    )
  }

  if (!teamId) {
    throw new Error('teamId is required for generating review summary')
  }

  if (aiProvider === 'openai') {
    return generateReviewSummaryWithOpenAI(taskData, apiKey, teamId, reviewData)
  } else if (aiProvider === 'anthropic') {
    return generateReviewSummaryWithAnthropic(taskData, apiKey, teamId, reviewData)
  } else {
    throw new Error(
      `Unsupported AI provider: ${aiProvider}. Supported providers: openai, anthropic`
    )
  }
}

/**
 * Generate review summary using OpenAI
 */
async function generateReviewSummaryWithOpenAI(
  taskData: {
    title: string
    description?: string
    state: string
    contributors: string[]
    reviewers?: string[]
    cookValue?: number
    taskType?: string
    createdAt: string
    updatedAt: string
  },
  apiKey: string,
  teamId: string,
  reviewData?: {
    comments?: Array<{ reviewerId: string; comment: string; timestamp: string }>
    objections?: Array<{ reviewerId: string; reason: string; timestamp: string }>
    approvals?: string[]
  }
): Promise<ReviewSummary> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const openaiApiKey = apiKey || process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Get relevant playbooks for review assistance
  const playbookContent = await getRelevantPlaybooks(teamId, 'review-assistance')
  const playbookContext = playbookContent
    ? `\n\n## Review Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the review summary follows team practices.`
    : ''

  const systemPrompt = `You are a review assistance assistant for a cooperation toolkit. Generate a clear and concise review summary to help reviewers understand what to review.

Generate the following information:
- taskWork: A summary of what work was done (what the task accomplished)
- changesMade: A summary of changes made (if applicable, what was changed or created)
- keyDecisions: An array of key decisions made during the work (important choices, trade-offs, approaches)
- context: Context about the task and its purpose (why this task exists, what problem it solves)
- summary: A concise overall summary (2-3 sentences) that helps reviewers understand what to focus on

The summary should be:
- Clear and concise
- Help reviewers understand what to review
- Focus on what matters for review
- Based on task data and related context${playbookContext}

Return a JSON object with the extracted information.`

  // Build user prompt with task and review data
  const taskInfo = `Task: ${taskData.title}
${taskData.description ? `Description: ${taskData.description}` : ''}
State: ${taskData.state}
Type: ${taskData.taskType || 'Not specified'}
COOK Value: ${taskData.cookValue || 'Not assigned'}
Contributors: ${taskData.contributors.join(', ')}
${taskData.reviewers ? `Reviewers: ${taskData.reviewers.join(', ')}` : ''}
Created: ${taskData.createdAt}
Updated: ${taskData.updatedAt}`

  const reviewInfo = reviewData
    ? `\n\nReview Status:
${
  reviewData.comments && reviewData.comments.length > 0
    ? `Comments: ${reviewData.comments.map(c => `- ${c.comment}`).join('\n')}`
    : 'No comments yet'
}
${
  reviewData.objections && reviewData.objections.length > 0
    ? `Objections: ${reviewData.objections.map(o => `- ${o.reason}`).join('\n')}`
    : 'No objections'
}
${
  reviewData.approvals && reviewData.approvals.length > 0
    ? `Approvals: ${reviewData.approvals.length} reviewer(s) approved`
    : 'No approvals yet'
}`
    : '\n\nReview Status: Review just initiated, no comments or feedback yet.'

  const userPrompt = `Generate a review summary for this task:\n\n${taskInfo}${reviewInfo}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const summary = JSON.parse(content) as ReviewSummary

    // Validate and normalize
    if (!summary.summary) {
      summary.summary = `${summary.taskWork || 'Task work completed'}. ${summary.changesMade || 'Changes made as described'}.`
    }
    if (!summary.taskWork) {
      summary.taskWork = taskData.description || taskData.title
    }
    if (!summary.changesMade) {
      summary.changesMade = 'See task description for details.'
    }
    if (!summary.keyDecisions || !Array.isArray(summary.keyDecisions)) {
      summary.keyDecisions = []
    }
    if (!summary.context) {
      summary.context = taskData.description || 'No additional context provided.'
    }

    // Log usage
    await logUsageAfterSuccess(
      'openai',
      model,
      'generate_review_summary',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        taskTitle: taskData.title,
        hasReviewData: !!reviewData,
        hasComments: reviewData?.comments && reviewData.comments.length > 0,
        hasObjections: reviewData?.objections && reviewData.objections.length > 0,
        approvalCount: reviewData?.approvals?.length || 0
      }
    )

    return summary
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'openai',
      model,
      'generate_review_summary',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic summary from task data
    console.error('Error generating review summary with OpenAI:', error)
    return {
      taskWork: taskData.description || taskData.title,
      changesMade: 'See task description for details.',
      keyDecisions: [],
      context: taskData.description || 'No additional context provided.',
      summary: `${taskData.title}: ${taskData.description || 'Task work completed'}.`
    }
  }
}

/**
 * Generate review summary using Anthropic
 */
async function generateReviewSummaryWithAnthropic(
  taskData: {
    title: string
    description?: string
    state: string
    contributors: string[]
    reviewers?: string[]
    cookValue?: number
    taskType?: string
    createdAt: string
    updatedAt: string
  },
  apiKey: string,
  teamId: string,
  reviewData?: {
    comments?: Array<{ reviewerId: string; comment: string; timestamp: string }>
    objections?: Array<{ reviewerId: string; reason: string; timestamp: string }>
    approvals?: string[]
  }
): Promise<ReviewSummary> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
  const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured')
  }

  // Get relevant playbooks for review assistance
  const playbookContent = await getRelevantPlaybooks(teamId, 'review-assistance')
  const playbookContext = playbookContent
    ? `\n\n## Review Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the review summary follows team practices.`
    : ''

  const systemPrompt = `You are a review assistance assistant for a cooperation toolkit. Generate a clear and concise review summary to help reviewers understand what to review.

Generate the following information:
- taskWork: A summary of what work was done (what the task accomplished)
- changesMade: A summary of changes made (if applicable, what was changed or created)
- keyDecisions: An array of key decisions made during the work (important choices, trade-offs, approaches)
- context: Context about the task and its purpose (why this task exists, what problem it solves)
- summary: A concise overall summary (2-3 sentences) that helps reviewers understand what to focus on

The summary should be:
- Clear and concise
- Help reviewers understand what to review
- Focus on what matters for review
- Based on task data and related context${playbookContext}

Return a JSON object with the extracted information.`

  // Build user prompt (same as OpenAI)
  const taskInfo = `Task: ${taskData.title}
${taskData.description ? `Description: ${taskData.description}` : ''}
State: ${taskData.state}
Type: ${taskData.taskType || 'Not specified'}
COOK Value: ${taskData.cookValue || 'Not assigned'}
Contributors: ${taskData.contributors.join(', ')}
${taskData.reviewers ? `Reviewers: ${taskData.reviewers.join(', ')}` : ''}
Created: ${taskData.createdAt}
Updated: ${taskData.updatedAt}`

  const reviewInfo = reviewData
    ? `\n\nReview Status:
${
  reviewData.comments && reviewData.comments.length > 0
    ? `Comments: ${reviewData.comments.map(c => `- ${c.comment}`).join('\n')}`
    : 'No comments yet'
}
${
  reviewData.objections && reviewData.objections.length > 0
    ? `Objections: ${reviewData.objections.map(o => `- ${o.reason}`).join('\n')}`
    : 'No objections'
}
${
  reviewData.approvals && reviewData.approvals.length > 0
    ? `Approvals: ${reviewData.approvals.length} reviewer(s) approved`
    : 'No approvals yet'
}`
    : '\n\nReview Status: Review just initiated, no comments or feedback yet.'

  const userPrompt = `Generate a review summary for this task:\n\n${taskInfo}${reviewInfo}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.content[0]?.text

    if (!content) {
      throw new Error('No content in Anthropic response')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response')
    }

    const summary = JSON.parse(jsonMatch[0]) as ReviewSummary

    // Validate and normalize (same as OpenAI)
    if (!summary.summary) {
      summary.summary = `${summary.taskWork || 'Task work completed'}. ${summary.changesMade || 'Changes made as described'}.`
    }
    if (!summary.taskWork) {
      summary.taskWork = taskData.description || taskData.title
    }
    if (!summary.changesMade) {
      summary.changesMade = 'See task description for details.'
    }
    if (!summary.keyDecisions || !Array.isArray(summary.keyDecisions)) {
      summary.keyDecisions = []
    }
    if (!summary.context) {
      summary.context = taskData.description || 'No additional context provided.'
    }

    // Log usage
    await logUsageAfterSuccess(
      'anthropic',
      model,
      'generate_review_summary',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        taskTitle: taskData.title,
        hasReviewData: !!reviewData,
        hasComments: reviewData?.comments && reviewData.comments.length > 0,
        hasObjections: reviewData?.objections && reviewData.objections.length > 0,
        approvalCount: reviewData?.approvals?.length || 0
      }
    )

    return summary
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'anthropic',
      model,
      'generate_review_summary',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic summary from task data
    console.error('Error generating review summary with Anthropic:', error)
    return {
      taskWork: taskData.description || taskData.title,
      changesMade: 'See task description for details.',
      keyDecisions: [],
      context: taskData.description || 'No additional context provided.',
      summary: `${taskData.title}: ${taskData.description || 'Task work completed'}.`
    }
  }
}

/**
 * Generate review checklist for a task
 *
 * Story 10B.2: AI Review Assistance - Checklists
 *
 * @param taskData - Task data including title, description, task type, COOK value
 * @param teamId - Team ID for context
 * @returns Review checklist
 */
export async function generateReviewChecklist(
  taskData: {
    title: string
    description?: string
    taskType?: string
    cookValue?: number
  },
  teamId?: string
): Promise<ReviewChecklist> {
  const aiProvider = process.env.AI_PROVIDER || 'openai'

  // Determine API key based on provider
  let apiKey: string | undefined
  if (aiProvider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
  } else if (aiProvider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY
  } else if (aiProvider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY
  }

  if (!apiKey) {
    throw new Error(
      `AI API key not configured for provider '${aiProvider}'. Please set ${aiProvider.toUpperCase()}_API_KEY or AI_API_KEY environment variable.`
    )
  }

  if (aiProvider === 'openai') {
    return generateReviewChecklistWithOpenAI(taskData, apiKey, teamId)
  } else if (aiProvider === 'anthropic') {
    return generateReviewChecklistWithAnthropic(taskData, apiKey, teamId)
  } else if (aiProvider === 'gemini') {
    return generateReviewChecklistWithGemini(taskData, apiKey, teamId)
  } else {
    throw new Error(
      `Unsupported AI provider: ${aiProvider}. Supported providers: openai, anthropic, gemini`
    )
  }
}

/**
 * Generate review checklist using OpenAI
 */
async function generateReviewChecklistWithOpenAI(
  taskData: {
    title: string
    description?: string
    taskType?: string
    cookValue?: number
  },
  apiKey: string,
  teamId?: string
): Promise<ReviewChecklist> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const openaiApiKey = apiKey || process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Get relevant playbooks for review assistance (Story 10B.4: Comprehensive Playbook-Aware AI)
  const playbookContent = await getRelevantPlaybooks(teamId, 'review-assistance')
  const playbookContext = playbookContent
    ? `\n\n## Review Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to generate appropriate checklist items.`
    : ''

  // Determine rigor level based on COOK value
  const cookValue = taskData.cookValue || 0
  let rigorLevel: 'basic' | 'standard' | 'rigorous' | 'comprehensive'
  let requiredItems: number

  if (cookValue < 10) {
    rigorLevel = 'basic'
    requiredItems = 3
  } else if (cookValue <= 30) {
    rigorLevel = 'standard'
    requiredItems = 5
  } else if (cookValue <= 60) {
    rigorLevel = 'rigorous'
    requiredItems = 8
  } else {
    rigorLevel = 'comprehensive'
    requiredItems = 12
  }

  const systemPrompt = `You are a review assistance assistant for a cooperation toolkit. Generate a review checklist to help reviewers know what to check during review.

Generate a checklist based on:
- Task type: ${taskData.taskType || 'Not specified'} (Build/Ops/Governance/Research)
- COOK value: ${cookValue} (determines rigor level: ${rigorLevel})
- Required items: ${requiredItems} (minimum number of required items)

The checklist should:
- Include relevant review items for the task type
- Adapt to COOK value (higher COOK = more rigorous checklist)
- Include both required and optional items
- Cover key aspects: quality, correctness, completeness, security, documentation
- Be specific and actionable

Task type guidelines:
- Build: Focus on code quality, tests, documentation, security, performance
- Ops: Focus on infrastructure, deployment, monitoring, security, reliability
- Governance: Focus on clarity, alignment, feasibility, impact, stakeholder consideration
- Research: Focus on methodology, sources, conclusions, applicability, documentation

Return a JSON object with:
- items: Array of checklist items, each with: id (unique string), text (item description), category (e.g., 'Code Quality', 'Security'), required (boolean)
- rigorLevel: '${rigorLevel}'${playbookContext}

Return a JSON object with the checklist.`

  const userPrompt = `Generate a review checklist for this task:

Task: ${taskData.title}
${taskData.description ? `Description: ${taskData.description}` : ''}
Type: ${taskData.taskType || 'Not specified'}
COOK Value: ${cookValue}
Rigor Level: ${rigorLevel}
Required Items: ${requiredItems}`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const checklist = JSON.parse(content) as ReviewChecklist

    // Validate and normalize
    if (!checklist.items || !Array.isArray(checklist.items)) {
      checklist.items = []
    }

    // Ensure items have required fields and unique IDs
    checklist.items = checklist.items.map((item, index) => ({
      id: item.id || `item-${index}`,
      text: item.text || 'Review item',
      category: item.category || 'General',
      required: item.required !== undefined ? item.required : index < requiredItems,
      checked: false // Always start unchecked
    }))

    checklist.taskType = taskData.taskType || 'Not specified'
    checklist.cookValue = cookValue
    checklist.rigorLevel = rigorLevel

    // Log usage
    await logUsageAfterSuccess(
      'openai',
      model,
      'generate_review_checklist',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        taskTitle: taskData.title,
        taskType: taskData.taskType,
        cookValue,
        rigorLevel,
        itemCount: checklist.items.length,
        requiredItemCount: checklist.items.filter(i => i.required).length
      }
    )

    return checklist
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'openai',
      model,
      'generate_review_checklist',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic checklist
    console.error('Error generating review checklist with OpenAI:', error)
    return generateFallbackChecklist(taskData, rigorLevel, requiredItems)
  }
}

/**
 * Generate review checklist using Anthropic
 */
async function generateReviewChecklistWithAnthropic(
  taskData: {
    title: string
    description?: string
    taskType?: string
    cookValue?: number
  },
  apiKey: string,
  teamId?: string
): Promise<ReviewChecklist> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
  const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured')
  }

  // Get relevant playbooks (same as OpenAI) (Story 10B.4: Comprehensive Playbook-Aware AI)
  const playbookContent = await getRelevantPlaybooks(teamId, 'review-assistance')
  const playbookContext = playbookContent
    ? `\n\n## Review Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to generate appropriate checklist items.`
    : ''

  // Determine rigor level (same as OpenAI)
  const cookValue = taskData.cookValue || 0
  let rigorLevel: 'basic' | 'standard' | 'rigorous' | 'comprehensive'
  let requiredItems: number

  if (cookValue < 10) {
    rigorLevel = 'basic'
    requiredItems = 3
  } else if (cookValue <= 30) {
    rigorLevel = 'standard'
    requiredItems = 5
  } else if (cookValue <= 60) {
    rigorLevel = 'rigorous'
    requiredItems = 8
  } else {
    rigorLevel = 'comprehensive'
    requiredItems = 12
  }

  const systemPrompt = `You are a review assistance assistant for a cooperation toolkit. Generate a review checklist to help reviewers know what to check during review.

Generate a checklist based on:
- Task type: ${taskData.taskType || 'Not specified'} (Build/Ops/Governance/Research)
- COOK value: ${cookValue} (determines rigor level: ${rigorLevel})
- Required items: ${requiredItems} (minimum number of required items)

The checklist should:
- Include relevant review items for the task type
- Adapt to COOK value (higher COOK = more rigorous checklist)
- Include both required and optional items
- Cover key aspects: quality, correctness, completeness, security, documentation
- Be specific and actionable

Task type guidelines:
- Build: Focus on code quality, tests, documentation, security, performance
- Ops: Focus on infrastructure, deployment, monitoring, security, reliability
- Governance: Focus on clarity, alignment, feasibility, impact, stakeholder consideration
- Research: Focus on methodology, sources, conclusions, applicability, documentation

Return a JSON object with:
- items: Array of checklist items, each with: id (unique string), text (item description), category (e.g., 'Code Quality', 'Security'), required (boolean)
- rigorLevel: '${rigorLevel}'${playbookContext}

Return a JSON object with the checklist.`

  const userPrompt = `Generate a review checklist for this task:

Task: ${taskData.title}
${taskData.description ? `Description: ${taskData.description}` : ''}
Type: ${taskData.taskType || 'Not specified'}
COOK Value: ${cookValue}
Rigor Level: ${rigorLevel}
Required Items: ${requiredItems}`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 2000
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.content[0]?.text

    if (!content) {
      throw new Error('No content in Anthropic response')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response')
    }

    const checklist = JSON.parse(jsonMatch[0]) as ReviewChecklist

    // Validate and normalize (same as OpenAI)
    if (!checklist.items || !Array.isArray(checklist.items)) {
      checklist.items = []
    }

    checklist.items = checklist.items.map((item, index) => ({
      id: item.id || `item-${index}`,
      text: item.text || 'Review item',
      category: item.category || 'General',
      required: item.required !== undefined ? item.required : index < requiredItems,
      checked: false
    }))

    checklist.taskType = taskData.taskType || 'Not specified'
    checklist.cookValue = cookValue
    checklist.rigorLevel = rigorLevel

    // Log usage
    await logUsageAfterSuccess(
      'anthropic',
      model,
      'generate_review_checklist',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        taskTitle: taskData.title,
        taskType: taskData.taskType,
        cookValue,
        rigorLevel,
        itemCount: checklist.items.length,
        requiredItemCount: checklist.items.filter(i => i.required).length
      }
    )

    return checklist
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'anthropic',
      model,
      'generate_review_checklist',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic checklist
    console.error('Error generating review checklist with Anthropic:', error)
    return generateFallbackChecklist(taskData, rigorLevel, requiredItems)
  }
}

/**
 * Generate review checklist using Google Gemini
 */
async function generateReviewChecklistWithGemini(
  taskData: {
    title: string
    description?: string
    taskType?: string
    cookValue?: number
  },
  apiKey: string,
  teamId?: string
): Promise<ReviewChecklist> {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro'
  const geminiApiKey = apiKey || process.env.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured')
  }

  // Get relevant playbooks
  const playbookContent = await getRelevantPlaybooks(teamId, 'review-assistance')
  const playbookContext = playbookContent
    ? `\n\n## Review Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to generate appropriate checklist items.`
    : ''

  // Determine rigor level
  const cookValue = taskData.cookValue || 0
  let rigorLevel: 'basic' | 'standard' | 'rigorous' | 'comprehensive'
  let requiredItems: number

  if (cookValue < 10) {
    rigorLevel = 'basic'
    requiredItems = 3
  } else if (cookValue <= 30) {
    rigorLevel = 'standard'
    requiredItems = 5
  } else if (cookValue <= 60) {
    rigorLevel = 'rigorous'
    requiredItems = 8
  } else {
    rigorLevel = 'comprehensive'
    requiredItems = 12
  }

  const systemPrompt = `You are a review assistance assistant for a cooperation toolkit. Generate a review checklist to help reviewers know what to check during review.

Generate a checklist based on:
- Task type: ${taskData.taskType || 'Not specified'} (Build/Ops/Governance/Research)
- COOK value: ${cookValue} (determines rigor level: ${rigorLevel})
- Required items: ${requiredItems} (minimum number of required items)

The checklist should:
- Include relevant review items for the task type
- Adapt to COOK value (higher COOK = more rigorous checklist)
- Include both required and optional items
- Cover key aspects: quality, correctness, completeness, security, documentation
- Be specific and actionable

Task type guidelines:
- Build: Focus on code quality, tests, documentation, security, performance
- Ops: Focus on infrastructure, deployment, monitoring, security, reliability
- Governance: Focus on clarity, alignment, feasibility, impact, stakeholder consideration
- Research: Focus on methodology, sources, conclusions, applicability, documentation

Return a JSON object with:
- items: Array of checklist items, each with: id (unique string), text (item description), category (e.g., 'Code Quality', 'Security'), required (boolean)
- rigorLevel: '${rigorLevel}'${playbookContext}

Return a JSON object with the checklist.`

  const userPrompt = `Generate a review checklist for this task:

Task: ${taskData.title}
${taskData.description ? `Description: ${taskData.description}` : ''}
Type: ${taskData.taskType || 'Not specified'}
COOK Value: ${cookValue}
Rigor Level: ${rigorLevel}
Required Items: ${requiredItems}`

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2000,
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error('No content in Gemini response')
    }

    // Parse JSON response
    let checklist: ReviewChecklist
    try {
      checklist = JSON.parse(content) as ReviewChecklist
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response')
      }
      checklist = JSON.parse(jsonMatch[0]) as ReviewChecklist
    }

    // Validate and normalize
    if (!checklist.items || !Array.isArray(checklist.items)) {
      checklist.items = []
    }

    checklist.items = checklist.items.map((item, index) => ({
      id: item.id || `item-${index}`,
      text: item.text || 'Review item',
      category: item.category || 'General',
      required: item.required !== undefined ? item.required : index < requiredItems,
      checked: false
    }))

    checklist.taskType = taskData.taskType || 'Not specified'
    checklist.cookValue = cookValue
    checklist.rigorLevel = rigorLevel

    // Log usage
    await logUsageAfterSuccess(
      'gemini',
      model,
      'generate_review_checklist',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        taskTitle: taskData.title,
        taskType: taskData.taskType,
        cookValue,
        rigorLevel,
        itemCount: checklist.items.length,
        requiredItemCount: checklist.items.filter(i => i.required).length
      }
    )

    return checklist
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'gemini',
      model,
      'generate_review_checklist',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic checklist
    console.error('Error generating review checklist with Gemini:', error)
    return generateFallbackChecklist(taskData, rigorLevel, requiredItems)
  }
}

/**
 * Generate fallback checklist when AI generation fails
 */
function generateFallbackChecklist(
  taskData: {
    title: string
    description?: string
    taskType?: string
    cookValue?: number
  },
  rigorLevel: 'basic' | 'standard' | 'rigorous' | 'comprehensive',
  requiredItems: number
): ReviewChecklist {
  const taskType = taskData.taskType || 'Build'
  const cookValue = taskData.cookValue || 0

  // Base checklist items by task type
  const baseItems: Record<string, Array<{ text: string; category: string }>> = {
    Build: [
      { text: 'Code follows team style guidelines', category: 'Code Quality' },
      { text: 'Tests are included and passing', category: 'Testing' },
      { text: 'Documentation is updated', category: 'Documentation' },
      { text: 'No security vulnerabilities', category: 'Security' },
      { text: 'Performance considerations addressed', category: 'Performance' },
      { text: 'Error handling is appropriate', category: 'Code Quality' }
    ],
    Ops: [
      { text: 'Infrastructure changes are documented', category: 'Documentation' },
      { text: 'Deployment process is tested', category: 'Deployment' },
      { text: 'Monitoring is configured', category: 'Monitoring' },
      { text: 'Security best practices followed', category: 'Security' },
      { text: 'Rollback plan is defined', category: 'Reliability' },
      { text: 'Impact assessment completed', category: 'Operations' }
    ],
    Governance: [
      { text: 'Process is clearly defined', category: 'Clarity' },
      { text: 'Policy aligns with team values', category: 'Alignment' },
      { text: 'Implementation is feasible', category: 'Feasibility' },
      { text: 'Impact is assessed', category: 'Impact' },
      { text: 'Stakeholders are considered', category: 'Stakeholders' },
      { text: 'Documentation is complete', category: 'Documentation' }
    ],
    Research: [
      { text: 'Research methodology is sound', category: 'Methodology' },
      { text: 'Sources are credible and cited', category: 'Sources' },
      { text: 'Conclusions are supported by evidence', category: 'Analysis' },
      { text: 'Findings are applicable to the problem', category: 'Applicability' },
      { text: 'Documentation is comprehensive', category: 'Documentation' },
      { text: 'Recommendations are actionable', category: 'Recommendations' }
    ]
  }

  const items = baseItems[taskType] || baseItems.Build
  const selectedItems = items.slice(0, Math.max(requiredItems, items.length))

  return {
    items: selectedItems.map((item, index) => ({
      id: `item-${index}`,
      text: item.text,
      category: item.category,
      required: index < requiredItems,
      checked: false
    })),
    taskType,
    cookValue,
    rigorLevel
  }
}

/**
 * Retrospective interface
 * Story 10B.3: Generate Retrospectives via AI
 */
export interface Retrospective {
  accomplishments: string[] // Key accomplishments and wins
  patterns: string[] // Patterns observed in work
  areasForImprovement: string[] // Areas that need improvement
  recommendations: string[] // Actionable recommendations
  summary: string // Overall summary for team discussion
  dataSummary: {
    completedTasks: number
    totalCookIssued: number
    averageCookPerTask: number
    reviewCount: number
    averageReviewTime?: number // In days (if calculable)
    topContributors: Array<{ contributorId: string; cookValue: number }>
  }
}

/**
 * Generate retrospective for a team
 *
 * Story 10B.3: Generate Retrospectives via AI
 *
 * @param retrospectiveData - Data about completed tasks, COOK issuances, reviews
 * @param teamId - Team ID for context
 * @returns Generated retrospective
 */
export async function generateRetrospective(
  retrospectiveData: {
    completedTasks: Array<{
      id: string
      title: string
      description?: string
      cookValue?: number
      taskType?: string
      contributors: string[]
      reviewers?: string[]
      createdAt: string
      updatedAt: string
    }>
    cookLedgerEntries: Array<{
      taskId: string
      contributorId: string
      cookValue: number
      issuedAt: string
    }>
    reviews: Array<{
      taskId: string
      status: string
      approvals: string[]
      objections: Array<{ reason: string }>
      comments: Array<{ comment: string }>
      createdAt: string
      updatedAt: string
    }>
    timeRange: {
      startDate: string
      endDate: string
    }
  },
  teamId?: string
): Promise<Retrospective> {
  const aiProvider = process.env.AI_PROVIDER || 'openai'

  // Determine API key based on provider
  let apiKey: string | undefined
  if (aiProvider === 'openai') {
    apiKey = process.env.OPENAI_API_KEY || process.env.AI_API_KEY
  } else if (aiProvider === 'anthropic') {
    apiKey = process.env.ANTHROPIC_API_KEY || process.env.AI_API_KEY
  } else if (aiProvider === 'gemini') {
    apiKey = process.env.GEMINI_API_KEY || process.env.AI_API_KEY
  }

  if (!apiKey) {
    throw new Error(
      `AI API key not configured for provider '${aiProvider}'. Please set ${aiProvider.toUpperCase()}_API_KEY or AI_API_KEY environment variable.`
    )
  }

  if (aiProvider === 'openai') {
    return generateRetrospectiveWithOpenAI(retrospectiveData, apiKey, teamId)
  } else if (aiProvider === 'anthropic') {
    return generateRetrospectiveWithAnthropic(retrospectiveData, apiKey, teamId)
  } else if (aiProvider === 'gemini') {
    return generateRetrospectiveWithGemini(retrospectiveData, apiKey, teamId)
  } else {
    throw new Error(
      `Unsupported AI provider: ${aiProvider}. Supported providers: openai, anthropic, gemini`
    )
  }
}

/**
 * Generate retrospective using OpenAI
 */
async function generateRetrospectiveWithOpenAI(
  retrospectiveData: {
    completedTasks: Array<{
      id: string
      title: string
      description?: string
      cookValue?: number
      taskType?: string
      contributors: string[]
      reviewers?: string[]
      createdAt: string
      updatedAt: string
    }>
    cookLedgerEntries: Array<{
      taskId: string
      contributorId: string
      cookValue: number
      issuedAt: string
    }>
    reviews: Array<{
      taskId: string
      status: string
      approvals: string[]
      objections: Array<{ reason: string }>
      comments: Array<{ comment: string }>
      createdAt: string
      updatedAt: string
    }>
    timeRange: {
      startDate: string
      endDate: string
    }
  },
  apiKey: string,
  teamId?: string
): Promise<Retrospective> {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const openaiApiKey = apiKey || process.env.OPENAI_API_KEY
  if (!openaiApiKey) {
    throw new Error('OpenAI API key not configured')
  }

  // Get relevant playbooks for retrospectives
  const playbookContent = await getRelevantPlaybooks(teamId, 'retrospective')
  const playbookContext = playbookContent
    ? `\n\n## Retrospective Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the retrospective follows team practices.`
    : ''

  // Calculate data summary
  const totalCookIssued = retrospectiveData.cookLedgerEntries.reduce(
    (sum, entry) => sum + entry.cookValue,
    0
  )
  const averageCookPerTask =
    retrospectiveData.completedTasks.length > 0
      ? totalCookIssued / retrospectiveData.completedTasks.length
      : 0

  // Calculate top contributors
  const contributorCookMap = new Map<string, number>()
  retrospectiveData.cookLedgerEntries.forEach(entry => {
    const current = contributorCookMap.get(entry.contributorId) || 0
    contributorCookMap.set(entry.contributorId, current + entry.cookValue)
  })
  const topContributors = Array.from(contributorCookMap.entries())
    .map(([contributorId, cookValue]) => ({ contributorId, cookValue }))
    .sort((a, b) => b.cookValue - a.cookValue)
    .slice(0, 5)

  // Calculate average review time (if possible)
  let averageReviewTime: number | undefined
  const reviewTimes: number[] = []
  retrospectiveData.reviews.forEach(review => {
    const start = new Date(review.createdAt).getTime()
    const end = new Date(review.updatedAt).getTime()
    if (review.status === 'approved' && end > start) {
      const days = (end - start) / (1000 * 60 * 60 * 24)
      reviewTimes.push(days)
    }
  })
  if (reviewTimes.length > 0) {
    averageReviewTime =
      reviewTimes.reduce((sum, time) => sum + time, 0) / reviewTimes.length
  }

  const dataSummary = {
    completedTasks: retrospectiveData.completedTasks.length,
    totalCookIssued,
    averageCookPerTask,
    reviewCount: retrospectiveData.reviews.length,
    averageReviewTime,
    topContributors
  }

  const systemPrompt = `You are a retrospective assistant for a cooperation toolkit. Generate a comprehensive retrospective summary to help teams reflect on their performance and improve.

Generate the following information:
- accomplishments: Array of key accomplishments and wins (what went well)
- patterns: Array of patterns observed in the work (trends, recurring themes)
- areasForImprovement: Array of areas that need improvement (what could be better)
- recommendations: Array of actionable recommendations (specific next steps)
- summary: A concise overall summary formatted for team discussion (2-3 paragraphs)

The retrospective should:
- Reference specific tasks and data when relevant
- Be constructive and actionable
- Focus on learning and improvement
- Be formatted for team discussion
- Use the data provided to inform insights${playbookContext}

Return a JSON object with the retrospective information.`

  // Build user prompt with retrospective data
  const tasksSummary = `Completed Tasks (${retrospectiveData.completedTasks.length}):
${retrospectiveData.completedTasks
  .slice(0, 20)
  .map(
    (task, idx) =>
      `${idx + 1}. ${task.title} (${task.taskType || 'N/A'}, ${task.cookValue || 0} COOK)`
  )
  .join('\n')}
${retrospectiveData.completedTasks.length > 20 ? `... and ${retrospectiveData.completedTasks.length - 20} more tasks` : ''}`

  const cookSummary = `COOK Distribution:
- Total COOK Issued: ${totalCookIssued}
- Average COOK per Task: ${averageCookPerTask.toFixed(2)}
- Top Contributors: ${topContributors.map(c => `Contributor ${c.contributorId}: ${c.cookValue} COOK`).join(', ')}`

  const reviewSummary = `Review Patterns:
- Total Reviews: ${retrospectiveData.reviews.length}
- Average Review Time: ${averageReviewTime ? `${averageReviewTime.toFixed(1)} days` : 'N/A'}
- Reviews with Objections: ${retrospectiveData.reviews.filter(r => r.objections.length > 0).length}
- Total Comments: ${retrospectiveData.reviews.reduce((sum, r) => sum + r.comments.length, 0)}`

  const userPrompt = `Generate a retrospective for this team:

Time Range: ${retrospectiveData.timeRange.startDate} to ${retrospectiveData.timeRange.endDate}

${tasksSummary}

${cookSummary}

${reviewSummary}

Analyze this data and generate a comprehensive retrospective that helps the team reflect and improve.`

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`OpenAI API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.choices[0]?.message?.content

    if (!content) {
      throw new Error('No content in OpenAI response')
    }

    const retrospective = JSON.parse(content) as Retrospective

    // Validate and normalize
    if (!retrospective.accomplishments || !Array.isArray(retrospective.accomplishments)) {
      retrospective.accomplishments = []
    }
    if (!retrospective.patterns || !Array.isArray(retrospective.patterns)) {
      retrospective.patterns = []
    }
    if (
      !retrospective.areasForImprovement ||
      !Array.isArray(retrospective.areasForImprovement)
    ) {
      retrospective.areasForImprovement = []
    }
    if (!retrospective.recommendations || !Array.isArray(retrospective.recommendations)) {
      retrospective.recommendations = []
    }
    if (!retrospective.summary) {
      retrospective.summary =
        'Team completed work and made progress. Review the data for details.'
    }

    retrospective.dataSummary = dataSummary

    // Log usage
    await logUsageAfterSuccess(
      'openai',
      model,
      'generate_retrospective',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        completedTasksCount: retrospectiveData.completedTasks.length,
        totalCookIssued,
        reviewCount: retrospectiveData.reviews.length,
        timeRangeStart: retrospectiveData.timeRange.startDate,
        timeRangeEnd: retrospectiveData.timeRange.endDate
      }
    )

    return retrospective
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'openai',
      model,
      'generate_retrospective',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic retrospective
    console.error('Error generating retrospective with OpenAI:', error)
    return {
      accomplishments: ['Team completed tasks and issued COOK'],
      patterns: [],
      areasForImprovement: [],
      recommendations: ['Continue tracking metrics and improving processes'],
      summary: `Team completed ${dataSummary.completedTasks} tasks and issued ${dataSummary.totalCookIssued} COOK during this period.`,
      dataSummary
    }
  }
}

/**
 * Generate retrospective using Anthropic
 */
async function generateRetrospectiveWithAnthropic(
  retrospectiveData: {
    completedTasks: Array<{
      id: string
      title: string
      description?: string
      cookValue?: number
      taskType?: string
      contributors: string[]
      reviewers?: string[]
      createdAt: string
      updatedAt: string
    }>
    cookLedgerEntries: Array<{
      taskId: string
      contributorId: string
      cookValue: number
      issuedAt: string
    }>
    reviews: Array<{
      taskId: string
      status: string
      approvals: string[]
      objections: Array<{ reason: string }>
      comments: Array<{ comment: string }>
      createdAt: string
      updatedAt: string
    }>
    timeRange: {
      startDate: string
      endDate: string
    }
  },
  apiKey: string,
  teamId?: string
): Promise<Retrospective> {
  const model = process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-20241022'
  const anthropicApiKey = apiKey || process.env.ANTHROPIC_API_KEY
  if (!anthropicApiKey) {
    throw new Error('Anthropic API key not configured')
  }

  // Get relevant playbooks (same as OpenAI)
  const playbookContent = await getRelevantPlaybooks(teamId, 'retrospective')
  const playbookContext = playbookContent
    ? `\n\n## Retrospective Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the retrospective follows team practices.`
    : ''

  // Calculate data summary (same as OpenAI)
  const totalCookIssued = retrospectiveData.cookLedgerEntries.reduce(
    (sum, entry) => sum + entry.cookValue,
    0
  )
  const averageCookPerTask =
    retrospectiveData.completedTasks.length > 0
      ? totalCookIssued / retrospectiveData.completedTasks.length
      : 0

  const contributorCookMap = new Map<string, number>()
  retrospectiveData.cookLedgerEntries.forEach(entry => {
    const current = contributorCookMap.get(entry.contributorId) || 0
    contributorCookMap.set(entry.contributorId, current + entry.cookValue)
  })
  const topContributors = Array.from(contributorCookMap.entries())
    .map(([contributorId, cookValue]) => ({ contributorId, cookValue }))
    .sort((a, b) => b.cookValue - a.cookValue)
    .slice(0, 5)

  let averageReviewTime: number | undefined
  const reviewTimes: number[] = []
  retrospectiveData.reviews.forEach(review => {
    const start = new Date(review.createdAt).getTime()
    const end = new Date(review.updatedAt).getTime()
    if (review.status === 'approved' && end > start) {
      const days = (end - start) / (1000 * 60 * 60 * 24)
      reviewTimes.push(days)
    }
  })
  if (reviewTimes.length > 0) {
    averageReviewTime =
      reviewTimes.reduce((sum, time) => sum + time, 0) / reviewTimes.length
  }

  const dataSummary = {
    completedTasks: retrospectiveData.completedTasks.length,
    totalCookIssued,
    averageCookPerTask,
    reviewCount: retrospectiveData.reviews.length,
    averageReviewTime,
    topContributors
  }

  const systemPrompt = `You are a retrospective assistant for a cooperation toolkit. Generate a comprehensive retrospective summary to help teams reflect on their performance and improve.

Generate the following information:
- accomplishments: Array of key accomplishments and wins (what went well)
- patterns: Array of patterns observed in the work (trends, recurring themes)
- areasForImprovement: Array of areas that need improvement (what could be better)
- recommendations: Array of actionable recommendations (specific next steps)
- summary: A concise overall summary formatted for team discussion (2-3 paragraphs)

The retrospective should:
- Reference specific tasks and data when relevant
- Be constructive and actionable
- Focus on learning and improvement
- Be formatted for team discussion
- Use the data provided to inform insights${playbookContext}

Return a JSON object with the retrospective information.`

  // Build user prompt (same as OpenAI)
  const tasksSummary = `Completed Tasks (${retrospectiveData.completedTasks.length}):
${retrospectiveData.completedTasks
  .slice(0, 20)
  .map(
    (task, idx) =>
      `${idx + 1}. ${task.title} (${task.taskType || 'N/A'}, ${task.cookValue || 0} COOK)`
  )
  .join('\n')}
${retrospectiveData.completedTasks.length > 20 ? `... and ${retrospectiveData.completedTasks.length - 20} more tasks` : ''}`

  const cookSummary = `COOK Distribution:
- Total COOK Issued: ${totalCookIssued}
- Average COOK per Task: ${averageCookPerTask.toFixed(2)}
- Top Contributors: ${topContributors.map(c => `Contributor ${c.contributorId}: ${c.cookValue} COOK`).join(', ')}`

  const reviewSummary = `Review Patterns:
- Total Reviews: ${retrospectiveData.reviews.length}
- Average Review Time: ${averageReviewTime ? `${averageReviewTime.toFixed(1)} days` : 'N/A'}
- Reviews with Objections: ${retrospectiveData.reviews.filter(r => r.objections.length > 0).length}
- Total Comments: ${retrospectiveData.reviews.reduce((sum, r) => sum + r.comments.length, 0)}`

  const userPrompt = `Generate a retrospective for this team:

Time Range: ${retrospectiveData.timeRange.startDate} to ${retrospectiveData.timeRange.endDate}

${tasksSummary}

${cookSummary}

${reviewSummary}

Analyze this data and generate a comprehensive retrospective that helps the team reflect and improve.`

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: 3000
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Anthropic API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.content[0]?.text

    if (!content) {
      throw new Error('No content in Anthropic response')
    }

    // Extract JSON from response
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      throw new Error('No JSON found in Anthropic response')
    }

    const retrospective = JSON.parse(jsonMatch[0]) as Retrospective

    // Validate and normalize (same as OpenAI)
    if (!retrospective.accomplishments || !Array.isArray(retrospective.accomplishments)) {
      retrospective.accomplishments = []
    }
    if (!retrospective.patterns || !Array.isArray(retrospective.patterns)) {
      retrospective.patterns = []
    }
    if (
      !retrospective.areasForImprovement ||
      !Array.isArray(retrospective.areasForImprovement)
    ) {
      retrospective.areasForImprovement = []
    }
    if (!retrospective.recommendations || !Array.isArray(retrospective.recommendations)) {
      retrospective.recommendations = []
    }
    if (!retrospective.summary) {
      retrospective.summary =
        'Team completed work and made progress. Review the data for details.'
    }

    retrospective.dataSummary = dataSummary

    // Log usage
    await logUsageAfterSuccess(
      'anthropic',
      model,
      'generate_retrospective',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        completedTasksCount: retrospectiveData.completedTasks.length,
        totalCookIssued,
        reviewCount: retrospectiveData.reviews.length,
        timeRangeStart: retrospectiveData.timeRange.startDate,
        timeRangeEnd: retrospectiveData.timeRange.endDate
      }
    )

    return retrospective
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'anthropic',
      model,
      'generate_retrospective',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic retrospective
    console.error('Error generating retrospective with Anthropic:', error)
    return {
      accomplishments: ['Team completed tasks and issued COOK'],
      patterns: [],
      areasForImprovement: [],
      recommendations: ['Continue tracking metrics and improving processes'],
      summary: `Team completed ${dataSummary.completedTasks} tasks and issued ${dataSummary.totalCookIssued} COOK during this period.`,
      dataSummary
    }
  }
}

/**
 * Generate retrospective using Google Gemini
 */
async function generateRetrospectiveWithGemini(
  retrospectiveData: {
    completedTasks: Array<{
      id: string
      title: string
      description?: string
      cookValue?: number
      taskType?: string
      contributors: string[]
      reviewers?: string[]
      createdAt: string
      updatedAt: string
    }>
    cookLedgerEntries: Array<{
      taskId: string
      contributorId: string
      cookValue: number
      issuedAt: string
    }>
    reviews: Array<{
      taskId: string
      status: string
      approvals: string[]
      objections: Array<{ reason: string }>
      comments: Array<{ comment: string }>
      createdAt: string
      updatedAt: string
    }>
    timeRange: {
      startDate: string
      endDate: string
    }
  },
  apiKey: string,
  teamId?: string
): Promise<Retrospective> {
  const model = process.env.GEMINI_MODEL || 'gemini-1.5-pro'
  const geminiApiKey = apiKey || process.env.GEMINI_API_KEY
  if (!geminiApiKey) {
    throw new Error('Gemini API key not configured')
  }

  // Get relevant playbooks for retrospectives
  const playbookContent = await getRelevantPlaybooks(teamId, 'retrospective')
  const playbookContext = playbookContent
    ? `\n\n## Retrospective Playbook Guidelines\n\n${playbookContent}\n\nUse these guidelines to ensure the retrospective follows team practices.`
    : ''

  // Prepare data summary
  const taskCount = retrospectiveData.completedTasks.length
  const totalCook = retrospectiveData.cookLedgerEntries.reduce(
    (sum, entry) => sum + entry.cookValue,
    0
  )
  const reviewCount = retrospectiveData.reviews.length
  const approvalCount = retrospectiveData.reviews.reduce(
    (sum, review) => sum + review.approvals.length,
    0
  )
  const objectionCount = retrospectiveData.reviews.reduce(
    (sum, review) => sum + review.objections.length,
    0
  )

  // Top contributors
  const contributorCookMap = new Map<string, number>()
  retrospectiveData.cookLedgerEntries.forEach(entry => {
    const current = contributorCookMap.get(entry.contributorId) || 0
    contributorCookMap.set(entry.contributorId, current + entry.cookValue)
  })
  const topContributors = Array.from(contributorCookMap.entries())
    .map(([contributorId, cookValue]) => ({ contributorId, cookValue }))
    .sort((a, b) => b.cookValue - a.cookValue)
    .slice(0, 5)

  const systemPrompt = `You are a retrospective assistant for a cooperation toolkit. Generate a comprehensive team retrospective based on completed work, COOK distribution, and review patterns.

Generate the following sections:
- summary: Overall summary of the retrospective period (2-3 paragraphs)
- accomplishments: Array of key accomplishments and achievements
- patterns: Array of patterns observed (positive and areas for improvement)
- areasForImprovement: Array of specific areas that need improvement
- recommendations: Array of actionable recommendations for the next period

The retrospective should be:
- Honest and constructive
- Data-driven (based on tasks, COOK, reviews)
- Actionable (specific recommendations)
- Balanced (celebrate wins, address challenges)${playbookContext}

Return a JSON object with the retrospective sections.`

  const dataSummary = `Retrospective Period: ${retrospectiveData.timeRange.startDate} to ${retrospectiveData.timeRange.endDate}

Data Summary:
- Completed Tasks: ${taskCount}
- Total COOK Issued: ${totalCook}
- Reviews Completed: ${reviewCount}
- Total Approvals: ${approvalCount}
- Total Objections: ${objectionCount}
- Top Contributors: ${topContributors.map(c => `Contributor ${c.contributorId}: ${c.cookValue} COOK`).join(', ')}

Completed Tasks:
${retrospectiveData.completedTasks
  .slice(0, 20)
  .map(task => `- ${task.title} (${task.cookValue || 0} COOK, ${task.taskType || 'N/A'})`)
  .join('\n')}
${taskCount > 20 ? `\n... and ${taskCount - 20} more tasks` : ''}

Review Patterns:
- Approval Rate: ${reviewCount > 0 ? Math.round((approvalCount / reviewCount) * 100) : 0}%
- Objection Rate: ${reviewCount > 0 ? Math.round((objectionCount / reviewCount) * 100) : 0}%`

  const userPrompt = `Generate a retrospective for this period:\n\n${dataSummary}`

  try {
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [{ text: `${systemPrompt}\n\n${userPrompt}` }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 4000,
          responseMimeType: 'application/json'
        }
      })
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }))
      throw new Error(`Gemini API error: ${error.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text

    if (!content) {
      throw new Error('No content in Gemini response')
    }

    // Parse JSON response
    let retrospective: Retrospective
    try {
      retrospective = JSON.parse(content) as Retrospective
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (!jsonMatch) {
        throw new Error('No JSON found in Gemini response')
      }
      retrospective = JSON.parse(jsonMatch[0]) as Retrospective
    }

    // Calculate data summary
    const averageCookPerTask = taskCount > 0 ? totalCook / taskCount : 0
    const averageReviewTime: number | undefined = undefined // Can be calculated if needed

    const dataSummary = {
      completedTasks: taskCount,
      totalCookIssued: totalCook,
      averageCookPerTask,
      reviewCount,
      averageReviewTime,
      topContributors
    }

    // Validate and normalize
    if (!retrospective.summary) {
      retrospective.summary = `Team completed ${taskCount} tasks and earned ${totalCook} COOK during this period.`
    }
    if (!retrospective.accomplishments || !Array.isArray(retrospective.accomplishments)) {
      retrospective.accomplishments = []
    }
    if (!retrospective.patterns || !Array.isArray(retrospective.patterns)) {
      retrospective.patterns = []
    }
    if (
      !retrospective.areasForImprovement ||
      !Array.isArray(retrospective.areasForImprovement)
    ) {
      retrospective.areasForImprovement = []
    }
    if (!retrospective.recommendations || !Array.isArray(retrospective.recommendations)) {
      retrospective.recommendations = []
    }

    // Add dataSummary to retrospective
    retrospective.dataSummary = dataSummary

    // Log usage
    await logUsageAfterSuccess(
      'gemini',
      model,
      'generate_retrospective',
      teamId,
      data,
      (systemPrompt + userPrompt).length,
      content.length,
      {
        completedTasksCount: taskCount,
        totalCookIssued: totalCook,
        reviewCount,
        timeRangeStart: retrospectiveData.timeRange.startDate,
        timeRangeEnd: retrospectiveData.timeRange.endDate
      }
    )

    return retrospective
  } catch (error) {
    // Log usage error
    await logUsageAfterError(
      'gemini',
      model,
      'generate_retrospective',
      teamId,
      error,
      (systemPrompt + userPrompt).length
    )

    // Fallback: return basic retrospective
    console.error('Error generating retrospective with Gemini:', error)

    // Calculate data summary for fallback
    const averageCookPerTask = taskCount > 0 ? totalCook / taskCount : 0
    const dataSummary = {
      completedTasks: taskCount,
      totalCookIssued: totalCook,
      averageCookPerTask,
      reviewCount,
      averageReviewTime: undefined as number | undefined,
      topContributors
    }

    return {
      summary: `Team completed ${taskCount} tasks and earned ${totalCook} COOK during this period.`,
      accomplishments: retrospectiveData.completedTasks.slice(0, 5).map(t => t.title),
      patterns: [],
      areasForImprovement: [],
      recommendations: [],
      dataSummary
    }
  }
}

/**
 * Get relevant playbooks for review assistance
 */
async function getRelevantPlaybooks(
  teamId?: string,
  category?: 'task-creation' | 'review-assistance' | 'retrospective'
): Promise<string> {
  if (!teamId || !category) {
    return ''
  }

  try {
    // Read playbook from filesystem (server-side only)
    const { readFile } = await import('fs/promises')
    const { join } = await import('path')

    const playbookPath = join(
      process.cwd(),
      'features',
      'ai',
      'playbooks',
      `${category}.md`
    )
    const content = await readFile(playbookPath, 'utf-8')
    return content
  } catch (error) {
    // Silently fail - playbooks are optional
    return ''
  }
}
