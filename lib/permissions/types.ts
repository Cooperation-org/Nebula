import type { UserRole } from '@/lib/types/user'

/**
 * Permission error codes
 * Used for consistent error handling across the application
 */
export enum PermissionErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  NOT_TEAM_MEMBER = 'NOT_TEAM_MEMBER',
  INSUFFICIENT_ROLE = 'INSUFFICIENT_ROLE',
  UNAUTHORIZED_ACTION = 'UNAUTHORIZED_ACTION'
}

/**
 * Permission error class
 * Extends Error with error code for programmatic handling
 */
export class PermissionError extends Error {
  constructor(
    public code: PermissionErrorCode,
    message: string
  ) {
    super(message)
    this.name = 'PermissionError'
  }
}

/**
 * Role hierarchy
 * Lower number = lower permissions, higher number = higher permissions
 */
export const ROLE_HIERARCHY: Record<UserRole, number> = {
  Contributor: 1,
  Reviewer: 2,
  Steward: 3,
  Admin: 4
}

/**
 * Check if role1 has at least the permissions of role2
 */
export function hasRoleOrHigher(role1: UserRole, role2: UserRole): boolean {
  return ROLE_HIERARCHY[role1] >= ROLE_HIERARCHY[role2]
}

/**
 * Check if role1 has exactly the permissions of role2
 */
export function hasExactRole(role1: UserRole, role2: UserRole): boolean {
  return role1 === role2
}

