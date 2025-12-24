# Quick Start Guide

Get up and running with the Firebase stack in 5 minutes!

## Step 1: Install Dependencies

```bash
cd firebase
npm install
cd functions && npm install && cd ..
```

## Step 2: Set Up Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project (or use existing)
3. Enable Authentication (Email/Password)
4. Create a Firestore database
5. Create a Realtime Database (optional)
6. Go to Project Settings > General
7. Add a web app and copy the configuration

## Step 3: Configure Environment

Create a `.env` file in the `firebase` directory:

```env
FIREBASE_API_KEY=your-api-key
FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_STORAGE_BUCKET=your-project.appspot.com
FIREBASE_MESSAGING_SENDER_ID=your-sender-id
FIREBASE_APP_ID=your-app-id
FIREBASE_DATABASE_URL=https://your-project-default-rtdb.firebaseio.com
NODE_ENV=development
```

## Step 4: Build the Project

```bash
npm run build
```

## Step 5: Run Examples

### Option 1: Run Complete Example

```bash
npx ts-node src/examples/complete-example.ts
```

### Option 2: Use in Your Code

```typescript
import { initializeFirebase, authService, userRepository } from './index';

// Initialize
initializeFirebase();

// Use services
const result = await authService.signUp('user@example.com', 'password', 'Name');
```

## Step 6: Test with Emulators (Optional)

Start Firebase emulators for local development:

```bash
firebase emulators:start
```

Then update your `.env` to use emulator endpoints.

## Common Commands

```bash
# Build
npm run build

# Watch mode
npm run build:watch

# Development
npm run dev

# Lint
npm run lint

# Format
npm run format

# Test
npm test

# Deploy functions
cd functions && npm run deploy
```

## Next Steps

- Read the full [README.md](./README.md) for detailed documentation
- Check out examples in `src/examples/`
- Explore the code structure in `src/`
- Review security rules in `firestore.rules` and `database.rules.json`

## Troubleshooting

### "Firebase not initialized" error
- Make sure you've called `initializeFirebase()` before using services
- Check that your `.env` file is properly configured

### Authentication errors
- Ensure Email/Password authentication is enabled in Firebase Console
- Check that your API keys are correct

### Firestore errors
- Make sure Firestore is enabled in Firebase Console
- Check security rules allow your operations

### Realtime Database errors
- Ensure Realtime Database is created in Firebase Console
- Check that `FIREBASE_DATABASE_URL` is set in `.env`

