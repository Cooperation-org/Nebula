'use client'

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp,
  runTransaction,
  collection,
  getDocs,
  query,
  where
} from 'firebase/firestore'
import { db } from './config'
import { getCurrentUser, getCurrentUserDocument } from './auth'
import type { Team, TeamDocument } from '@/lib/types/team'
import { teamDocumentSchema, teamSchema, teamUpdateSchema } from '@/lib/schemas/team'
import { logger } from '@/lib/utils/logger'
import type { UserRole } from '@/lib/types/user'

/**
 * Create a new team
 * Creates team document and adds creator as team member with Steward role
 */
export async function createTeam(name: string, description?: string): Promise<Team> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to create a team')
  }

  // Get user document to verify user exists
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Generate team ID - create a new document reference to get an auto-generated ID
  const teamId = doc(collection(db, 'teams')).id

  const now = new Date().toISOString()
  const teamDoc: TeamDocument = {
    name,
    description: description || '',
    createdAt: now,
    updatedAt: now,
    createdBy: currentUser.uid
  }

  // Validate with Zod schema
  const validatedData = teamDocumentSchema.parse(teamDoc)

  // Use transaction to ensure atomicity
  // Firestore transactions require ALL reads before ANY writes
  // 1. Read user document
  // 2. Create team document
  // 3. Update user document with team membership
  await runTransaction(db, async transaction => {
    // FIRST: Read user document (all reads must come before writes)
    const userRef = doc(db, 'users', currentUser.uid)
    const userSnap = await transaction.get(userRef)

    if (!userSnap.exists()) {
      throw new Error('User document does not exist')
    }

    const userData = userSnap.data()
    const updatedTeams = {
      ...userData.teams,
      [teamId]: 'Steward' as UserRole
    }

    // THEN: Perform writes (after all reads)
    // Create team document
    const teamRef = doc(db, 'teams', teamId)
    transaction.set(teamRef, {
      ...validatedData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    })

    // Update user document with team membership (Steward role for creator)
    transaction.update(userRef, {
      teams: updatedTeams,
      updatedAt: serverTimestamp()
    })
  })

  logger.info('Team created', {
    teamId,
    name,
    userId: currentUser.uid
  })

  // Return team object with ID
  const team: Team = {
    id: teamId,
    ...validatedData
  }

  return team
}

/**
 * Get team document by ID
 */
export async function getTeam(teamId: string): Promise<Team | null> {
  const teamDocRef = doc(db, 'teams', teamId)
  const teamDocSnap = await getDoc(teamDocRef)

  if (!teamDocSnap.exists()) {
    return null
  }

  const data = teamDocSnap.data()

  // Convert Firestore Timestamp to ISO string
  const createdAt =
    data.createdAt?.toDate?.()?.toISOString() ||
    (typeof data.createdAt === 'string' ? data.createdAt : new Date().toISOString())
  const updatedAt =
    data.updatedAt?.toDate?.()?.toISOString() ||
    (typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString())

  const team: Team = {
    id: teamId,
    name: data.name || '',
    description: data.description,
    createdAt,
    updatedAt,
    createdBy: data.createdBy || '',
    cookCap: data.cookCap, // Story 8.4: COOK cap configuration
    cookDecayRate: data.cookDecayRate, // Story 8.5: COOK decay configuration
    equityModel: data.equityModel, // Story 9.2: Equity calculation model
    committeeEligibilityWindowMonths: data.committeeEligibilityWindowMonths, // Story 9.3: Committee eligibility window
    committeeMinimumActiveCook: data.committeeMinimumActiveCook, // Story 9.3: Minimum active COOK for eligibility
    committeeCoolingOffPeriodDays: data.committeeCoolingOffPeriodDays, // Story 9.5: Cooling-off period after service
    defaultObjectionWindowDays: data.defaultObjectionWindowDays, // Story 9.6: Default objection window duration
    defaultObjectionThreshold: data.defaultObjectionThreshold, // Story 9.6: Default objection threshold
    defaultVotingPeriodDays: data.defaultVotingPeriodDays, // Story 9.7: Default voting period duration
    constitutionalVotingPeriodDays: data.constitutionalVotingPeriodDays, // Story 9.9: Constitutional challenge voting period
    constitutionalApprovalThreshold: data.constitutionalApprovalThreshold // Story 9.9: Constitutional challenge approval threshold
  }

  // Validate with Zod schema
  return teamSchema.parse(team)
}

