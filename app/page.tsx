'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Container,
  Typography,
  Grid,
  Card,
  CardContent,
  Stack,
  Chip,
  Link as MuiLink,
  Paper,
  Divider
} from '@mui/material'
import {
  TaskAlt,
  Groups,
  Verified,
  TrendingUp,
  Security,
  IntegrationInstructions,
  ChatBubbleOutline,
  AutoAwesome
} from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import { getCurrentUser } from '@/lib/firebase/auth'

export default function Home() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check if user is authenticated
  useEffect(() => {
    const user = getCurrentUser()
    setIsAuthenticated(!!user)
  }, [])

  const handleGetStarted = () => {
    if (isAuthenticated) {
      router.push('/teams')
    } else {
      router.push('/register')
    }
  }

  const features = [
    {
      icon: <TaskAlt sx={{ fontSize: 40 }} />,
      title: 'Task Management',
      description: 'Track work with COOK-based valuation. Tasks flow through peer review to ensure quality and fairness.'
    },
    {
      icon: <Groups sx={{ fontSize: 40 }} />,
      title: 'Peer Review',
      description: 'Multi-reviewer system ensures work quality. Higher COOK values require more reviewers for accountability.'
    },
    {
      icon: <Verified sx={{ fontSize: 40 }} />,
      title: 'Verifiable Attestations',
      description: 'Get portable proof of contribution with cryptographic attestations. Your work history travels with you.'
    },
    {
      icon: <TrendingUp sx={{ fontSize: 40 }} />,
      title: 'Earned Governance',
      description: 'Governance weight derives from COOK earned through contribution. No capital required, only valuable work.'
    },
    {
      icon: <Security sx={{ fontSize: 40 }} />,
      title: 'Anti-Capture Design',
      description: 'Governance power cannot be purchased or transferred. Built-in safeguards prevent mission drift.'
    },
    {
      icon: <IntegrationInstructions sx={{ fontSize: 40 }} />,
      title: 'GitHub Integration',
      description: 'First-class GitHub Projects integration. Sync tasks bidirectionally with conflict resolution.'
    },
    {
      icon: <ChatBubbleOutline sx={{ fontSize: 40 }} />,
      title: 'Slack Primary Interface',
      description: 'Manage everything via Slack. Real-time notifications keep you informed without leaving your workflow.'
    },
    {
      icon: <AutoAwesome sx={{ fontSize: 40 }} />,
      title: 'AI Assistance',
      description: 'AI-powered task creation, review summaries, checklists, and retrospectives. Playbook-aware responses.'
    }
  ]

  const benefits = [
    {
      title: 'For Contributors',
      items: [
        'Fair recognition for your work',
        'Portable proof of contribution',
        'Clear path to governance participation',
        'Transparent equity calculations'
      ]
    },
    {
      title: 'For Teams',
      items: [
        'Equitable ownership distribution',
        'Governance-by-workflow (minimal voting)',
        'Anti-capture safeguards',
        'Transparent audit trails'
      ]
    },
    {
      title: 'For Founders',
      items: [
        'Share ownership without losing mission control',
        'Reward early contributors fairly',
        'Prevent hostile takeovers',
        'Maintain team purpose'
      ]
    }
  ]

  return (
    <AppLayout>
      {/* Hero Section */}
      <Box
        sx={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          color: 'white',
          py: { xs: 8, md: 12 },
          mb: 8
        }}
      >
        <Container maxWidth='lg'>
          <Stack spacing={4} alignItems='center' textAlign='center'>
            <Chip
              label='Nebula'
              sx={{
                bgcolor: 'rgba(255, 255, 255, 0.2)',
                color: 'white',
                fontWeight: 600
              }}
            />
            <Typography variant='h2' component='h1' fontWeight='bold' gutterBottom>
              Cooperation Toolkit
            </Typography>
            <Typography variant='h5' component='h2' sx={{ maxWidth: '800px', opacity: 0.95 }}>
              Enable any team to share ownership and governance equitably through{' '}
              <strong>earned contribution</strong>, not capital ownership.
            </Typography>
            <Typography variant='body1' sx={{ maxWidth: '700px', opacity: 0.9 }}>
              The Cooperation Toolkit provides composable infrastructure for task tracking, peer review,
              attestation, and equity/governance updates, preserving team purpose and preventing capture.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mt: 2 }}>
              <Button
                variant='contained'
                size='large'
                onClick={handleGetStarted}
                sx={{
                  bgcolor: 'white',
                  color: 'primary.main',
                  '&:hover': { bgcolor: 'grey.100' },
                  px: 4,
                  py: 1.5
                }}
              >
                {isAuthenticated ? 'Go to Dashboard' : 'Get Started'}
              </Button>
              <Button
                variant='outlined'
                size='large'
                onClick={() => router.push('/login')}
                sx={{
                  borderColor: 'white',
                  color: 'white',
                  '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                  px: 4,
                  py: 1.5
                }}
              >
                Sign In
              </Button>
            </Stack>
          </Stack>
        </Container>
      </Box>

      <Container maxWidth='lg' sx={{ mb: 8 }}>
        {/* Problem Statement */}
        <Box sx={{ mb: 8, textAlign: 'center' }}>
          <Typography variant='h4' component='h2' gutterBottom fontWeight='bold'>
            The Problem
          </Typography>
          <Typography variant='body1' color='text.secondary' sx={{ maxWidth: '800px', mx: 'auto', mt: 2 }}>
            Traditional organizational structures concentrate power via capital rather than contribution, fail to
            fairly reward early or underfunded contributors, and are vulnerable to mission drift or hostile
            takeover. Existing tools fragment responsibility across task management, equity tracking, and
            governance, with no shared source of legitimacy.
          </Typography>
        </Box>

        {/* Solution */}
        <Box sx={{ mb: 8 }}>
          <Typography variant='h4' component='h2' gutterBottom fontWeight='bold' textAlign='center'>
            The Solution
          </Typography>
          <Paper
            elevation={3}
            sx={{
              p: 4,
              mt: 4,
              background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)'
            }}
          >
            <Typography variant='h5' component='h3' gutterBottom fontWeight='600'>
              Contribution-to-Governance Pipeline
            </Typography>
            <Grid container spacing={3} sx={{ mt: 2 }}>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant='h6' color='primary' gutterBottom>
                  1. Track Work
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Work is tracked via tasks with COOK-based valuation
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant='h6' color='primary' gutterBottom>
                  2. Peer Review
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Value is assigned and reviewed by peers for quality
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant='h6' color='primary' gutterBottom>
                  3. Attestations
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Completed work issues verifiable attestations
                </Typography>
              </Grid>
              <Grid size={{ xs: 12, md: 3 }}>
                <Typography variant='h6' color='primary' gutterBottom>
                  4. Governance
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Attestations update earnings, equity, and governance weight
                </Typography>
              </Grid>
            </Grid>
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Chip
                label='Transparency is default; voting is exceptional'
                color='primary'
                sx={{ fontWeight: 600 }}
              />
            </Box>
          </Paper>
        </Box>

        {/* Features */}
        <Box sx={{ mb: 8 }}>
          <Typography variant='h4' component='h2' gutterBottom fontWeight='bold' textAlign='center'>
            Key Features
          </Typography>
          <Grid container spacing={4} sx={{ mt: 2 }}>
            {features.map((feature, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      boxShadow: 6
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Box sx={{ color: 'primary.main', mb: 2 }}>{feature.icon}</Box>
                    <Typography variant='h6' component='h3' gutterBottom fontWeight='600'>
                      {feature.title}
                    </Typography>
                    <Typography variant='body2' color='text.secondary'>
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Benefits */}
        <Box sx={{ mb: 8 }}>
          <Typography variant='h4' component='h2' gutterBottom fontWeight='bold' textAlign='center'>
            Who Benefits
          </Typography>
          <Grid container spacing={4} sx={{ mt: 2 }}>
            {benefits.map((benefit, index) => (
              <Grid size={{ xs: 12, md: 4 }} key={index}>
                <Card sx={{ height: '100%' }}>
                  <CardContent>
                    <Typography variant='h6' component='h3' gutterBottom fontWeight='600' color='primary'>
                      {benefit.title}
                    </Typography>
                    <Stack spacing={1} sx={{ mt: 2 }}>
                      {benefit.items.map((item, itemIndex) => (
                        <Box key={itemIndex} sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                          <Typography variant='body2' color='text.secondary'>
                            • {item}
                          </Typography>
                        </Box>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Core Principles */}
        <Box sx={{ mb: 8 }}>
          <Typography variant='h4' component='h2' gutterBottom fontWeight='bold' textAlign='center'>
            Core Principles
          </Typography>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {[
              'Earned Governance',
              'Transparency over Permission',
              'Work-Weighted Influence',
              'Opportunity to Object',
              'Anti-Capture by Design',
              'Portability'
            ].map((principle, index) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={index}>
                <Chip
                  label={principle}
                  variant='outlined'
                  color='primary'
                  sx={{ width: '100%', py: 2.5, fontSize: '0.95rem' }}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* CTA Section */}
        <Paper
          elevation={3}
          sx={{
            p: 6,
            textAlign: 'center',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white'
          }}
        >
          <Typography variant='h4' component='h2' gutterBottom fontWeight='bold'>
            Ready to Get Started?
          </Typography>
          <Typography variant='body1' sx={{ mb: 4, opacity: 0.95 }}>
            Join teams that are building equitable ownership and governance through earned contribution.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent='center'>
            <Button
              variant='contained'
              size='large'
              onClick={handleGetStarted}
              sx={{
                bgcolor: 'white',
                color: 'primary.main',
                '&:hover': { bgcolor: 'grey.100' },
                px: 4
              }}
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Create Account'}
            </Button>
            <Button
              variant='outlined'
              size='large'
              onClick={() => router.push('/login')}
              sx={{
                borderColor: 'white',
                color: 'white',
                '&:hover': { borderColor: 'white', bgcolor: 'rgba(255, 255, 255, 0.1)' },
                px: 4
              }}
            >
              Sign In
            </Button>
          </Stack>
        </Paper>
      </Container>
    </AppLayout>
  )
}
