# Authentication State Persistence Fix

## Problem

The website wasn't recognizing users as signed in after page refresh or navigation. Users had to navigate to `/dashboard` for the site to recognize their authentication state.

## Root Cause

Firebase Auth state is restored **asynchronously** from browser storage (localStorage/indexedDB) when the page loads. Components were calling `getCurrentUser()` immediately, before Firebase finished restoring the auth state, resulting in `null` being returned.

## Solution

Created a `useAuth` hook that:

1. Uses `onAuthStateChanged` to wait for Firebase to restore auth state
2. Provides a `loading` state while auth is initializing
3. Returns the authenticated user once Firebase has restored the state

## Changes Made

### 1. Created `lib/hooks/useAuth.ts`

- Hook that subscribes to Firebase Auth state changes
- Waits for auth state to be restored before returning user
- Provides loading state to prevent premature auth checks

### 2. Updated Components

- **CookLedgerView**: Now uses `useAuth` hook instead of direct `getCurrentUser()` call
- **AttestationsView**: Now uses `useAuth` hook instead of direct `getCurrentUser()` call
- **DashboardPage**: Now uses `useAuth` hook to wait for auth initialization
- **LoginForm**: Now uses `useAuth` hook to check if user is already logged in

## How It Works

```typescript
// Before (problematic):
const currentUser = getCurrentUser() // Returns null if Firebase hasn't restored state yet

// After (fixed):
const { user, loading } = useAuth() // Waits for Firebase to restore state
if (loading) {
  return <LoadingSpinner />
}
if (!user) {
  return <LoginPrompt />
}
```

## Benefits

- ✅ Auth state persists across page refreshes
- ✅ No need to navigate to `/dashboard` to restore auth state
- ✅ Consistent auth checking across all components
- ✅ Proper loading states while auth initializes

## Testing

After this fix:

1. Log in to the application
2. Refresh the page - you should remain logged in
3. Navigate to any page - auth state should be recognized immediately
4. Close and reopen the browser - you should remain logged in (until session expires)
