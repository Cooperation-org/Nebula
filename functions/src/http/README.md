# HTTP Functions

HTTP functions handle external API integrations and webhooks.

## Structure

HTTP functions are organized by integration:
- `slack/` - Slack bot webhooks and commands
- `github/` - GitHub webhook handlers

## Pattern

HTTP functions should:
1. Validate authentication/authorization
2. Parse and validate request data (use Zod schemas)
3. Perform business logic or delegate to shared utilities
4. Return structured responses with proper status codes
5. Handle errors gracefully with structured error responses

## Example Structure

```typescript
import { onRequest } from 'firebase-functions/v2/https'
import { z } from 'zod'

const requestSchema = z.object({
  // Define request schema
})

export const exampleWebhook = onRequest(async (request, response) => {
  try {
    // 1. Validate request
    const data = requestSchema.parse(request.body)
    
    // 2. Perform business logic
    // ...
    
    // 3. Return success response
    response.status(200).json({ success: true, data: {} })
  } catch (error) {
    // 4. Handle errors
    response.status(400).json({ success: false, error: { message: '...', code: '...' } })
  }
})
```

