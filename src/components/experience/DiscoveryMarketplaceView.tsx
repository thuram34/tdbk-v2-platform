import React, { useState } from 'react';
import { DbkExperienceResolved, ExperienceDiscoveryItem } from '../../experience/types';
import { DynamicIcon } from './IconHelper';
import { Sparkles, CheckCircle2, Lock, Power, Settings2, Ban, AlertTriangle } from 'lucide-react';

interface DiscoveryMarketplaceViewProps {
  experience: DbkExperienceResolved;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => Promise<any>;
  onRefreshExperience: () => Promise<void>;
}

export const DiscoveryMarketplaceView: React.FC<DiscoveryMarketplaceViewProps> = ({
  experience,
  onDispatchCommand,
  onRefreshExperience,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const { discoveryItems, subscriptionTier } = experience;

  const categories = ['ALL', ...Array.from(new Set(discoveryItems.map((d) => d.category)))];

  const filteredItems = discoveryItems.filter(
    (item) => selectedCategory === 'ALL' || item.category === selectedCategory
  );

  const handleEnableCapability = async (item: ExperienceDiscoveryItem) => {
    setActionInProgress(item.capabilityId);
    try {
      await onDispatchCommand('ENABLE_CAPABILITY', { capabilityId: item.capabilityId });
      await onRefreshExperience();
    } catch (err) {
      console.error('Capability activation failed:', err);
      throw err;
    } finally {
      setActionInProgress(null);
    }
  };

  const statusPresentation = (item: ExperienceDiscoveryItem) => {
    switch (item.status) {
      case 'OPERATIONAL':
        return {
          label: 'OPERATIONAL',
          className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
          icon: CheckCircle2,
        };
      case 'UPGRADE_REQUIRED':
        return {
          label: `${item.minimumTier} TIER`,
          className: 'bg-neutral-800 text-neutral-400 border-neutral-700',
          icon: Lock,
        };
      case 'CONFIGURATION_REQUIRED':
        return {
          label: 'CONFIGURATION REQUIRED',
          className: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
          icon: Settings2,
        };
      case 'SUSPENDED':
        return {
          label: 'SUSPENDED',
          className: 'bg-red-500/20 text-red-400 border-red-500/30',
          icon: Ban,
        };
      case 'DISCOVERABLE':
      default:
        return {
          label: 'READY TO ACTIVATE',
          className: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30',
          icon: Power,
        };
    }
  };

  const actionFor = (item: ExperienceDiscoveryItem) => {
    switch (item.status) {
      case 'OPERATIONAL':
        return <div className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold"><CheckCircle2 className="w-3.5 h-3.5" /><span>Enabled</span></div>;
      case 'DISCOVERABLE':
        if (!item.isEntitled) {
          return <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500">Entitlement required</span>;
        }
        return (
          <button
            onClick={() => handleEnableCapability(item)}
            disabled={actionInProgress === item.capabilityId}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 cursor-pointer"
          >
            <Power className="w-3 h-3" />
            <span>{actionInProgress === item.capabilityId ? 'Enabling...' : 'Enable Capability'}</span>
          </button>
        );
      case 'UPGRADE_REQUIRED':
        return <button disabled className="px-3 py-1.5 text-xs font-semibold rounded bg-neutral-800 text-neutral-500 cursor-not-allowed">Upgrade Required</button>;
      case 'CONFIGURATION_REQUIRED':
        return <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-amber-400"><AlertTriangle className="w-3 h-3" />Configuration required</span>;
      case 'SUSPENDED':
        return <span className="text-[10px] font-semibold uppercase tracking-wide text-red-400">Unavailable</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                CAPABILITY DISCOVERY
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-neutral-800 text-neutral-300">
                Tier: {subscriptionTier}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-2">Discover & Activate Business Capabilities</h1>
            <p className="text-xs text-neutral-400 mt-1">
              Capability availability and activation state below are resolved by the TDBK Engine for this organization.
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2 mt-4 pt-4 border-t border-neutral-800 overflow-x-auto">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-neutral-950 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => {
          const presentation = statusPresentation(item);
          const StatusIcon = presentation.icon;

          return (
            <div key={item.capabilityId} className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded bg-neutral-950 border border-neutral-800 text-indigo-400">
                    <DynamicIcon name={item.iconName} className="w-5 h-5" />
                  </div>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border ${presentation.className}`}>
                    <StatusIcon className="w-2.5 h-2.5" />
                    {presentation.label}
                  </span>
                </div>

                <h3 className="text-sm font-bold text-white mt-3">{item.name}</h3>
                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{item.description}</p>
              </div>

              <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between gap-3">
                <span className="text-[10px] font-mono text-neutral-500 uppercase">{item.category}</span>
                {actionFor(item)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
