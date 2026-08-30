import React, { useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  KeyRound,
  LogIn,
  Mail,
  ShieldCheck,
  UserPlus,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../client/AuthContext';

export function LoginScreen() {
  const { signIn, signUp, isFirebaseConfigured } = useAuth();

  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);

    if (!isFirebaseConfigured) {
      setError('Firebase Authentication is not configured in this environment.');
      return;
    }

    if (!email.trim() || !password.trim()) {
      setError('Please provide both email and password.');
      return;
    }

    if (mode === 'SIGN_UP' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'SIGN_IN') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
        setInfo('Account created successfully. Authenticating session...');
      }
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/invalid-credential' || code === 'auth/user-not-found' || code === 'auth/wrong-password') {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else {
        setError(err?.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-neutral-900 border border-[#333] mb-4">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            TDBK OPERATIONAL KERNEL
          </h1>
          <p className="mt-2 text-sm text-neutral-400">
            Secure access to your TDBK business workspace.
          </p>
        </div>

        <div className="border border-[#333] bg-[#1A1A1A] p-6">
          {!isFirebaseConfigured && (
            <div className="mb-6 border border-amber-800/60 bg-amber-950/40 p-4 text-xs text-amber-300">
              <div className="flex items-center gap-2 mb-1.5 font-bold uppercase tracking-wider text-amber-200">
                <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                <span>Configuration Required</span>
              </div>
              <p className="text-neutral-300 leading-relaxed">
                Firebase Web Client credentials (<code className="font-mono text-amber-300">VITE_FIREBASE_*</code>) are not configured. User authentication and workspace access are unavailable until valid configuration is provided.
              </p>
            </div>
          )}

          <div className="flex border-b border-[#333] mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('SIGN_IN');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition ${
                mode === 'SIGN_IN'
                  ? 'text-white border-b-2 border-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('SIGN_UP');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition ${
                mode === 'SIGN_UP'
                  ? 'text-white border-b-2 border-white'
                  : 'text-neutral-500 hover:text-neutral-300'
              }`}
            >
              Sign Up
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-950/50 border border-red-800/80 text-red-200 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="mb-4 p-3 bg-emerald-950/50 border border-emerald-800/80 text-emerald-200 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  disabled={!isFirebaseConfigured || isSubmitting}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-[#111] border border-[#333] px-3 py-2.5 pl-9 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  disabled={!isFirebaseConfigured || isSubmitting}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-[#111] border border-[#333] px-3 py-2.5 pl-9 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
                  required
                />
              </div>
            </div>

            {mode === 'SIGN_UP' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    disabled={!isFirebaseConfigured || isSubmitting}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#111] border border-[#333] px-3 py-2.5 pl-9 text-sm text-white placeholder-neutral-600 focus:outline-none focus:border-white disabled:opacity-50 disabled:cursor-not-allowed"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !isFirebaseConfigured}
              className="w-full py-2.5 px-4 bg-white hover:bg-neutral-200 text-black text-xs font-bold uppercase tracking-wider transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
            >
              {isSubmitting ? (
                <span>Authenticating...</span>
              ) : mode === 'SIGN_IN' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>
              All operations are protected by Cryptographic Identity Verification and Tenant Data Isolation.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
