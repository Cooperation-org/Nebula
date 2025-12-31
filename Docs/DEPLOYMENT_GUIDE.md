# Deployment Guide - Cooperation Toolkit

Complete guide for deploying the Cooperation Toolkit to production.

## Overview

The application deploys to two platforms:

1. **Vercel** - Next.js frontend
2. **Firebase** - Cloud Functions and Firestore Rules

## Step 1: GitHub Secrets (Required for CI/CD)

These secrets are used by GitHub Actions to build and deploy your application.

### Where to Add GitHub Secrets

1. Go to your GitHub repository
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret** for each secret below

### Required GitHub Secrets

#### Firebase Secrets

| Secret Name                | Description                                       | Where to Get                                               |
| -------------------------- | ------------------------------------------------- | ---------------------------------------------------------- |
| `FIREBASE_PROJECT_ID`      | Your Firebase project ID                          | Firebase Console → Project Settings → General → Project ID |
| `FIREBASE_SERVICE_ACCOUNT` | Firebase service account JSON (full JSON content) | See detailed instructions below                            |

**Getting FIREBASE_SERVICE_ACCOUNT:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon → **Project Settings**
4. Go to **Service Accounts** tab
5. Click **Generate New Private Key**
6. Click **Generate Key** (downloads JSON file)
7. **Copy the entire JSON content** from the downloaded file
8. Paste it as the value for `FIREBASE_SERVICE_ACCOUNT` secret in GitHub

#### Vercel Secrets

| Secret Name         | Description                 | Where to Get                    |
| ------------------- | --------------------------- | ------------------------------- |
| `VERCEL_TOKEN`      | Vercel authentication token | See detailed instructions below |
| `VERCEL_ORG_ID`     | Vercel organization ID      | See detailed instructions below |
| `VERCEL_PROJECT_ID` | Vercel project ID           | See detailed instructions below |

**Getting Vercel Credentials:**

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Click your profile → **Settings** → **Tokens**
3. Click **Create Token**
4. Name it (e.g., "GitHub Actions")
5. Copy the token → Add as `VERCEL_TOKEN` secret
6. For Organization ID:
   - Go to **Settings** → **General**
   - Copy **Team ID** → Add as `VERCEL_ORG_ID` secret
7. For Project ID:
   - Go to your project → **Settings** → **General**
   - Copy **Project ID** → Add as `VERCEL_PROJECT_ID` secret

#### Next.js Build Secrets (Firebase Config)

These are needed during the build process in GitHub Actions:

