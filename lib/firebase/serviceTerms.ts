'use client'

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import type { ServiceTerm, ServiceTermDocument } from '@/lib/types/serviceTerm'
import {
  serviceTermDocumentSchema,
  serviceTermSchema,
  serviceTermUpdateSchema,
  type ServiceTermUpdate
} from '@/lib/schemas/serviceTerm'
import { logger } from '@/lib/utils/logger'

/**
 * Calculate duration in days between two dates
 *
 * @param startDate - Start date (ISO string)
 * @param endDate - End date (ISO string)
 * @returns Duration in days
 */
function calculateDurationDays(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  const diffTime = Math.abs(end.getTime() - start.getTime())
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  return diffDays
}

/**
 * Create a service term when committee service begins
 *
 * Story 9.5: Track Committee Service Terms (FR62)
 *
 * @param teamId - Team ID
 * @param committeeId - Committee ID
 * @param committeeName - Committee name
 * @param contributorId - Contributor user ID
 * @param startDate - Service start date (ISO string, defaults to now)
 * @returns Created service term
 */
export async function createServiceTerm(
  teamId: string,
  committeeId: string,
  committeeName: string,
  contributorId: string,
  startDate?: string
): Promise<ServiceTerm> {
  const now = new Date().toISOString()
  const serviceStartDate = startDate || now

  // Generate service term ID
  const serviceTermId = doc(
    collection(getFirestoreInstance(), 'teams', teamId, 'serviceTerms'),
    '_'
  ).id

  const serviceTermDoc: ServiceTermDocument = {
    teamId,
    committeeId,
    committeeName,
    contributorId,
    startDate: serviceStartDate,
    endDate: undefined, // Service is ongoing
    durationDays: undefined, // Will be calculated when service ends
    status: 'active',
    createdAt: now,
    updatedAt: now
  }

  const validatedDoc = serviceTermDocumentSchema.parse(serviceTermDoc)

  // Store in Firestore (teams/{teamId}/serviceTerms/{serviceTermId})
  const serviceTermRef = doc(
    getFirestoreInstance(),
    'teams',
    teamId,
    'serviceTerms',
    serviceTermId
  )
  await setDoc(serviceTermRef, {
    ...validatedDoc,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  })

  logger.info('Service term created', {
    serviceTermId,
    teamId,
    committeeId,
    committeeName,
    contributorId,
    startDate: serviceStartDate,
    status: 'active'
  })

  const serviceTerm: ServiceTerm = {
    id: serviceTermId,
    ...validatedDoc
  }

  return serviceTerm
}

/**
 * End a service term (mark service as completed or terminated)
 *
 * @param teamId - Team ID
 * @param serviceTermId - Service term ID
 * @param endDate - Service end date (ISO string, defaults to now)
 * @param status - Service status ('completed' or 'terminated')
 * @returns Updated service term
 */
export async function endServiceTerm(
  teamId: string,
  serviceTermId: string,
  endDate?: string,
  status: 'completed' | 'terminated' = 'completed'
): Promise<ServiceTerm> {
  // Get existing service term
  const serviceTermRef = doc(
    getFirestoreInstance(),
    'teams',
    teamId,
    'serviceTerms',
    serviceTermId
  )
  const serviceTermSnap = await getDoc(serviceTermRef)

  if (!serviceTermSnap.exists()) {
    throw new Error('Service term not found')
  }

  const existingData = serviceTermSnap.data()
  const existingServiceTerm = serviceTermSchema.parse({
    id: serviceTermSnap.id,
    ...existingData,
    startDate: existingData.startDate?.toDate?.()
      ? existingData.startDate.toDate().toISOString()
      : existingData.startDate,
    endDate: existingData.endDate?.toDate?.()
      ? existingData.endDate.toDate().toISOString()
      : existingData.endDate,
    createdAt: existingData.createdAt?.toDate?.()
      ? existingData.createdAt.toDate().toISOString()
      : existingData.createdAt,
    updatedAt: existingData.updatedAt?.toDate?.()
      ? existingData.updatedAt.toDate().toISOString()
      : existingData.updatedAt
  })

  if (existingServiceTerm.status !== 'active') {
    throw new Error(`Service term is already ${existingServiceTerm.status}`)
  }

  const now = new Date().toISOString()
  const serviceEndDate = endDate || now

  // Calculate duration
  const durationDays = calculateDurationDays(
    existingServiceTerm.startDate,
    serviceEndDate
  )

  const update: ServiceTermUpdate = {
    endDate: serviceEndDate,
    durationDays,
    status,
    updatedAt: now
  }

  const validatedUpdate = serviceTermUpdateSchema.parse(update)

  // Update service term
  await updateDoc(serviceTermRef, {
    ...validatedUpdate,
    endDate: serviceEndDate,
    durationDays,
    status,
    updatedAt: serverTimestamp()
  })

  logger.info('Service term ended', {
    serviceTermId,
    teamId,
    committeeId: existingServiceTerm.committeeId,
    contributorId: existingServiceTerm.contributorId,
    startDate: existingServiceTerm.startDate,
    endDate: serviceEndDate,
    durationDays,
    status
  })

  return {
    ...existingServiceTerm,
    ...validatedUpdate
  }
}

