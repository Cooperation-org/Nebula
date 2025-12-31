'use client'

import {
  doc,
  collection,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  serverTimestamp
} from 'firebase/firestore'
import { getFirestoreInstance } from './config'
import { getCookLedgerEntries } from './cookLedger'
import { getTeam } from './teams'
import { calculateTeamEquity, type EquityModel } from '@/lib/utils/equityCalculations'
import type { Equity, EquityDocument } from '@/lib/types/equity'
import type { CookLedgerEntry } from '@/lib/types/cookLedger'
import { equityDocumentSchema, equitySchema } from '@/lib/schemas/equity'
import { logger } from '@/lib/utils/logger'

/**
 * Calculate and store equity for all contributors in a team
 * 
 * Story 9.2: Feed COOK Totals into Equity Calculations
 * 
 * @param teamId - Team ID
 * @returns Array of updated equity calculations
 */
export async function updateTeamEquity(teamId: string): Promise<Equity[]> {
  // Get team configuration
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  // Get all COOK ledger entries for the team
  // We need to get all contributors' entries
  const cookLedgerRef = collection(getFirestoreInstance(), 'teams', teamId, 'cookLedger')
  const querySnapshot = await getDocs(cookLedgerRef)

  // Group entries by contributor
  const contributorsCook = new Map<string, CookLedgerEntry[]>()
  
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const contributorId = data.contributorId
    if (!contributorsCook.has(contributorId)) {
      contributorsCook.set(contributorId, [])
    }
    
    const entry: CookLedgerEntry = {
      id: doc.id,
      taskId: data.taskId,
      teamId: data.teamId,
      contributorId: data.contributorId,
      cookValue: data.cookValue,
      attribution: data.attribution,
      issuedAt: data.issuedAt?.toDate?.() ? data.issuedAt.toDate().toISOString() : data.issuedAt
    }
    
    contributorsCook.get(contributorId)!.push(entry)
  })

  // Calculate equity for all contributors
  const equityModel = (team.equityModel || 'slicing') as EquityModel
  const equityResults = await calculateTeamEquity(contributorsCook, team, equityModel)

  // Store equity calculations
  const now = new Date().toISOString()
  const equityDocuments: Equity[] = []

  for (const result of equityResults) {
    const equityDoc: EquityDocument = {
      teamId,
      equity: result.equity,
      effectiveCook: result.effectiveCook,
      rawCook: result.rawCook,
      model: result.model,
      totalTeamCook: result.totalTeamCook,
      capApplied: result.capApplied,
      decayApplied: result.decayApplied,
      lastUpdated: now
    }

    // Validate with Zod schema
    const validatedDoc = equityDocumentSchema.parse(equityDoc)

    // Store in Firestore (teams/{teamId}/equity/{contributorId})
    const equityRef = doc(getFirestoreInstance(), 'teams', teamId, 'equity', result.contributorId)
    await setDoc(equityRef, {
      ...validatedDoc,
      lastUpdated: serverTimestamp()
    })

    // Log equity update
    logger.info('Equity updated', {
      teamId,
      contributorId: result.contributorId,
      equity: result.equity,
      effectiveCook: result.effectiveCook,
      rawCook: result.rawCook,
      model: result.model,
      totalTeamCook: result.totalTeamCook,
      capApplied: result.capApplied,
      decayApplied: result.decayApplied,
      timestamp: now
    })

    // Return equity object with contributorId
    const equity: Equity = {
      contributorId: result.contributorId,
      ...validatedDoc
    }

    equityDocuments.push(equity)
  }

  return equityDocuments
}

/**
 * Get equity for a contributor in a team
 * 
 * @param teamId - Team ID
 * @param contributorId - Contributor user ID
 * @returns Equity or null if not found
 */
export async function getEquity(
  teamId: string,
  contributorId: string
): Promise<Equity | null> {
  const equityRef = doc(getFirestoreInstance(), 'teams', teamId, 'equity', contributorId)
  const equitySnap = await getDoc(equityRef)

  if (!equitySnap.exists()) {
    return null
  }

  const data = equitySnap.data()
  const equity: Equity = {
    contributorId: equitySnap.id,
    teamId: data.teamId,
    equity: data.equity,
    effectiveCook: data.effectiveCook,
    rawCook: data.rawCook,
    model: data.model,
    totalTeamCook: data.totalTeamCook,
    capApplied: data.capApplied,
    decayApplied: data.decayApplied,
    lastUpdated: data.lastUpdated?.toDate?.() ? data.lastUpdated.toDate().toISOString() : data.lastUpdated
  }

  // Validate with schema
  try {
    return equitySchema.parse(equity)
  } catch (error) {
    logger.warn('Invalid equity data', {
      teamId,
      contributorId,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
    return null
  }
}

/**
 * Get all equity calculations for a team
 * 
 * @param teamId - Team ID
 * @returns Array of equity calculations for all contributors in the team
 */
export async function getTeamEquity(teamId: string): Promise<Equity[]> {
  const equityRef = collection(getFirestoreInstance(), 'teams', teamId, 'equity')
  const querySnapshot = await getDocs(equityRef)

  const equities: Equity[] = []
  querySnapshot.forEach((doc) => {
    const data = doc.data()
    const equity: Equity = {
      contributorId: doc.id,
      teamId: data.teamId,
      equity: data.equity,
      effectiveCook: data.effectiveCook,
      rawCook: data.rawCook,
      model: data.model,
      totalTeamCook: data.totalTeamCook,
      capApplied: data.capApplied,
      decayApplied: data.decayApplied,
      lastUpdated: data.lastUpdated?.toDate?.() ? data.lastUpdated.toDate().toISOString() : data.lastUpdated
    }

    // Validate with schema
    try {
      const validatedEquity = equitySchema.parse(equity)
      equities.push(validatedEquity)
    } catch (error) {
      logger.warn('Invalid equity skipped', {
        teamId,
        contributorId: doc.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  })

  return equities
}

