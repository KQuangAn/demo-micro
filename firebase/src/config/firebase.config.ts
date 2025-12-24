import { initializeApp, FirebaseApp, getApps } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { FirebaseOptions } from 'firebase/app';

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  databaseURL?: string;
}

/**
 * Firebase configuration manager
 * Follows singleton pattern to ensure single Firebase instance
 */
export class FirebaseConfigManager {
  private static instance: FirebaseConfigManager;
  private app: FirebaseApp | null = null;
  private auth: Auth | null = null;
  private firestore: Firestore | null = null;
  private database: Database | null = null;

  private constructor() {
    // Private constructor for singleton
  }

  public static getInstance(): FirebaseConfigManager {
    if (!FirebaseConfigManager.instance) {
      FirebaseConfigManager.instance = new FirebaseConfigManager();
    }
    return FirebaseConfigManager.instance;
  }

  /**
   * Initialize Firebase with configuration
   */
  public initialize(config: FirebaseConfig): void {
    if (this.app) {
      console.warn('Firebase already initialized');
      return;
    }

    const firebaseConfig: FirebaseOptions = {
      apiKey: config.apiKey,
      authDomain: config.authDomain,
      projectId: config.projectId,
      storageBucket: config.storageBucket,
      messagingSenderId: config.messagingSenderId,
      appId: config.appId,
      ...(config.databaseURL && { databaseURL: config.databaseURL }),
    };

    // Check if Firebase is already initialized
    const existingApps = getApps();
    if (existingApps.length > 0) {
      this.app = existingApps[0];
    } else {
      this.app = initializeApp(firebaseConfig);
    }

    this.auth = getAuth(this.app);
    this.firestore = getFirestore(this.app);
    
    if (config.databaseURL) {
      this.database = getDatabase(this.app);
    }
  }

  public getApp(): FirebaseApp {
    if (!this.app) {
      throw new Error('Firebase not initialized. Call initialize() first.');
    }
    return this.app;
  }

  public getAuth(): Auth {
    if (!this.auth) {
      throw new Error('Firebase Auth not initialized. Call initialize() first.');
    }
    return this.auth;
  }

  public getFirestore(): Firestore {
    if (!this.firestore) {
      throw new Error('Firestore not initialized. Call initialize() first.');
    }
    return this.firestore;
  }

  public getDatabase(): Database {
    if (!this.database) {
      throw new Error('Realtime Database not initialized. Call initialize() first.');
    }
    return this.database;
  }
}

// Export singleton instance
export const firebaseConfig = FirebaseConfigManager.getInstance();