/**
 * Join an existing team
 * Adds user to team with Contributor role (default)
 */
export async function joinTeam(
  teamId: string,
  role: UserRole = 'Contributor'
): Promise<Team> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to join a team')
  }

  // Get user document to verify user exists
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check if user is already a member of the team
  if (isTeamMember(userDoc, teamId)) {
    throw new Error('You are already a member of this team')
  }

  // Verify team exists
  const team = await getTeam(teamId)
  if (!team) {
    throw new Error('Team not found')
  }

  // Use transaction to ensure atomicity
  // Update user document with team membership
  await runTransaction(db, async transaction => {
    // Update user document with team membership
    const userRef = doc(db, 'users', currentUser.uid)
    const userSnap = await transaction.get(userRef)

    if (!userSnap.exists()) {
      throw new Error('User document does not exist')
    }

    const userData = userSnap.data()

    // Check again in transaction (double-check)
    if (teamId in (userData.teams || {})) {
      throw new Error('You are already a member of this team')
    }

    const updatedTeams = {
      ...(userData.teams || {}),
      [teamId]: role
    }

    transaction.update(userRef, {
      teams: updatedTeams,
      updatedAt: serverTimestamp()
    })
  })

  logger.info('User joined team', {
    teamId,
    userId: currentUser.uid,
    role
  })

  return team
}

/**
 * Check if user is a member of a team
 */
function isTeamMember(
  user: { teams: Record<string, UserRole> },
  teamId: string
): boolean {
  return teamId in user.teams
}

/**
 * Update team document
 * Only Stewards and Admins can update team settings
 */
export async function updateTeam(teamId: string, updates: Partial<Team>): Promise<Team> {
  const currentUser = getCurrentUser()
  if (!currentUser) {
    throw new Error('User must be authenticated to update a team')
  }

  // Get user document to verify permissions
  const userDoc = await getCurrentUserDocument()
  if (!userDoc) {
    throw new Error('User document not found')
  }

  // Check if user is a Steward or Admin
  const userRole = userDoc.teams[teamId]
  if (userRole !== 'Steward' && userRole !== 'Admin') {
    throw new Error('Only Stewards and Admins can update team settings')
  }

  // Verify team exists
  const existingTeam = await getTeam(teamId)
  if (!existingTeam) {
    throw new Error('Team not found')
  }

  // Prepare update data (exclude id, createdAt, createdBy from updates)
  const { id, createdAt, createdBy, ...updateableFields } = updates
  const updateData = {
    ...updateableFields,
    updatedAt: new Date().toISOString()
  }

  // Validate with Zod schema
  const validatedData = teamUpdateSchema.parse(updateData)

  // Update team document
  const teamRef = doc(db, 'teams', teamId)
  await setDoc(
    teamRef,
    {
      ...validatedData,
      updatedAt: serverTimestamp()
    },
    { merge: true }
  )

  logger.info('Team updated', {
    teamId,
    userId: currentUser.uid,
    updates: Object.keys(validatedData)
  })

  // Return updated team
  const updatedTeam = await getTeam(teamId)
  if (!updatedTeam) {
    throw new Error('Failed to retrieve updated team')
  }

  return updatedTeam
}

/**
 * Get all team members for a team
 * Returns array of user documents for users who belong to the team
 */
export async function getTeamMembers(
  teamId: string
): Promise<Array<{ user: import('@/lib/types/user').User; role: string }>> {
  const { getUserDocument } = await import('./auth')
  const { getFirestoreInstance } = await import('./config')

  // Query all users where teams map contains this teamId
  const usersRef = collection(getFirestoreInstance(), 'users')
  const q = query(usersRef, where(`teams.${teamId}`, '!=', null))
  const querySnapshot = await getDocs(q)

  const members: Array<{ user: import('@/lib/types/user').User; role: string }> = []

  for (const docSnap of querySnapshot.docs) {
    const data = docSnap.data()
    const userRole = data.teams?.[teamId]
    if (userRole) {
      const user = await getUserDocument(docSnap.id)
      if (user) {
        members.push({ user, role: userRole })
      }
    }
  }

  return members
}
