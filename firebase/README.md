# Firebase Stack - Complete TypeScript Example

A comprehensive Firebase stack implementation demonstrating best practices, senior developer patterns, and all major Firebase services.

## 🚀 Features

- ✅ **Firebase Authentication** - Complete auth flow with email/password
- ✅ **Cloud Firestore** - NoSQL database with repository pattern
- ✅ **Realtime Database** - Real-time data synchronization
- ✅ **Cloud Functions** - Serverless functions with TypeScript
- ✅ **TypeScript** - Full type safety throughout
- ✅ **Best Practices** - Repository pattern, service layer, error handling
- ✅ **Security Rules** - Firestore and Realtime Database rules
- ✅ **Error Handling** - Custom error classes and proper error management
- ✅ **Logging** - Structured logging utility

## 📁 Project Structure

```
firebase/
├── src/
│   ├── config/           # Configuration files
│   │   ├── firebase.config.ts
│   │   └── env.config.ts
│   ├── services/          # Service layer
│   │   ├── auth.service.ts
│   │   └── realtime-db.service.ts
│   ├── repositories/     # Repository pattern
│   │   ├── firestore.repository.ts
│   │   ├── user.repository.ts
│   │   └── post.repository.ts
│   ├── types/            # TypeScript types
│   │   └── index.ts
│   ├── utils/            # Utilities
│   │   ├── errors.ts
│   │   └── logger.ts
│   ├── examples/         # Example usage
│   │   └── complete-example.ts
│   └── index.ts          # Main entry point
├── functions/            # Cloud Functions
│   ├── src/
│   │   └── index.ts
│   └── package.json
├── firestore.rules       # Firestore security rules
├── firestore.indexes.json
├── database.rules.json   # Realtime Database rules
├── firebase.json         # Firebase configuration
└── package.json
```

## 🛠️ Setup

### 1. Install Dependencies

```bash
cd firebase
npm install
cd functions
npm install
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase project credentials:

```bash
cp .env.example .env
```

Get your Firebase credentials from:
- Firebase Console > Project Settings > General
- Your apps > Web app configuration

### 3. Initialize Firebase (if not already done)

```bash
firebase login
firebase init
```

### 4. Build the Project

```bash
npm run build
```

## 📖 Usage

### Basic Usage

```typescript
import { initializeFirebase, authService, userRepository } from './index';

// Initialize Firebase
initializeFirebase();

// Sign up a user
const signUpResult = await authService.signUp(
  'user@example.com',
  'password123',
  'John Doe'
);

// Create user document in Firestore
const user = await userRepository.createUser(signUpResult.user.uid, {
  email: 'user@example.com',
  displayName: 'John Doe',
  role: 'user',
});
```

### Authentication

```typescript
import { authService } from './services/auth.service';

// Sign up
await authService.signUp('email@example.com', 'password', 'Display Name');

// Sign in
await authService.signIn('email@example.com', 'password');

// Sign out
await authService.signOut();

// Get current user
const user = authService.getCurrentUser();

// Listen to auth state changes
const unsubscribe = authService.onAuthStateChanged((user) => {
  console.log('Auth state:', user);
});
```

### Firestore (Repository Pattern)

```typescript
import { userRepository, postRepository } from './repositories';

// Create user
const user = await userRepository.createUser(userId, {
  email: 'user@example.com',
  displayName: 'John Doe',
});

// Find user
const foundUser = await userRepository.findById(userId);
const userByEmail = await userRepository.findByEmail('user@example.com');

// Create post
const post = await postRepository.createPost({
  userId,
  title: 'My Post',
  content: 'Post content',
  category: 'general',
});

// Query posts
const userPosts = await postRepository.findByUserId(userId);
const categoryPosts = await postRepository.findByCategory('general');

// Paginated query
const paginated = await postRepository.findPaginated({
  limit: 10,
  orderBy: 'createdAt',
  orderDirection: 'desc',
});
```

### Realtime Database

```typescript
import { realtimeDatabaseService } from './services/realtime-db.service';

// Write data
await realtimeDatabaseService.write('users/userId', { name: 'John' });

// Read data
const user = await realtimeDatabaseService.read('users/userId');

// Update data
await realtimeDatabaseService.updateData('users/userId', { name: 'Jane' });

// Push to list
const messageId = await realtimeDatabaseService.push('messages', {
  text: 'Hello',
  userId: 'user123',
});

// Listen to changes
const unsubscribe = realtimeDatabaseService.onValueChange(
  'users/userId',
  (data) => {
    console.log('Data changed:', data);
  }
);

