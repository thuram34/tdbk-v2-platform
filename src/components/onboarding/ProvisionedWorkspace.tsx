import React from 'react';
import {
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Cloud,
  FileText,
  Package,
  Receipt,
  Sparkles,
  Users,
  WalletCards,
} from 'lucide-react';

export interface ProvisionedBusiness {
  dbkId: string;
  businessName: string;
  businessType: string;
  branchName: string;
  capabilities: string[];
}

interface ProvisionedWorkspaceProps {
  business: ProvisionedBusiness;
  onEnterWorkspace: () => void;
}

const iconFor = (name: string) => {
  const value = name.toLowerCase();
  if (value.includes('pos') || value.includes('sale')) return Receipt;
  if (value.includes('inventory') || value.includes('stock')) return Package;
  if (value.includes('customer') || value.includes('crm')) return Users;
  if (value.includes('report') || value.includes('analytics')) return BarChart3;
  if (value.includes('mpesa') || value.includes('payment') || value.includes('finance')) return WalletCards;
  if (value.includes('cloud') || value.includes('sync')) return Cloud;
  return FileText;
};

export const ProvisionedWorkspace: React.FC<ProvisionedWorkspaceProps> = ({
  business,
  onEnterWorkspace,
}) => {
  return (
    <div className="min-h-screen bg-[#07181D] text-white">
      <header className="border-b border-white/10 bg-[#07181D]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <div className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <span>TDBK</span><span className="text-emerald-400">.</span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-white/55">
              Thuram Digital Bridge Kenya
            </p>
          </div>
          <div className="hidden rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-bold text-emerald-300 sm:block">
            WORKSPACE PROVISIONED
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-5 py-8 sm:px-8 sm:py-12">
        <section className="relative overflow-hidden rounded-[32px] border border-white/10 bg-gradient-to-br from-[#102B31] via-[#0A2025] to-[#07181D] p-6 shadow-2xl sm:p-10 lg:p-12">
          <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />
          <div className="relative grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Your business is ready
              </div>
              <h1 className="mt-5 max-w-2xl text-4xl font-black tracking-tight sm:text-5xl">
                {business.businessName}
              </h1>
              <p className="mt-3 text-lg text-white/65">
                Your TDBK operating workspace has been provisioned for {business.businessType.toLowerCase()}.
              </p>

              <div className="mt-7 grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Business</p>
                  <p className="mt-1 text-sm font-bold">{business.businessType}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Main location</p>
                  <p className="mt-1 text-sm font-bold">{business.branchName}</p>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                  <p className="text-[10px] font-black uppercase tracking-wider text-white/45">Workspace</p>
                  <p className="mt-1 text-sm font-bold text-emerald-300">Active</p>
                </div>
              </div>

              <button
                type="button"
                onClick={onEnterWorkspace}
                className="mt-8 inline-flex items-center gap-2 rounded-2xl bg-emerald-500 px-6 py-3.5 text-sm font-black text-[#061519] shadow-lg shadow-emerald-500/20 transition hover:bg-emerald-400"
              >
                Enter my workspace
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="rounded-[28px] border border-white/10 bg-black/20 p-4 sm:p-5">
              <div className="rounded-[22px] border border-white/10 bg-[#0B171A] p-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-white/10 pb-4">
                  <div>
                    <p className="text-xs font-black text-white">{business.businessName}</p>
                    <p className="mt-0.5 text-[10px] text-white/40">TDBK Business Workspace</p>
                  </div>
                  <span className="rounded-full bg-emerald-400/10 px-2.5 py-1 text-[9px] font-black text-emerald-300">ONLINE</span>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2.5">
                  {business.capabilities.slice(0, 8).map((capability) => {
                    const Icon = iconFor(capability);
                    return (
                      <div key={capability} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                        <Icon className="h-4 w-4 text-emerald-300" />
                        <p className="mt-2 text-[11px] font-bold text-white/85">{capability}</p>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 rounded-xl border border-emerald-400/15 bg-emerald-400/[0.06] p-3">
                  <div className="flex items-center gap-2 text-[11px] font-bold text-emerald-200">
                    <Sparkles className="h-3.5 w-3.5" />
                    Business DNA configured
                  </div>
                  <p className="mt-1 text-[10px] leading-5 text-white/45">
                    Your workspace is routed from the business type and authoritative capabilities you selected.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-6 grid gap-3 sm:grid-cols-3">
          {[
            ['Identity', 'Your account is connected to this business.'],
            ['Capabilities', 'Starting tools are ready for your workspace.'],
            ['Cloud', 'Business state is persisted through TDBK.'],
          ].map(([title, body]) => (
            <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              <p className="mt-3 text-sm font-bold">{title}</p>
              <p className="mt-1 text-xs leading-5 text-white/45">{body}</p>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
};

export default ProvisionedWorkspace;
