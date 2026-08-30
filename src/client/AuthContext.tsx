import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';

import { firebaseAuth, isFirebaseConfigured } from './firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  isFirebaseConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isFirebaseConfigured && firebaseAuth) {
      try {
        const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
          setUser(nextUser);
          setLoading(false);
        });
        return unsubscribe;
      } catch (err) {
        console.warn('[TDBK Auth] onAuthStateChanged error:', err);
        setUser(null);
        setLoading(false);
      }
    } else {
      setUser(null);
      setLoading(false);
    }
  }, []);

  const signIn = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      throw new Error('Firebase Authentication is not configured in this environment.');
    }
    await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password,
    );
  };

  const signUp = async (email: string, password: string) => {
    if (!isFirebaseConfigured || !firebaseAuth) {
      throw new Error('Firebase Authentication is not configured in this environment.');
    }
    await createUserWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password,
    );
  };

  const signOutUser = async () => {
    if (isFirebaseConfigured && firebaseAuth) {
      await signOut(firebaseAuth);
    }
    setUser(null);
  };

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    if (isFirebaseConfigured && firebaseAuth?.currentUser) {
      return firebaseAuth.currentUser.getIdToken(forceRefresh);
    }
    return null;
  };

  const value: AuthContextValue = {
    user,
    loading,
    isFirebaseConfigured,
    signIn,
    signUp,
    signOutUser,
    getIdToken,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return context;
}