/**
 * Get service term by ID
 *
 * @param teamId - Team ID
 * @param serviceTermId - Service term ID
 * @returns Service term or null if not found
 */
export async function getServiceTerm(
  teamId: string,
  serviceTermId: string
): Promise<ServiceTerm | null> {
  const serviceTermRef = doc(
    getFirestoreInstance(),
    'teams',
    teamId,
    'serviceTerms',
    serviceTermId
  )
  const serviceTermSnap = await getDoc(serviceTermRef)

  if (!serviceTermSnap.exists()) {
    return null
  }

  const data = serviceTermSnap.data()
  return serviceTermSchema.parse({
    id: serviceTermSnap.id,
    ...data,
    startDate: data.startDate?.toDate?.()
      ? data.startDate.toDate().toISOString()
      : data.startDate,
    endDate: data.endDate?.toDate?.()
      ? data.endDate.toDate().toISOString()
      : data.endDate,
    createdAt: data.createdAt?.toDate?.()
      ? data.createdAt.toDate().toISOString()
      : data.createdAt,
    updatedAt: data.updatedAt?.toDate?.()
      ? data.updatedAt.toDate().toISOString()
      : data.updatedAt
  })
}

/**
 * Get all service terms for a contributor
 *
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @returns Array of service terms
 */
export async function getServiceTermsForContributor(
  teamId: string,
  contributorId: string
): Promise<ServiceTerm[]> {
  const serviceTermsRef = collection(
    getFirestoreInstance(),
    'teams',
    teamId,
    'serviceTerms'
  )
  const q = query(serviceTermsRef, where('contributorId', '==', contributorId))
  const querySnapshot = await getDocs(q)

  const serviceTerms: ServiceTerm[] = []
  querySnapshot.forEach(doc => {
    const data = doc.data()
    try {
      const serviceTerm = serviceTermSchema.parse({
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate?.()
          ? data.startDate.toDate().toISOString()
          : data.startDate,
        endDate: data.endDate?.toDate?.()
          ? data.endDate.toDate().toISOString()
          : data.endDate,
        createdAt: data.createdAt?.toDate?.()
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()
          ? data.updatedAt.toDate().toISOString()
          : data.updatedAt
      })
      serviceTerms.push(serviceTerm)
    } catch (error) {
      logger.error('Error parsing service term', {
        serviceTermId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return serviceTerms
}

/**
 * Get all active service terms for a contributor (currently serving)
 *
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @returns Array of active service terms
 */
export async function getActiveServiceTerms(
  teamId: string,
  contributorId: string
): Promise<ServiceTerm[]> {
  const allTerms = await getServiceTermsForContributor(teamId, contributorId)
  return allTerms.filter(term => term.status === 'active')
}

/**
 * Get all service terms for a committee
 *
 * @param teamId - Team ID
 * @param committeeId - Committee ID
 * @returns Array of service terms
 */
export async function getServiceTermsForCommittee(
  teamId: string,
  committeeId: string
): Promise<ServiceTerm[]> {
  const serviceTermsRef = collection(
    getFirestoreInstance(),
    'teams',
    teamId,
    'serviceTerms'
  )
  const q = query(serviceTermsRef, where('committeeId', '==', committeeId))
  const querySnapshot = await getDocs(q)

  const serviceTerms: ServiceTerm[] = []
  querySnapshot.forEach(doc => {
    const data = doc.data()
    try {
      const serviceTerm = serviceTermSchema.parse({
        id: doc.id,
        ...data,
        startDate: data.startDate?.toDate?.()
          ? data.startDate.toDate().toISOString()
          : data.startDate,
        endDate: data.endDate?.toDate?.()
          ? data.endDate.toDate().toISOString()
          : data.endDate,
        createdAt: data.createdAt?.toDate?.()
          ? data.createdAt.toDate().toISOString()
          : data.createdAt,
        updatedAt: data.updatedAt?.toDate?.()
          ? data.updatedAt.toDate().toISOString()
          : data.updatedAt
      })
      serviceTerms.push(serviceTerm)
    } catch (error) {
      logger.error('Error parsing service term', {
        serviceTermId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return serviceTerms
}
