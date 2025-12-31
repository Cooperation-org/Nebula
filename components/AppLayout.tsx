'use client'

import { Box, Container } from '@mui/material'
import { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'

// Dynamically import components with SSR disabled to prevent Firebase initialization during build
const AppHeader = dynamic(
  () => import('./navigation/AppHeader').then((mod) => ({ default: mod.AppHeader })),
  {
    ssr: false
  }
)

const Sidebar = dynamic(
  () => import('./navigation/Sidebar').then((mod) => ({ default: mod.Sidebar })),
  {
    ssr: false
  }
)

const Breadcrumbs = dynamic(
  () => import('./navigation/Breadcrumbs').then((mod) => ({ default: mod.Breadcrumbs })),
  {
    ssr: false
  }
)

interface AppLayoutProps {
  children: ReactNode
}

export function AppLayout({ children }: AppLayoutProps) {
  const pathname = usePathname()
  const isAuthPage = pathname?.startsWith('/login') || pathname?.startsWith('/register')

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        backgroundColor: 'background.default'
      }}
    >
      <AppHeader />
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          overflow: 'hidden'
        }}
      >
        {!isAuthPage && <Sidebar />}
        {/* Main content area - responsive container */}
        <Box
          sx={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'auto'
          }}
        >
          <Container
            maxWidth='xl'
            sx={{
              flex: 1,
              py: { xs: 2, sm: 3, md: 4 },
              px: { xs: 2, sm: 3, md: 4 }
            }}
          >
            {!isAuthPage && <Breadcrumbs />}
            {children}
          </Container>
        </Box>
      </Box>
    </Box>
  )
}

