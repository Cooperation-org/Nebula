'use client'

import {
  doc,
  collection,
  setDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import type { AuditLog, AuditLogDocument } from '@/lib/types/auditLog'
import { auditLogDocumentSchema, auditLogSchema } from '@/lib/schemas/auditLog'
import { logger } from '@/lib/utils/logger'
import { getCurrentUser } from './auth'

/**
 * Create an audit log entry
 * 
 * Story 9.10: Audit Logs for Governance Actions
 * 
 * @param teamId - Team ID
 * @param actionType - Type of governance action
 * @param actorId - User ID who performed the action (or 'system' for automated actions)
 * @param participants - Optional array of participant IDs
 * @param outcome - Optional outcome description
 * @param outcomeDetails - Optional detailed outcome data
 * @param cookWeights - Optional map of participantId -> governance weight used
 * @param totalWeight - Optional total COOK weight involved
 * @param relatedEntityId - Optional related entity ID
 * @param relatedEntityType - Optional related entity type
 * @param metadata - Optional additional metadata
 * @returns Created audit log entry
 */
export async function createAuditLog(
  teamId: string,
  actionType: AuditLog['actionType'],
  actorId: string,
  participants?: string[],
  outcome?: string,
  outcomeDetails?: Record<string, unknown>,
  cookWeights?: Record<string, number>,
  totalWeight?: number,
  relatedEntityId?: string,
  relatedEntityType?: string,
  metadata?: Record<string, unknown>
): Promise<AuditLog> {
  const auditLogId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'auditLogs'), '_').id
  const now = new Date().toISOString()

  const auditLogDoc: AuditLogDocument = {
    teamId,
    actionType,
    timestamp: now,
    actorId,
    participants,
    outcome,
    outcomeDetails,
    cookWeights,
    totalWeight,
    relatedEntityId,
    relatedEntityType,
    metadata
  }

  const validatedDoc = auditLogDocumentSchema.parse(auditLogDoc)

  // Store in Firestore (teams/{teamId}/auditLogs/{auditLogId})
  const auditLogRef = doc(getFirestoreInstance(), 'teams', teamId, 'auditLogs', auditLogId)
  await setDoc(auditLogRef, {
    ...validatedDoc,
    timestamp: serverTimestamp()
  })

  // Also log to structured logger for immediate visibility
  logger.info('Audit log created', {
    auditLogId,
    teamId,
    actionType,
    actorId,
    participants: participants?.length || 0,
    outcome,
    totalWeight,
    relatedEntityId,
    relatedEntityType
  })

  const auditLog: AuditLog = {
    id: auditLogId,
    ...validatedDoc
  }

  return auditLog
}

/**
 * Get audit logs for a team
 * 
 * @param teamId - Team ID
 * @param actionType - Optional filter by action type
 * @param limitCount - Optional limit number of results (default: 100)
 * @param startAfter - Optional start after timestamp (for pagination)
 * @returns Array of audit log entries
 */
