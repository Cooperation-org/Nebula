'use client'

import type { User, UserRole } from '@/lib/types/user'
import { getCurrentUser } from '@/lib/firebase/auth'
import { PermissionError, PermissionErrorCode, hasRoleOrHigher } from './types'

/**
 * Check if user is authenticated
 */
export function requireAuth(): void {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new PermissionError(
      PermissionErrorCode.UNAUTHENTICATED,
      'User must be authenticated to perform this action'
    )
  }
}

/**
 * Check if user is a member of the team
 */
export function requireTeamMember(user: User, teamId: string): void {
  if (!(teamId in user.teams)) {
    throw new PermissionError(
      PermissionErrorCode.NOT_TEAM_MEMBER,
      `User is not a member of team ${teamId}`
    )
  }
}

/**
 * Check if user has at least the specified role in the team
 */
export function requireRole(
  user: User,
  teamId: string,
  requiredRole: UserRole
): void {
  requireTeamMember(user, teamId)

  const userRole = user.teams[teamId] as UserRole | undefined
  if (!userRole) {
    throw new PermissionError(
      PermissionErrorCode.NOT_TEAM_MEMBER,
      `User does not have a role in team ${teamId}`
    )
  }

  if (!hasRoleOrHigher(userRole, requiredRole)) {
    throw new PermissionError(
      PermissionErrorCode.INSUFFICIENT_ROLE,
      `User role ${userRole} is insufficient. Required: ${requiredRole}`
    )
  }
}

/**
 * Check if user has exactly the specified role in the team
 */
export function requireExactRole(
  user: User,
  teamId: string,
  requiredRole: UserRole
): void {
  requireTeamMember(user, teamId)

  const userRole = user.teams[teamId] as UserRole | undefined
  if (!userRole) {
    throw new PermissionError(
      PermissionErrorCode.NOT_TEAM_MEMBER,
      `User does not have a role in team ${teamId}`
    )
  }

  if (userRole !== requiredRole) {
    throw new PermissionError(
      PermissionErrorCode.INSUFFICIENT_ROLE,
      `User role ${userRole} does not match required role ${requiredRole}`
    )
  }
}

