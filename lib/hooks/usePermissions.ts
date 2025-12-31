'use client'

import { useMemo } from 'react'
import { useAppStore } from '@/lib/stores/useAppStore'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { useState, useEffect } from 'react'
import type { User, UserRole } from '@/lib/types/user'
import { hasRoleOrHigher } from '@/lib/permissions/types'

/**
 * Hook to check user permissions for the active team
 * Returns permission checks and user role information
 */
export function usePermissions() {
  const activeTeamId = useAppStore((state) => state.activeTeamId)
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userDoc = await getCurrentUserDocument()
        setUser(userDoc)
      } catch {
        setUser(null)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [])

  const permissions = useMemo(() => {
    if (!user || !activeTeamId) {
      return {
        isAuthenticated: false,
        isTeamMember: false,
        role: null as UserRole | null,
        hasRole: () => false,
        hasRoleOrHigher: () => false,
        canCreate: false,
        canReview: false,
        canGovern: false,
        canAdmin: false
      }
    }

    const role = (user.teams[activeTeamId] as UserRole) || null
    const isTeamMember = role !== null

    return {
      isAuthenticated: true,
      isTeamMember,
      role,
      hasRole: (requiredRole: UserRole) => role === requiredRole,
      hasRoleOrHigher: (requiredRole: UserRole) =>
        role ? hasRoleOrHigher(role, requiredRole) : false,
      // Permission checks based on role hierarchy
      canCreate: isTeamMember, // All team members can create tasks
      canReview: isTeamMember && role ? hasRoleOrHigher(role, 'Reviewer') : false,
      canGovern: isTeamMember && role ? hasRoleOrHigher(role, 'Steward') : false,
      canAdmin: isTeamMember && role ? hasRoleOrHigher(role, 'Admin') : false
    }
  }, [user, activeTeamId])

  return {
    ...permissions,
    loading,
    user
  }
}

/**
 * Hook to check if user has a specific role or higher
 */
export function useHasRole(requiredRole: UserRole): boolean {
  const { hasRoleOrHigher: hasRole } = usePermissions()
  return hasRole(requiredRole)
}

/**
 * Hook to check if user can perform a specific action
 */
export function useCan(action: 'create' | 'review' | 'govern' | 'admin'): boolean {
  const permissions = usePermissions()
  switch (action) {
    case 'create':
      return permissions.canCreate
    case 'review':
      return permissions.canReview
    case 'govern':
      return permissions.canGovern
    case 'admin':
      return permissions.canAdmin
    default:
      return false
  }
}

