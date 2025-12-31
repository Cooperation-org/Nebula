/**
 * Example usage of structured logging utility
 *
 * This file demonstrates how to use the logger in different contexts.
 */

import { createLogger, logger } from './logger'

// Example 1: Using default logger
logger.info('Application started')
logger.error('Failed to connect to database', { error: 'Connection timeout' })

// Example 2: Creating service-specific loggers
const taskLogger = createLogger('tasks')
const cookLogger = createLogger('cook')
const authLogger = createLogger('auth')

// Example 3: Logging with metadata (taskId, userId, teamId, etc.)
taskLogger.info('Task created', {
  taskId: 'task-123',
  teamId: 'team-456',
  userId: 'user-789',
  title: 'Implement feature X'
})

cookLogger.info('COOK issued', {
  taskId: 'task-123',
  teamId: 'team-456',
  userId: 'user-789',
  cookValue: 100,
  state: 'Final'
})

authLogger.warn('Login attempt failed', {
  email: 'user@example.com',
  reason: 'Invalid credentials'
})

// Example 4: Error logging with full context
taskLogger.error('Task update failed', {
  taskId: 'task-123',
  teamId: 'team-456',
  userId: 'user-789',
  error: {
    message: 'Permission denied',
    code: 'UNAUTHORIZED'
  }
})

// Example 5: Debug logging (only in development)
if (process.env.NODE_ENV === 'development') {
  taskLogger.debug('Task state transition', {
    taskId: 'task-123',
    fromState: 'Backlog',
    toState: 'In Progress'
  })
}
