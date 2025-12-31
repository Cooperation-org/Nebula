# Slack Bot Setup Guide

Complete guide for setting up the Cooperation Toolkit Slack bot.

## Quick Setup

### Option 1: Using Slack App Manifest (Recommended)

1. **Create App from Manifest:**
   - Go to https://api.slack.com/apps
   - Click **Create New App** → **From an app manifest**
   - Select your workspace
   - Copy and paste the contents of `slack-app-manifest.json`
   - Click **Create**

2. **Install App to Workspace:**
   - Go to **OAuth & Permissions** in the left sidebar
   - Click **Install to Workspace**
   - Review permissions and click **Allow**
   - Copy the **Bot User OAuth Token** (starts with `xoxb-`)

3. **Get Signing Secret:**
   - Go to **Basic Information** → **App Credentials**
   - Copy the **Signing Secret**

4. **Configure Slash Command:**
   - Go to **Slash Commands** in the left sidebar
   - Click **Create New Command**
   - Command: `/cook`
   - Request URL: `https://handleslackcommands-ikjwsjcgpq-uc.a.run.app`
   - Short description: `Cooperation Toolkit commands`
   - Usage hint: `help | create | list | update | move | task | value | my-cook | assign | review | vote | object`
   - Click **Save**

5. **Set Environment Variables:**
   ```bash
   firebase functions:config:set \
     slack.signing_secret="your-signing-secret" \
     slack.bot_token="xoxb-your-bot-token"
   ```

### Option 2: Manual Setup

1. **Create App:**
   - Go to https://api.slack.com/apps
   - Click **Create New App** → **From scratch**
   - App name: `Cooperation Toolkit`
   - Select your workspace
   - Click **Create App**

2. **Configure Bot User:**
   - Go to **App Home** → **Your App's Presence in Slack**
   - Under **App Display Name**, enter: `Cooperation Toolkit`
   - Under **Default Username**, enter: `cooperation-toolkit`
   - Click **Save Changes**

3. **Add Bot Token Scopes:**
   - Go to **OAuth & Permissions** in the left sidebar
   - Scroll to **Scopes** → **Bot Token Scopes**
   - Add the following scopes:
     - `chat:write` - Send messages as the bot
     - `im:write` - Send direct messages
     - `commands` - Add slash commands
   - Click **Save Changes**

4. **Install App to Workspace:**
   - Scroll to the top of **OAuth & Permissions**
   - Click **Install to Workspace**
   - Review permissions and click **Allow**
   - Copy the **Bot User OAuth Token** (starts with `xoxb-`)

5. **Get Signing Secret:**
   - Go to **Basic Information** → **App Credentials**
   - Copy the **Signing Secret**

6. **Create Slash Command:**
   - Go to **Slash Commands** in the left sidebar
   - Click **Create New Command**
   - Fill in:
     - **Command**: `/cook`
     - **Request URL**: `https://handleslackcommands-ikjwsjcgpq-uc.a.run.app`
     - **Short Description**: `Cooperation Toolkit commands`
     - **Usage Hint**: `help | create | list | update | move | task | value | my-cook | assign | review | vote | object`
   - Click **Save**

7. **Set Environment Variables:**

   ```bash
   firebase functions:config:set \
     slack.signing_secret="your-signing-secret" \
     slack.bot_token="xoxb-your-bot-token"
   ```

8. **Redeploy Functions:**
   ```bash
   firebase deploy --only functions
   ```

## Required Permissions (Scopes)

The bot requires the following OAuth scopes:

- **`chat:write`** - Send messages to channels and DMs
- **`im:write`** - Send direct messages to users
- **`commands`** - Add slash commands

## Function URL

Your Slack command handler is deployed at:

```
https://handleslackcommands-ikjwsjcgpq-uc.a.run.app
```

## Testing

1. **Test Slash Command:**
   - In any Slack channel or DM, type: `/cook help`
   - You should see a help message with all available commands

2. **Test Task Creation:**
   - Type: `/cook create "Test task" -description "This is a test"`
   - You should receive a confirmation with the task ID

3. **Test Notifications:**
   - Create a task and assign it to yourself
   - You should receive a Slack DM notification

## User Setup

For users to use the bot:

1. **Link Slack Account:**
   - Users must link their Slack account in the web dashboard
   - Go to Profile → Settings → Link Slack Account
   - The system will store their Slack user ID

2. **Use Commands:**
   - Once linked, users can use `/cook` commands in Slack
   - Notifications will be sent to their Slack DMs

## Troubleshooting

### "Command not found"

- Verify the slash command is created in Slack App settings
- Check that the Request URL is correct
- Ensure the app is installed to your workspace

### "Unauthorized" error

- Verify `SLACK_SIGNING_SECRET` is set correctly
- Check that the signing secret matches your Slack app
- Ensure functions are redeployed after setting config

### "SLACK_BOT_TOKEN not configured"

- Verify `SLACK_BOT_TOKEN` is set in Firebase Functions config
- Check that the bot token starts with `xoxb-`
- Ensure the bot is installed to your workspace

### Notifications not working

- Verify users have linked their Slack accounts
- Check that `SLACK_BOT_TOKEN` is configured
- Ensure the bot has `chat:write` and `im:write` scopes
- Check Firebase Functions logs for errors

### "User not found" error

- User must link their Slack account in the web dashboard
- Slack user ID must be stored in `users/{userId}.slackUserId`
- Verify the Slack user ID matches between Slack and Firebase

## Security Notes

- **Signing Secret**: Never commit this to version control
- **Bot Token**: Keep this secure and rotate if compromised
- **Request Verification**: All requests are verified using Slack's signature verification
- **Timestamp Validation**: Prevents replay attacks (requests older than 5 minutes are rejected)

## Next Steps

After setup:

1. Test basic commands (`/cook help`, `/cook create`)
2. Link your Slack account in the web dashboard
3. Test notifications by creating and assigning tasks
4. Share the bot with your team members

For more information, see:

- [Slack API Documentation](https://api.slack.com/)
- [Firebase Functions Documentation](https://firebase.google.com/docs/functions)
- [Slack Bot Integration README](./functions/src/http/slack/README.md)