| Secret Name                                | Description                  | Where to Get                                                                 |
| ------------------------------------------ | ---------------------------- | ---------------------------------------------------------------------------- |
| `NEXT_PUBLIC_FIREBASE_API_KEY`             | Firebase API key             | Firebase Console → Project Settings → General → Your apps → Web app → Config |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`         | Firebase auth domain         | Same as above (format: `your-project.firebaseapp.com`)                       |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID`          | Firebase project ID          | Same as above                                                                |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`      | Firebase storage bucket      | Same as above (format: `your-project.appspot.com`)                           |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase messaging sender ID | Same as above                                                                |
| `NEXT_PUBLIC_FIREBASE_APP_ID`              | Firebase app ID              | Same as above                                                                |

**Getting Firebase Config:**

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Click the gear icon → **Project Settings**
4. Scroll to **Your apps** section
5. If you don't have a web app, click **Add app** → **Web** (</> icon)
6. Copy each value from the config object shown

---

## Step 2: Vercel Environment Variables (Runtime)

These variables are used when your Next.js app runs on Vercel.

### Where to Add Vercel Environment Variables

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add each variable below

### Required Vercel Environment Variables

#### Firebase Configuration (Public)

Add all of these (same values as GitHub secrets):

```
NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789012
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789012:web:abcdef123456
```

#### Application URL

```
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Note:** Replace `your-app.vercel.app` with your actual Vercel deployment URL (you'll get this after first deployment).

#### AI Service Configuration

Choose one provider:

**For OpenAI:**

```
AI_PROVIDER=openai
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
```

**For Anthropic:**

```
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
```

**For Google Gemini:**

```
AI_PROVIDER=gemini
GEMINI_API_KEY=your-gemini-api-key
GEMINI_MODEL=gemini-1.5-pro
```

**Getting AI API Keys:**

- **OpenAI**: https://platform.openai.com/api-keys
- **Anthropic**: https://console.anthropic.com/
- **Google Gemini**: https://aistudio.google.com/app/apikey

#### Optional: Firebase Analytics

```
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX
```

---

## Step 3: Firebase Functions Configuration

These are set in Firebase Functions (not in Vercel or GitHub).

### Where to Set Firebase Functions Config

You have two options:

#### Option A: Firebase CLI (Recommended)

```bash
# Set Slack configuration
firebase functions:config:set \
  slack.signing_secret="your-slack-signing-secret" \
  slack.bot_token="xoxb-your-bot-token"

# Set GitHub webhook secret
firebase functions:config:set \
  github.webhook_secret="your-github-webhook-secret"
```

#### Option B: Firebase Console

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Functions** → **Configuration**
4. Click **Environment variables** tab
5. Add each variable below

### Required Firebase Functions Variables

#### Slack Integration

| Variable Name          | Description              | Where to Get |
| ---------------------- | ------------------------ | ------------ |
| `slack.signing_secret` | Slack app signing secret | See below    |
| `slack.bot_token`      | Slack bot OAuth token    | See below    |

**Getting Slack Credentials:**

1. Go to [Slack API](https://api.slack.com/apps)
2. Select your app (or create a new one)
3. **Signing Secret:**
   - Go to **Basic Information** → **App Credentials**
   - Copy **Signing Secret** → Use as `slack.signing_secret`
4. **Bot Token:**
   - Go to **OAuth & Permissions**
   - Scroll to **Bot User OAuth Token**
   - Copy token (starts with `xoxb-`) → Use as `slack.bot_token`
   - If you don't see a token, click **Install to Workspace** first

#### GitHub Integration

| Variable Name           | Description           | Where to Get |
| ----------------------- | --------------------- | ------------ |
| `github.webhook_secret` | GitHub webhook secret | See below    |

**Getting GitHub Webhook Secret:**

1. Generate a secure random string:

   ```bash
   # On Linux/Mac:
   openssl rand -hex 32

   # On Windows PowerShell:
   -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 64 | ForEach-Object {[char]$_})
   ```

2. Use this string as `github.webhook_secret`
3. **Important:** You'll also need to set this same secret in your GitHub webhook settings (if you set up webhooks)

---

## Step 4: Verify Configuration

### Check GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Verify all secrets listed in Step 1 are present

### Check Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project → **Settings** → **Environment Variables**
2. Verify all variables from Step 2 are present
3. Make sure they're set for **Production** environment (and optionally Preview/Development)

### Check Firebase Functions Config

Run this command locally:

```bash
firebase functions:config:get
```

Or check in Firebase Console:

1. Go to Firebase Console → **Functions** → **Configuration**
2. Verify all variables from Step 3 are present

---

## Step 5: Deploy

### Automatic Deployment (via GitHub Actions)

Once all secrets are configured:

1. Push to `main` or `develop` branch
2. GitHub Actions will automatically:
   - Lint and type-check
   - Build Next.js app
   - Build Cloud Functions
   - Deploy to Vercel
   - Deploy to Firebase

### Manual Deployment

If you need to deploy manually:

**Deploy Next.js to Vercel:**

```bash
vercel --prod
```

**Deploy Firebase Functions and Rules:**

```bash
firebase deploy --only functions,firestore:rules
```

---

## Quick Reference Checklist

### GitHub Secrets (Settings → Secrets and variables → Actions)

- [ ] `FIREBASE_PROJECT_ID`
- [ ] `FIREBASE_SERVICE_ACCOUNT` (full JSON)
- [ ] `VERCEL_TOKEN`
- [ ] `VERCEL_ORG_ID`
- [ ] `VERCEL_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_API_KEY`
- [ ] `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- [ ] `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- [ ] `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- [ ] `NEXT_PUBLIC_FIREBASE_APP_ID`

### Vercel Environment Variables (Settings → Environment Variables)

- [ ] All `NEXT_PUBLIC_FIREBASE_*` variables
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] `AI_PROVIDER`
- [ ] `OPENAI_API_KEY` (or `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`)
- [ ] `OPENAI_MODEL` (or `ANTHROPIC_MODEL` or `GEMINI_MODEL`) - optional

### Firebase Functions Config (via CLI or Console)

- [ ] `slack.signing_secret`
- [ ] `slack.bot_token`
- [ ] `github.webhook_secret`

---

## Troubleshooting

### "Missing environment variable" error in Vercel

- Check that all variables are set in Vercel Dashboard → Settings → Environment Variables
- Make sure variables are set for the correct environment (Production/Preview/Development)
- Redeploy after adding variables

### "FIREBASE_SERVICE_ACCOUNT is invalid" error

- Make sure you copied the **entire JSON content** (including all brackets and quotes)
- The JSON should start with `{` and end with `}`
- Don't add extra quotes or formatting

### "Vercel deployment failed"

- Verify `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID` are correct
- Check Vercel dashboard for detailed error logs

### "Firebase Functions deployment failed"

- Verify `FIREBASE_SERVICE_ACCOUNT` JSON is valid
- Check Firebase Console → Functions → Logs for errors
- Ensure Firebase Functions config variables are set correctly

### "Slack bot not responding"

- Verify `slack.signing_secret` and `slack.bot_token` are set in Firebase Functions config
- Check that Slack app is installed to your workspace
- Verify bot has necessary permissions in Slack app settings

---

## Security Best Practices

1. **Never commit secrets** to version control
2. **Rotate secrets regularly** (especially API keys)
3. **Use different secrets** for development and production
4. **Limit access** to GitHub secrets and Vercel environment variables
5. **Monitor usage** of API keys for unexpected activity

---

## Next Steps

After deployment:

1. Test your application at the Vercel URL
2. Test Slack bot commands
3. Verify Firebase Functions are working
4. Check application logs for any errors
5. Set up monitoring and alerts

For more information, see:

- [ENV_VARIABLES.md](./ENV_VARIABLES.md) - Complete environment variables reference
- [README.md](./README.md) - Project documentation
- [AI_SETUP.md](./AI_SETUP.md) - AI service setup guide
