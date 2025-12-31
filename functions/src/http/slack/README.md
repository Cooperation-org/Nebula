# Slack Bot Integration

## Overview

Slack bot integration for the Cooperation Toolkit, providing a primary interface for users to interact with the system via Slack commands.

## Story 11A.1: Set Up Slack Bot with Basic Commands

### Configuration

1. **Slack App Setup**:
   - Create a Slack app at https://api.slack.com/apps
   - Enable Slash Commands
   - Configure command: `/cook`
   - Set Request URL to: `https://[region]-[project-id].cloudfunctions.net/handleSlackCommands`

2. **Environment Variables**:
   - `SLACK_SIGNING_SECRET`: Slack app signing secret (from Slack app settings)

3. **User Authentication**:
   - Users must link their Slack account in the web dashboard
   - Slack user ID is stored in user document: `users/{userId}.slackUserId`

### Commands

#### `/cook help`

Shows help message with available commands.

#### `/cook create "Task title" -description "Description"`

Creates a new task in the user's active team.

**Example:**

```
/cook create "Fix login bug" -description "User cannot log in with email"
```

#### `/cook list`

Lists user's active tasks (up to 10).

### Security

- **Signature Verification**: All requests are verified using Slack's signature verification
- **Timestamp Check**: Prevents replay attacks (requests older than 5 minutes are rejected)
- **Firebase Auth**: Users must be authenticated and have their Slack account linked

### Implementation Details

- **Function**: `handleSlackCommands` (HTTP Cloud Function)
- **Authentication**: Firebase Auth via Slack user ID lookup
- **Error Handling**: Graceful error messages returned to user
- **Logging**: All commands and errors are logged for debugging

## Story 11B.4: Real-Time Notifications via Slack

### Configuration

Set the following environment variables in Firebase Functions:

- `SLACK_BOT_TOKEN`: Your Slack bot's OAuth token (xoxb-...) - Required for notifications
- `NEXT_PUBLIC_APP_URL`: Your web application URL (for notification action links)

### Notification Events

The Slack bot sends real-time notifications for:

- **Task Assigned**: When a user is assigned to a task
- **Review Requested**: When a task moves to Review state and reviewers are notified
- **COOK Issued**: When a contributor earns COOK for completing a task
- **Governance Proposal Created**: When a new governance proposal is created
- **Voting Started**: When voting begins for a governance proposal

### Notification Setup

1. **User Slack Account Linking**: Users must link their Slack account in the web dashboard
   - Slack user ID is stored in user document: `users/{userId}.slackUserId`
   - Notifications are only sent to users with linked Slack accounts

2. **Firestore Triggers**: Notifications are triggered automatically via Firestore triggers:
   - `onTaskAssigned`: Triggers when task contributors change
   - `onReviewRequested`: Triggers when task moves to Review state
   - `onCookIssued`: Triggers when COOK ledger entry is created
   - `onGovernanceProposalCreated`: Triggers when governance proposal is created
   - `onVotingStarted`: Triggers when voting instance is created

3. **Notification Format**: Notifications include:
   - Clear title and message
   - Action buttons linking to web UI
   - Rich formatting with Slack blocks

### Notification Preferences

Currently, all notifications are sent to users with linked Slack accounts. Future enhancements will include:

- Per-event notification preferences
- Quiet hours
- Notification frequency controls

## Story 11B.5: Complete Slack Integration

Slack integration is **COMPLETE** and serves as the **PRIMARY INTERFACE** for the Cooperation Toolkit.

### Complete Feature Coverage

**All core operations are available via Slack:**

- ✅ Task management (create, list, view, update, move)
- ✅ COOK tracking (view, assign, view ledger)
- ✅ Review workflow (approve, object, comment)
- ✅ Governance actions (vote, object)
- ✅ Real-time notifications (all events)

### Primary vs Secondary Interface

**Slack (Primary Interface):**

- All day-to-day operations
- Quick commands and interactions
- Real-time notifications
- Mobile-friendly

**Web UI (Secondary Interface):**

- Complex workflows (multi-step processes)
- Transparency (public boards, audit logs)
- Detailed analytics and reporting
- Configuration and administration
- Visual board management

See `INTEGRATION_COMPLETE.md` for full implementation status and verification.

## Future Enhancements

- Team selection in commands
- Interactive buttons and modals
- Event subscriptions (task updates, notifications)
- Rich message formatting
- Task details view
- Notification preferences configuration
