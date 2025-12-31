'use client'

import { useState, useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar
} from '@mui/material'
import { TeamSwitcher } from './TeamSwitcher'
import { getCurrentUser, getCurrentUserDocument, signOut } from '@/lib/firebase/auth'
import { logger } from '@/lib/utils/logger'
import type { User } from '@/lib/types/user'

export function AppHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const [user, setUser] = useState<User | null>(null)
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return

    const loadUser = async () => {
      try {
        const currentUser = getCurrentUser()
        if (!currentUser) {
          setLoading(false)
          return
        }

        const userDoc = await getCurrentUserDocument()
        setUser(userDoc)
      } catch (err) {
        logger.error('Error loading user for header', {
          error: err instanceof Error ? err.message : 'Unknown error'
        })
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [mounted])

  const handleMenuOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleMenuClose = () => {
    setAnchorEl(null)
  }

  const handleProfile = () => {
    handleMenuClose()
    router.push('/profile')
  }

  const handleSignOut = async () => {
    handleMenuClose()
    try {
      await signOut()
      logger.info('User signed out')
      router.push('/login')
    } catch (err) {
      logger.error('Error signing out', {
        error: err instanceof Error ? err.message : 'Unknown error'
      })
    }
  }

  // Don't render on server
  if (!mounted) {
    return null
  }

  // Don't show header on auth pages
  if (pathname?.startsWith('/login') || pathname?.startsWith('/register')) {
    return null
  }

  // Show header only if user is authenticated
  if (loading || !user) {
    return null
  }

  return (
    <AppBar position='static' elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          px: { xs: 2, sm: 3 }
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography
            variant='h6'
            component='a'
            href='/'
            sx={{
              textDecoration: 'none',
              color: 'inherit',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            Cooperation Toolkit
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <TeamSwitcher />

          <IconButton
            onClick={handleMenuOpen}
            size='small'
            sx={{ ml: 1 }}
            aria-label='account menu'
          >
            <Avatar
              src={user.photoURL || undefined}
              sx={{ width: 32, height: 32 }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleMenuClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right'
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right'
            }}
          >
            <MenuItem onClick={handleProfile}>Profile</MenuItem>
            <MenuItem onClick={handleSignOut}>Sign Out</MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  )
}

