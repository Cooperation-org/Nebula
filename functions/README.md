# Firebase Cloud Functions

Cloud Functions for the Nebula project.

## Structure

```
functions/
├── src/
│   ├── index.ts              # Entry point - exports all functions
│   ├── http/                 # HTTP functions (external APIs)
│   │   ├── slack/            # Slack bot webhooks
│   │   └── github/           # GitHub webhook handlers
│   ├── triggers/             # Firestore trigger functions
│   │   ├── tasks/            # Task lifecycle triggers
│   │   ├── cook/             # COOK ledger triggers
│   │   ├── reviews/          # Review workflow triggers
│   │   └── governance/       # Governance proposal triggers
│   └── shared/               # Shared utilities
│       ├── logger.ts         # Structured logging
│       ├── errorHandling.ts  # Error handling utilities
│       ├── validation.ts     # Shared validation schemas
│       ├── firestore.ts      # Firestore helpers
│       └── auth.ts           # Auth utilities (Admin SDK)
├── package.json
├── tsconfig.json
└── README.md
```

## Development

### Prerequisites

1. Install Firebase CLI:

   ```bash
   npm install -g firebase-tools
   ```

2. Install dependencies:
   ```bash
   cd functions
   npm install
   ```

### Local Development

Build functions:

```bash
npm run build
```

Run emulator:

```bash
npm run serve
```

This starts the Firebase emulator with functions enabled.

### Deployment

Deploy all functions:

```bash
npm run deploy
```

Deploy specific function:

```bash
firebase deploy --only functions:functionName
```

## Function Types

### HTTP Functions

HTTP functions handle external API integrations:

- Slack webhooks and commands
- GitHub webhooks
- Public API endpoints

### Firestore Triggers

Trigger functions handle internal workflows:

- Task state transitions
- COOK ledger updates
- Review workflow automation
- Governance proposal processing

## Environment Variables

Set environment variables for functions:

```bash
firebase functions:config:set slack.token="your-token"
firebase functions:config:get
```

Or use `.env` file for local development (not committed to git).

## Logging

Use structured logging from `shared/logger.ts`:

```typescript
import { logger } from '../shared/logger'

logger.info('Task created', { teamId, taskId, userId })
logger.error('Error occurred', { error, metadata })
```

## Error Handling

Functions should handle errors gracefully:

- HTTP functions: Return structured error responses
- Trigger functions: Log errors, don't throw (to avoid retry loops)
