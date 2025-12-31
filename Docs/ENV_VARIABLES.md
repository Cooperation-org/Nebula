# Environment Variables Reference

Complete list of all environment variables required for the Cooperation Toolkit.

## Quick Setup

1. Copy `.env.example` to `.env.local` (if it exists)
2. Fill in all required variables
3. For Firebase Functions, set variables via `firebase functions:config:set`

## Required Environment Variables

### Firebase Configuration (Next.js - Client)

These are **public** variables (safe to expose in client code):

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

**Optional:**
```bash
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX  # Firebase Analytics
```

**Where to get:** Firebase Console > Project Settings > General > Your apps > Web app config

---

### AI Service Configuration (Next.js - Server)

**Required for AI features** (task extraction, review assistance, retrospectives):

```bash
# Choose provider (default: 'openai')
AI_PROVIDER=openai  # or 'anthropic' or 'gemini'

# OpenAI (if AI_PROVIDER=openai)
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini  # Optional, defaults to 'gpt-4o-mini'

# Anthropic (if AI_PROVIDER=anthropic)
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022  # Optional, defaults to 'claude-3-5-sonnet-20241022'

# Google Gemini (if AI_PROVIDER=gemini)
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-pro  # Optional, defaults to 'gemini-1.5-pro'
# Available models: gemini-1.5-pro, gemini-1.5-flash, gemini-pro, gemini-pro-vision

# Legacy support (backward compatibility)
AI_API_KEY=sk-...  # Optional, used if provider-specific key not found
```

**Where to get:**
- OpenAI: https://platform.openai.com/api-keys
- Anthropic: https://console.anthropic.com/
- Google Gemini: https://aistudio.google.com/app/apikey

---

### Application URL (Next.js - Client)

**Required for Slack notifications** (action links):

```bash
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
# Or for local development:
# NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Firebase Functions Environment Variables

These are set in **Firebase Functions**, not Next.js. Use `firebase functions:config:set` or Firebase Console.

### Slack Integration

**Required for Slack bot features:**

```bash
# Set via: firebase functions:config:set slack.signing_secret="..." slack.bot_token="..."
SLACK_SIGNING_SECRET=your-slack-signing-secret
SLACK_BOT_TOKEN=xoxb-your-bot-token
```

**Where to get:**
- `SLACK_SIGNING_SECRET`: Slack App > Basic Information > App Credentials > Signing Secret
- `SLACK_BOT_TOKEN`: Slack App > OAuth & Permissions > Bot User OAuth Token (starts with `xoxb-`)

**How to set:**
```bash
firebase functions:config:set slack.signing_secret="your-secret" slack.bot_token="xoxb-your-token"
```

---

### GitHub Integration

**Required for GitHub integration features:**

```bash
# Set via: firebase functions:config:set github.webhook_secret="..."
GITHUB_WEBHOOK_SECRET=your-github-webhook-secret
```

**Where to get:**
- Create a secure random string (e.g., `openssl rand -hex 32`)
- Set this in GitHub Webhook settings and Firebase Functions config

**How to set:**
```bash
firebase functions:config:set github.webhook_secret="your-secret"
```

**Optional (if needed for GitHub API calls):**
```bash
GITHUB_TOKEN=ghp_your-github-personal-access-token
```

---

## Optional: Development/Testing

### Firebase Emulator (Local Development)

```bash
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost
NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT=5001
```

---

## Complete .env.local Example

Create a `.env.local` file in the project root:

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your-firebase-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456

# AI Service
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini

# Application URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Firebase Emulator (Development only)
# NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true
# NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost
# NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT=5001
```

---

## Firebase Functions Configuration

Set these via Firebase CLI or Console:

```bash
# Set Slack configuration
firebase functions:config:set \
  slack.signing_secret="your-slack-signing-secret" \
  slack.bot_token="xoxb-your-bot-token"

# Set GitHub configuration
firebase functions:config:set \
  github.webhook_secret="your-github-webhook-secret"

# View current configuration
firebase functions:config:get
```

---

## Deployment Platforms

### Vercel (Next.js)

1. Go to Vercel Dashboard > Your Project > Settings > Environment Variables
2. Add all `NEXT_PUBLIC_*` variables
3. Add all non-public variables (AI keys, etc.)
4. Redeploy

### Firebase Functions

1. Go to Firebase Console > Functions > Configuration
2. Add environment variables under "Environment variables" tab
3. Or use CLI: `firebase functions:config:set key="value"`

---

## Security Notes

1. **Never commit** `.env.local` or `.env` to version control
2. **Safe to commit**: `.env.example` (contains no secrets)
3. **Public variables**: `NEXT_PUBLIC_*` are exposed to client code
4. **Private variables**: All others are server-side only
5. **Firebase Functions**: Set via `firebase functions:config:set` (encrypted at rest)

---

## Verification

After setting up environment variables:

1. **Next.js**: Restart dev server (`npm run dev`)
2. **Firebase Functions**: Redeploy functions (`firebase deploy --only functions`)
3. **Check logs**: Verify no "missing environment variable" errors

---

## Troubleshooting

### "Firebase configuration is missing"
- Ensure all `NEXT_PUBLIC_FIREBASE_*` variables are set
- Restart Next.js dev server after adding variables

### "AI API key not configured"
- Set `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` based on `AI_PROVIDER`
- Ensure variable is set in deployment platform (Vercel, etc.)

### "SLACK_BOT_TOKEN not configured"
- Set via `firebase functions:config:set slack.bot_token="..."`
- Redeploy functions after setting

### "GITHUB_WEBHOOK_SECRET not configured"
- Set via `firebase functions:config:set github.webhook_secret="..."`
- Ensure same secret is set in GitHub webhook settings

