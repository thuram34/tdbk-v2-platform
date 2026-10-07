import React, { useEffect, useState } from 'react';
import { Loader2, ShieldCheck, UserRound, UserRoundCog } from 'lucide-react';
import { useAuth } from '../../client/AuthContext';

type Identity = {
  uid: string;
  email?: string;
  displayName?: string;
  roles: string[];
  permissions: string[];
  tenantId?: string | null;
  branchId?: string | null;
};

const ROLE_OPTIONS = [
  { value: 'SCHOOL_PRINCIPAL', label: 'School Principal' },
  { value: 'TEACHER', label: 'Teacher' },
  { value: 'BURSAR', label: 'Bursar' },
  { value: 'FINANCE_VIEWER', label: 'Finance Viewer' },
  { value: 'CASHIER', label: 'Cashier' },
  { value: 'STORE_OWNER', label: 'Store Owner' },
  { value: 'SHOP_MANAGER', label: 'Shop Manager' },
  { value: 'CLINICIAN', label: 'Clinician' },
  { value: 'MEDICAL_DIRECTOR', label: 'Medical Director' },
  { value: 'BRANCH_MANAGER', label: 'Branch Manager' },
  { value: 'STAFF', label: 'Staff' },
  { value: 'AUDITOR', label: 'Auditor' },
  { value: 'INTEGRATION_AGENT', label: 'Integration Agent' },
];

export const TeamRolesPanel: React.FC<{ tenantId: string; onChanged: () => Promise<void> }> = ({ tenantId, onChanged }) => {
  const { getIdToken } = useAuth();
  const [identities, setIdentities] = useState<Identity[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingUid, setSavingUid] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/kernel/identity?tenantId=' + encodeURIComponent(tenantId), {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || 'Unable to load business team.');
      setIdentities(data.identities || []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load business team.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [tenantId]);

  const assignRole = async (identity: Identity) => {
    const role = selectedRoles[identity.uid];
    if (!role) return;
    setSavingUid(identity.uid);
    setError(null);
    setNotice(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch('/api/kernel/identity/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          targetUid: identity.uid,
          tenantId,
          role,
          branchId: identity.branchId || undefined,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error?.message || 'Role assignment failed.');
      setNotice('Role updated. The Engine has refreshed the member identity and permissions.');
      setSelectedRoles((current) => ({ ...current, [identity.uid]: '' }));
      await load();
      await onChanged();
    } catch (err: any) {
      setError(err?.message || 'Role assignment failed.');
    } finally {
      setSavingUid(null);
    }
  };

  return (
    <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-emerald-700">
            <UserRoundCog className="h-5 w-5" />
            <span className="text-sm font-black uppercase tracking-wider">People & roles</span>
          </div>
          <h2 className="mt-2 text-xl font-bold">Who can operate this business?</h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
            Assign tenant-scoped roles through the authoritative identity and RBAC boundary. This does not create a parallel user directory.
          </p>
        </div>
        <button type="button" onClick={() => void load()} className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-700">Refresh</button>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</div>}
      {notice && <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{notice}</div>}

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading authorized members…</div>
      ) : identities.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-200 p-5 text-sm text-neutral-500">
          No tenant identities are currently visible to your account.
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          {identities.map((identity) => (
            <div key={identity.uid} className="grid gap-4 rounded-2xl border border-neutral-200 bg-neutral-50/70 p-4 lg:grid-cols-[1fr_auto_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white ring-1 ring-neutral-200"><UserRound className="h-4 w-4 text-neutral-500" /></div>
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold text-neutral-900">{identity.displayName || identity.email || identity.uid}</div>
                    <div className="truncate text-xs text-neutral-500">{identity.email || identity.uid}</div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {identity.roles.map((role) => <span key={role} className="rounded-full bg-white px-2 py-1 text-[10px] font-bold text-neutral-600 ring-1 ring-neutral-200">{role}</span>)}
                  {identity.permissions.slice(0, 5).map((permission) => <span key={permission} className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] text-emerald-700">{permission}</span>)}
                </div>
              </div>
              <select
                aria-label={'Assign role to ' + (identity.displayName || identity.email || identity.uid)}
                value={selectedRoles[identity.uid] || ''}
                onChange={(event) => setSelectedRoles((current) => ({ ...current, [identity.uid]: event.target.value }))}
                className="rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-semibold"
              >
                <option value="">Assign role…</option>
                {ROLE_OPTIONS.map((role) => <option key={role.value} value={role.value}>{role.label}</option>)}
              </select>
              <button
                type="button"
                disabled={!selectedRoles[identity.uid] || savingUid === identity.uid}
                onClick={() => void assignRole(identity)}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
              >
                {savingUid === identity.uid ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldCheck className="h-3.5 w-3.5" />}
                Assign
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};
