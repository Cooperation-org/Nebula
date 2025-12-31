'use client'

import { create } from 'zustand'
import { createUISlice, type UISlice } from './slices/uiSlice'

// Main app store interface combining all slices
export interface AppStore extends UISlice {
  // activeTeamId is in UI slice and exposed at root level
  // Additional slices will be added here as features are implemented:
  // tasksSlice, cookSlice, reviewsSlice, governanceSlice, teamsSlice
}

// Create main store combining all slices
// For now, we use UI slice which includes activeTeamId at root level
// Additional slices will be merged as features are implemented
export const useAppStore = create<AppStore>()((...a) => ({
  ...createUISlice(...a)
}))

// Export selectors for optimized re-renders
export const useActiveTeamId = () => useAppStore(state => state.activeTeamId)
export const useIsLoadingTasks = () => useAppStore(state => state.isLoadingTasks)
export const useIsLoadingCookLedger = () =>
  useAppStore(state => state.isLoadingCookLedger)
export const useIsLoadingGovernanceProposals = () =>
  useAppStore(state => state.isLoadingGovernanceProposals)
