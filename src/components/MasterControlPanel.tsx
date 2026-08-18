import React, { useState, useEffect } from 'react';
import {
  Server,
  Layers,
  CheckCircle2,
  AlertOctagon,
  Play,
  RotateCcw,
  Archive,
  RefreshCw,
  Eye,
  GitBranch,
  Building2,
  Sparkles,
  Zap,
} from 'lucide-react';
import { dbkRegistry } from '../platform/dbkRegistry';
import { provisioningService } from '../platform/provisioning/provisioningService';
import { dbkLifecycleManager } from '../platform/lifecycle/lifecycleManager';
import { experienceProjection } from '../platform/projection/experienceProjection';
import { blueprintRegistry } from '../blueprint/registry';
import { DbkIdentity, DbkExperienceProjection } from '../platform/types';
import { SubscriptionTier } from '../capability/types';
import { SecurityContext } from '../kernel/types';

export const MasterControlPanel: React.FC = () => {
  const [dbks, setDbks] = useState<DbkIdentity[]>([]);
  const [selectedDbkId, setSelectedDbkId] = useState<string>('');
  const [projection, setProjection] = useState<DbkExperienceProjection | null>(null);
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form State for New Provisioning
  const [newDbkId, setNewDbkId] = useState('dbk_demo_school_01');
  const [newLegalName, setNewLegalName] = useState('Premier Academy Nairobi');
  const [newBlueprintId, setNewBlueprintId] = useState('school_v1');
  const [newTier, setNewTier] = useState<SubscriptionTier>('PRO');

  const masterContext: SecurityContext = {
    requestId: `req_ui_${Date.now()}`,
    timestamp: new Date().toISOString(),
    principal: {
      id: 'usr_master_admin_console',
      tenantId: 'master',
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      authTime: Date.now(),
      tokenSource: 'SESSION',
      isMaster: true,
    },
    tenantContext: null,
    branchContext: null,
    correlationId: `corr_ui_${Date.now()}`,
  };

  const reloadDbks = () => {
    try {
      const allDbks = dbkRegistry.listAllDbks(masterContext);
      setDbks(allDbks);
      if (allDbks.length > 0 && !selectedDbkId) {
        setSelectedDbkId(allDbks[0].dbkId);
      }
    } catch {
      setDbks([]);
    }
  };

  useEffect(() => {
    reloadDbks();
  }, []);

  useEffect(() => {
    if (selectedDbkId) {
      try {
        const proj = experienceProjection.getExperienceProjection(masterContext, selectedDbkId);
        setProjection(proj);
      } catch {
        setProjection(null);
      }
    }
  }, [selectedDbkId, dbks]);

  const handleProvision = async () => {
    setProvisionLoading(true);
    setActionMessage(null);
    try {
      const result = await provisioningService.provisionDbk(masterContext, {
        dbkId: newDbkId,
        legalName: newLegalName,
        displayName: newLegalName,
        blueprintId: newBlueprintId,
        subscriptionTier: newTier,
        primaryBranchName: 'Main Campus',
        secondaryBranches: [
          {
            branchId: `${newDbkId}_cbd`,
            name: 'CBD Annex',
            type: 'CAMPUS',
          },
        ],
      });

      if (result.success) {
        setActionMessage({
          type: 'success',
          text: `DBK '${result.dbkId}' successfully provisioned with status '${result.status}'.`,
        });
        reloadDbks();
        setSelectedDbkId(result.dbkId);
      } else {
        setActionMessage({
          type: 'error',
          text: `Provisioning failed: ${result.error}`,
        });
      }
    } catch (err: any) {
      setActionMessage({
        type: 'error',
        text: `Exception during provisioning: ${err.message}`,
      });
    } finally {
      setProvisionLoading(false);
    }
  };

  const handleSuspend = (dbkId: string) => {
    try {
      dbkLifecycleManager.suspendDbk(masterContext, dbkId, 'Suspension requested via Master Console');
      setActionMessage({ type: 'success', text: `DBK '${dbkId}' is now SUSPENDED.` });
      reloadDbks();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleReactivate = (dbkId: string) => {
    try {
      dbkLifecycleManager.reactivateDbk(masterContext, dbkId, 'Reactivation requested via Master Console');
      setActionMessage({ type: 'success', text: `DBK '${dbkId}' is now ACTIVE.` });
      reloadDbks();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleArchive = (dbkId: string) => {
    try {
      dbkLifecycleManager.archiveDbk(masterContext, dbkId, 'Archived via Master Console');
      setActionMessage({ type: 'success', text: `DBK '${dbkId}' is now ARCHIVED (historical records preserved).` });
      reloadDbks();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleRestore = (dbkId: string) => {
    try {
      dbkLifecycleManager.restoreDbk(masterContext, dbkId, 'Restored from archive via Master Console');
      setActionMessage({ type: 'success', text: `DBK '${dbkId}' is now RESTORED to ACTIVE.` });
      reloadDbks();
    } catch (err: any) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const blueprints = blueprintRegistry.getAllBlueprints();
  const selectedDbk = dbks.find((d) => d.dbkId === selectedDbkId);

  return (
    <div className="space-y-6" id="master-control-panel">
      {/* Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-100">
                TDBK Master Control & DBK Provisioning Console
              </h2>
              <p className="text-xs text-slate-400">
                Phase 4 Server-Authoritative Provisioning, Lifecycle State Machine & DBK Registry
              </p>
            </div>
          </div>
          <button
            onClick={reloadDbks}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Registry</span>
          </button>
        </div>

        {actionMessage && (
          <div
            className={`mt-4 p-3 rounded-lg text-xs flex items-center space-x-2 ${
              actionMessage.type === 'success'
                ? 'bg-emerald-950/60 border border-emerald-800/60 text-emerald-300'
                : 'bg-rose-950/60 border border-rose-800/60 text-rose-300'
            }`}
          >
            {actionMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertOctagon className="w-4 h-4 shrink-0" />
            )}
            <span>{actionMessage.text}</span>
          </div>
        )}
      </div>

      {/* Grid: Provisioning Form + DBK Registry */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Provision New DBK Form */}
        <div className="lg:col-span-5 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center space-x-2 pb-2 border-b border-slate-800">
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <h3 className="text-sm font-semibold text-slate-200">Provision Dedicated Business Instance</h3>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1">Target DBK ID (Unique Tenant Namespace)</label>
              <input
                type="text"
                value={newDbkId}
                onChange={(e) => setNewDbkId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-slate-400 mb-1">Business Legal Name</label>
              <input
                type="text"
                value={newLegalName}
                onChange={(e) => setNewLegalName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-400 mb-1">Sector Blueprint</label>
                <select
                  value={newBlueprintId}
                  onChange={(e) => setNewBlueprintId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  {blueprints.map((bp) => (
                    <option key={bp.id} value={bp.id}>
                      {bp.name} ({bp.sector})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Subscription Tier</label>
                <select
                  value={newTier}
                  onChange={(e) => setNewTier(e.target.value as SubscriptionTier)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="FREE">Free</option>
                  <option value="FOUNDATION">Foundation</option>
                  <option value="GROWTH">Growth</option>
                  <option value="PRO">Pro</option>
                  <option value="ENTERPRISE">Enterprise</option>
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={handleProvision}
                disabled={provisionLoading}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-medium flex items-center justify-center space-x-2 transition shadow-sm"
              >
                {provisionLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Executing Provisioning Workflow...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    <span>Execute Authoritative Provisioning</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* DBK Registry Listing */}
        <div className="lg:col-span-7 bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-semibold text-slate-200">
                Provisioned DBK Instances ({dbks.length})
              </h3>
            </div>
            <span className="text-xs text-slate-400">Canonical Path: /tenants/&#123;dbkId&#125;</span>
          </div>

          {dbks.length === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">
              No DBKs provisioned in registry yet. Use the form on the left to provision a DBK instance.
            </div>
          ) : (
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {dbks.map((dbk) => (
                <div
                  key={dbk.dbkId}
                  onClick={() => setSelectedDbkId(dbk.dbkId)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition ${
                    selectedDbkId === dbk.dbkId
                      ? 'bg-slate-800/90 border-indigo-500/80 shadow-sm'
                      : 'bg-slate-950/50 border-slate-800/80 hover:bg-slate-800/50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-200">{dbk.displayName}</span>
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">
                        {dbk.dbkId}
                      </span>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-full font-mono text-[10px] uppercase font-semibold ${
                        dbk.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          : dbk.status === 'SUSPENDED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : dbk.status === 'ARCHIVED'
                          ? 'bg-slate-500/10 text-slate-400 border border-slate-500/20'
                          : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                      }`}
                    >
                      {dbk.status}
                    </span>
                  </div>

                  <div className="flex items-center space-x-4 mt-2 text-[11px] text-slate-400">
                    <span>Sector: <strong className="text-slate-300 font-normal">{dbk.sector}</strong></span>
                    <span>Tier: <strong className="text-indigo-300 font-normal">{dbk.subscriptionTier}</strong></span>
                    <span>Branches: <strong className="text-slate-300 font-normal">{dbk.branchTopology?.length || 1}</strong></span>
                    <span>Workspace: <strong className="text-slate-300 font-normal">v{dbk.workspaceVersion}</strong></span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Selected DBK Lifecycle & Projection Inspector */}
      {selectedDbk && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h3 className="text-base font-semibold text-slate-100 flex items-center space-x-2">
                <span>{selectedDbk.displayName}</span>
                <span className="text-xs font-mono text-slate-400 font-normal">({selectedDbk.dbkId})</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Blueprint: <span className="text-slate-300">{selectedDbk.blueprintId}@{selectedDbk.blueprintVersion}</span> | Created By: <span className="text-slate-300">{selectedDbk.createdBy}</span>
              </p>
            </div>

            {/* Lifecycle Controls */}
            <div className="flex items-center space-x-2 text-xs">
              {selectedDbk.status === 'ACTIVE' && (
                <>
                  <button
                    onClick={() => handleSuspend(selectedDbk.dbkId)}
                    className="px-3 py-1.5 bg-amber-600/20 text-amber-300 border border-amber-600/40 rounded-lg hover:bg-amber-600/30 transition flex items-center space-x-1"
                  >
                    <AlertOctagon className="w-3.5 h-3.5" />
                    <span>Suspend DBK</span>
                  </button>
                  <button
                    onClick={() => handleArchive(selectedDbk.dbkId)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition flex items-center space-x-1"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                </>
              )}

              {selectedDbk.status === 'SUSPENDED' && (
                <>
                  <button
                    onClick={() => handleReactivate(selectedDbk.dbkId)}
                    className="px-3 py-1.5 bg-emerald-600/20 text-emerald-300 border border-emerald-600/40 rounded-lg hover:bg-emerald-600/30 transition flex items-center space-x-1"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>Reactivate DBK</span>
                  </button>
                  <button
                    onClick={() => handleArchive(selectedDbk.dbkId)}
                    className="px-3 py-1.5 bg-slate-800 text-slate-300 border border-slate-700 rounded-lg hover:bg-slate-700 transition flex items-center space-x-1"
                  >
                    <Archive className="w-3.5 h-3.5" />
                    <span>Archive</span>
                  </button>
                </>
              )}

              {selectedDbk.status === 'ARCHIVED' && (
                <button
                  onClick={() => handleRestore(selectedDbk.dbkId)}
                  className="px-3 py-1.5 bg-indigo-600/20 text-indigo-300 border border-indigo-600/40 rounded-lg hover:bg-indigo-600/30 transition flex items-center space-x-1"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restore from Archive</span>
                </button>
              )}
            </div>
          </div>

          {/* Details Tabs: Branches, Projection, Lifecycle History */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Branch Topology */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <GitBranch className="w-3.5 h-3.5 text-blue-400" />
                <span>Branch Topology ({selectedDbk.branchTopology?.length || 0})</span>
              </div>
              <div className="space-y-2 text-xs">
                {selectedDbk.branchTopology?.map((branch) => (
                  <div key={branch.branchId} className="p-2 bg-slate-900 rounded border border-slate-800">
                    <div className="flex items-center justify-between font-medium text-slate-200">
                      <span>{branch.name}</span>
                      {branch.isHeadquarters && (
                        <span className="text-[10px] bg-blue-500/10 text-blue-400 px-1.5 py-0.2 rounded border border-blue-500/20">
                          HQ
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-500 mt-1">
                      ID: {branch.branchId} ({branch.type})
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Experience Layer Stateless Projection */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <Eye className="w-3.5 h-3.5 text-emerald-400" />
                <span>Stateless Experience Projection</span>
              </div>
              {projection ? (
                <div className="space-y-2 text-xs font-mono text-slate-400">
                  <div>Status: <span className="text-emerald-400">{projection.status}</span></div>
                  <div>Enabled Caps: <span className="text-slate-200">{projection.capabilities.enabled.length}</span></div>
                  <div>Discoverable: <span className="text-slate-200">{projection.capabilities.discoverable.length}</span></div>
                  <div>Terminology: <span className="text-slate-200">{Object.keys(projection.terminology).length} terms</span></div>
                  <div className="text-[10px] text-slate-500 pt-2 border-t border-slate-800">
                    Authority Timestamp: {new Date(projection.serverAuthoritativeTimestamp).toLocaleTimeString()}
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-500">No projection available</div>
              )}
            </div>

            {/* Lifecycle History Audit */}
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-lg p-4 space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <Layers className="w-3.5 h-3.5 text-amber-400" />
                <span>Lifecycle Transitions ({selectedDbk.lifecycleHistory?.length || 0})</span>
              </div>
              <div className="space-y-2 max-h-[160px] overflow-y-auto text-xs font-mono">
                {selectedDbk.lifecycleHistory?.map((lh, idx) => (
                  <div key={idx} className="p-1.5 bg-slate-900 rounded border border-slate-800 text-[10px]">
                    <div className="text-slate-300 font-semibold">
                      {lh.fromStatus} → {lh.toStatus}
                    </div>
                    <div className="text-slate-500">
                      {new Date(lh.timestamp).toLocaleTimeString()} by {lh.actorId}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
