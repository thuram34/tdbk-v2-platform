import React, { useEffect, useState } from 'react';
import { DbkExperienceResolved } from '../../experience/types';
import { useAuth } from '../../client/AuthContext';
import { DynamicIcon } from './IconHelper';
import { DashboardView } from './DashboardView';
import { EntityListView } from './EntityListView';
import { OperationalFlowView } from './OperationalFlowView';
import { DiscoveryMarketplaceView } from './DiscoveryMarketplaceView';
import { SettingsView } from './SettingsView';
import { DocumentAiShellPanel } from '../document_ai/DocumentAiShellPanel';
import { OwnerPortfolioView } from './OwnerPortfolioView';
import { SmartClassroomView } from '../classroom/SmartClassroomView';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Building2,
  CheckCircle2,
  GitBranch,
  Menu,
  RefreshCw,
  X,
} from 'lucide-react';

interface DbkShellProps {
  initialDbkId?: string;
  initialViewMode?: 'PORTFOLIO' | 'WORKSPACE';
  onSwitchToMaster?: () => void;
}

type ShellError = 'UNAUTHORIZED' | 'ERROR' | null;

export const DbkShell: React.FC<DbkShellProps> = ({
  initialDbkId,
  initialViewMode = 'PORTFOLIO',
}) => {
  const { getIdToken, user } = useAuth();
  const [dbkList, setDbkList] = useState<Array<any>>([]);
  const [selectedDbkId, setSelectedDbkId] = useState<string>(initialDbkId || '');
  const [selectedBranchId, setSelectedBranchId] = useState<string>('');
  const [experience, setExperience] = useState<DbkExperienceResolved | null>(null);
  const [activeViewId, setActiveViewId] = useState<string>('nav_overview');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [errorKind, setErrorKind] = useState<ShellError>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'PORTFOLIO' | 'WORKSPACE'>(initialViewMode);

  const loadDbkList = async () => {
    setIsLoading(true);
    setError(null);
    setErrorKind(null);

    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Your session has expired. Please sign in again.');

      const response = await fetch('/api/platform/dbks', {
        headers: { Authorization: `Bearer ${idToken}` },
      });

      if (response.status === 401 || response.status === 403) {
        setErrorKind('UNAUTHORIZED');
        setError('Your account is not currently authorized to access these organizations.');
        setDbkList([]);
        return;
      }

      if (!response.ok) {
        throw new Error('We could not load your organizations. Please try again.');
      }

      const data = await response.json();
      const list = (data.dbks || []).map((dbk: any) => ({
        dbkId: dbk.dbkId,
        legalName: dbk.legalName,
        displayName: dbk.displayName,
        sector: dbk.blueprintId?.split('_')[0]?.toUpperCase() || 'Organization',
        blueprintId: dbk.blueprintId,
        subscriptionTier: dbk.subscriptionTier,
        status: dbk.status,
        branchTopology: dbk.branchTopology,
      }));

      setDbkList(list);
      if (!selectedDbkId && list.length > 0) setSelectedDbkId(list[0].dbkId);
    } catch (err: any) {
      setDbkList([]);
      setErrorKind('ERROR');
      setError(err?.message || 'We could not load your organizations. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const resolveExperience = async (dbkId: string, branchId?: string) => {
    if (!dbkId) return;
    setIsLoading(true);
    setError(null);
    setErrorKind(null);

    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Your session has expired. Please sign in again.');

      const branchQuery = branchId ? `?branchId=${encodeURIComponent(branchId)}` : '';
      const response = await fetch(`/api/experience/resolve/${encodeURIComponent(dbkId)}${branchQuery}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
      });

      if (response.status === 401 || response.status === 403) {
        setErrorKind('UNAUTHORIZED');
        setError('You do not have access to this organization.');
        setExperience(null);
        return;
      }

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error?.message || 'We could not open this organization. Please try again.');
      }

      const data = await response.json();
      setExperience(data.resolved);
      if (!selectedBranchId && data.resolved.activeBranch) {
        setSelectedBranchId(data.resolved.activeBranch.branchId);
      }
    } catch (err: any) {
      setErrorKind('ERROR');
      setError(err?.message || 'We could not open this organization. Please try again.');
      setExperience(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDbkList();
  }, []);

  useEffect(() => {
    if (selectedDbkId && viewMode === 'WORKSPACE') {
      resolveExperience(selectedDbkId, selectedBranchId);
    }
  }, [selectedDbkId, selectedBranchId, viewMode]);

  const handleDispatchCommand = async (commandType: string, payload: Record<string, unknown>) => {
    if (!selectedDbkId) return null;

    const idToken = await getIdToken();
    if (!idToken) throw new Error('Your session has expired. Please sign in again.');

    const response = await fetch('/api/experience/command', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        commandType,
        targetDbkId: selectedDbkId,
        payload: { ...payload, branchId: selectedBranchId },
      }),
    });

    const data = await response.json().catch(() => ({}));
    if (response.status === 401 || response.status === 403) {
      setErrorKind('UNAUTHORIZED');
      setError('You are not authorized to perform that action.');
      throw new Error('You are not authorized to perform that action.');
    }

    if (!response.ok) {
      throw new Error(data.error?.message || 'The action could not be completed.');
    }

    if (data.commandResponse?.updatedResolvedExperience) {
      setExperience(data.commandResponse.updatedResolvedExperience);
    }

    return data;
  };

  const handleBranchSwitch = async (newBranchId: string) => {
    try {
      await handleDispatchCommand('SWITCH_BRANCH', { branchId: newBranchId });
      setSelectedBranchId(newBranchId);
      setError(null);
      setErrorKind(null);
    } catch (err: any) {
      setErrorKind('ERROR');
      setError(err?.message || 'We could not change the active location.');
    }
  };

  const handleSelectDbk = (dbkId: string) => {
    setSelectedDbkId(dbkId);
    setSelectedBranchId('');
    setActiveViewId('nav_overview');
    setExperience(null);
    setError(null);
    setErrorKind(null);
    setViewMode('WORKSPACE');
  };

  const categories = [
    { key: 'OVERVIEW', label: 'Overview' },
    { key: 'CORE_OPERATIONS', label: 'Core operations' },
    { key: 'RECORDS', label: 'Records' },
    { key: 'FINANCE', label: 'Finance' },
    { key: 'OPERATIONS', label: 'Operations' },
    { key: 'DISCOVERY', label: 'Discovery' },
    { key: 'SETTINGS', label: 'Settings' },
  ];

  if (viewMode === 'PORTFOLIO') {
    return (
      <OwnerPortfolioView
        dbks={dbkList}
        isLoading={isLoading}
        error={error}
        onSelectDbk={handleSelectDbk}
        onRefreshDbks={loadDbkList}
      />
    );
  }

  const currentNav = experience?.navigation.find((item) => item.id === activeViewId || item.capabilityId === activeViewId);

  return (
    <div className="flex min-h-screen flex-col bg-neutral-950 font-sans text-neutral-100">
      <header className="sticky top-0 z-40 border-b border-neutral-800 bg-neutral-950/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => setViewMode('PORTFOLIO')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My organizations</span>
            </button>

            <div className="hidden h-6 w-px bg-neutral-800 sm:block" />

            <select
              aria-label="Switch organization"
              value={selectedDbkId}
              onChange={(event) => handleSelectDbk(event.target.value)}
              className="max-w-[180px] rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 text-xs font-semibold text-white outline-none focus:border-indigo-500 sm:max-w-[260px]"
            >
              {dbkList.map((dbk) => (
                <option key={dbk.dbkId} value={dbk.dbkId} className="bg-neutral-900 text-white">
                  {dbk.displayName || dbk.legalName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {experience?.availableBranches?.length > 0 && (
              <div className="hidden items-center gap-1.5 rounded-lg border border-neutral-800 bg-neutral-900 px-2.5 py-2 sm:flex">
                <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
                <select
                  aria-label="Switch location"
                  value={experience.activeBranch.branchId}
                  onChange={(event) => handleBranchSwitch(event.target.value)}
                  className="max-w-[150px] bg-transparent text-xs font-medium text-neutral-200 outline-none"
                >
                  {experience.availableBranches.map((branch) => (
                    <option key={branch.branchId} value={branch.branchId} className="bg-neutral-900 text-white">
                      {branch.name}{branch.isHeadquarters ? ' · Main' : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <button
              type="button"
              onClick={() => setActiveViewId('view_doc_ai')}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-semibold transition ${activeViewId === 'view_doc_ai' ? 'border-emerald-500 bg-emerald-600 text-white' : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:bg-neutral-800'}`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI & documents</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="rounded-lg border border-neutral-800 bg-neutral-900 p-2 text-neutral-300 hover:bg-neutral-800 md:hidden"
              aria-label="Open navigation"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <aside
          className={`w-64 shrink-0 border-r border-neutral-800 bg-neutral-950 p-4 md:block ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 block w-72' : 'hidden'}`}
        >
          {isMobileMenuOpen && (
            <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-3 md:hidden">
              <span className="text-sm font-semibold">Organization menu</span>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-1.5 text-neutral-400 hover:bg-neutral-800">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {experience && (
            <nav aria-label="Organization navigation" className="space-y-5">
              {categories.map((category) => {
                const items = experience.navigation.filter((item) => item.category === category.key);
                if (items.length === 0) return null;

                return (
                  <div key={category.key}>
                    <p className="mb-1.5 px-2.5 text-[10px] font-bold uppercase tracking-wider text-neutral-500">{category.label}</p>
                    <div className="space-y-1">
                      {items.map((item) => {
                        const isActive = activeViewId === item.id ||
                          (item.capabilityId && activeViewId === item.capabilityId) ||
                          (item.route === '/dashboard' && activeViewId === 'nav_overview') ||
                          (item.route === '/discovery' && activeViewId === 'discovery') ||
                          (item.route === '/settings' && activeViewId === 'settings');

                        return (
                          <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                              setActiveViewId(item.capabilityId || item.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2.5 text-left text-xs font-medium transition ${isActive ? 'border border-indigo-500/40 bg-indigo-500/15 text-indigo-200' : 'text-neutral-400 hover:bg-neutral-900 hover:text-neutral-200'}`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <DynamicIcon name={item.iconName} className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.badge !== undefined && (
                              <span className="ml-2 rounded bg-indigo-500/20 px-1.5 py-0.5 text-[9px] font-bold text-indigo-300">{item.badge}</span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          )}
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
          {isLoading && !experience ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="max-w-sm text-center">
                <RefreshCw className="mx-auto h-7 w-7 animate-spin text-indigo-400" />
                <h1 className="mt-4 text-lg font-semibold">Opening your organization</h1>
                <p className="mt-1 text-sm text-neutral-500">Loading the workspace available to your account.</p>
              </div>
            </div>
          ) : errorKind === 'UNAUTHORIZED' ? (
            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-amber-800/50 bg-amber-950/20 p-7 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-amber-400" />
              <h1 className="mt-4 text-lg font-semibold">Access not available</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-400">{error || 'Your account does not currently have access to this organization or action.'}</p>
              <button type="button" onClick={() => setViewMode('PORTFOLIO')} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
                <ArrowLeft className="h-4 w-4" />
                Back to organizations
              </button>
            </div>
          ) : error ? (
            <div className="mx-auto mt-10 max-w-lg rounded-2xl border border-rose-900/60 bg-rose-950/20 p-7">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                <div>
                  <h1 className="font-semibold">Something went wrong</h1>
                  <p className="mt-1 text-sm leading-6 text-neutral-400">{error}</p>
                  <button type="button" onClick={() => resolveExperience(selectedDbkId, selectedBranchId)} className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3.5 py-2 text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : experience ? (
            <div>
              <div className="mb-5 flex flex-col gap-3 border-b border-neutral-900 pb-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{experience.activeBranch.name}</p>
                  <h1 className="mt-1 truncate text-xl font-bold sm:text-2xl">{experience.displayName}</h1>
                  {currentNav?.label && activeViewId !== 'nav_overview' && (
                    <p className="mt-1 text-sm text-neutral-400">{currentNav.label}</p>
                  )}
                </div>
                <div className="inline-flex w-fit items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-semibold text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {experience.operationalState || 'Ready'}
                </div>
              </div>

              {activeViewId === 'view_doc_ai' ? (
                <DocumentAiShellPanel tenantId={selectedDbkId} />
              ) : activeViewId === 'nav_overview' || activeViewId === 'dashboard' ? (
                <DashboardView experience={experience} onNavigate={(capabilityId) => setActiveViewId(capabilityId)} onDispatchCommand={handleDispatchCommand} />
              ) : activeViewId === 'nav_discovery' || activeViewId === 'discovery' ? (
                <DiscoveryMarketplaceView
                  experience={experience}
                  onDispatchCommand={handleDispatchCommand}
                  onRefreshExperience={() => resolveExperience(selectedDbkId, selectedBranchId)}
                />
              ) : activeViewId === 'nav_settings' || activeViewId === 'settings' ? (
                <SettingsView experience={experience} onDispatchCommand={handleDispatchCommand} />
              ) : currentNav?.viewType === 'CUSTOM_CLASSROOM' || activeViewId === 'smart_classroom' ? (
                <SmartClassroomView
                  tenantId={selectedDbkId}
                  userId={experience.currentPrincipal.userId}
                  userName={user?.email || 'Organization user'}
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
          ) : (
            <div className="flex min-h-[50vh] items-center justify-center text-center text-sm text-neutral-500">
              Select an organization to continue.
            </div>
          )}
        </main>
      </div>
    </div>
  );
};