'use client'

import { createTheme } from '@mui/material/styles'

// Mobile-first responsive breakpoints
const breakpoints = {
  values: {
    xs: 0, // Mobile phones (portrait)
    sm: 600, // Mobile phones (landscape) / Small tablets
    md: 900, // Tablets
    lg: 1200, // Desktop
    xl: 1536 // Large desktop
  }
}

// Create theme with mobile-first responsive design
export const theme = createTheme({
  breakpoints,
  palette: {
    mode: 'light',
    primary: {
      main: '#1976d2'
    },
    secondary: {
      main: '#dc004e'
    },
    background: {
      default: '#ffffff',
      paper: '#f5f5f5'
    }
  },
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif'
    ].join(',')
  },
  components: {
    // Global component overrides for mobile-first design
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none' // Disable uppercase transformation
        }
      }
    }
  }
})
