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

interface LoginScreenProps {
  onBackToGateway?: () => void;
}

export function LoginScreen({ onBackToGateway }: LoginScreenProps) {
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
      setError('Authentication is not configured in this environment.');
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
        setInfo('Account created successfully. Authenticating your Digital Space...');
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
    <div className="min-h-[calc(100vh-4rem)] bg-[#FBFBF9] text-neutral-900 flex items-center justify-center p-4 sm:p-6 antialiased">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-neutral-950 text-white shadow-xs mb-3">
            <Building2 className="w-6 h-6" />
          </div>
          <div className="text-xs font-semibold uppercase tracking-wider text-neutral-500 mb-1.5">
            Digital Bridge Kenya
          </div>
          <h1 className="text-2xl sm:text-3xl font-serif font-bold tracking-tight text-neutral-950">
            Your Digital Space
          </h1>
          <p className="mt-2 text-sm text-neutral-600">
            {mode === 'SIGN_IN'
              ? 'Sign in to continue to your business.'
              : 'Create your account and start your digital journey.'}
          </p>
        </div>

        <div className="border border-neutral-200/90 bg-white shadow-sm sm:shadow-md rounded-2xl p-6 sm:p-8">
          {!isFirebaseConfigured && (
            <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900">
              <div className="flex items-center gap-2 mb-1 font-bold uppercase tracking-wider text-amber-800">
                <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0" />
                <span>Configuration Required</span>
              </div>
              <p className="text-neutral-700 leading-relaxed">
                Authentication is not configured in this environment.
              </p>
            </div>
          )}

          <div className="flex border-b border-neutral-200 mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('SIGN_IN');
                setError(null);
                setInfo(null);
              }}
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition cursor-pointer ${
                mode === 'SIGN_IN'
                  ? 'text-neutral-950 border-b-2 border-neutral-950'
                  : 'text-neutral-500 hover:text-neutral-800'
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
              className={`flex-1 pb-3 text-xs font-bold uppercase tracking-wider text-center transition cursor-pointer ${
                mode === 'SIGN_UP'
                  ? 'text-neutral-950 border-b-2 border-neutral-950'
                  : 'text-neutral-500 hover:text-neutral-800'
              }`}
            >
              Create Account
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {info && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{info}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  value={email}
                  disabled={!isFirebaseConfigured || isSubmitting}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                Password
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  value={password}
                  disabled={!isFirebaseConfigured || isSubmitting}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed transition"
                  required
                />
              </div>
            </div>

            {mode === 'SIGN_UP' && (
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-neutral-600 mb-1.5">
                  Confirm Password
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-neutral-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    value={confirmPassword}
                    disabled={!isFirebaseConfigured || isSubmitting}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3.5 py-2.5 pl-10 text-sm text-neutral-900 placeholder-neutral-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-950 disabled:opacity-50 disabled:cursor-not-allowed transition"
                    required
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting || !isFirebaseConfigured}
              className="w-full py-3 px-4 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6 cursor-pointer shadow-sm"
            >
              {isSubmitting ? (
                <span>Connecting...</span>
              ) : mode === 'SIGN_IN' ? (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Enter My Digital Space</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create My Account</span>
                </>
              )}
            </button>
          </form>

          {onBackToGateway && (
            <div className="mt-5 text-center">
              <button
                type="button"
                onClick={onBackToGateway}
                className="text-xs text-neutral-500 hover:text-neutral-900 font-medium transition cursor-pointer"
              >
                ← Return to DBK Overview
              </button>
            </div>
          )}

          <div className="mt-6 pt-5 border-t border-neutral-100 flex items-start gap-2.5 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 mt-0.5" />
            <span className="leading-relaxed">
              Your account and business data are protected with secure identity and access controls.
            </span>
          </div>
        </div>

        <div className="mt-8 text-center text-xs text-neutral-500 font-medium">
          Built in Kenya. For Kenya. For a Brighter Tomorrow.
        </div>
      </div>
    </div>
  );
}
