'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Box,
  Button,
  Container,
  Typography,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Paper,
  Stack,
  Card,
  CardContent,
  IconButton,
  Chip
} from '@mui/material'
import {
  CheckCircle,
  ArrowForward,
  ArrowBack,
  TaskAlt,
  Groups,
  Verified,
  TrendingUp,
  ChatBubbleOutline,
  AutoAwesome,
  Close
} from '@mui/icons-material'
import { AppLayout } from '@/components/AppLayout'
import { useAuth } from '@/lib/hooks/useAuth'
import { getCurrentUserDocument } from '@/lib/firebase/auth'
import { completeOnboarding } from '@/lib/firebase/onboarding'
import { logger } from '@/lib/utils/logger'

interface OnboardingStep {
  title: string
  description: string
  content: React.ReactNode
  icon: React.ReactNode
}

export default function OnboardingFlow() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [activeStep, setActiveStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [skipped, setSkipped] = useState(false)

  useEffect(() => {
    // Wait for auth to initialize
    if (authLoading) {
      return
    }

    // Check if user is authenticated
    if (!user) {
      router.push('/login')
      return
    }

    // Check if onboarding already completed
    const checkOnboardingStatus = async () => {
      try {
        const userDoc = await getCurrentUserDocument()
        if (userDoc?.onboardingCompleted) {
          // Already completed, redirect to teams
          logger.info('Onboarding already completed, redirecting to teams', {
            userId: user.uid
          })
          router.push('/teams')
        }
      } catch (error) {
        logger.error('Error checking onboarding status', {
          error: error instanceof Error ? error.message : 'Unknown error'
        })
      }
    }

    checkOnboardingStatus()
  }, [router, user, authLoading])

  const handleNext = () => {
    setActiveStep((prevActiveStep) => prevActiveStep + 1)
  }

  const handleBack = () => {
    setActiveStep((prevActiveStep) => prevActiveStep - 1)
  }

  const handleSkip = async () => {
    if (!user) {
      logger.error('Cannot skip onboarding - user not authenticated')
      return
    }
    setSkipped(true)
    setLoading(true)
    try {
      await completeOnboarding(user.uid)
      logger.info('Onboarding skipped and completed', { userId: user.uid })
      router.push('/teams')
    } catch (error) {
      logger.error('Error completing onboarding (skip)', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.uid
      })
      // Still redirect even if update fails
      router.push('/teams')
    } finally {
      setLoading(false)
    }
  }

  const handleCompleteOnboarding = async () => {
    if (!user) {
      logger.error('Cannot complete onboarding - user not authenticated')
      return
    }
    
    setLoading(true)
    try {
      await completeOnboarding(user.uid)
      logger.info('Onboarding completed successfully', { userId: user.uid })
      // Wait a moment to ensure Firestore write completes
      await new Promise(resolve => setTimeout(resolve, 500))
      router.push('/teams')
    } catch (error) {
      logger.error('Error completing onboarding', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user.uid,
        stack: error instanceof Error ? error.stack : undefined
      })
      // Still redirect even if update fails (user can retry later)
      router.push('/teams')
    } finally {
      setLoading(false)
    }
  }

  const handleFinish = async () => {
    await handleCompleteOnboarding()
  }

  const steps: OnboardingStep[] = [
    {
      title: 'Welcome to Cooperation Toolkit',
      description: 'Get started with equitable ownership and governance',
      icon: <CheckCircle />,
      content: (
        <Box>
          <Typography variant='body1' paragraph>
            Welcome! The Cooperation Toolkit helps teams share ownership and governance equitably through{' '}
            <strong>earned contribution</strong>, not capital ownership.
          </Typography>
          <Typography variant='body1' paragraph>
            This quick tour will help you understand the key features and get you started.
          </Typography>
          <Card sx={{ mt: 3, bgcolor: 'primary.light', color: 'primary.contrastText' }}>
            <CardContent>
              <Typography variant='h6' gutterBottom>
                What You'll Learn
              </Typography>
              <Stack spacing={1}>
                <Typography variant='body2'>• How tasks and COOK work</Typography>
                <Typography variant='body2'>• Peer review process</Typography>
                <Typography variant='body2'>• Governance and voting</Typography>
                <Typography variant='body2'>• Slack integration</Typography>
              </Stack>
            </CardContent>
          </Card>
        </Box>
      )
    },
    {
      title: 'Tasks & COOK',
      description: 'Track work and assign value',
      icon: <TaskAlt />,
      content: (
        <Box>
          <Typography variant='body1' paragraph>
            <strong>Tasks</strong> are the foundation of the Cooperation Toolkit. Every piece of work is tracked
            as a task with a COOK (Contribution) value.
          </Typography>
          <Typography variant='body1' paragraph>
            <strong>COOK</strong> represents the value of your contribution. It's assigned to tasks and reviewed
            by peers to ensure fairness.
          </Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Task States
                </Typography>
                <Stack direction='row' spacing={1} flexWrap='wrap' sx={{ mt: 1 }}>
                  <Chip label='Backlog' size='small' />
                  <Chip label='Ready' size='small' color='primary' />
                  <Chip label='In Progress' size='small' color='warning' />
                  <Chip label='Review' size='small' color='info' />
                  <Chip label='Done' size='small' color='success' />
                </Stack>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                  Tasks move sequentially through these states. Higher COOK values require more reviewers.
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  COOK States
                </Typography>
                <Stack direction='row' spacing={1} flexWrap='wrap' sx={{ mt: 1 }}>
                  <Chip label='Draft' size='small' />
                  <Chip label='Provisional' size='small' color='primary' />
                  <Chip label='Locked' size='small' color='warning' />
                  <Chip label='Final' size='small' color='success' />
                </Stack>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                  COOK becomes Locked when a task enters Review, and Final after approval.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )
    },
    {
      title: 'Peer Review',
      description: 'Quality assurance through peer review',
      icon: <Groups />,
      content: (
        <Box>
          <Typography variant='body1' paragraph>
            <strong>Peer Review</strong> ensures work quality and fairness. When a task moves to Review, assigned
            reviewers evaluate the work.
          </Typography>
          <Typography variant='body1' paragraph>
            The number of required reviewers depends on the COOK value:
          </Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Reviewer Requirements
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Box>
                    <Typography variant='body2' fontWeight='bold'>
                      COOK &lt; 10: 1 reviewer
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant='body2' fontWeight='bold'>
                      COOK 10-50: 2 reviewers
                    </Typography>
                  </Box>
                  <Box>
                    <Typography variant='body2' fontWeight='bold'>
                      COOK &gt; 50: 3 reviewers
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Review Actions
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Typography variant='body2'>• <strong>Approve</strong>: Work meets standards</Typography>
                  <Typography variant='body2'>• <strong>Object</strong>: Raise concerns or issues</Typography>
                  <Typography variant='body2'>• <strong>Comment</strong>: Provide feedback</Typography>
                </Stack>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                  Once all required reviewers approve, COOK is issued and the task is marked Done.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )
    },
    {
      title: 'Attestations & Governance',
      description: 'Portable proof and earned governance',
      icon: <Verified />,
      content: (
        <Box>
          <Typography variant='body1' paragraph>
            <strong>Attestations</strong> are verifiable proof of your contributions. They're issued when you
            complete tasks and are portable across teams.
          </Typography>
          <Typography variant='body1' paragraph>
            <strong>Governance Weight</strong> is derived from your cumulative COOK. It determines your influence
            in team decisions and voting.
          </Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Governance-by-Workflow
                </Typography>
                <Typography variant='body2' paragraph>
                  Most governance happens through workflow (implicit consent) rather than explicit voting. This
                  minimizes overhead while maintaining transparency.
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  Voting is triggered only when objection thresholds are exceeded or for policy changes.
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Anti-Capture Design
                </Typography>
                <Typography variant='body2' paragraph>
                  Governance power cannot be purchased or transferred. It can only be earned through valuable
                  contributions.
                </Typography>
                <Typography variant='body2' color='text.secondary'>
                  This prevents mission drift and hostile takeovers.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )
    },
    {
      title: 'Slack Integration',
      description: 'Primary interface for daily operations',
      icon: <ChatBubbleOutline />,
      content: (
        <Box>
          <Typography variant='body1' paragraph>
            <strong>Slack</strong> is the primary interface for the Cooperation Toolkit. You can manage tasks,
            reviews, COOK, and governance directly from Slack.
          </Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Key Slack Commands
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Typography variant='body2' component='code' sx={{ display: 'block' }}>
                    /cook create "Task title"
                  </Typography>
                  <Typography variant='body2' component='code' sx={{ display: 'block' }}>
                    /cook list
                  </Typography>
                  <Typography variant='body2' component='code' sx={{ display: 'block' }}>
                    /cook review &lt;task-id&gt; approve
                  </Typography>
                  <Typography variant='body2' component='code' sx={{ display: 'block' }}>
                    /cook my-cook
                  </Typography>
                  <Typography variant='body2' component='code' sx={{ display: 'block' }}>
                    /cook vote &lt;proposal-id&gt; approve
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Real-Time Notifications
                </Typography>
                <Typography variant='body2' paragraph>
                  You'll receive Slack notifications for:
                </Typography>
                <Stack spacing={1}>
                  <Typography variant='body2'>• Task assignments</Typography>
                  <Typography variant='body2'>• Review requests</Typography>
                  <Typography variant='body2'>• COOK issuance</Typography>
                  <Typography variant='body2'>• Governance proposals</Typography>
                  <Typography variant='body2'>• Voting started</Typography>
                </Stack>
                <Typography variant='body2' color='text.secondary' sx={{ mt: 2 }}>
                  Link your Slack account in your profile to enable notifications.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )
    },
    {
      title: 'AI Assistance',
      description: 'Smart features powered by AI',
      icon: <AutoAwesome />,
      content: (
        <Box>
          <Typography variant='body1' paragraph>
            The Cooperation Toolkit includes <strong>AI-powered features</strong> to help you work more
            efficiently.
          </Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Natural Language Task Creation
                </Typography>
                <Typography variant='body2' paragraph>
                  Describe your task in natural language, and AI will extract the title, description, and
                  estimated COOK value.
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Review Assistance
                </Typography>
                <Typography variant='body2' paragraph>
                  AI generates review summaries and checklists to help reviewers evaluate work more effectively.
                </Typography>
              </CardContent>
            </Card>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Retrospectives
                </Typography>
                <Typography variant='body2' paragraph>
                  AI generates team retrospectives based on completed work, COOK distribution, and review
                  patterns.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )
    },
    {
      title: "You're All Set!",
      description: 'Start using the Cooperation Toolkit',
      icon: <CheckCircle />,
      content: (
        <Box>
          <Typography variant='body1' paragraph>
            You now understand the key features of the Cooperation Toolkit. Here's what to do next:
          </Typography>
          <Stack spacing={2} sx={{ mt: 3 }}>
            <Card>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Next Steps
                </Typography>
                <Stack spacing={1} sx={{ mt: 1 }}>
                  <Typography variant='body2'>
                    1. <strong>Create or join a team</strong> to start working
                  </Typography>
                  <Typography variant='body2'>
                    2. <strong>Link your Slack account</strong> in your profile (optional but recommended)
                  </Typography>
                  <Typography variant='body2'>
                    3. <strong>Create your first task</strong> or get assigned to one
                  </Typography>
                  <Typography variant='body2'>
                    4. <strong>Start earning COOK</strong> by completing tasks
                  </Typography>
                </Stack>
              </CardContent>
            </Card>
            <Card sx={{ bgcolor: 'primary.light', color: 'primary.contrastText' }}>
              <CardContent>
                <Typography variant='h6' gutterBottom>
                  Need Help?
                </Typography>
                <Typography variant='body2'>
                  Visit the web dashboard for detailed documentation, or use <code>/cook help</code> in Slack for
                  command reference.
                </Typography>
              </CardContent>
            </Card>
          </Stack>
        </Box>
      )
    }
  ]

  return (
    <AppLayout>
      <Container maxWidth='md'>
        <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant='h4' component='h1' fontWeight='bold'>
              Welcome to Cooperation Toolkit
            </Typography>
            <IconButton onClick={handleSkip} disabled={loading}>
              <Close />
            </IconButton>
          </Box>

          <Stepper activeStep={activeStep} orientation='vertical'>
            {steps.map((step, index) => (
              <Step key={index}>
                <StepLabel
                  StepIconComponent={() => (
                    <Box sx={{ color: 'primary.main' }}>{step.icon}</Box>
                  )}
                >
                  <Typography variant='h6'>{step.title}</Typography>
                  <Typography variant='body2' color='text.secondary'>
                    {step.description}
                  </Typography>
                </StepLabel>
                <StepContent>
                  <Box sx={{ mb: 2 }}>{step.content}</Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 3 }}>
                    <Button
                      disabled={activeStep === 0}
                      onClick={handleBack}
                      startIcon={<ArrowBack />}
                    >
                      Back
                    </Button>
                    {activeStep === steps.length - 1 ? (
                      <Button
                        variant='contained'
                        onClick={handleCompleteOnboarding}
                        disabled={loading}
                        endIcon={<CheckCircle />}
                      >
                        {loading ? 'Completing...' : 'Get Started'}
                      </Button>
                    ) : (
                      <Button
                        variant='contained'
                        onClick={handleNext}
                        endIcon={<ArrowForward />}
                      >
                        Next
                      </Button>
                    )}
                  </Box>
                </StepContent>
              </Step>
            ))}
          </Stepper>

          {activeStep === steps.length && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Button variant='contained' onClick={handleCompleteOnboarding} disabled={loading} size='large'>
                {loading ? 'Completing...' : 'Get Started'}
              </Button>
            </Box>
          )}

          {skipped && (
            <Box sx={{ mt: 3, textAlign: 'center' }}>
              <Typography variant='body2' color='text.secondary'>
                You can complete this tour later from your profile.
              </Typography>
            </Box>
          )}
        </Paper>
      </Container>
    </AppLayout>
  )
}

