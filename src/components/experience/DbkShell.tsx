import React, { useState, useEffect } from 'react';
import {
  DbkExperienceResolved,
  ExperienceNavItem,
} from '../../experience/types';
import { useAuth } from '../../client/AuthContext';
import { DynamicIcon } from './IconHelper';
import { DashboardView } from './DashboardView';
import { EntityListView } from './EntityListView';
import { OperationalFlowView } from './OperationalFlowView';
import { DiscoveryMarketplaceView } from './DiscoveryMarketplaceView';
import { SettingsView } from './SettingsView';
import { Phase5TestSuitePanel } from './Phase5TestSuitePanel';
import { Phase6TestSuitePanel } from '../document_ai/Phase6TestSuitePanel';
import { DocumentAiShellPanel } from '../document_ai/DocumentAiShellPanel';
import { OwnerPortfolioView } from './OwnerPortfolioView';
import { MultiBusinessSuitePanel } from './MultiBusinessSuitePanel';
import { CoherenceEnginePanel } from './CoherenceEnginePanel';
import { SmartClassroomView } from '../classroom/SmartClassroomView';
import {
  Building2,
  GitBranch,
  User,
  ShieldCheck,
  Shield,
  Sparkles,
  AlertTriangle,
  Menu,
  X,
  ChevronDown,
  LayoutDashboard,
  Layers,
  ArrowLeft,
  CheckCircle2,
  RotateCcw,
  RefreshCw,
  Bot,
  FileText,
  Grid,
} from 'lucide-react';

interface DbkShellProps {
  initialDbkId?: string;
  initialViewMode?: 'PORTFOLIO' | 'WORKSPACE';
  onSwitchToMaster: () => void;
}

