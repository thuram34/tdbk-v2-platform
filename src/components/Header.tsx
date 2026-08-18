import React from 'react';
import { Shield, ShieldAlert, CheckCircle2, Server, Lock, Database } from 'lucide-react';

interface HeaderProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  healthStatus: string;
}

export const Header: React.FC<HeaderProps> = ({ activeTab, setActiveTab, healthStatus }) => {
  return (
    <header className="bg-[#141414] text-white border-b border-neutral-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
              <Shield className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono tracking-wider uppercase text-emerald-400 font-semibold">TDBK V2 PLATFORM</span>
                <span className="text-[10px] bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded font-mono border border-neutral-700">PHASE 0: FOUNDATIONS</span>
              </div>
              <h1 className="text-lg font-bold tracking-tight text-white">Kernel & Multi-Tenant Authority Console</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 bg-neutral-900 px-3 py-1.5 rounded border border-neutral-800 text-xs">
              <Server className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-neutral-400">Layer 1 Kernel:</span>
              <span className="text-emerald-400 font-medium">SERVER AUTHORITATIVE</span>
            </div>

            <div className="flex items-center space-x-2 bg-neutral-900 px-3 py-1.5 rounded border border-neutral-800 text-xs">
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-neutral-400">Database:</span>
              <span className="text-white font-medium font-mono">Firestore Native Mode</span>
            </div>

            <div className="flex items-center space-x-2 bg-emerald-950/80 px-3 py-1.5 rounded border border-emerald-800/80 text-xs text-emerald-300">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span className="font-semibold">Health: {healthStatus}</span>
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex space-x-1 mt-4 border-t border-neutral-800/80 pt-2 overflow-x-auto">
          {[
            { id: 'test-suite', label: 'Phase 0 Security Test Runner (12 Tests)', icon: Lock },
            { id: 'security-inspector', label: 'Security Context & Tenant Inspector', icon: ShieldAlert },
            { id: 'audit-stream', label: 'Real-Time Audit Event Stream', icon: Server },
            { id: 'definition-of-done', label: 'Phase 0 Definition of Done & Rules', icon: CheckCircle2 },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-t border-b-2 transition-colors whitespace-nowrap ${
                  isActive
                    ? 'border-emerald-500 bg-neutral-900 text-white font-semibold'
                    : 'border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-900/50'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-emerald-400' : 'text-neutral-400'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
