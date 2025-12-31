# Shared Utilities

Shared utilities used across Cloud Functions.

## Structure

- `logger.ts` - Structured logging utility
- `errorHandling.ts` - Error handling utilities
- `validation.ts` - Shared validation schemas
- `firestore.ts` - Firestore helper functions
- `auth.ts` - Authentication utilities (Firebase Admin SDK)

## Usage

Import shared utilities in functions:

```typescript
import { logger } from '../shared/logger'
import { validateRequest } from '../shared/validation'
import { getFirestoreInstance } from '../shared/firestore'
```
