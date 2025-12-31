'use client'

import { ReactNode } from 'react'
import { Alert, Box } from '@mui/material'
import { usePermissions } from '@/lib/hooks/usePermissions'
import type { UserRole } from '@/lib/types/user'

interface PermissionGuardProps {
  children: ReactNode
  requireRole?: UserRole
  requireAction?: 'create' | 'review' | 'govern' | 'admin'
  fallback?: ReactNode
  showError?: boolean
}

/**
 * PermissionGuard component
 * Conditionally renders children based on user permissions
 */
export function PermissionGuard({
  children,
  requireRole,
  requireAction,
  fallback,
  showError = false
}: PermissionGuardProps) {
  const permissions = usePermissions()

  // Check if user has required role
  if (requireRole && !permissions.hasRoleOrHigher(requireRole)) {
    if (showError) {
      return (
        <Alert severity='error'>
          You do not have sufficient permissions. Required role: {requireRole}
        </Alert>
      )
    }
    return fallback ? <>{fallback}</> : null
  }

  // Check if user can perform required action
  if (requireAction) {
    let canPerform = false
    switch (requireAction) {
      case 'create':
        canPerform = permissions.canCreate
        break
      case 'review':
        canPerform = permissions.canReview
        break
      case 'govern':
        canPerform = permissions.canGovern
        break
      case 'admin':
        canPerform = permissions.canAdmin
        break
    }
    if (!canPerform) {
      if (showError) {
        return (
          <Alert severity='error'>
            You do not have permission to perform this action.
          </Alert>
        )
      }
      return fallback ? <>{fallback}</> : null
    }
  }

  // Check if user is authenticated and team member
  if (!permissions.isAuthenticated || !permissions.isTeamMember) {
    if (showError) {
      return (
        <Alert severity='error'>
          You must be authenticated and a member of the active team.
        </Alert>
      )
    }
    return fallback ? <>{fallback}</> : null
  }

  return <>{children}</>
}