export const DbkShell: React.FC<DbkShellProps> = ({
  initialDbkId,
  initialViewMode = 'PORTFOLIO',
  onSwitchToMaster,
}) => {
  const { getIdToken, user } = useAuth();
  const [dbkList, setDbkList] = useState<Array<any>>([]);
  const [selectedDbkId, setSelectedDbkId] = useState<string>(initialDbkId || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [selectedRole, setSelectedRole] = useState<string>('TENANT_ADMIN');
  const [experience, setExperience] = useState<DbkExperienceResolved | null>(null);
  const [activeViewId, setActiveViewId] = useState<string>('nav_overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'PORTFOLIO' | 'WORKSPACE' | 'MULTI_BUSINESS_TESTS' | 'COHERENCE_ENGINE'>(initialViewMode);

  // 1. Fetch available DBKs
  const loadDbkList = async () => {
    try {
      const idToken = await getIdToken();

      if (!idToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const res = await fetch('/api/platform/dbks', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        const list = (data.dbks || []).map((d: any) => ({
          dbkId: d.dbkId,
          legalName: d.legalName,
          displayName: d.displayName,
          sector: d.blueprintId?.split('_')[0]?.toUpperCase() || 'SME',
          blueprintId: d.blueprintId,
          subscriptionTier: d.subscriptionTier,
          status: d.status,
          branchTopology: d.branchTopology,
        }));
        setDbkList(list);
        if (!selectedDbkId && list.length > 0) {
          setSelectedDbkId(list[0].dbkId);
        }
      }
    } catch {
      // Fallback
    }
  };

  // 2. Resolve authoritative experience projection from server
  const resolveExperience = async (dbkId: string, branchId?: string, role: string = 'TENANT_ADMIN') => {
    if (!dbkId) return;
    setIsLoading(true);
    setError(null);

    try {
      const idToken = await getIdToken();

      if (!idToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const branchQuery = branchId ? `?branchId=${branchId}` : '';
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${idToken}`,
      };

      const res = await fetch(`/api/experience/resolve/${dbkId}${branchQuery}`, { headers });
      if (res.ok) {
        const data = await res.json();
        setExperience(data.resolved);
        if (!selectedBranchId && data.resolved.activeBranch) {
          setSelectedBranchId(data.resolved.activeBranch.branchId);
        }
      } else {
        const errData = await res.json();
        setError(errData.error?.message || 'Failed to resolve workspace experience');
      }
    } catch (err: any) {
      setError(err?.message || 'Network error resolving workspace');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDbkList();
  }, []);

  useEffect(() => {
    if (selectedDbkId) {
      resolveExperience(selectedDbkId, selectedBranchId, selectedRole);
    }
  }, [selectedDbkId, selectedBranchId, selectedRole]);

  // Command dispatcher
  const handleDispatchCommand = async (commandType: string, payload: Record<string, unknown>) => {
    if (!selectedDbkId) return;

    try {
      const idToken = await getIdToken();

      if (!idToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const res = await fetch('/api/experience/command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          commandType,
          targetDbkId: selectedDbkId,
          payload: { ...payload, branchId: selectedBranchId },
        }),
      });

      const data = await res.json();
      if (data.commandResponse?.updatedResolvedExperience) {
        setExperience(data.commandResponse.updatedResolvedExperience);
      }
      return data;
    } catch (err) {
      console.error('Command failed:', err);
      throw err;
    }
  };

  const handleBranchSwitch = async (newBranchId: string) => {
    setSelectedBranchId(newBranchId);
    await handleDispatchCommand('SWITCH_BRANCH', { branchId: newBranchId });
  };

  // Group navigation items by category
  const categories = [
    { key: 'OVERVIEW', label: 'Overview' },
    { key: 'CORE_OPERATIONS', label: 'Core Operations' },
    { key: 'RECORDS', label: 'Entity Records' },
    { key: 'FINANCE', label: 'Finance & Payments' },
    { key: 'OPERATIONS', label: 'Operations & Yard' },
    { key: 'DISCOVERY', label: 'Marketplace' },
    { key: 'SETTINGS', label: 'Configuration' },
  ];

  const currentNav = experience?.navigation.find((n) => n.id === activeViewId || n.capabilityId === activeViewId);

  if (viewMode === 'PORTFOLIO') {
    return (
      <OwnerPortfolioView
        dbks={dbkList}
        onSelectDbk={(dbkId) => {
          setSelectedDbkId(dbkId);
          setSelectedBranchId('');
          setActiveViewId('nav_overview');
          setViewMode('WORKSPACE');
        }}
        onRefreshDbks={loadDbkList}
        onOpenTestSuite={() => setViewMode('MULTI_BUSINESS_TESTS')}
        onOpenCoherenceEngine={() => setViewMode('COHERENCE_ENGINE')}
      />
    );
  }

  if (viewMode === 'MULTI_BUSINESS_TESTS') {
    return (
      <MultiBusinessSuitePanel
        onBackToPortfolio={() => setViewMode('PORTFOLIO')}
      />
    );
  }

  if (viewMode === 'COHERENCE_ENGINE') {
    return (
      <CoherenceEnginePanel
        defaultDbkId={selectedDbkId || 'tenant_school_01'}
        onBack={() => setViewMode(selectedDbkId ? 'WORKSPACE' : 'PORTFOLIO')}
      />
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* ------------------------------------------------------------- */}
      {/* GLOBAL EXPERIENTIAL HEADER                                    */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-neutral-900 border-b border-neutral-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
          {/* Brand Identity & DBK Selector */}
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setViewMode('PORTFOLIO')}
              className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold border border-neutral-700 transition cursor-pointer"
            >
              <Building2 className="w-3.5 h-3.5 text-indigo-400" />
              <span>← My Businesses Portfolio</span>
            </button>

            <div className="h-4 w-px bg-neutral-800 hidden md:block" />

            {/* DBK Switcher Dropdown */}
            <div className="relative">
              <select
                value={selectedDbkId}
                onChange={(e) => {
                  setSelectedDbkId(e.target.value);
                  setSelectedBranchId('');
                  setActiveViewId('nav_overview');
                }}
                className="bg-neutral-950 border border-neutral-700 rounded px-2.5 py-1 text-xs font-bold text-white focus:outline-none focus:border-indigo-500 cursor-pointer"
              >
                {dbkList.map((d) => (
                  <option key={d.dbkId} value={d.dbkId}>
                    {d.displayName} ({d.sector})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Contextual Badges & Switchers */}
          <div className="flex items-center space-x-2">
            {/* Branch Switcher */}
            {experience && experience.availableBranches.length > 0 && (
              <div className="hidden sm:flex items-center space-x-1.5 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
                <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
                <select
                  value={experience.activeBranch.branchId}
                  onChange={(e) => handleBranchSwitch(e.target.value)}
                  className="bg-transparent text-xs text-neutral-200 font-medium focus:outline-none cursor-pointer"
                >
                  {experience.availableBranches.map((b) => (
                    <option key={b.branchId} value={b.branchId} className="bg-neutral-900 text-white">
                      {b.name} {b.isHeadquarters ? '(HQ)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Role / Persona Switcher for UI Verification */}
            <div className="hidden md:flex items-center space-x-1.5 bg-neutral-950 px-2 py-1 rounded border border-neutral-800">
              <User className="w-3.5 h-3.5 text-indigo-400" />
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="bg-transparent text-xs text-neutral-300 font-medium focus:outline-none cursor-pointer"
              >
                <option value="TENANT_ADMIN" className="bg-neutral-900 text-white">Role: Administrator</option>
                <option value="SCHOOL_PRINCIPAL" className="bg-neutral-900 text-white">Role: Principal</option>
                <option value="TEACHER" className="bg-neutral-900 text-white">Role: Teacher</option>
                <option value="BURSAR" className="bg-neutral-900 text-white">Role: Bursar</option>
                <option value="STORE_OWNER" className="bg-neutral-900 text-white">Role: Store Owner</option>
                <option value="CASHIER" className="bg-neutral-900 text-white">Role: Cashier</option>
                <option value="CLINICIAN" className="bg-neutral-900 text-white">Role: Clinician</option>
              </select>
            </div>

            {/* Phase 6 & Document AI Triggers */}
            <button
              onClick={() => setActiveViewId('view_doc_ai')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                activeViewId === 'view_doc_ai'
                  ? 'bg-emerald-600 border-emerald-500 text-white'
                  : 'bg-neutral-800 border-neutral-700 text-emerald-300 hover:bg-neutral-700'
              }`}
            >
              <Bot className="w-3 h-3 text-emerald-400" />
              <span className="hidden sm:inline">AI & Docs</span>
            </button>

            <button
              onClick={() => setActiveViewId('view_phase6_suite')}
              className={`flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded border transition cursor-pointer ${
                activeViewId === 'view_phase6_suite'
                  ? 'bg-indigo-600 border-indigo-500 text-white'
                  : 'bg-neutral-800 border-neutral-700 text-indigo-300 hover:bg-neutral-700'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              <span className="hidden sm:inline">P6 (60 Tests)</span>
            </button>

            {/* Role-Based Coherence Engine Trigger */}
            <button
              onClick={() => setViewMode('COHERENCE_ENGINE')}
              className="flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded border bg-indigo-950/60 border-indigo-500/40 text-indigo-300 hover:bg-indigo-900/60 transition cursor-pointer shadow-2xs"
            >
              <Layers className="w-3 h-3 text-indigo-400" />
              <span className="hidden sm:inline">Role Coherence</span>
            </button>

            {/* Master Console */}
            <button
              onClick={onSwitchToMaster}
              className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 text-xs font-semibold rounded border bg-amber-950/40 border-amber-700 text-amber-300 hover:bg-amber-900/50 transition cursor-pointer"
              title="Master authority verification required"
            >
              <Shield className="w-3 h-3" />
              <span>Master Console</span>
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-1.5 rounded bg-neutral-800 text-neutral-300 md:hidden cursor-pointer"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* WORKSPACE LAYOUT (SIDEBAR + MAIN CANVAS)                      */}
      {/* ------------------------------------------------------------- */}
      <div className="flex-1 max-w-7xl w-full mx-auto flex">
        {/* SIDEBAR NAVIGATION */}
        <aside
          className={`w-64 bg-neutral-900/60 border-r border-neutral-800/80 p-4 space-y-6 shrink-0 md:block ${
            isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 bg-neutral-950 w-72' : 'hidden'
          }`}
        >
          {isMobileMenuOpen && (
            <div className="flex items-center justify-between pb-3 border-b border-neutral-800 md:hidden">
              <span className="text-xs font-bold text-white">Navigation</span>
              <button onClick={() => setIsMobileMenuOpen(false)} className="text-neutral-400">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {experience && (
            <div className="space-y-5">
              {categories.map((cat) => {
                const items = experience.navigation.filter((n) => n.category === cat.key);
                if (items.length === 0) return null;

                return (
                  <div key={cat.key} className="space-y-1.5">
                    <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-neutral-500 px-2.5">
                      {cat.label}
                    </div>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const isActive =
                          activeViewId === item.id ||
                          (item.capabilityId && activeViewId === item.capabilityId) ||
                          (item.route === '/dashboard' && activeViewId === 'nav_overview') ||
                          (item.route === '/discovery' && activeViewId === 'discovery') ||
                          (item.route === '/settings' && activeViewId === 'settings');

                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveViewId(item.capabilityId || item.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-2.5 py-2 rounded text-xs font-medium transition cursor-pointer ${
                              isActive
                                ? 'bg-indigo-600/20 text-indigo-300 font-semibold border border-indigo-500/40'
                                : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/40'
                            }`}
                          >
                            <div className="flex items-center space-x-2.5 truncate">
                              <DynamicIcon name={item.iconName} className="w-4 h-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </div>

                            {item.badge !== undefined && (
                              <span className="px-1.5 py-0.5 text-[9px] font-mono font-bold rounded bg-indigo-500/30 text-indigo-300">
                                {item.badge}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </aside>

        {/* MAIN CONTENT CANVAS */}
        <main className="flex-1 p-6 overflow-y-auto">
          {isLoading && !experience ? (
            <div className="flex items-center justify-center p-16 text-neutral-500 space-x-2">
              <RefreshCw className="w-5 h-5 animate-spin text-indigo-400" />
              <span className="text-xs font-mono">Synthesizing Business DNA & Experience Projection...</span>
            </div>
          ) : error ? (
            <div className="bg-red-950/30 border border-red-900/50 p-6 rounded-lg text-red-300 text-xs space-y-2">
              <div className="flex items-center space-x-2 font-bold text-sm">
                <AlertTriangle className="w-4 h-4 text-red-400" />
                <span>Experience Resolution Error</span>
              </div>
              <p>{error}</p>
              <button
                onClick={() => resolveExperience(selectedDbkId, selectedBranchId, selectedRole)}
                className="mt-2 px-3 py-1.5 bg-red-900/40 hover:bg-red-900/60 rounded font-semibold text-white cursor-pointer"
              >
                Retry Resolution
              </button>
            </div>
          ) : experience ? (
            <div>
              {/* Context Bar */}
              <div className="flex items-center justify-between text-xs text-neutral-500 mb-4 pb-2 border-b border-neutral-900">
                <div className="flex items-center space-x-2 font-mono">
                  <span>{experience.displayName}</span>
                  <span>/</span>
                  <span className="text-neutral-400">{experience.activeBranch.name}</span>
                  <span>/</span>
                  <span className="text-indigo-400 font-semibold">
                    {activeViewId === 'view_test_suite'
                      ? 'Phase 5 Verification Suite'
                      : currentNav?.label || activeViewId}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>OPERATIONAL STATE: {experience.operationalState}</span>
                  </span>
                </div>
              </div>

              {/* View Router */}
              {activeViewId === 'view_doc_ai' ? (
                <DocumentAiShellPanel tenantId={selectedDbkId} />
              ) : activeViewId === 'view_phase6_suite' ? (
                <Phase6TestSuitePanel />
              ) : activeViewId === 'view_test_suite' ? (
                <Phase5TestSuitePanel />
              ) : activeViewId === 'nav_overview' || activeViewId === 'dashboard' ? (
                <DashboardView
                  experience={experience}
                  onNavigate={(capId) => setActiveViewId(capId)}
                  onDispatchCommand={handleDispatchCommand}
                />
              ) : activeViewId === 'nav_discovery' || activeViewId === 'discovery' ? (
                <DiscoveryMarketplaceView
                  experience={experience}
                  onDispatchCommand={handleDispatchCommand}
                  onRefreshExperience={() => resolveExperience(selectedDbkId, selectedBranchId, selectedRole)}
                />
              ) : activeViewId === 'nav_settings' || activeViewId === 'settings' ? (
                <SettingsView experience={experience} onDispatchCommand={handleDispatchCommand} />
              ) : currentNav?.viewType === 'CUSTOM_CLASSROOM' || activeViewId === 'smart_classroom' ? (
                <SmartClassroomView
                  tenantId={selectedDbkId}
                  userId={experience.currentPrincipal.userId}
                  userName={user?.email || "bethuelthuram@gmail.com"}
                />
              ) : currentNav?.viewType === 'OPERATIONAL_FLOW' ? (
                <OperationalFlowView
                  experience={experience}
                  capabilityId={currentNav.capabilityId || activeViewId}
                  onDispatchCommand={handleDispatchCommand}
                />
              ) : (
                <EntityListView
                  experience={experience}
                  capabilityId={currentNav?.capabilityId || activeViewId}
                  onDispatchCommand={handleDispatchCommand}
                />
              )}
            </div>
          ) : null}
        </main>
      </div>
    </div>
  );
};
