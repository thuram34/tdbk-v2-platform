import React, { useState } from 'react';
import { TokenVerifier } from '../../kernel/identity/tokenVerifier';
import {
  Building2,
  Plus,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Layers,
  Store,
  GraduationCap,
  Pill,
  Truck,
  Stethoscope,
  Hotel,
  CheckCircle2,
  AlertCircle,
  Loader2,
  LayoutDashboard,
  Cpu,
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
  onSelectDbk: (dbkId: string) => void;
  onRefreshDbks: () => void;
  onOpenTestSuite: () => void;
}

export const OwnerPortfolioView: React.FC<OwnerPortfolioViewProps> = ({
  dbks,
  onSelectDbk,
  onRefreshDbks,
  onOpenTestSuite,
}) => {
  const [isRegisterOpen, setIsRegisterOpen] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Form state for registration
  const [legalName, setLegalName] = useState<string>('');
  const [dbkId, setDbkId] = useState<string>('');
  const [blueprintId, setBlueprintId] = useState<string>('school_fee_structure');
  const [subscriptionTier, setSubscriptionTier] = useState<string>('PROFESSIONAL');
  const [branchName, setBranchName] = useState<string>('Headquarters');

  const blueprints = [
    { id: 'school_fee_structure', label: 'School / Academy', icon: GraduationCap, sector: 'EDUCATION' },
    { id: 'pos_register', label: 'Pharmacy / Retail POS', icon: Pill, sector: 'RETAIL' },
    { id: 'inventory_catalog', label: 'Hardware / Inventory', icon: Store, sector: 'COMMERCE' },
    { id: 'logistics_fleet', label: 'Logistics & Fleet Dispatch', icon: Truck, sector: 'LOGISTICS' },
    { id: 'clinic_patients', label: 'Clinic / Medical Practice', icon: Stethoscope, sector: 'HEALTHCARE' },
  ];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!legalName || !dbkId) {
      setError('Legal name and DBK ID are required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const masterToken = TokenVerifier.mintTestToken({
        uid: 'usr_master_admin',
        tenantId: 'tdbk_master',
        roles: ['TDBK_MASTER_ADMIN'],
        permissions: ['*'],
      });

      const res = await fetch('/api/platform/provision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${masterToken}`,
        },
        body: JSON.stringify({
          dbkId: dbkId.trim().toLowerCase().replace(/\s+/g, '_'),
          legalName,
          displayName: legalName,
          blueprintId,
          subscriptionTier,
          primaryBranchName: branchName || 'Headquarters',
        }),
      });

      const data = await res.json();
      if (res.ok && data.result?.success) {
        setIsRegisterOpen(false);
        setLegalName('');
        setDbkId('');
        onRefreshDbks();
        onSelectDbk(data.result.dbkId);
      } else {
        setError(data.error?.message || data.result?.error || 'Failed to provision business DBK.');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error during provisioning.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const autoGenerateId = (name: string) => {
    const slug = name.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
    setDbkId(slug);
  };

  const getBlueprintIcon = (bpId: string) => {
    if (bpId.includes('school')) return <GraduationCap className="w-6 h-6 text-indigo-600" />;
    if (bpId.includes('pos')) return <Pill className="w-6 h-6 text-emerald-600" />;
    if (bpId.includes('inventory')) return <Store className="w-6 h-6 text-amber-600" />;
    if (bpId.includes('logistics')) return <Truck className="w-6 h-6 text-blue-600" />;
    if (bpId.includes('clinic')) return <Stethoscope className="w-6 h-6 text-rose-600" />;
    return <Building2 className="w-6 h-6 text-neutral-600" />;
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-neutral-200 sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-neutral-900 text-white flex items-center justify-center font-bold text-lg shadow-sm">
            T
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-neutral-900 flex items-center gap-2">
              TDBK V2 Owner Portfolio
              <span className="text-xs bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-200">
                Authoritative Master
              </span>
            </h1>
            <p className="text-xs text-neutral-500">Multi-Business Operations & SHA UI Control Hub</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={onOpenTestSuite}
            className="px-3.5 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-lg transition-colors flex items-center gap-1.5"
          >
            <Cpu className="w-4 h-4 text-neutral-600" />
            Multi-Business Test Suite
          </button>
          <button
            onClick={() => setIsRegisterOpen(true)}
            className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Register Business
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-6 py-10">
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-neutral-900">My Operated Businesses</h2>
            <p className="text-sm text-neutral-500 mt-1">
              Select a business workspace to enter its dedicated SHA UI projection. Each business maintains strict tenant isolation, independent Business DNA, and its own external bridge connections.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs font-medium text-neutral-600 bg-white px-3 py-1.5 rounded-lg border border-neutral-200 shadow-2xs self-start">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Multi-Tenant Authoritative Isolation Active</span>
          </div>
        </div>

        {dbks.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center max-w-xl mx-auto shadow-xs mt-12">
            <div className="w-16 h-16 bg-neutral-100 text-neutral-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-neutral-900">Welcome to TDBK V2</h3>
            <p className="text-sm text-neutral-500 mt-1 mb-6">
              You currently have zero registered businesses in your operator portfolio. Register your first business to initialize its Business DNA and SHA UI projection.
            </p>
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="px-5 py-2.5 text-sm font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors inline-flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Register Your First Business
            </button>
          </div>
        ) : (
          /* Business Card Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {dbks.map((dbk) => {
              const branchCount = dbk.branchTopology?.length || 1;
              return (
                <div
                  key={dbk.dbkId}
                  className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group relative overflow-hidden"
                >
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-neutral-800 to-neutral-600 opacity-0 group-hover:opacity-15 transition-opacity" />
                  
                  <div>
                    <div className="flex items-start justify-between mb-4">
                      <div className="w-12 h-12 rounded-xl bg-neutral-100 flex items-center justify-center border border-neutral-200">
                        {getBlueprintIcon(dbk.blueprintId)}
                      </div>
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-neutral-100 text-neutral-700 border border-neutral-200 uppercase tracking-wide">
                        {dbk.sector || 'OPERATIONAL'}
                      </span>
                    </div>

                    <h3 className="text-lg font-bold text-neutral-900 group-hover:text-black transition-colors">
                      {dbk.displayName || dbk.legalName}
                    </h3>
                    <p className="text-xs text-neutral-500 mt-0.5 font-mono">ID: {dbk.dbkId}</p>

                    <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 gap-2 text-xs text-neutral-600">
                      <div className="flex items-center gap-1.5">
                        <Layers className="w-4 h-4 text-neutral-400" />
                        <span>{branchCount} {branchCount === 1 ? 'Branch' : 'Branches'}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-neutral-400" />
                        <span>Tier: {dbk.subscriptionTier || 'PRO'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-neutral-100 flex items-center justify-between">
                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {dbk.status || 'ACTIVE'}
                    </span>
                    <button
                      onClick={() => onSelectDbk(dbk.dbkId)}
                      className="px-3.5 py-2 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-900 hover:text-white rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs"
                    >
                      <span>Open SHA UI</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}

            {/* Add Business Card Tile */}
            <button
              onClick={() => setIsRegisterOpen(true)}
              className="bg-neutral-50 hover:bg-neutral-100 border-2 border-dashed border-neutral-300 rounded-2xl p-6 flex flex-col items-center justify-center text-center transition-all group min-h-[220px]"
            >
              <div className="w-12 h-12 rounded-xl bg-white border border-neutral-200 text-neutral-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform shadow-2xs">
                <Plus className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-neutral-800">Register Another Business</h4>
              <p className="text-xs text-neutral-500 mt-1 max-w-xs">
                Add a new school, pharmacy, hardware, or logistics entity to your portfolio.
              </p>
            </button>
          </div>
        )}
      </main>

      {/* Register Business Modal */}
      {isRegisterOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-neutral-200 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-neutral-200 mb-6">
              <div>
                <h3 className="text-lg font-bold text-neutral-900">Register New Business DBK</h3>
                <p className="text-xs text-neutral-500">Initialize authoritative Business DNA and Provisioning Service</p>
              </div>
              <button
                onClick={() => setIsRegisterOpen(false)}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Business Legal Name</label>
                <input
                  type="text"
                  required
                  value={legalName}
                  onChange={(e) => {
                    setLegalName(e.target.value);
                    autoGenerateId(e.target.value);
                  }}
                  placeholder="e.g. Hillcrest International School"
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Canonical DBK ID (Tenant Slug)</label>
                <input
                  type="text"
                  required
                  value={dbkId}
                  onChange={(e) => setDbkId(e.target.value)}
                  placeholder="e.g. hillcrest_school"
                  className="w-full px-3 py-2 text-sm font-mono bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
                />
                <p className="text-[11px] text-neutral-500 mt-1">Unique tenant identifier used for authoritative Firestore paths.</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">Industry Blueprint / Sector</label>
                <select
                  value={blueprintId}
                  onChange={(e) => setBlueprintId(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
                >
                  {blueprints.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.label} ({bp.sector})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">Subscription Tier</label>
                  <select
                    value={subscriptionTier}
                    onChange={(e) => setSubscriptionTier(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
                  >
                    <option value="STANDARD">Standard</option>
                    <option value="PROFESSIONAL">Professional</option>
                    <option value="ENTERPRISE">Enterprise</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">HQ Branch Name</label>
                  <input
                    type="text"
                    value={branchName}
                    onChange={(e) => setBranchName(e.target.value)}
                    placeholder="Headquarters"
                    className="w-full px-3 py-2 text-sm bg-neutral-50 border border-neutral-300 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-neutral-900"
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center justify-end space-x-3 border-t border-neutral-200 mt-6">
                <button
                  type="button"
                  onClick={() => setIsRegisterOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Provision Business DBK</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
