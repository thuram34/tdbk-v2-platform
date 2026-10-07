import React, { useMemo, useState } from 'react';
import { useAuth } from '../../client/AuthContext';
import {
  AlertCircle,
  Building2,
  Check,
  CheckCircle2,
  ChevronRight,
  GitBranch,
  KeyRound,
  Layers,
  Link2,
  Loader2,
  PlugZap,
  Settings2,
  ShieldCheck,
  Sliders,
} from 'lucide-react';
import { DbkExperienceResolved } from '../../experience/types';
import { TeamRolesPanel } from './TeamRolesPanel';

interface SettingsViewProps {
  experience: DbkExperienceResolved;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => Promise<any>;
  onRefreshExperience: () => Promise<void>;
}

const providerMeta: Record<string, { name: string; description: string; icon: React.ElementType }> = {
  SAFARICOM_MPESA: { name: 'M-Pesa', description: 'Accept customer payments and reconcile transactions.', icon: Link2 },
  KRA_ETIMS: { name: 'KRA eTIMS', description: 'Connect sales and invoices to your tax workflow.', icon: ShieldCheck },
  META_WHATSAPP: { name: 'WhatsApp Business', description: 'Connect customer messaging to your business workspace.', icon: Link2 },
  SENDGRID: { name: 'Email', description: 'Send business email from TDBK.', icon: Link2 },
  AFRICAS_TALKING: { name: 'SMS', description: 'Send customer and operational SMS.', icon: Link2 },
  GENERIC_BANK: { name: 'Banking', description: 'Connect supported banking operations.', icon: Link2 },
};

const fieldLabel = (key: string) =>
  key
    .replace(/^MPESA_/, '')
    .replace(/^ETIMS_/, '')
    .replace(/^WHATSAPP_/, '')
    .replace(/^SENDGRID_/, '')
    .replace(/^SMS_/, '')
    .replace(/^BANK_/, '')
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/(^|\s)\S/g, (char) => char.toUpperCase());

const isSecretField = (key: string) => /secret|password|token|passkey|consumer.*key|api.*key/i.test(key);

const statusView = (connection: DbkExperienceResolved['connections'][number]) => {
  if (connection.ready) return { label: 'Connected', tone: 'emerald' };
  if (connection.blockers.some((blocker) => /tier|entitlement/i.test(blocker))) return { label: 'Upgrade required', tone: 'violet' };
  if (connection.status === 'CONFIGURED') return { label: 'Needs attention', tone: 'amber' };
  return { label: 'Needs setup', tone: 'neutral' };
};

const toneClasses: Record<string, string> = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  violet: 'border-violet-200 bg-violet-50 text-violet-700',
  neutral: 'border-neutral-200 bg-neutral-50 text-neutral-600',
};

