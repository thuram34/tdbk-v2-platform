import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Building2,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Layers3,
  Plus,
  RefreshCw,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import type { DbkExperienceProjection, DbkIdentity } from '../../platform/types';
import { getExperienceProjection } from '../../client/masterControlApi';

interface OwnerCommandCenterProps {
  userEmail?: string | null;
  dbks: DbkIdentity[];
  idToken: string;
  loading?: boolean;
  onRefresh: () => Promise<void> | void;
  onAddOrganization: () => void;
  onOpenOrganization: (dbkId: string) => void;
}

const statusMeta = (status: DbkIdentity['status']) => {
  switch (status) {
    case 'ACTIVE':
      return { label: 'Active', tone: 'text-emerald-700 bg-emerald-50 border-emerald-200', icon: CheckCircle2 };
    case 'PROVISIONING':
      return { label: 'Setting up', tone: 'text-amber-700 bg-amber-50 border-amber-200', icon: Clock3 };
    case 'PROVISIONING_FAILED':
      return { label: 'Needs attention', tone: 'text-red-700 bg-red-50 border-red-200', icon: CircleAlert };
    case 'SUSPENDED':
      return { label: 'Suspended', tone: 'text-orange-700 bg-orange-50 border-orange-200', icon: CircleAlert };
    case 'ARCHIVED':
      return { label: 'Archived', tone: 'text-neutral-600 bg-neutral-100 border-neutral-200', icon: Clock3 };
    default:
      return { label: status, tone: 'text-neutral-600 bg-neutral-100 border-neutral-200', icon: Clock3 };
  }
};