export async function getTeamAuditLogs(
  teamId: string,
  actionType?: AuditLog['actionType'],
  limitCount: number = 100,
  startAfter?: string
): Promise<AuditLog[]> {
  // Check authorization (only Stewards and Admins can view audit logs)
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User not authenticated')
  }

  // Get user's role in team
  const { getUserDocument } = await import('./auth')
  const user = await getUserDocument(currentUser.uid)
  if (!user) {
    throw new Error('User not found')
  }

  const teamRole = user.teams?.[teamId]
  if (teamRole !== 'Steward' && teamRole !== 'Admin') {
    throw new Error('Only Stewards and Admins can view audit logs')
  }

  const auditLogsRef = collection(getFirestoreInstance(), 'teams', teamId, 'auditLogs')
  let q = query(
    auditLogsRef,
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  )

  if (actionType) {
    q = query(
      auditLogsRef,
      where('actionType', '==', actionType),
      orderBy('timestamp', 'desc'),
      limit(limitCount)
    )
  }

  const querySnapshot = await getDocs(q)
  const auditLogs: AuditLog[] = []

  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const timestamp = data.timestamp?.toDate?.() 
      ? data.timestamp.toDate().toISOString() 
      : (typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString())

    try {
      const auditLog = auditLogSchema.parse({
        id: doc.id,
        teamId: data.teamId,
        actionType: data.actionType,
        timestamp,
        actorId: data.actorId,
        participants: data.participants,
        outcome: data.outcome,
        outcomeDetails: data.outcomeDetails,
        cookWeights: data.cookWeights,
        totalWeight: data.totalWeight,
        relatedEntityId: data.relatedEntityId,
        relatedEntityType: data.relatedEntityType,
        metadata: data.metadata
      })
      auditLogs.push(auditLog)
    } catch (error) {
      logger.error('Error parsing audit log', {
        auditLogId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return auditLogs
}

/**
 * Get audit logs for a specific entity
 * 
 * @param teamId - Team ID
 * @param relatedEntityId - Related entity ID
 * @param relatedEntityType - Optional related entity type
 * @returns Array of audit log entries
 */
export async function getAuditLogsForEntity(
  teamId: string,
  relatedEntityId: string,
  relatedEntityType?: string
): Promise<AuditLog[]> {
  // Check authorization (only Stewards and Admins can view audit logs)
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User not authenticated')
  }

  const { getUserDocument } = await import('./auth')
  const user = await getUserDocument(currentUser.uid)
  if (!user) {
    throw new Error('User not found')
  }

  const teamRole = user.teams?.[teamId]
  if (teamRole !== 'Steward' && teamRole !== 'Admin') {
    throw new Error('Only Stewards and Admins can view audit logs')
  }

  const auditLogsRef = collection(getFirestoreInstance(), 'teams', teamId, 'auditLogs')
  let q = query(
    auditLogsRef,
    where('relatedEntityId', '==', relatedEntityId),
    orderBy('timestamp', 'desc')
  )

  if (relatedEntityType) {
    q = query(
      auditLogsRef,
      where('relatedEntityId', '==', relatedEntityId),
      where('relatedEntityType', '==', relatedEntityType),
      orderBy('timestamp', 'desc')
    )
  }

  const querySnapshot = await getDocs(q)
  const auditLogs: AuditLog[] = []

  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const timestamp = data.timestamp?.toDate?.() 
      ? data.timestamp.toDate().toISOString() 
      : (typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString())

    try {
      const auditLog = auditLogSchema.parse({
        id: doc.id,
        teamId: data.teamId,
        actionType: data.actionType,
        timestamp,
        actorId: data.actorId,
        participants: data.participants,
        outcome: data.outcome,
        outcomeDetails: data.outcomeDetails,
        cookWeights: data.cookWeights,
        totalWeight: data.totalWeight,
        relatedEntityId: data.relatedEntityId,
        relatedEntityType: data.relatedEntityType,
        metadata: data.metadata
      })
      auditLogs.push(auditLog)
    } catch (error) {
      logger.error('Error parsing audit log', {
        auditLogId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return auditLogs
}

/**
 * Get audit logs for a specific actor
 * 
 * @param teamId - Team ID
 * @param actorId - Actor user ID
 * @param limitCount - Optional limit number of results (default: 100)
 * @returns Array of audit log entries
 */
export async function getAuditLogsForActor(
  teamId: string,
  actorId: string,
  limitCount: number = 100
): Promise<AuditLog[]> {
  // Check authorization (only Stewards and Admins can view audit logs)
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User not authenticated')
  }

  const { getUserDocument } = await import('./auth')
  const user = await getUserDocument(currentUser.uid)
  if (!user) {
    throw new Error('User not found')
  }

  const teamRole = user.teams?.[teamId]
  if (teamRole !== 'Steward' && teamRole !== 'Admin') {
    throw new Error('Only Stewards and Admins can view audit logs')
  }

  const auditLogsRef = collection(getFirestoreInstance(), 'teams', teamId, 'auditLogs')
  const q = query(
    auditLogsRef,
    where('actorId', '==', actorId),
    orderBy('timestamp', 'desc'),
    limit(limitCount)
  )

  const querySnapshot = await getDocs(q)
  const auditLogs: AuditLog[] = []

  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const timestamp = data.timestamp?.toDate?.() 
      ? data.timestamp.toDate().toISOString() 
      : (typeof data.timestamp === 'string' ? data.timestamp : new Date().toISOString())

    try {
      const auditLog = auditLogSchema.parse({
        id: doc.id,
        teamId: data.teamId,
        actionType: data.actionType,
        timestamp,
        actorId: data.actorId,
        participants: data.participants,
        outcome: data.outcome,
        outcomeDetails: data.outcomeDetails,
        cookWeights: data.cookWeights,
        totalWeight: data.totalWeight,
        relatedEntityId: data.relatedEntityId,
        relatedEntityType: data.relatedEntityType,
        metadata: data.metadata
      })
      auditLogs.push(auditLog)
    } catch (error) {
      logger.error('Error parsing audit log', {
        auditLogId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return auditLogs
}

