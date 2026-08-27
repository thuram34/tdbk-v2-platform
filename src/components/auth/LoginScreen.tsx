import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { useAuth } from '../../client/AuthContext';

export function LoginScreen() {
  const { signIn, signUp } = useAuth();

  const [mode, setMode] = useState<'SIGN_IN' | 'SIGN_UP'>('SIGN_IN');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    if (mode === 'SIGN_UP' && password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must contain at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (mode === 'SIGN_IN') {
        await signIn(email, password);
      } else {
        await signUp(email, password);
      }
    } catch (err: any) {
      const code = err?.code || '';

      if (code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (code === 'auth/email-already-in-use') {
        setError('An account already exists with this email.');
      } else if (code === 'auth/invalid-email') {
        setError('Please enter a valid email address.');
      } else if (code === 'auth/weak-password') {
        setError('Please choose a stronger password.');
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
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 w-16 h-16 border border-emerald-500/40 bg-emerald-500/10 flex items-center justify-center">
            <Building2 className="w-8 h-8 text-emerald-400" />
          </div>

          <h1 className="text-2xl font-bold">
            Thuram Digital Bridge Kenya
          </h1>

          <p className="mt-2 text-sm text-neutral-400">
            Secure access to your TDBK business workspace.
          </p>
        </div>

        <div className="border border-[#333] bg-[#1A1A1A] p-6">
          <div className="flex mb-6 border border-[#333]">
            <button
              type="button"
              onClick={() => {
                setMode('SIGN_IN');
                setError(null);
              }}
              className={`flex-1 px-4 py-3 text-sm font-semibold ${
                mode === 'SIGN_IN'
                  ? 'bg-emerald-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setMode('SIGN_UP');
                setError(null);
              }}
              className={`flex-1 px-4 py-3 text-sm font-semibold ${
                mode === 'SIGN_UP'
                  ? 'bg-emerald-600 text-white'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              Create Account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-2">
                EMAIL ADDRESS
              </label>

              <div className="flex items-center border border-[#333] bg-[#141414]">
                <Mail className="w-4 h-4 ml-3 text-neutral-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@business.co.ke"
                  autoComplete="email"
                  className="w-full bg-transparent px-3 py-3 outline-none text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-400 mb-2">
                PASSWORD
              </label>

              <div className="flex items-center border border-[#333] bg-[#141414]">
                <Lock className="w-4 h-4 ml-3 text-neutral-500" />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Minimum 6 characters"
                  autoComplete={
                    mode === 'SIGN_IN'
                      ? 'current-password'
                      : 'new-password'
                  }
                  className="w-full bg-transparent px-3 py-3 outline-none text-sm"
                />
              </div>
            </div>

            {mode === 'SIGN_UP' && (
              <div>
                <label className="block text-xs font-semibold text-neutral-400 mb-2">
                  CONFIRM PASSWORD
                </label>

                <div className="flex items-center border border-[#333] bg-[#141414]">
                  <Lock className="w-4 h-4 ml-3 text-neutral-500" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    placeholder="Repeat your password"
                    autoComplete="new-password"
                    className="w-full bg-transparent px-3 py-3 outline-none text-sm"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="border border-red-500/40 bg-red-500/10 px-3 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 px-4 py-3 text-sm font-bold transition"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  PROCESSING...
                </>
              ) : mode === 'SIGN_IN' ? (
                <>
                  SIGN IN
                  <ArrowRight className="w-4 h-4" />
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  CREATE ACCOUNT
                </>
              )}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-2 text-xs text-neutral-500">
            <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-500" />
            <span>
              Authentication is secured through the TDBK identity system.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
