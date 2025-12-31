'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Box,
  Typography,
  Collapse,
  useTheme,
  useMediaQuery
} from '@mui/material'
import {
  Dashboard,
  Groups,
  TaskAlt,
  Assessment,
  AttachMoney,
  History,
  Settings,
  PersonAdd,
  Add,
  ExpandLess,
  ExpandMore,
  Home
} from '@mui/icons-material'
import { useAppStore } from '@/lib/stores/useAppStore'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'
import type { User } from '@/lib/types/user'
import type { UserRole } from '@/lib/types/user'

const DRAWER_WIDTH = 280

interface NavItem {
  label: string
  icon: React.ReactNode
  path: string
  requiresTeam?: boolean
  requiresRole?: UserRole[]
  children?: NavItem[]
}

export function Sidebar() {
  const router = useRouter()
  const pathname = usePathname()
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))
  const [open, setOpen] = useState(!isMobile)
  const [user, setUser] = useState<User | null>(null)
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const activeTeamId = useAppStore(state => state.activeTeamId)

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userDoc = await getCurrentUserDocument()
        setUser(userDoc)
      } catch (err) {
        logger.error('Error loading user for sidebar', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      }
    }
    loadUser()
  }, [])

  const handleToggle = () => {
    setOpen(!open)
  }

  const handleExpand = (path: string) => {
    const newExpanded = new Set(expandedItems)
    if (newExpanded.has(path)) {
      newExpanded.delete(path)
    } else {
      newExpanded.add(path)
    }
    setExpandedItems(newExpanded)
  }

  const hasRole = (requiredRoles?: UserRole[]): boolean => {
    if (!requiredRoles || !activeTeamId || !user) return true
    const userRole = user.teams?.[activeTeamId] as UserRole | undefined
    if (!userRole) return false

    const roleHierarchy: Record<UserRole, number> = {
      Contributor: 1,
      Reviewer: 2,
      Steward: 3,
      Admin: 4
    }

    return requiredRoles.some(role => {
      const userLevel = roleHierarchy[userRole] || 0
      const requiredLevel = roleHierarchy[role] || 0
      return userLevel >= requiredLevel
    })
  }

  const navItems: NavItem[] = [
    {
      label: 'Home',
      icon: <Home />,
      path: '/dashboard'
    },
    {
      label: 'Teams',
      icon: <Groups />,
      path: '/teams',
      children: [
        {
          label: 'My Teams',
          icon: <Groups />,
          path: '/teams'
        },
        {
          label: 'Create Team',
          icon: <Add />,
          path: '/teams/create'
        },
        {
          label: 'Join Team',
          icon: <PersonAdd />,
          path: '/teams/join'
        },
        {
          label: 'Browse Teams',
          icon: <Groups />,
          path: '/teams/browse'
        }
      ]
    }
  ]

  // Add team-specific items if team is selected
  if (activeTeamId) {
    navItems.push(
      {
        label: 'Tasks',
        icon: <TaskAlt />,
        path: `/teams/${activeTeamId}/tasks`,
        requiresTeam: true
      },
      {
        label: 'COOK Ledger',
        icon: <AttachMoney />,
        path: `/teams/${activeTeamId}/ledger`,
        requiresTeam: true
      },
      {
        label: 'Retrospective',
        icon: <Assessment />,
        path: `/teams/${activeTeamId}/retrospective`,
        requiresTeam: true
      },
      {
        label: 'Attestations',
        icon: <History />,
        path: '/attestations',
        requiresTeam: true
      },
      {
        label: 'Join Requests',
        icon: <PersonAdd />,
        path: `/teams/${activeTeamId}/requests`,
        requiresTeam: true,
        requiresRole: ['Steward', 'Admin']
      },
      {
        label: 'Team Settings',
        icon: <Settings />,
        path: `/teams/${activeTeamId}/settings`,
        requiresTeam: true,
        requiresRole: ['Steward', 'Admin']
      }
    )
  }

  const renderNavItem = (item: NavItem, depth = 0) => {
    const isActive = pathname === item.path || pathname?.startsWith(item.path + '/')
    const hasChildren = item.children && item.children.length > 0
    const isExpanded = expandedItems.has(item.path)
    const canAccess = !item.requiresTeam || (activeTeamId && hasRole(item.requiresRole))

    if (!canAccess) return null

    return (
      <Box key={item.path}>
        <ListItem disablePadding>
          <ListItemButton
            onClick={() => {
              if (hasChildren) {
                handleExpand(item.path)
              } else {
                router.push(item.path)
                if (isMobile) {
                  setOpen(false)
                }
              }
            }}
            selected={isActive && !hasChildren}
            sx={{
              pl: 2 + depth * 2,
              '&.Mui-selected': {
                backgroundColor: 'primary.main',
                color: 'primary.contrastText',
                '&:hover': {
                  backgroundColor: 'primary.dark'
                },
                '& .MuiListItemIcon-root': {
                  color: 'primary.contrastText'
                }
              }
            }}
          >
            <ListItemIcon
              sx={{
                color: isActive && !hasChildren ? 'primary.contrastText' : 'inherit',
                minWidth: 40
              }}
            >
              {item.icon}
            </ListItemIcon>
            <ListItemText primary={item.label} />
            {hasChildren && (isExpanded ? <ExpandLess /> : <ExpandMore />)}
          </ListItemButton>
        </ListItem>
        {hasChildren && (
          <Collapse in={isExpanded} timeout='auto' unmountOnExit>
            <List component='div' disablePadding>
              {item.children?.map(child => renderNavItem(child, depth + 1))}
            </List>
          </Collapse>
        )}
      </Box>
    )
  }

  const drawerContent = (
    <Box
      sx={{
        width: DRAWER_WIDTH,
        height: '100%',
        display: 'flex',
        flexDirection: 'column'
      }}
    >
      <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant='h6' noWrap component='div' sx={{ fontWeight: 600 }}>
          Cooperation Toolkit
        </Typography>
      </Box>
      <List sx={{ flexGrow: 1, pt: 1 }}>{navItems.map(item => renderNavItem(item))}</List>
      <Divider />
      <Box sx={{ p: 2 }}>
        <Typography variant='caption' color='text.secondary'>
          {user?.displayName || 'User'}
        </Typography>
      </Box>
    </Box>
  )

  if (isMobile) {
    return (
      <Drawer
        variant='temporary'
        open={open}
        onClose={handleToggle}
        ModalProps={{
          keepMounted: true // Better open performance on mobile
        }}
        sx={{
          '& .MuiDrawer-paper': {
            width: DRAWER_WIDTH
          }
        }}
      >
        {drawerContent}
      </Drawer>
    )
  }

  return (
    <Drawer
      variant='persistent'
      open={open}
      sx={{
        width: open ? DRAWER_WIDTH : 0,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          position: 'relative',
          height: '100%'
        }
      }}
    >
      {drawerContent}
    </Drawer>
  )
}

export function SidebarToggle() {
  const theme = useTheme()
  const isMobile = useMediaQuery(theme.breakpoints.down('md'))

  if (isMobile) {
    return null // Mobile uses temporary drawer with its own toggle
  }

  return null // Can add a toggle button here if needed
}
