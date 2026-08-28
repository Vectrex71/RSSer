import { initializeApp } from 'firebase/app';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Use initializeFirestore with long polling to avoid WebSocket connectivity issues in restricted environments
const dbId = firebaseConfig.firestoreDatabaseId === '(default)' ? undefined : firebaseConfig.firestoreDatabaseId;
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, dbId); 

/**
 * Utility to get a specific firestore database instance by ID
 * We use a separate app instance for each database to avoid "already initialized" errors
 */
const dbInstances: Record<string, any> = {};
const apps: Record<string, any> = {};

export function getDbInstance(identifier?: string) {
  const actualId = identifier === '(default)' ? undefined : identifier;
  
  // If requested ID matches the one in our default config, just return the default db
  if (actualId === firebaseConfig.firestoreDatabaseId || (actualId === undefined && firebaseConfig.firestoreDatabaseId === '(default)')) {
    return db;
  }

  const key = actualId || 'default';
  
  if (dbInstances[key]) return dbInstances[key];
  
  console.log(`Initializing new Firestore instance for: ${key}`);
  try {
    // We use the main 'app' instance to share authentication state
    // but initialize a different firestore instance for the specific database ID
    dbInstances[key] = initializeFirestore(app, {
      experimentalForceLongPolling: true,
    }, actualId);
    
    // Attach the ID for debugging
    (dbInstances[key] as any)._customId = key;
    
    return dbInstances[key];
  } catch (error) {
    console.error(`Error initializing DB instance for ${key}:`, error);
    return db;
  }
}

export const auth = getAuth(app);
export const storage = getStorage(app, firebaseConfig.storageBucket);

// Test connectivity to Firestore with a single check on session start
let hasCheckedConnection = false;
async function testConnection() {
  onAuthStateChanged(auth, async (user) => {
    if (!user || hasCheckedConnection) return;
    hasCheckedConnection = true;
    try {
      // Use getDocFromServer to verify connection without setting up a listener
      await getDocFromServer(doc(db, '_connection_test_', 'check'));
      console.log("Firestore connection test: Successfully reached server");
    } catch (error: any) {
      const msg = error?.message || String(error);
      // Suppress CANCELLED errors during startup test
      if (msg.includes('CANCELLED')) return;
      
      console.warn("Firestore connection check info:", msg);
      if (msg.includes('the client is offline')) {
        console.warn("Firestore client appears to be offline.");
      }
    }
  });
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  const errorJson = JSON.stringify(errInfo);
  console.error('Firestore Error Detailed: ', errorJson);
  
  // Log the error but do not throw to avoid uncaught background exceptions crashing the app
  console.warn("Firestore Operation Failed:", errorJson);
}

export function isQuotaError(error: any) {
  const msg = error?.message || String(error);
  return msg.includes('Quota exceeded') || msg.includes('quota metric') || msg.includes('8 RESOURCE_EXHAUSTED');
}
