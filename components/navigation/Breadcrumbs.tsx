'use client'

import { usePathname } from 'next/navigation'
import { Breadcrumbs as MuiBreadcrumbs, Link, Typography, Box } from '@mui/material'
import { NavigateNext } from '@mui/icons-material'
import { useAppStore } from '@/lib/stores/useAppStore'
import { getTeam } from '@/lib/firebase/teams'
import { useState, useEffect } from 'react'
import type { Team } from '@/lib/types/team'

interface BreadcrumbItem {
  label: string
  href?: string
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const activeTeamId = useAppStore(state => state.activeTeamId)
  const [teamName, setTeamName] = useState<string | null>(null)

  useEffect(() => {
    if (activeTeamId && pathname?.includes(`/teams/${activeTeamId}`)) {
      getTeam(activeTeamId)
        .then(team => {
          if (team) {
            setTeamName(team.name)
          }
        })
        .catch(() => {
          setTeamName(null)
        })
    } else {
      setTeamName(null)
    }
  }, [activeTeamId, pathname])

  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    if (!pathname) return []

    const segments = pathname.split('/').filter(Boolean)
    const items: BreadcrumbItem[] = []

    // Always start with Home
    items.push({ label: 'Home', href: '/dashboard' })

    // Handle different route patterns
    if (segments[0] === 'teams') {
      items.push({ label: 'Teams', href: '/teams' })

      if (segments[1] === 'create') {
        items.push({ label: 'Create Team' })
      } else if (segments[1] === 'join') {
        items.push({ label: 'Join Team' })
      } else if (segments[1] === 'browse') {
        items.push({ label: 'Browse Teams' })
      } else if (segments[1] === 'my-requests') {
        items.push({ label: 'My Requests' })
      } else if (segments[1] && activeTeamId && segments[1] === activeTeamId) {
        // Team-specific routes
        if (teamName) {
          items.push({ label: teamName, href: `/teams/${activeTeamId}/tasks` })
        } else {
          items.push({ label: 'Team', href: `/teams/${activeTeamId}/tasks` })
        }

        if (segments[2] === 'tasks') {
          if (segments[3] === 'create') {
            items.push({ label: 'Create Task' })
          } else if (segments[3] === 'archived') {
            items.push({ label: 'Archived Tasks' })
          } else if (segments[3]) {
            if (segments[4] === 'edit') {
              items.push({ label: 'Edit Task' })
            } else if (segments[4] === 'review') {
              items.push({ label: 'Review Task' })
            } else {
              items.push({ label: 'Task Details' })
            }
          } else {
            items.push({ label: 'Tasks' })
          }
        } else if (segments[2] === 'ledger') {
          items.push({ label: 'COOK Ledger' })
        } else if (segments[2] === 'retrospective') {
          items.push({ label: 'Retrospective' })
        } else if (segments[2] === 'boards') {
          items.push({ label: 'Boards' })
          if (segments[3]) {
            if (segments[4] === 'edit') {
              items.push({ label: 'Edit Board' })
            } else {
              items.push({ label: 'Board' })
            }
          }
        } else if (segments[2] === 'settings') {
          items.push({ label: 'Settings' })
        } else if (segments[2] === 'requests') {
          items.push({ label: 'Join Requests' })
        }
      }
    } else if (segments[0] === 'onboarding') {
      items.push({ label: 'Onboarding' })
    } else if (segments[0] === 'profile') {
      items.push({ label: 'Profile' })
    } else if (segments[0] === 'attestations') {
      items.push({ label: 'Attestations' })
    }

    return items
  }

  const breadcrumbs = generateBreadcrumbs()

  if (breadcrumbs.length <= 1) {
    return null
  }

  return (
    <Box sx={{ mb: 2 }}>
      <MuiBreadcrumbs
        separator={<NavigateNext fontSize='small' />}
        aria-label='breadcrumb'
      >
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1

          if (isLast || !item.href) {
            return (
              <Typography key={index} color='text.primary' variant='body2'>
                {item.label}
              </Typography>
            )
          }

          return (
            <Link
              key={index}
              component='a'
              href={item.href}
              onClick={e => {
                e.preventDefault()
                window.location.href = item.href!
              }}
              color='inherit'
              variant='body2'
              sx={{
                textDecoration: 'none',
                '&:hover': {
                  textDecoration: 'underline'
                }
              }}
            >
              {item.label}
            </Link>
          )
        })}
      </MuiBreadcrumbs>
    </Box>
  )
}
