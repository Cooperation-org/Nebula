# GitHub Integration

This directory contains the GitHub integration code for syncing GitHub Issues and Projects with Toolkit tasks.

## Overview

The GitHub integration enables bidirectional sync between GitHub Issues/Projects and Toolkit tasks, with Toolkit as the canonical source of truth (FR6, FR18).

## Files

- **`handle-github-webhook.ts`**: Main webhook handler that receives GitHub webhook events
- **`github-mapper.ts`**: Maps GitHub Issue fields to Task schema fields
- **`github-user-mapper.ts`**: Maps GitHub usernames to Toolkit user IDs
- **`github-team-mapper.ts`**: Maps GitHub repositories to Toolkit team IDs

## Setup

### 1. Configure GitHub Webhook

1. Go to your GitHub repository settings
2. Navigate to **Webhooks** > **Add webhook**
3. Set the **Payload URL** to: `https://<your-region>-<your-project>.cloudfunctions.net/handleGithubWebhook`
4. Set **Content type** to: `application/json`
5. Set **Secret** to a secure random string (store this in `GITHUB_WEBHOOK_SECRET`)
6. Select events:
   - **Issues** (for issue creation/updates)
   - **Projects** (for project card movements)
   - **Project cards** (for column changes)

### 2. Configure Environment Variables

Add to your Firebase Functions `.env` or Firebase Console:

```bash
GITHUB_WEBHOOK_SECRET=your-webhook-secret-here
GITHUB_REPO_TEAM_MAPPING=owner/repo:teamId,owner2/repo2:teamId2
```

### 3. Configure User Mapping

Users need to link their GitHub username to their Toolkit account:

1. Users should add `githubUsername` field to their user document
2. This can be done via profile settings or Cloud Function
3. Format: `githubUsername: "octocat"` (without @)

### 4. Configure Team Mapping

Map GitHub repositories to Toolkit teams using one of:

**Option A: Firestore Collection (Recommended)**
- Create documents in `githubRepoMappings` collection
- Document ID: repository full name (e.g., `owner/repo`)
- Fields: `teamId`, `repository`, `repositoryOwner`, `createdAt`, `updatedAt`

**Option B: Environment Variable**
- Set `GITHUB_REPO_TEAM_MAPPING` environment variable
- Format: `owner/repo:teamId,owner2/repo2:teamId2`

## Field Mapping

### Required GitHub Fields (FR11)

- **Issue ID**: Mapped to `github.issueId`
- **Project Item Status**: Mapped to task `state` (Story 7.2)
- **Assignee(s)**: Mapped to `contributors` array
- **Linked Repository**: Mapped to `github.repository` and `github.repositoryOwner`
- **COOK metadata**: Extracted from issue body (`COOK: 100`) or labels (`cook:100`)
- **Reviewer(s)**: Extracted from labels (`reviewer:@username`)

### Optional Fields (FR12)

- **COOK size class**: Extracted from labels (`cook:s`, `cook:m`, `cook:l`, `cook:xl`)
- **Task type**: Extracted from labels (`type:build`, `type:ops`, `type:governance`, `type:research`)

## Label Conventions

GitHub Issues use labels to provide metadata:

- **COOK value**: `cook:100` (label)
- **COOK size**: `cook:s`, `cook:m`, `cook:l`, `cook:xl` (labels)
- **Task type**: `type:build`, `type:ops`, `type:governance`, `type:research` (labels)
- **Reviewers**: `reviewer:@username` (labels)

## Webhook Events Handled

- **`issues`**: Issue created, edited, closed, assigned, etc.
- **`project_card`**: Project card moved between columns (Story 7.2)
- **`project`**: Project created, updated, deleted

## Security

- **Webhook Signature Verification**: All webhooks are verified using HMAC SHA-256
- **Signature Header**: `X-Hub-Signature-256`
- **Secret**: Stored in `GITHUB_WEBHOOK_SECRET` environment variable

## Error Handling

- Invalid webhook signatures return `401 Unauthorized`
- Missing team mappings are logged and skipped
- Missing user mappings are logged and skipped (task created without contributor)
- All errors are logged with structured logging

## Testing

### Local Testing

1. Use `ngrok` or similar to expose local server
2. Point GitHub webhook to ngrok URL
3. Test with GitHub webhook payloads

### Production Testing

1. Create a test issue in GitHub
2. Verify task is created in Firestore
3. Update issue and verify task is updated
4. Check logs for any errors

## Related Stories

- **Story 7.1**: Map GitHub Issues to Tasks (this implementation)
- **Story 7.2**: Sync GitHub Project Columns to Task States
- **Story 7.3**: Enforce Allowed Column Transitions in GitHub
- **Story 7.6**: Handle GitHub Outage with Graceful Degradation

## References

- **PRD Section 6.2.1**: GitHub Mapping Specification
- **FR11**: Required GitHub fields
- **FR12**: Optional GitHub fields
- **FR6**: Toolkit state is canonical
- **FR18**: Toolkit state takes precedence in conflicts