export const SettingsView: React.FC<SettingsViewProps> = ({ experience, onRefreshExperience }) => {
  const {
    dbkId,
    legalName,
    displayName,
    sector,
    subscriptionTier,
    workspaceVersion,
    configurationVersion,
    activeBranch,
    availableBranches,
    terminology,
    connections,
  } = experience;

  const [selectedBridgeId, setSelectedBridgeId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [healthTesting, setHealthTesting] = useState(false);
  const { getIdToken } = useAuth();

  const selectedConnection = useMemo(
    () => connections.find((connection) => connection.bridgeId === selectedBridgeId) || null,
    [connections, selectedBridgeId],
  );

  const bridgeRequirements: Record<string, string[]> = {
    bridge_mpesa: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY', 'MPESA_SHORTCODE', 'MPESA_CALLBACK_URL'],
    bridge_etims: ['ETIMS_PIN', 'ETIMS_DEVICE_SERIAL', 'ETIMS_BRANCH_CODE', 'ETIMS_VSCU_BASE_URL'],
    bridge_whatsapp: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WABA_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'],
    bridge_email: ['SENDGRID_API_KEY', 'SENDGRID_FROM_EMAIL'],
    bridge_sms: ['SMS_API_KEY', 'SMS_USERNAME', 'SMS_SENDER_ID'],
    bridge_bank: ['BANK_API_KEY', 'BANK_CLIENT_ID', 'BANK_ACCOUNT_NO'],
  };

  const openConnector = (bridgeId: string) => {
    setSelectedBridgeId(bridgeId);
    setDraft({});
    setSaveError(null);
    setSaveSuccess(null);
  };

  const saveConnector = async () => {
    if (!selectedConnection || !selectedBridgeId) return;

    const requirements = bridgeRequirements[selectedBridgeId] || [];
    const missing = requirements.filter((key) => !draft[key]?.trim());
    if (missing.length > 0) {
      setSaveError(`Complete: ${missing.map(fieldLabel).join(', ')}.`);
      setSaveSuccess(null);
      return;
    }

    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);

    try {
      const token = await getIdToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');

      const parameters: Record<string, string> = {};
      const secretRefs: Record<string, { provider: 'GCP_SECRET_MANAGER'; name: string }> = {};

      requirements.forEach((key) => {
        const value = draft[key].trim();
        if (isSecretField(key)) {
          secretRefs[key] = { provider: 'GCP_SECRET_MANAGER', name: value };
        } else {
          parameters[key] = value;
        }
      });

      const response = await fetch('/api/connectors/configure', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          tenantId: dbkId,
          bridgeId: selectedBridgeId,
          parameters,
          secretRefs,
          enabled: true,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error?.message || 'The connection could not be saved.');
      }

      setSaveSuccess('Connection configuration saved. Refreshing workspace status…');
      setDraft({});
      await onRefreshExperience();
    } catch (error: any) {
      setSaveError(error?.message || 'The connection could not be saved.');
    } finally {
      setSaving(false);
    }
  };

  const testConnection = async () => {
    if (!selectedBridgeId || !selectedConnection) return;
    setHealthTesting(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const token = await getIdToken();
      if (!token) throw new Error('Your session has expired. Please sign in again.');
      const response = await fetch(
        '/api/connectors/' + encodeURIComponent(dbkId) + '/' + encodeURIComponent(selectedBridgeId) + '/health',
        { method: 'POST', headers: { Authorization: 'Bearer ' + token } },
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        const reason = data.health?.details?.reason || data.error?.message || 'Provider health check failed.';
        throw new Error(reason);
      }
      setSaveSuccess('Provider connection is healthy. Refreshing workspace readiness…');
      await onRefreshExperience();
    } catch (error: any) {
      setSaveError(error?.message || 'Provider health check failed.');
      await onRefreshExperience();
    } finally {
      setHealthTesting(false);
    }
  };

  const configuredCount = connections.filter((connection) => connection.status === 'CONFIGURED' || connection.ready).length;

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-3xl border border-neutral-200 bg-white shadow-sm">
        <div className="border-b border-neutral-100 p-5 sm:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                <Sliders className="h-3.5 w-3.5" />
                Workspace settings
              </div>
              <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">Keep your business connected.</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-500">
                Configure the services your business uses. TDBK keeps each connection scoped to this workspace and shows the current operational state.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Connected</div>
                <div className="mt-1 text-lg font-bold">{connections.filter((c) => c.ready).length}</div>
              </div>
              <div className="rounded-2xl bg-neutral-50 px-4 py-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Configured</div>
                <div className="mt-1 text-lg font-bold">{configuredCount}</div>
              </div>
              <div className="rounded-2xl bg-neutral-50 px-4 py-3 col-span-2 sm:col-span-1">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">Plan</div>
                <div className="mt-1 text-lg font-bold">{subscriptionTier}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-7">
          <div className="grid gap-3 lg:grid-cols-3">
            {connections.map((connection) => {
              const meta = providerMeta[connection.provider] || { name: connection.provider, description: 'Business service connection.', icon: Link2 };
              const Icon = meta.icon;
              const status = statusView(connection);
              const requirements = bridgeRequirements[connection.bridgeId] || [];
              const tierBlocked = connection.blockers.some((blocker) => /tier|entitlement/i.test(blocker));

              return (
                <article key={connection.bridgeId} className="flex min-h-[220px] flex-col rounded-2xl border border-neutral-200 bg-neutral-50/70 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-neutral-700 shadow-sm ring-1 ring-neutral-200">
                      <Icon className="h-5 w-5" />
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${toneClasses[status.tone]}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-4">
                    <h2 className="text-base font-bold">{meta.name}</h2>
                    <p className="mt-1 text-xs leading-5 text-neutral-500">{meta.description}</p>
                  </div>

                  <div className="mt-4 space-y-2 text-xs">
                    <div className="flex items-center justify-between rounded-xl bg-white px-3 py-2 ring-1 ring-neutral-100">
                      <span className="text-neutral-500">Health</span>
                      <span className="font-semibold text-neutral-800">{connection.healthStatus}</span>
                    </div>
                    {connection.blockers[0] && (
                      <div className="rounded-xl bg-amber-50 px-3 py-2 text-amber-800">
                        {connection.blockers[0]}
                      </div>
                    )}
                  </div>

                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      onClick={() => openConnector(connection.bridgeId)}
                      disabled={tierBlocked}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-950 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                    >
                      {connection.ready ? 'Manage connection' : 'Set up connection'}
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="mt-3 flex items-center gap-2 text-[10px] text-neutral-400">
                    <PlugZap className="h-3.5 w-3.5" />
                    {requirements.length} configuration fields
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {selectedConnection && (
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2 text-emerald-700">
                <Settings2 className="h-5 w-5" />
                <span className="text-sm font-black uppercase tracking-wider">Connection setup</span>
              </div>
              <h2 className="mt-2 text-xl font-bold">{providerMeta[selectedConnection.provider]?.name || selectedConnection.provider}</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-neutral-500">
                Enter configuration details below. Secret fields accept the name of an existing GCP Secret Manager reference; TDBK does not store raw secret material in this form.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedBridgeId(null)}
              className="rounded-xl border border-neutral-200 px-3 py-2 text-xs font-bold text-neutral-600 hover:bg-neutral-50"
            >
              Close
            </button>
          </div>

          {saveError && (
            <div className="mt-5 flex items-start gap-2 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{saveError}</span>
            </div>
          )}

          {saveSuccess && (
            <div className="mt-5 flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              <CheckCircle2 className="h-4 w-4" />
              {saveSuccess}
            </div>
          )}

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(bridgeRequirements[selectedConnection.bridgeId] || []).map((key) => {
              const secret = isSecretField(key);
              return (
                <label key={key} className="block">
                  <span className="mb-2 flex items-center gap-2 text-xs font-bold text-neutral-700">
                    {secret ? <KeyRound className="h-3.5 w-3.5 text-amber-600" /> : <Link2 className="h-3.5 w-3.5 text-neutral-400" />}
                    {fieldLabel(key)}
                    <span className="ml-auto text-[10px] font-normal text-neutral-400">{secret ? 'Secret reference' : 'Required'}</span>
                  </span>
                  <input
                    value={draft[key] || ''}
                    onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value }))}
                    type={secret ? 'text' : key.includes('PORT') ? 'number' : 'text'}
                    placeholder={secret ? 'projects/.../secrets/...' : `Enter ${fieldLabel(key).toLowerCase()}`}
                    className="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3.5 py-3 text-sm outline-none focus:border-neutral-400 focus:bg-white focus:ring-2 focus:ring-neutral-100"
                  />
                </label>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-neutral-100 bg-neutral-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-xs text-neutral-500">
              <span className="font-semibold text-neutral-700">Security boundary:</span> provider secrets are referenced, not persisted as raw values.
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={testConnection}
                disabled={healthTesting || saving || selectedConnection.status !== 'CONFIGURED'}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-neutral-300 bg-white px-5 py-3 text-sm font-bold text-neutral-800 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {healthTesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
                {healthTesting ? 'Testing…' : 'Test connection'}
              </button>
              <button
                type="button"
                onClick={saveConnector}
                disabled={saving || healthTesting}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-neutral-950 px-5 py-3 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                {saving ? 'Saving…' : 'Save connection'}
              </button>
            </div>
          </div>

          <div className="mt-4 text-[11px] text-neutral-400">
            Connection: {selectedConnection.bridgeId} · Workspace: {dbkId}
          </div>
        </section>
      )}

      <TeamRolesPanel tenantId={dbkId} onChanged={onRefreshExperience} />

      <div className="grid gap-6 md:grid-cols-2">
        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Building2 className="h-4 w-4 text-neutral-700" />
            <h2 className="text-sm font-bold">Business identity</h2>
          </div>
          <div className="mt-4 space-y-0 text-sm">
            {[
              ['Brand', displayName],
              ['Legal name', legalName],
              ['Business type', sector],
              ['Plan', subscriptionTier],
              ['Workspace version', `v${workspaceVersion}.${configurationVersion}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between gap-4 border-b border-neutral-100 py-3 last:border-b-0">
                <span className="text-neutral-500">{label}</span>
                <span className="text-right font-semibold text-neutral-900">{value}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <GitBranch className="h-4 w-4 text-emerald-700" />
            <h2 className="text-sm font-bold">Locations</h2>
          </div>
          <div className="mt-4 space-y-2">
            {availableBranches.map((branch) => (
              <div key={branch.branchId} className={`flex items-center justify-between rounded-2xl border px-4 py-3 ${branch.branchId === activeBranch.branchId ? 'border-emerald-200 bg-emerald-50' : 'border-neutral-100 bg-neutral-50'}`}>
                <div>
                  <div className="text-sm font-semibold">{branch.name}</div>
                  <div className="mt-0.5 text-[10px] text-neutral-400">{branch.isHeadquarters ? 'Main location' : 'Branch'}</div>
                </div>
                {branch.branchId === activeBranch.branchId && <span className="rounded-full bg-emerald-100 px-2 py-1 text-[10px] font-bold text-emerald-700">ACTIVE</span>}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm md:col-span-2 sm:p-7">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Layers className="h-4 w-4 text-neutral-700" />
            <h2 className="text-sm font-bold">Business language</h2>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {Object.entries(terminology).map(([key, val]: [string, any]) => (
              <div key={key} className="rounded-2xl bg-neutral-50 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-neutral-400">{key}</div>
                <div className="mt-1 text-sm font-semibold text-neutral-800">
                  {typeof val === 'object' ? `${val.singular} / ${val.plural}` : String(val)}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsView;