export const OwnerCommandCenter: React.FC<OwnerCommandCenterProps> = ({
  userEmail,
  dbks,
  idToken,
  loading = false,
  onRefresh,
  onAddOrganization,
  onOpenOrganization,
}) => {
  const [projections, setProjections] = useState<Record<string, DbkExperienceProjection>>({});
  const [projectionError, setProjectionError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadProjections = async () => {
      const activeDbks = dbks.filter((dbk) => dbk.status === 'ACTIVE');
      if (!activeDbks.length) {
        setProjections({});
        setProjectionError(null);
        return;
      }

      try {
        setProjectionError(null);
        const entries = await Promise.all(
          activeDbks.map(async (dbk) => [dbk.dbkId, await getExperienceProjection(idToken, dbk.dbkId)] as const),
        );
        if (!cancelled) setProjections(Object.fromEntries(entries));
      } catch (error) {
        if (!cancelled) {
          console.error('Failed to load DBK experience projections:', error);
          setProjectionError('Some workspace details could not be loaded. Organization status remains authoritative.');
        }
      }
    };

    loadProjections();
    return () => {
      cancelled = true;
    };
  }, [dbks, idToken]);

  const metrics = useMemo(() => {
    const active = dbks.filter((dbk) => dbk.status === 'ACTIVE').length;
    const settingUp = dbks.filter((dbk) => dbk.status === 'PROVISIONING').length;
    const attention = dbks.filter((dbk) => dbk.status === 'PROVISIONING_FAILED' || dbk.status === 'SUSPENDED').length;
    const enabledCapabilities = Object.values(projections).reduce((total, projection) => total + projection.capabilities.enabled.length, 0);
    return { active, settingUp, attention, enabledCapabilities };
  }, [dbks, projections]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FBFBF9] text-neutral-900">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-5 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-neutral-950 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-500">TDBK Master</p>
              <p className="truncate text-sm font-bold">Owner / Operator Command Center</p>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            <p className="text-xs font-semibold text-neutral-900">{userEmail || 'Authenticated operator'}</p>
            <p className="mt-0.5 text-[11px] text-neutral-500">Identity verified · workspace access controlled</p>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10">
        <div className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Your operating layer</p>
            <h1 className="mt-2 font-serif text-3xl font-bold tracking-tight sm:text-4xl">Everything you operate, in one place.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-600">
              Manage your businesses, see what is ready, and enter a workspace when it is operational. TDBK uses server-authoritative organization state for these decisions.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleRefresh}
              disabled={refreshing || loading}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-4 py-3 text-sm font-semibold text-neutral-800 shadow-sm transition hover:border-neutral-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={onAddOrganization}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" />
              Add organization
            </button>
          </div>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Organization summary">
          {[
            ['Organizations', dbks.length, Building2],
            ['Active', metrics.active, CheckCircle2],
            ['Setting up', metrics.settingUp, Clock3],
            ['Capabilities enabled', metrics.enabledCapabilities, Layers3],
          ].map(([label, value, Icon]) => (
            <div key={String(label)} className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-500">{label}</span>
                {React.createElement(Icon as React.ElementType, { className: 'h-4 w-4 text-neutral-400' })}
              </div>
              <p className="mt-3 text-2xl font-bold">{value}</p>
            </div>
          ))}
        </section>

        {metrics.attention > 0 && (
          <section className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-5">
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
              <div>
                <p className="font-bold text-red-900">{metrics.attention} organization{metrics.attention === 1 ? '' : 's'} need attention</p>
                <p className="mt-1 text-sm text-red-800">Open the affected organization below for its current lifecycle state. TDBK will not present an unavailable workspace as ready.</p>
              </div>
            </div>
          </section>
        )}

        {projectionError && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
            {projectionError}
          </div>
        )}

        <section className="mt-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">My organizations</h2>
              <p className="mt-1 text-sm text-neutral-500">Select an active workspace to continue operating it.</p>
            </div>
            <Activity className="h-5 w-5 text-neutral-400" />
          </div>

          {loading ? (
            <div className="rounded-3xl border border-neutral-200 bg-white p-8 text-center text-sm text-neutral-500">Refreshing organization state…</div>
          ) : dbks.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-neutral-300 bg-white p-10 text-center">
              <Building2 className="mx-auto h-8 w-8 text-neutral-400" />
              <h3 className="mt-4 text-lg font-bold">No organization yet</h3>
              <p className="mx-auto mt-2 max-w-md text-sm text-neutral-500">Create your first organization and TDBK will provision its workspace from the selected business blueprint.</p>
              <button type="button" onClick={onAddOrganization} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-semibold text-white">
                Create organization <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {dbks.map((dbk) => {
                const meta = statusMeta(dbk.status);
                const Icon = meta.icon;
                const projection = projections[dbk.dbkId];
                const canOpen = dbk.status === 'ACTIVE';
                return (
                  <article key={dbk.dbkId} className="rounded-3xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:shadow-md">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-lg font-bold">{dbk.displayName || dbk.legalName}</p>
                        <p className="mt-1 truncate text-sm text-neutral-500">{dbk.legalName}</p>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
                        <Icon className="h-3.5 w-3.5" />
                        {meta.label}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <p className="text-xs text-neutral-500">Sector</p>
                        <p className="mt-1 font-semibold">{dbk.sector}</p>
                      </div>
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <p className="text-xs text-neutral-500">Subscription</p>
                        <p className="mt-1 font-semibold">{dbk.subscriptionTier}</p>
                      </div>
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <p className="text-xs text-neutral-500">Branches</p>
                        <p className="mt-1 font-semibold">{projection?.branches.length ?? dbk.branchTopology.length}</p>
                      </div>
                      <div className="rounded-2xl bg-neutral-50 p-3">
                        <p className="text-xs text-neutral-500">Enabled capabilities</p>
                        <p className="mt-1 font-semibold">{projection?.capabilities.enabled.length ?? '—'}</p>
                      </div>
                    </div>

                    {projection && (
                      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
                        <Sparkles className="h-3.5 w-3.5" />
                        {projection.capabilities.discoverable.length} capability{projection.capabilities.discoverable.length === 1 ? '' : 'ies'} available to discover
                      </div>
                    )}

                    <div className="mt-6 flex items-center justify-between gap-4 border-t border-neutral-100 pt-5">
                      <div className="text-xs text-neutral-500">
                        Workspace v{dbk.workspaceVersion} · Configuration v{dbk.configurationVersion}
                      </div>
                      <button
                        type="button"
                        disabled={!canOpen}
                        onClick={() => onOpenOrganization(dbk.dbkId)}
                        className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                      >
                        {canOpen ? 'Open workspace' : 'Not ready'}
                        {canOpen && <ArrowRight className="h-4 w-4" />}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
};

export default OwnerCommandCenter;
