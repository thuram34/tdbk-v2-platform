import React, { useMemo, useState } from 'react';
import { useAuth } from '../../client/AuthContext';
import {
  AlertCircle,
  ArrowRight,
  Building2,
  CheckCircle2,
  GraduationCap,
  Hospital,
  Hotel,
  Layers,
  Loader2,
  Pill,
  Plus,
  RefreshCw,
  Store,
  Truck,
} from 'lucide-react';

interface DbkItem {
  dbkId: string;
  legalName: string;
  displayName: string;
  sector: string;
  blueprintId: string;
  subscriptionTier: string;
  status: string;
  branchTopology?: Array<any>;
}

interface OwnerPortfolioViewProps {
  dbks: DbkItem[];
  isLoading?: boolean;
  error?: string | null;
  onSelectDbk: (dbkId: string) => void;
  onRefreshDbks: () => void;
}

const getStatus = (status?: string) => {
  const value = (status || 'ACTIVE').toUpperCase();
  if (value.includes('PROVISION')) return { label: 'Setting up', tone: 'amber' };
  if (value.includes('SUSPEND') || value.includes('INACTIVE') || value.includes('DISABLED')) {
    return { label: 'Inactive', tone: 'neutral' };
  }
  if (value.includes('ERROR') || value.includes('FAILED')) return { label: 'Needs attention', tone: 'rose' };
  return { label: 'Active', tone: 'emerald' };
};

const statusClasses: Record<string, string> = {
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  amber: 'bg-amber-50 text-amber-700 border-amber-200',
  rose: 'bg-rose-50 text-rose-700 border-rose-200',
  neutral: 'bg-neutral-100 text-neutral-600 border-neutral-200',
};

const getIndustryIcon = (blueprintId: string, sector: string) => {
  const value = `${blueprintId} ${sector}`.toLowerCase();
  if (value.includes('school') || value.includes('education')) return <GraduationCap className="h-6 w-6" />;
  if (value.includes('clinic') || value.includes('health')) return <Hospital className="h-6 w-6" />;
  if (value.includes('hotel') || value.includes('hospitality')) return <Hotel className="h-6 w-6" />;
  if (value.includes('pharmacy') || value.includes('retail')) return <Pill className="h-6 w-6" />;
  if (value.includes('logistics')) return <Truck className="h-6 w-6" />;
  if (value.includes('hardware') || value.includes('commerce')) return <Store className="h-6 w-6" />;
  return <Building2 className="h-6 w-6" />;
};

const createInternalDbkId = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80);

