import React, { useEffect, useState } from 'react';
import { DbkExperienceResolved } from '../../experience/types';
import { useAuth } from '../../client/AuthContext';

interface DbkAppProps {
  dbkId: string;
}

export const DbkApp: React.FC<DbkAppProps> = ({ dbkId }) => {
  const { getIdToken } = useAuth();
  const [experience, setExperience] = useState<DbkExperienceResolved | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadExperience = async () => {
      setLoading(true);
      setError(null);

      try {
        const idToken = await getIdToken();

        if (!idToken) {
          throw new Error('Your session has expired. Please sign in again.');
        }

        const res = await fetch(`/api/experience/resolve/${dbkId}`, {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${idToken}`,
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data?.error?.message || 'Failed to load your business workspace'
          );
        }

        if (!cancelled) {
          setExperience(data.resolved);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err?.message || 'Network error loading your business');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    loadExperience();

    return () => {
      cancelled = true;
    };
  }, [dbkId, getIdToken]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-lg font-semibold text-slate-900">
            Opening your business...
          </div>
          <div className="mt-2 text-sm text-slate-500">
            Preparing your digital workspace
          </div>
        </div>
      </div>
    );
  }

  if (error || !experience) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-slate-900">
            Business workspace unavailable
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {error || 'Unable to resolve this business workspace.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-5">
          <h1 className="text-2xl font-bold text-slate-900">
            {experience.displayName}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {experience.sector} · {experience.activeBranch.name}
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="rounded-2xl bg-white border border-slate-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Your Digital Workspace
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            This business app is powered by TDBK and configured specifically
            for {experience.displayName}.
          </p>

          {experience.navigation.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {experience.navigation.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-slate-200 p-4"
                >
                  <div className="font-medium text-slate-900">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default DbkApp;
