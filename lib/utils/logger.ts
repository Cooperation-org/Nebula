/**
 * Structured Logging Utility
 * 
 * Provides consistent, structured logging for both Next.js app and Cloud Functions.
 * All timestamps are in UTC (ISO 8601 format).
 * 
 * Format: { timestamp: ISO string, level: 'info'|'error'|'warn'|'debug', service: string, message: string, metadata?: object }
 */

export type LogLevel = 'info' | 'error' | 'warn' | 'debug'

export interface LogEntry {
  timestamp: string // ISO 8601 UTC string
  level: LogLevel
  service: string
  message: string
  metadata?: Record<string, unknown>
}

/**
 * Get current UTC timestamp as ISO 8601 string
 */
function getUTCTimestamp(): string {
  return new Date().toISOString()
}

/**
 * Format log entry as JSON string
 */
function formatLogEntry(entry: LogEntry): string {
  return JSON.stringify(entry)
}

/**
 * Check if running in Cloud Functions environment
 */
function isCloudFunctions(): boolean {
  return typeof process !== 'undefined' && process.env.FUNCTION_TARGET !== undefined
}

/**
 * Check if running in browser environment
 */
function isBrowser(): boolean {
  return typeof window !== 'undefined'
}

/**
 * Log entry to appropriate output based on environment
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry)

  // In Cloud Functions, use console methods
  if (isCloudFunctions()) {
    switch (entry.level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'debug':
        console.debug(formatted)
        break
      default:
        console.log(formatted)
    }
    return
  }

  // In browser, use console methods (can be intercepted by logging services)
  if (isBrowser()) {
    switch (entry.level) {
      case 'error':
        console.error(formatted)
        break
      case 'warn':
        console.warn(formatted)
        break
      case 'debug':
        console.debug(formatted)
        break
      default:
        console.log(formatted)
    }
    return
  }

  // Server-side Next.js (Node.js)
  switch (entry.level) {
    case 'error':
      console.error(formatted)
      break
    case 'warn':
      console.warn(formatted)
      break
    case 'debug':
      console.debug(formatted)
      break
    default:
      console.log(formatted)
  }
}

/**
 * Create a logger instance for a specific service
 */
export function createLogger(service: string) {
  return {
    /**
     * Log info message
     */
    info(message: string, metadata?: Record<string, unknown>): void {
      const entry: LogEntry = {
        timestamp: getUTCTimestamp(),
        level: 'info',
        service,
        message,
        metadata
      }
      outputLog(entry)
    },

    /**
     * Log error message
     */
    error(message: string, metadata?: Record<string, unknown>): void {
      const entry: LogEntry = {
        timestamp: getUTCTimestamp(),
        level: 'error',
        service,
        message,
        metadata
      }
      outputLog(entry)
    },

    /**
     * Log warning message
     */
    warn(message: string, metadata?: Record<string, unknown>): void {
      const entry: LogEntry = {
        timestamp: getUTCTimestamp(),
        level: 'warn',
        service,
        message,
        metadata
      }
      outputLog(entry)
    },

    /**
     * Log debug message
     */
    debug(message: string, metadata?: Record<string, unknown>): void {
      const entry: LogEntry = {
        timestamp: getUTCTimestamp(),
        level: 'debug',
        service,
        message,
        metadata
      }
      outputLog(entry)
    }
  }
}

/**
 * Default logger instance (use createLogger for service-specific loggers)
 */
export const logger = createLogger('app')

