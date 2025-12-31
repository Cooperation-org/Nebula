'use client'

import {
  doc,
  collection,
  setDoc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  onSnapshot,
  orderBy
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import type { CookLedgerEntry, CookLedgerEntryDocument } from '@/lib/types/cookLedger'
import { cookLedgerEntryDocumentSchema, cookLedgerEntrySchema } from '@/lib/schemas/cookLedger'
import { logger } from '@/lib/utils/logger'

/**
 * Check if COOK has already been issued for a task and contributor
 * Prevents duplicate COOK issuance
 */
export async function hasCookBeenIssued(
  teamId: string,
  taskId: string,
  contributorId: string
): Promise<boolean> {
  const cookLedgerRef = collection(getFirestoreInstance(), 'teams', teamId, 'cookLedger')
  const q = query(
    cookLedgerRef,
    where('taskId', '==', taskId),
    where('contributorId', '==', contributorId)
  )
  
  const querySnapshot = await getDocs(q)
  return !querySnapshot.empty
}

/**
 * Issue COOK to a contributor
 * Creates an immutable ledger entry when COOK reaches Final state
 * This is the ONLY way COOK can be issued - no manual minting (FR28)
 * Prevents duplicate issuance for the same task and contributor
 */
export async function issueCook(
  teamId: string,
  taskId: string,
  contributorId: string,
  cookValue: number,
  attribution: 'self' | 'spend'
): Promise<CookLedgerEntry> {
  // Validate inputs
  if (cookValue <= 0) {
    throw new Error('COOK value must be positive')
  }

  if (!attribution || (attribution !== 'self' && attribution !== 'spend')) {
    throw new Error('Attribution must be "self" or "spend"')
  }

  // Story 7.8, FR19: Block COOK issuance if unauthorized movement detected
  const taskDoc = await getDoc(doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId))
  if (taskDoc.exists()) {
    const task = taskDoc.data()
    const unauthorizedMovement = task?.github?.unauthorizedMovement
    if (unauthorizedMovement?.blocked) {
      const errorMessage = 
        `COOK issuance blocked: Unauthorized GitHub column movement detected. ` +
        `Task was moved from "${unauthorizedMovement.fromState}" to "${unauthorizedMovement.attemptedState}" ` +
        `(skipped columns). Please correct the movement or have a Steward clear the flag.`
      
      logger.warn('COOK issuance blocked due to unauthorized GitHub movement', {
        taskId,
        teamId,
        contributorId,
        unauthorizedMovement: {
          detectedAt: unauthorizedMovement.detectedAt,
          fromState: unauthorizedMovement.fromState,
          attemptedState: unauthorizedMovement.attemptedState,
          reason: unauthorizedMovement.reason
        }
      })
      
      throw new Error(errorMessage)
    }
  }

  // Check if COOK has already been issued for this task and contributor
  // This prevents duplicate issuance if finalizeCook or updateTask is called multiple times
  const alreadyIssued = await hasCookBeenIssued(teamId, taskId, contributorId)
  if (alreadyIssued) {
    logger.warn('COOK already issued for task and contributor, skipping duplicate issuance (idempotent)', {
      taskId,
      teamId,
      contributorId,
      cookValue
    })
    // Return a placeholder entry (idempotent behavior)
    // In a production system, you might want to fetch and return the existing entry
    // For now, we'll throw an error to prevent duplicate issuance
    throw new Error('COOK has already been issued for this task and contributor')
  }

  // Generate ledger entry ID
  const entryId = doc(collection(getFirestoreInstance(), 'teams', teamId, 'cookLedger'), '_').id

  const now = new Date().toISOString()
  const entryDoc: CookLedgerEntryDocument = {
    taskId,
    teamId,
    contributorId,
    cookValue,
    attribution,
    issuedAt: now
  }

  // Validate with Zod schema
  const validatedEntryDoc = cookLedgerEntryDocumentSchema.parse(entryDoc)

  // Create ledger entry document (append-only, immutable)
  const entryRef = doc(getFirestoreInstance(), 'teams', teamId, 'cookLedger', entryId)
  await setDoc(entryRef, {
    ...validatedEntryDoc,
    issuedAt: serverTimestamp()
  })

  // Log COOK issuance (FR28, FR29)
  // Implicit consent is implied by COOK issuance
  // Task approval through review process = implicit consent for governance (FR30, Story 6B.5)
  logger.info('COOK issued', {
    entryId,
    taskId,
    teamId,
    contributorId,
    cookValue,
    attribution,
    timestamp: now,
    // Implicit consent: Task approval through review process provides implicit consent for governance
    implicitConsent: true,
    governanceWeightUpdate: true // Governance weight will be recalculated based on this issuance (Epic 9)
  })

  // Story 9.1: Update governance weight automatically when COOK is issued
  try {
    const { updateGovernanceWeight } = await import('./governanceWeight')
    await updateGovernanceWeight(teamId, contributorId)
    logger.info('Governance weight updated after COOK issuance', {
      teamId,
      contributorId,
      cookValue
    })
  } catch (error) {
    // Log error but don't fail COOK issuance if governance weight update fails
    logger.error('Failed to update governance weight after COOK issuance', {
      teamId,
      contributorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Story 8.6: Issue verifiable attestation when COOK is issued
  try {
    // Get task and review information for attestation
    const taskDoc = await getDoc(doc(getFirestoreInstance(), 'teams', teamId, 'tasks', taskId))
    const task = taskDoc.exists() ? taskDoc.data() : null
    
    // Get review to find reviewers
    const { getReviewByTaskId } = await import('./reviews')
    const review = await getReviewByTaskId(teamId, taskId)
    // Combine reviewers from approvals and task reviewers
    const reviewers = review 
      ? [...(review.approvals || []), ...(review.objections?.map(o => o.reviewerId) || [])]
      : task?.reviewers || []
    
    // Get team name for display
    const teamDoc = await getDoc(doc(getFirestoreInstance(), 'teams', teamId))
    const teamName = teamDoc.exists() ? teamDoc.data()?.name : undefined
    
    // Issue attestation (Story 8.6, FR55, FR56, FR57)
    // Merkle hash will be computed by Cloud Function trigger (Story 8.7)
    const { issueAttestation } = await import('./attestations')
    await issueAttestation(
      taskId,
      teamId,
      contributorId,
      cookValue,
      attribution,
      reviewers,
      task?.title,
      teamName
      // merkleRoot and parentHash will be computed by Cloud Function trigger
    )
  } catch (error) {
    // Log error but don't fail COOK issuance if attestation fails
    logger.error('Failed to issue attestation after COOK issuance', {
      taskId,
      teamId,
      contributorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }

  // Return ledger entry object with ID
  const entry: CookLedgerEntry = {
    id: entryId,
    ...validatedEntryDoc
  }

  return entry
}

/**
 * Get COOK ledger entries for a contributor
 * Returns all entries for the specified contributor in the team
 * 
 * Story 8.2: View COOK Ledger with Time-Based Aggregation
 * 
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @returns Array of COOK ledger entries, sorted by issuedAt (newest first)
 */
export async function getCookLedgerEntries(
  teamId: string,
  contributorId: string
): Promise<CookLedgerEntry[]> {
  const cookLedgerRef = collection(getFirestoreInstance(), 'teams', teamId, 'cookLedger')
  const q = query(
    cookLedgerRef,
    where('contributorId', '==', contributorId)
  )
  
  const querySnapshot = await getDocs(q)
  
  const entries: CookLedgerEntry[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const entry: CookLedgerEntry = {
      id: doc.id,
      taskId: data.taskId,
      teamId: data.teamId,
      contributorId: data.contributorId,
      cookValue: data.cookValue,
      attribution: data.attribution,
      issuedAt: data.issuedAt?.toDate?.() ? data.issuedAt.toDate().toISOString() : data.issuedAt
    }
    
    // Validate with schema
    const validatedEntry = cookLedgerEntrySchema.parse(entry)
    entries.push(validatedEntry)
  })
  
  // Sort by issuedAt (newest first)
  entries.sort((a, b) => {
    const dateA = new Date(a.issuedAt).getTime()
    const dateB = new Date(b.issuedAt).getTime()
    return dateB - dateA
  })
  
  return entries
}

/**
 * Subscribe to COOK ledger entries for a contributor (real-time updates)
 * Returns an unsubscribe function
 * 
 * Story 8.2: View COOK Ledger with Time-Based Aggregation
 * 
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @param callback - Callback function called with array of entries whenever data changes
 * @returns Unsubscribe function
 */
export function subscribeToCookLedgerEntries(
  teamId: string,
  contributorId: string,
  callback: (entries: CookLedgerEntry[]) => void
): () => void {
  const cookLedgerRef = collection(getFirestoreInstance(), 'teams', teamId, 'cookLedger')
  // Note: Firestore requires a composite index for where + orderBy on different fields
  // For now, we'll query without orderBy and sort in memory
  // In production, create a composite index: cookLedger(contributorId ASC, issuedAt DESC)
  const q = query(
    cookLedgerRef,
    where('contributorId', '==', contributorId)
  )
  
  const unsubscribe = onSnapshot(
    q,
    (querySnapshot) => {
      const entries: CookLedgerEntry[] = []
      querySnapshot.forEach((doc) => {
        const data = doc.data()
        const entry: CookLedgerEntry = {
          id: doc.id,
          taskId: data.taskId,
          teamId: data.teamId,
          contributorId: data.contributorId,
          cookValue: data.cookValue,
          attribution: data.attribution,
          issuedAt: data.issuedAt?.toDate?.() ? data.issuedAt.toDate().toISOString() : data.issuedAt
        }
        
        // Validate with schema
        try {
          const validatedEntry = cookLedgerEntrySchema.parse(entry)
          entries.push(validatedEntry)
        } catch (error) {
          logger.warn('Invalid ledger entry skipped', {
            entryId: doc.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          })
        }
      })
      
      // Sort by issuedAt (newest first) since we can't use orderBy without composite index
      entries.sort((a, b) => {
        const dateA = new Date(a.issuedAt).getTime()
        const dateB = new Date(b.issuedAt).getTime()
        return dateB - dateA
      })
      
      callback(entries)
    },
    (error) => {
      logger.error('Error subscribing to COOK ledger entries', {
        teamId,
        contributorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
      callback([])
    }
  )
  
  return unsubscribe
}

