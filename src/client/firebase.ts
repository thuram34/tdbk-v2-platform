import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';
import { getStorage, type FirebaseStorage } from 'firebase/storage';

const apiKey = import.meta.env.VITE_FIREBASE_API_KEY;
const projectId = import.meta.env.VITE_FIREBASE_PROJECT_ID;

export const isFirebaseConfigured = Boolean(
  apiKey &&
  typeof apiKey === 'string' &&
  apiKey.trim().length > 0 &&
  apiKey !== 'undefined' &&
  projectId &&
  typeof projectId === 'string' &&
  projectId.trim().length > 0 &&
  projectId !== 'undefined'
);

const firebaseConfig = {
  apiKey: apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
};

let app: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestore: Firestore | null = null;
let firebaseStorage: FirebaseStorage | null = null;

if (isFirebaseConfigured) {
  try {
    app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    firebaseAuth = getAuth(app);
    firestore = getFirestore(app);
    firebaseStorage = getStorage(app);
  } catch (err) {
    console.warn('[TDBK Firebase] client initialization warning:', err);
    app = null;
    firebaseAuth = null;
    firestore = null;
    firebaseStorage = null;
  }
}

export const auth = firebaseAuth;
export const db = firestore;
export const storage = firebaseStorage;
export { app, firebaseAuth, firestore, firebaseStorage };
