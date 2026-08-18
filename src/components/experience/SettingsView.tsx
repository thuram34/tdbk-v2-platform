import React from 'react';
import { DbkExperienceResolved } from '../../experience/types';
import { Sliders, Building2, GitBranch, Layers, ShieldCheck, Database, RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  experience: DbkExperienceResolved;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => Promise<any>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ experience }) => {
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
    serverTimestamp,
  } = experience;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex items-center space-x-2">
          <Sliders className="w-4 h-4 text-indigo-400" />
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
            BUSINESS DNA & WORKSPACE CONFIGURATION
          </span>
        </div>
        <h1 className="text-xl font-bold text-white mt-2">DBK Workspace Configuration</h1>
        <p className="text-xs text-neutral-400 mt-1">
          Authoritative server state bound to DBK Identity, Kernel Security, Branch Topology & Sector Blueprints.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Business DNA Card */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-neutral-800">
            <Building2 className="w-4 h-4 text-indigo-400" />
            <h2 className="text-sm font-bold text-white">Business DNA Identity</h2>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
              <span className="text-neutral-400">DBK Tenant ID:</span>
              <span className="font-mono text-white">{dbkId}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
              <span className="text-neutral-400">Legal Business Name:</span>
              <span className="font-medium text-white">{legalName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
              <span className="text-neutral-400">Display Brand Name:</span>
              <span className="font-medium text-white">{displayName}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
              <span className="text-neutral-400">Sector Blueprint:</span>
              <span className="font-mono text-indigo-400 font-bold">{sector}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-neutral-800/60">
              <span className="text-neutral-400">Subscription Tier:</span>
              <span className="font-mono text-emerald-400 font-bold">{subscriptionTier}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-neutral-400">Workspace / Config Version:</span>
              <span className="font-mono text-neutral-300">v{workspaceVersion}.{configurationVersion}</span>
            </div>
          </div>
        </div>

        {/* Branch Topology */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4">
          <div className="flex items-center space-x-2 pb-3 border-b border-neutral-800">
            <GitBranch className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-white">Branch Topology</h2>
          </div>

          <div className="space-y-2 text-xs">
            {availableBranches.map((br) => (
              <div
                key={br.branchId}
                className={`p-3 rounded border flex items-center justify-between ${
                  br.branchId === activeBranch.branchId
                    ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-300'
                    : 'bg-neutral-950 border-neutral-800 text-neutral-400'
                }`}
              >
                <div>
                  <div className="font-semibold text-white">{br.name}</div>
                  <div className="text-[10px] font-mono text-neutral-500">{br.branchId}</div>
                </div>

                <div className="flex items-center space-x-2">
                  {br.isHeadquarters && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      HQ
                    </span>
                  )}
                  {br.branchId === activeBranch.branchId && (
                    <span className="px-2 py-0.5 text-[9px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      ACTIVE
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Terminology Map Inspector */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 space-y-4 md:col-span-2">
          <div className="flex items-center space-x-2 pb-3 border-b border-neutral-800">
            <Layers className="w-4 h-4 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Active Blueprint Terminology Mappings</h2>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(terminology).map(([key, val]: [string, any]) => (
              <div key={key} className="bg-neutral-950 p-3 rounded border border-neutral-800">
                <div className="text-[10px] font-mono text-neutral-500 uppercase">{key}</div>
                <div className="text-xs font-semibold text-white mt-1">
                  {typeof val === 'object' ? `${val.singular} / ${val.plural}` : String(val)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
