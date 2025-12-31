import { StateCreator } from 'zustand'

export interface UIState {
  isLoadingTasks: boolean
  isLoadingCookLedger: boolean
  isLoadingGovernanceProposals: boolean
  activeTeamId: string | null
}

export interface UIActions {
  setActiveTeamId: (teamId: string | null) => void
  setIsLoadingTasks: (loading: boolean) => void
  setIsLoadingCookLedger: (loading: boolean) => void
  setIsLoadingGovernanceProposals: (loading: boolean) => void
}

export type UISlice = UIState & UIActions

// UI slice creator function
export const createUISlice: StateCreator<UISlice> = (set) => ({
  // State
  isLoadingTasks: false,
  isLoadingCookLedger: false,
  isLoadingGovernanceProposals: false,
  activeTeamId: null,

  // Actions
  setActiveTeamId: (teamId) => set({ activeTeamId: teamId }),
  setIsLoadingTasks: (loading) => set({ isLoadingTasks: loading }),
  setIsLoadingCookLedger: (loading) => set({ isLoadingCookLedger: loading }),
  setIsLoadingGovernanceProposals: (loading) =>
    set({ isLoadingGovernanceProposals: loading })
})

