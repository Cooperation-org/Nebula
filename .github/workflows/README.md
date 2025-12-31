# CI/CD Workflows

This directory contains GitHub Actions workflows for automated testing, building, and deployment.

## Workflows

### `deploy.yml`

Unified CI/CD pipeline that:
- Lints and type-checks code
- Builds Next.js application
- Builds Cloud Functions
- Deploys to Vercel (Next.js)
- Deploys to Firebase (Cloud Functions and Firestore Rules)

## Setup

### Required GitHub Secrets

Configure the following secrets in your GitHub repository settings:

#### Firebase Secrets
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_SERVICE_ACCOUNT` - Firebase service account JSON (for deployment)

#### Vercel Secrets
- `VERCEL_TOKEN` - Vercel authentication token
- `VERCEL_ORG_ID` - Vercel organization ID
- `VERCEL_PROJECT_ID` - Vercel project ID

#### Next.js Environment Variables (for build)
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

### Getting Firebase Service Account

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Go to **Project Settings** → **Service Accounts**
4. Click **Generate New Private Key**
5. Copy the JSON content and add it as `FIREBASE_SERVICE_ACCOUNT` secret

### Getting Vercel Credentials

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Go to **Settings** → **Tokens**
3. Create a new token and add it as `VERCEL_TOKEN`
4. Get your organization ID and project ID from Vercel dashboard
5. Add them as `VERCEL_ORG_ID` and `VERCEL_PROJECT_ID` secrets

## Workflow Triggers

The workflow runs on:
- Push to `main` or `develop` branches (full deployment)
- Pull requests to `main` or `develop` branches (lint and build only, no deployment)

## Deployment Strategy

- **Pull Requests**: Only lint, type-check, and build (no deployment)
- **Push to develop**: Deploy to Vercel preview and Firebase staging
- **Push to main**: Deploy to Vercel production and Firebase production

## Manual Deployment

You can also trigger deployments manually:

1. Go to **Actions** tab in GitHub
2. Select **Deploy** workflow
3. Click **Run workflow**
4. Select branch and click **Run workflow**

## Troubleshooting

### Build Failures

- Check that all environment variables are set in GitHub Secrets
- Verify Node.js version matches (currently 18)
- Check that all dependencies are properly installed

### Deployment Failures

- Verify Firebase service account has proper permissions
- Check Vercel token is valid and has deployment permissions
- Ensure Firebase project ID matches your actual project

