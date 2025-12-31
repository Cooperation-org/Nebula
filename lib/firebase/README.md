# Firebase Configuration

This directory contains Firebase initialization and configuration for the Nebula project.

## Setup Instructions

### 1. Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or select an existing project
3. Follow the setup wizard:
   - Enter project name (e.g., "Nebula")
   - Enable Google Analytics (optional)
   - Complete project creation

### 2. Get Firebase Configuration

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Scroll to **Your apps** section
3. Click **Web** icon (`</>`) to add a web app
4. Register app with a nickname (e.g., "Nebula Web")
5. Copy the configuration values

### 3. Set Up Environment Variables

Create a `.env.local` file in the project root with the following variables:

```env
# Firebase Configuration
# Get these values from Firebase Console > Project Settings > General > Your apps
# These are safe to expose in client code (public config)

NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key-here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your-measurement-id-optional

# Firebase Emulator (Development only)
# Set to 'true' to use Firebase emulators locally
NEXT_PUBLIC_FIREBASE_USE_EMULATOR=false
NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST=localhost
NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_PORT=5001
```

**Important:** 
- Replace all `your-*-here` values with actual values from Firebase Console
- The `.env.local` file is already in `.gitignore` and will not be committed
- These `NEXT_PUBLIC_*` variables are safe to expose in client code (they're public config)

### 4. Enable Firebase Services

In Firebase Console, enable the following services:

1. **Firestore Database:**
   - Go to **Firestore Database** in the left sidebar
   - Click **Create database**
   - Choose **Start in test mode** (we'll add security rules in later stories)
   - Select a location (choose closest to your users)

2. **Authentication:**
   - Go to **Authentication** in the left sidebar
   - Click **Get started**
   - Enable **Email/Password** sign-in method (and others as needed)

3. **Cloud Functions:**
   - Go to **Functions** in the left sidebar
   - Click **Get started** (if not already enabled)
   - Note: Functions will be set up in a separate story

### 5. Verify Configuration

After setting up environment variables, verify the configuration:

```typescript
import { getFirebaseApp, db, authInstance, functionsInstance } from '@/lib/firebase/config'

// These should initialize without errors
const app = getFirebaseApp()
const firestore = db
const auth = authInstance
const functions = functionsInstance
```

## Security Best Practices

✅ **Safe to expose in client code:**
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Public API key (restricted by domain)
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Public auth domain
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Public project ID
- Other `NEXT_PUBLIC_*` variables

❌ **Never expose in client code:**
- Firebase Admin SDK private keys
- Service account credentials
- Server-side secrets

These should only be used in Cloud Functions or server-side code with proper secret management.

## Usage

Import Firebase services in your components:

```typescript
// Firestore
import { db } from '@/lib/firebase/config'
import { collection, getDocs } from 'firebase/firestore'

// Auth
import { authInstance } from '@/lib/firebase/config'
import { signInWithEmailAndPassword } from 'firebase/auth'

// Functions
import { functionsInstance } from '@/lib/firebase/config'
import { httpsCallable } from 'firebase/functions'
```

## Development with Emulators

To use Firebase emulators locally:

1. Install Firebase CLI: `npm install -g firebase-tools`
2. Initialize emulators: `firebase init emulators`
3. Start emulators: `firebase emulators:start`
4. Set in `.env.local`: `NEXT_PUBLIC_FIREBASE_USE_EMULATOR=true`

