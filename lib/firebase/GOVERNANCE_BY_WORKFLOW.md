# Governance-by-Workflow: Implicit Consent

## Overview

The Cooperation Toolkit implements **governance-by-workflow** patterns to minimize explicit voting and maximize collaborative decision-making. This document describes how implicit consent works and how it's implemented in the system.

## Design Principle

Default governance happens through workflow, not voting:

- **Task approval → implicit consent** (FR30)
- Review objections → pause, not conflict (FR31)
- Committee selection → weighted lottery (no vote) (Epic 9)

Voting is triggered **only if**:

- Objections exceed threshold
- Policy changes are proposed
- Constitutional rules are challenged

## Implicit Consent Implementation

### Story 6B.5: Governance-by-Workflow - Implicit Consent

**Principle**: Task approval through the review process provides implicit consent for governance. No explicit vote is required for routine task completion.

### How It Works

1. **Task Review Process** (Epic 5):
   - Task enters "Review" state
   - Reviewers approve or object
   - All required approvals must be received

2. **COOK Finalization** (Epic 4, Story 4.5):
   - When task reaches "Done" state and all reviews are approved
   - COOK automatically transitions to "Final" state
   - COOK is automatically issued to contributors (Story 6B.4)

3. **Implicit Consent** (FR30):
   - Task approval = implicit consent for governance
   - COOK issuance = governance weight update
   - No explicit vote required for routine task completion

4. **Governance Weight** (Epic 9):
   - Governance weight is automatically recalculated based on COOK issuance
   - Contributors' governance weight increases with COOK they receive
   - This happens automatically through the workflow

### Implementation Details

#### Automatic COOK Issuance

When COOK reaches Final state, it's automatically issued to all contributors:

```typescript
// lib/firebase/tasks.ts - updateTask()
if (updates.state === 'Done' && existingTask.cookValue !== undefined) {
  if (existingTask.cookState === 'Locked') {
    // Check if review exists and is approved
    const review = await getReviewByTaskId(teamId, taskId)

    if (review && canCompleteReview(review)) {
      // All required reviewers approved, proceed with finalization
      updates.cookState = 'Final'

      // Automatically issue COOK to all contributors (FR28, Story 6B.4)
      const { issueCook } = await import('./cookLedger')
      const cookValuePerContributor =
        existingTask.cookValue! / existingTask.contributors.length

      for (const contributorId of existingTask.contributors) {
        await issueCook(
          teamId,
          taskId,
          contributorId,
          cookValuePerContributor,
          existingTask.cookAttribution || 'self'
        )
      }
    }
  }
}
```

#### Implicit Consent Logging

Implicit consent is logged when COOK is issued:

```typescript
// lib/firebase/cookLedger.ts - issueCook()
logger.info('COOK issued', {
  entryId,
  taskId,
  teamId,
  contributorId,
  cookValue,
  attribution,
  timestamp: now
  // Implicit consent is implied by COOK issuance
  // Task approval through review process = implicit consent for governance (FR30)
})
```

#### Task Approval Logging

Task approval through review process is logged:

```typescript
// lib/firebase/reviews.ts - approveReview()
logger.info('Review approved', {
  reviewId,
  taskId,
  teamId,
  reviewerId: currentUser.uid,
  // Approval provides implicit consent for governance (FR30)
  implicitConsent: true
})
```

### Acceptance Criteria (Story 6B.5)

✅ **Given** a task is approved through review process (Epic 5, Story 5.4)

- Reviewers approve the task
- All required approvals are received

✅ **When** COOK is issued (Story 6B.4)

- COOK automatically transitions to Final state
- COOK is automatically issued to contributors

✅ **Then** task approval is treated as implicit consent for governance (FR30)

- No explicit vote is required
- Governance weight updates automatically

✅ **And** no explicit vote is required for routine task completion

- Workflow handles governance automatically
- Voting only triggered for exceptional cases

✅ **And** governance weight updates automatically based on COOK issuance

- COOK ledger entries are created (Epic 8)
- Governance weight calculated from ledger (Epic 9)

✅ **And** implicit consent is logged for transparency

- COOK issuance logged with context
- Review approval logged with implicit consent flag
- Audit trail maintained for all governance actions

### Logging and Transparency

All implicit consent actions are logged:

1. **Review Approval**:
   - Logged in `lib/firebase/reviews.ts` - `approveReview()`
   - Includes `implicitConsent: true` flag
   - Records reviewer, task, and timestamp

2. **COOK Issuance**:
   - Logged in `lib/firebase/cookLedger.ts` - `issueCook()`
   - Records task approval context
   - Links COOK issuance to task approval

3. **Task Completion**:
   - Logged in `lib/firebase/tasks.ts` - `updateTask()`
   - Records state transition to Done
   - Links to review approval and COOK issuance

### Benefits

1. **Reduced Friction**: No need for explicit votes on routine tasks
2. **Faster Decisions**: Workflow handles governance automatically
3. **Transparency**: All actions logged for audit trail
4. **Collaborative**: Focus on work, not voting
5. **Accountable**: Full audit trail maintained

### When Voting Is Required

Voting is triggered **only if**:

1. **Objections Exceed Threshold**:
   - Multiple reviewers object
   - Objections cannot be resolved through workflow
   - Escalation to governance process required

2. **Policy Changes**:
   - Changes to team policies
   - Changes to COOK valuation rules
   - Changes to review requirements

3. **Constitutional Rules Challenged**:
   - Changes to team structure
   - Changes to role definitions
   - Changes to governance model

### Future Enhancements (Epic 9)

- **Governance Weight Calculation**: Automatic calculation from COOK ledger
- **Weighted Lottery**: Committee selection based on governance weight
- **Voting System**: Explicit voting for exceptional cases
- **Dispute Resolution**: Formal process for escalated conflicts

## Related Stories

- **Epic 4**: COOK Valuation System
- **Epic 5**: Peer Review Workflow
- **Story 6B.4**: Automatically Issue COOK Upon Finalization
- **Story 6B.5**: Governance-by-Workflow - Implicit Consent (this document)
- **Story 6B.6**: Governance-by-Workflow - Objection Windows (future)
- **Epic 8**: COOK Ledger & Attestations
- **Epic 9**: Governance & Voting System

## References

- **PRD Section 6.2.4**: Governance-by-Workflow (Vote Minimization)
- **FR30**: Task approval provides implicit consent for governance
- **FR31**: Review objections pause workflow, not create conflict
- **Architecture Decision**: Governance-by-Workflow Pattern
