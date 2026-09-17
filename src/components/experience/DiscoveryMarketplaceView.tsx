import React, { useState } from 'react';
import { DbkExperienceResolved, ExperienceDiscoveryItem } from '../../experience/types';
import { DynamicIcon } from './IconHelper';
import { Sparkles, CheckCircle2, Lock, ArrowUpRight, Power, Sliders, ShieldCheck } from 'lucide-react';

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

  const handleToggleCapability = async (item: ExperienceDiscoveryItem) => {
    setActionInProgress(item.capabilityId);
    try {
      if (!item.isEnabled) {
        await onDispatchCommand('ENABLE_CAPABILITY', { capabilityId: item.capabilityId });
      }
      await onRefreshExperience();
    } catch (err) {
      console.error('Capability activation failed:', err);
      throw err;
    } finally {
      setActionInProgress(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                CAPABILITY MARKETPLACE
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-neutral-800 text-neutral-300">
                Tier: {subscriptionTier}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-2">Discover & Activate Business Capabilities</h1>
            <p className="text-xs text-neutral-400 mt-1">
              Enable sector-tailored modular engines, POS terminals, financial integrations, and tax bridges.
            </p>
          </div>
        </div>

        {/* Category Pills */}
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

      {/* Discovery Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div
            key={item.capabilityId}
            className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col justify-between"
          >
            <div>
              <div className="flex items-start justify-between">
                <div className="p-2 rounded bg-neutral-950 border border-neutral-800 text-indigo-400">
                  <DynamicIcon name={item.iconName} className="w-5 h-5" />
                </div>

                {item.isEnabled ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    OPERATIONAL
                  </span>
                ) : item.isEntitled ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                    READY TO ACTIVATE
                  </span>
                ) : (
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-neutral-800 text-neutral-400 border border-neutral-700">
                    <Lock className="w-2.5 h-2.5" />
                    <span>{item.minimumTier} TIER</span>
                  </span>
                )}
              </div>

              <h3 className="text-sm font-bold text-white mt-3">{item.name}</h3>
              <p className="text-xs text-neutral-400 mt-1 line-clamp-2">{item.description}</p>
            </div>

            <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between">
              <span className="text-[10px] font-mono text-neutral-500 uppercase">{item.category}</span>

              {item.isEnabled ? (
                <div className="flex items-center space-x-1 text-xs text-emerald-400 font-semibold">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Enabled</span>
                </div>
              ) : item.isEntitled ? (
                <button
                  onClick={() => handleToggleCapability(item)}
                  disabled={actionInProgress === item.capabilityId}
                  className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 cursor-pointer"
                >
                  <Power className="w-3 h-3" />
                  <span>{actionInProgress === item.capabilityId ? 'Enabling...' : 'Enable Capability'}</span>
                </button>
              ) : (
                <button
                  disabled
                  className="px-3 py-1.5 text-xs font-semibold rounded bg-neutral-800 text-neutral-500 cursor-not-allowed"
                >
                  Upgrade Required
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
