# Firestore Trigger Functions

Trigger functions handle internal workflows triggered by Firestore document changes.

## Structure

Trigger functions are organized by domain:
- `tasks/` - Task lifecycle triggers (on-task-created, on-task-updated, etc.)
- `cook/` - COOK ledger triggers (on-cook-issued, etc.)
- `reviews/` - Review workflow triggers
- `governance/` - Governance proposal triggers

## Pattern

Trigger functions should:
1. Validate document data structure
2. Perform business logic (COOK calculations, state transitions, etc.)
3. Update related documents atomically (use transactions)
4. Log actions with structured logging
5. Handle errors gracefully (don't throw - log and continue)

## Example Structure

```typescript
import { onDocumentCreated } from 'firebase-functions/v2/firestore'
import { logger } from '../shared/logger'

export const onTaskCreated = onDocumentCreated(
  'teams/{teamId}/tasks/{taskId}',
  async (event) => {
    try {
      const taskData = event.data?.data()
      const { teamId, taskId } = event.params
      
      // Validate data
      if (!taskData) {
        logger.error('Task data missing', { teamId, taskId })
        return
      }
      
      // Perform business logic
      // ...
      
      logger.info('Task created', { teamId, taskId })
    } catch (error) {
      logger.error('Error in onTaskCreated', { error, teamId, taskId })
    }
  }
)
```

