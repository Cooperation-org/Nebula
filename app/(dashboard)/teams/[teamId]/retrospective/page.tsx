'use client'

import { useParams } from 'next/navigation'
import { Container, Box } from '@mui/material'
import { AppLayout } from '@/components/AppLayout'
import RetrospectiveGenerator from './RetrospectiveGenerator'

export default function RetrospectivePage() {
  const params = useParams()
  const teamId = params?.teamId as string

  return (
    <AppLayout>
      <Container maxWidth='lg'>
        <Box sx={{ py: 4 }}>
          <RetrospectiveGenerator teamId={teamId} />
        </Box>
      </Container>
    </AppLayout>
  )
}

