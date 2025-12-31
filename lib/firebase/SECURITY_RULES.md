# Firestore Security Rules

This document describes the Firestore security rules for the Nebula project.

## File Location

Security rules are defined in `firestore.rules` at the project root.

## Current Rules

### Users Collection (`users/{userId}`)

**Read Access:**
- Users can read their own user document

**Create Access:**
- Users can create their own user document during sign up
- Document ID must match authenticated user's UID
- Required fields must be present: `displayName`, `email`, `teams`, `createdAt`, `updatedAt`

**Update Access:**
- Users can update their own profile fields: `displayName`, `email`, `photoURL`, `updatedAt`
- Users cannot modify the `teams` map directly (only Cloud Functions can modify teams)
- Required fields cannot be removed
- Field types must be validated

**Delete Access:**
- Users cannot delete their own documents (deletion handled by Cloud Functions if needed)

## Helper Functions

The rules file includes helper functions for maintainability:

- `isAuthenticated()` - Checks if user is authenticated
- `isOwnUser(userId)` - Checks if user is accessing their own document
- `getUserData(userId)` - Gets user document data (for read operations)

## Deployment

### Prerequisites

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login to Firebase:
   ```bash
   firebase login
   ```

3. Initialize Firebase in project (if not already done):
   ```bash
   firebase init firestore
   ```
   - Select your Firebase project
   - Use existing `firestore.rules` file

### Deploy Rules

Deploy security rules to Firebase:

```bash
firebase deploy --only firestore:rules
```

### Test Rules Locally

Test rules using Firebase emulator:

```bash
# Start emulator
firebase emulators:start --only firestore

# In another terminal, run tests
npm test
```

### Validate Rules

Validate rules syntax before deploying:

```bash
firebase deploy --only firestore:rules --dry-run
```

## Future Rules

Additional security rules will be added incrementally as collections are created:

- **Teams Collection** (`teams/{teamId}`) - Team metadata and settings
- **Tasks Subcollection** (`teams/{teamId}/tasks/{taskId}`) - Task documents
- **COOK Ledger Subcollection** (`teams/{teamId}/cookLedger/{entryId}`) - Append-only COOK entries
- **Reviews Subcollection** (`teams/{teamId}/reviews/{reviewId}`) - Review documents
- **Attestations Collection** (`attestations/{attestationId}`) - Portable attestation records
- **Governance Proposals Collection** (`governanceProposals/{proposalId}`) - Governance proposals

## Security Best Practices

1. **Database-Level Enforcement**: All permission checks are in Firestore security rules, not just client-side
2. **Helper Functions**: Use helper functions to keep rules DRY and maintainable
3. **Default Deny**: Default deny all access, then explicitly allow what's needed
4. **Field Validation**: Validate field types and required fields in rules
5. **Team Isolation**: Team-specific data in subcollections for natural isolation
6. **Cloud Functions**: Use Cloud Functions for operations that require elevated permissions (e.g., modifying teams map)

## Testing

Security rules should be tested using Firebase emulator suite. Test cases should verify:

- Users can read their own documents
- Users cannot read other users' documents
- Users can update their own profile fields
- Users cannot modify restricted fields (e.g., teams map)
- Unauthenticated users cannot access any documents