export const OwnerPortfolioView: React.FC<OwnerPortfolioViewProps> = ({
  dbks,
  isLoading = false,
  error = null,
  onSelectDbk,
  onRefreshDbks,
}) => {
  const { getIdToken } = useAuth();
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState('school_v1');
  const [primaryLocation, setPrimaryLocation] = useState('');

  const organizationTypes = useMemo(() => [
    { id: 'school_v1', label: 'School / Academy', sector: 'Education' },
    { id: 'retail_v1', label: 'Pharmacy / Retail', sector: 'Retail' },
    { id: 'hardware_v1', label: 'Hardware / General Commerce', sector: 'Commerce' },
    { id: 'logistics_v1', label: 'Logistics & Fleet', sector: 'Logistics' },
    { id: 'clinic_v1', label: 'Clinic / Medical Practice', sector: 'Healthcare' },
  ], []);

  const openRegistration = () => {
    setFormError(null);
    setOrganizationName('');
    setPrimaryLocation('');
    setIsRegisterOpen(true);
  };

  const handleRegister = async (event: React.FormEvent) => {
    event.preventDefault();
    const name = organizationName.trim();
    if (!name) {
      setFormError('Enter your organization name.');
      return;
    }

    const internalDbkId = createInternalDbkId(name);
    if (!internalDbkId) {
      setFormError('Enter a valid organization name.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const idToken = await getIdToken(true);
      if (!idToken) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch('/api/platform/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          dbkId: internalDbkId,
          legalName: name,
          displayName: name,
          blueprintId: organizationType,
          subscriptionTier: 'FOUNDATION',
          primaryBranchName: primaryLocation.trim() || 'Headquarters',
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.result?.success) {
        setFormError(data.error?.message || data.result?.error || 'We could not set up your organization. Please try again.');
        return;
      }

      setIsRegisterOpen(false);
      onRefreshDbks();
      onSelectDbk(data.result.dbkId);
    } catch (err: any) {
      setFormError(err?.message || 'We could not connect to TDBK. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-neutral-900 text-lg font-bold text-white">T</div>
            <div className="min-w-0">
              <p className="truncate text-lg font-bold tracking-tight">My Organizations</p>
              <p className="hidden text-xs text-neutral-500 sm:block">Manage your organizations from one place.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={openRegistration}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Add organization</span>
            <span className="sm:hidden">Add</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <section className="mb-8">
          <p className="mb-2 text-sm font-semibold text-indigo-600">Your organizations</p>
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Manage your organizations</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-neutral-600 sm:text-base">
            Choose an organization to continue working, or add another organization to your portfolio.
          </p>
        </section>

        {isLoading ? (
          <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center shadow-sm">
            <RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-500" />
            <h2 className="mt-4 text-lg font-semibold">Loading your organizations</h2>
            <p className="mt-1 text-sm text-neutral-500">Getting the latest organization access from TDBK.</p>
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
              <div>
                <h2 className="font-semibold text-rose-900">We could not load your organizations</h2>
                <p className="mt-1 text-sm text-rose-800">{error}</p>
                <button
                  type="button"
                  onClick={onRefreshDbks}
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-rose-900 ring-1 ring-inset ring-rose-200 hover:bg-rose-100"
                >
                  <RefreshCw className="h-4 w-4" />
                  Try again
                </button>
              </div>
            </div>
          </div>
        ) : dbks.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 bg-white p-10 text-center shadow-sm sm:p-14">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
              <Building2 className="h-8 w-8" />
            </div>
            <h2 className="mt-5 text-xl font-bold">No organizations yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-neutral-500">
              Add your first organization and TDBK will guide you through setting it up.
            </p>
            <button
              type="button"
              onClick={openRegistration}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-3 text-sm font-semibold text-white hover:bg-neutral-800"
            >
              <Plus className="h-4 w-4" />
              Add your first organization
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {dbks.map((dbk) => {
              const status = getStatus(dbk.status);
              const branchCount = dbk.branchTopology?.length || 1;
              return (
                <article key={dbk.dbkId} className="flex min-h-[250px] flex-col rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-neutral-100 text-neutral-700">
                      {getIndustryIcon(dbk.blueprintId, dbk.sector)}
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClasses[status.tone]}`}>
                      {status.label}
                    </span>
                  </div>

                  <div className="mt-5 min-w-0">
                    <h2 className="truncate text-lg font-bold">{dbk.displayName || dbk.legalName}</h2>
                    <p className="mt-1 text-sm text-neutral-500">{dbk.sector || 'Organization'}</p>
                  </div>

                  <div className="mt-5 flex items-center gap-4 border-t border-neutral-100 pt-4 text-xs text-neutral-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Layers className="h-4 w-4" />
                      {branchCount} {branchCount === 1 ? 'location' : 'locations'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <CheckCircle2 className="h-4 w-4" />
                      TDBK connected
                    </span>
                  </div>

                  <div className="mt-auto pt-5">
                    <button
                      type="button"
                      onClick={() => onSelectDbk(dbk.dbkId)}
                      disabled={status.label === 'Inactive'}
                      className="flex w-full items-center justify-center gap-2 rounded-xl bg-neutral-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-200 disabled:text-neutral-500"
                    >
                      {status.label === 'Setting up' ? 'View setup' : 'Open organization'}
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </article>
              );
            })}

            <button
              type="button"
              onClick={openRegistration}
              className="flex min-h-[250px] flex-col items-center justify-center rounded-2xl border-2 border-dashed border-neutral-300 bg-neutral-50 p-6 text-center transition hover:border-neutral-400 hover:bg-white"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-neutral-600 shadow-sm">
                <Plus className="h-6 w-6" />
              </div>
              <span className="mt-4 text-sm font-bold">Add another organization</span>
              <span className="mt-1 max-w-xs text-xs leading-5 text-neutral-500">Schools, businesses, clinics, hotels, pharmacies and other supported organizations.</span>
            </button>
          </div>
        )}
      </main>

      {isRegisterOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" role="dialog" aria-modal="true" aria-labelledby="register-organization-title">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 id="register-organization-title" className="text-xl font-bold">Add an organization</h2>
                <p className="mt-1 text-sm text-neutral-500">Tell TDBK a little about the organization you want to manage.</p>
              </div>
              <button type="button" onClick={() => setIsRegisterOpen(false)} className="rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700" aria-label="Close">
                ×
              </button>
            </div>

            {formError && (
              <div className="mt-5 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="mt-6 space-y-5">
              <div>
                <label htmlFor="organization-name" className="mb-1.5 block text-sm font-semibold">Organization name</label>
                <input
                  id="organization-name"
                  required
                  value={organizationName}
                  onChange={(event) => setOrganizationName(event.target.value)}
                  placeholder="e.g. Hillcrest International School"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              <div>
                <label htmlFor="organization-type" className="mb-1.5 block text-sm font-semibold">What kind of organization is this?</label>
                <select
                  id="organization-type"
                  value={organizationType}
                  onChange={(event) => setOrganizationType(event.target.value)}
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm outline-none ring-indigo-500 focus:ring-2"
                >
                  {organizationTypes.map((type) => (
                    <option key={type.id} value={type.id}>{type.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="primary-location" className="mb-1.5 block text-sm font-semibold">Primary location <span className="font-normal text-neutral-400">(optional)</span></label>
                <input
                  id="primary-location"
                  value={primaryLocation}
                  onChange={(event) => setPrimaryLocation(event.target.value)}
                  placeholder="e.g. Mombasa"
                  className="w-full rounded-xl border border-neutral-300 bg-white px-3.5 py-3 text-sm outline-none ring-indigo-500 focus:ring-2"
                />
              </div>

              <div className="flex items-center justify-end gap-3 border-t border-neutral-100 pt-5">
                <button type="button" onClick={() => setIsRegisterOpen(false)} className="rounded-xl px-4 py-2.5 text-sm font-semibold text-neutral-600 hover:bg-neutral-100">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="inline-flex items-center gap-2 rounded-xl bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Setting up…' : 'Continue'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};