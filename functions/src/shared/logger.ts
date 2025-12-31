/**
 * Structured Logging Utility for Cloud Functions
 *
 * Provides consistent, structured logging for Firebase Cloud Functions.
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
 * Log entry to console (Cloud Functions logs to Firebase Console)
 */
function outputLog(entry: LogEntry): void {
  const formatted = formatLogEntry(entry)

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
export const logger = createLogger('functions')
