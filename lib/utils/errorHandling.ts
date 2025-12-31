import { PermissionError, PermissionErrorCode } from '@/lib/permissions/types'

/**
 * Check if error is a PermissionError
 */
export function isPermissionError(error: unknown): error is PermissionError {
  return error instanceof PermissionError
}

/**
 * Get user-friendly error message from error
 */
export function getErrorMessage(error: unknown): string {
  if (isPermissionError(error)) {
    switch (error.code) {
      case PermissionErrorCode.UNAUTHENTICATED:
        return 'You must be logged in to perform this action.'
      case PermissionErrorCode.NOT_TEAM_MEMBER:
        return 'You are not a member of this team.'
      case PermissionErrorCode.INSUFFICIENT_ROLE:
        return 'You do not have sufficient permissions to perform this action.'
      case PermissionErrorCode.UNAUTHORIZED_ACTION:
        return 'You are not authorized to perform this action.'
      default:
        return error.message || 'An error occurred.'
    }
  }

  if (error instanceof Error) {
    return error.message
  }

  return 'An unexpected error occurred.'
}

/**
 * Get error code from error
 */
export function getErrorCode(error: unknown): string | null {
  if (isPermissionError(error)) {
    return error.code
  }

  if (error instanceof Error) {
    // Try to extract error code from Firebase errors
    const firebaseErrorMatch = error.message.match(/\(([a-z]+\/[a-z-]+)\)/i)
    if (firebaseErrorMatch) {
      return firebaseErrorMatch[1]
    }
  }

  return null
}
