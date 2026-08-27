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

import { firebaseAuth } from './firebase';

interface AuthContextValue {
  user: User | null;
  loading: boolean;
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
    const unsubscribe = onAuthStateChanged(firebaseAuth, (nextUser) => {
      setUser(nextUser);
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    await signInWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password,
    );
  };

  const signUp = async (email: string, password: string) => {
    await createUserWithEmailAndPassword(
      firebaseAuth,
      email.trim(),
      password,
    );
  };

  const signOutUser = async () => {
    await signOut(firebaseAuth);
  };

  const getIdToken = async (forceRefresh = false) => {
    if (!firebaseAuth.currentUser) {
      return null;
    }

    return firebaseAuth.currentUser.getIdToken(forceRefresh);
  };

  const value: AuthContextValue = {
    user,
    loading,
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