// Create message
const message = await realtimeDatabaseService.createMessage({
  userId: 'user123',
  text: 'Hello, world!',
  roomId: 'room-1',
});

// Update presence
await realtimeDatabaseService.updatePresence('user123', 'online');
```

### Cloud Functions

Cloud Functions are located in the `functions/` directory. Examples include:

- **HTTP Functions** - REST API endpoints
- **Callable Functions** - Client-callable functions with auth
- **Firestore Triggers** - onCreate, onUpdate, onDelete
- **Realtime Database Triggers** - onCreate, onUpdate, onDelete
- **Auth Triggers** - onUserCreate, onUserDelete
- **Scheduled Functions** - Cron jobs

Deploy functions:

```bash
cd functions
npm run deploy
```

## 🏗️ Architecture Patterns

### Repository Pattern

The repository pattern abstracts data access logic:

```typescript
// Generic repository
class FirestoreRepository<T> {
  findById(id: string): Promise<T | null>
  findAll(options?: QueryOptions): Promise<T[]>
  create(data: Omit<T, 'id'>): Promise<T>
  update(id: string, data: Partial<T>): Promise<void>
  delete(id: string): Promise<void>
}

// Specific repository
class UserRepository extends FirestoreRepository<User> {
  findByEmail(email: string): Promise<User | null>
  createUser(userId: string, data: CreateUserDto): Promise<User>
}
```

### Service Layer

Services handle business logic:

```typescript
class AuthService {
  signUp(email: string, password: string): Promise<SignInResult>
  signIn(email: string, password: string): Promise<SignInResult>
  signOut(): Promise<void>
  // ... more methods
}
```

### Error Handling

Custom error classes with proper error handling:

```typescript
try {
  await authService.signIn(email, password);
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle auth error
  }
}
```

## 🔒 Security Rules

### Firestore Rules

Located in `firestore.rules`:

- Users can read/write their own data
- Admins can read/write all data
- Public read for posts, authenticated write
- Helper functions for common checks

### Realtime Database Rules

Located in `database.rules.json`:

- Authenticated users can read/write
- Users can only modify their own data
- Admins have full access
- Validation rules for data structure

## 🧪 Testing

Run the complete example:

```bash
npm run dev
# Then uncomment examples in src/index.ts
```

Or run the complete example directly:

```bash
npx ts-node src/examples/complete-example.ts
```

## 🚀 Deployment

### Deploy Firestore Rules

```bash
firebase deploy --only firestore:rules
```

### Deploy Database Rules

```bash
firebase deploy --only database
```

### Deploy Cloud Functions

```bash
cd functions
npm run deploy
```

### Deploy Everything

```bash
firebase deploy
```

## 📚 Best Practices Implemented

1. **Type Safety** - Full TypeScript with strict mode
2. **Error Handling** - Custom error classes and proper error propagation
3. **Logging** - Structured logging with levels
4. **Repository Pattern** - Separation of data access logic
5. **Service Layer** - Business logic separation
6. **Singleton Pattern** - For Firebase configuration
7. **Environment Configuration** - Zod validation for env vars
8. **Security Rules** - Comprehensive security rules
9. **Code Organization** - Clear folder structure
10. **Documentation** - Inline comments and README

## 🔧 Development

### Watch Mode

```bash
npm run build:watch
```

### Linting

```bash
npm run lint
npm run lint:fix
```

### Formatting

```bash
npm run format
```

### Emulators

Start Firebase emulators for local development:

```bash
npm run emulators:start
```

## 📝 Environment Variables

Required environment variables (see `.env.example`):

- `FIREBASE_API_KEY`
- `FIREBASE_AUTH_DOMAIN`
- `FIREBASE_PROJECT_ID`
- `FIREBASE_STORAGE_BUCKET`
- `FIREBASE_MESSAGING_SENDER_ID`
- `FIREBASE_APP_ID`
- `FIREBASE_DATABASE_URL` (optional, for Realtime Database)
- `NODE_ENV`

## 🤝 Contributing

This is an example project demonstrating Firebase best practices. Feel free to use it as a reference or starting point for your own projects.

## 📄 License

MIT

## 🔗 Resources

- [Firebase Documentation](https://firebase.google.com/docs)
- [Firebase TypeScript SDK](https://firebase.google.com/docs/reference/js)
- [Cloud Functions Documentation](https://firebase.google.com/docs/functions)
- [Firestore Security Rules](https://firebase.google.com/docs/firestore/security/get-started)

