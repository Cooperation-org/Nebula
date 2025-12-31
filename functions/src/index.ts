/**
 * Firebase Cloud Functions Entry Point
 *
 * This file exports all HTTP functions and Firestore triggers.
 *
 * Structure:
 * - HTTP functions: External APIs (Slack, GitHub webhooks)
 * - Firestore triggers: Internal workflows (task state changes, COOK issuance, etc.)
 */

// HTTP Functions (External APIs)
// Import and export HTTP functions here as they are created
export { handleGithubWebhook } from './http/github/handle-github-webhook'
export { detectTaskDesync, reconcileTaskDesync } from './http/github/reconcile-desync'
export { computeMerkleHash } from './http/attestations/compute-merkle-hash'
export { handleSlackCommands } from './http/slack/handle-slack-commands'

// Firestore Triggers (Internal Workflows)
// Import and export trigger functions here as they are created
export { onTaskStateChanged } from './triggers/on-task-state-changed'
export { onAttestationCreated } from './triggers/on-attestation-created'
export { onTaskAssigned } from './triggers/on-task-assigned'
export { onTaskMoved } from './triggers/on-task-moved'
export { onReviewRequested } from './triggers/on-review-requested'
export { onReviewInitiated } from './triggers/on-review-initiated'
export { onReviewApproved } from './triggers/on-review-approved'
export { onReviewObjected } from './triggers/on-review-objected'
export { onReviewEscalated } from './triggers/on-review-escalated'
export { onCookIssued } from './triggers/on-cook-issued'
export { onGovernanceProposalCreated } from './triggers/on-governance-proposal-created'
export { onVotingStarted } from './triggers/on-voting-started'
export { onCommitteeSelected } from './triggers/on-committee-selected'
export { onBoardVisibilityChanged } from './triggers/on-board-visibility-changed'

// Scheduled Functions (Periodic Tasks)
// Import and export scheduled functions here as they are created
export { processGithubSyncQueue } from './scheduled/process-github-sync-queue'
