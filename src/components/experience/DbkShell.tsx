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
import { ExperienceStudio } from './ExperienceStudio';
import { CustomQuestionnaireView } from './CustomQuestionnaireView';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  GitBranch,
  Menu,
  RefreshCw,
  Settings,
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
  onSwitchToMaster,
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
    if (data.commandResponse?.success === false) {
      throw new Error(data.commandResponse.error?.message || 'The action was rejected by the TDBK runtime.');
    }

    if (data.commandResponse?.updatedResolvedExperience) {
      setExperience(data.commandResponse.updatedResolvedExperience);
    }

    return data;
  };

  const handleCustomButton = (button: NonNullable<DbkExperienceResolved['customization']>['buttons'][number]) => {
    if (button.action.type === 'NAVIGATE_CAPABILITY') setActiveViewId(button.action.targetId);
    else if (button.action.type === 'OPEN_QUESTIONNAIRE') setActiveViewId(`custom_questionnaire:${button.action.targetId}`);
    else if (button.action.type === 'START_WORKFLOW') setActiveViewId(`custom_workflow:${button.action.targetId}`);
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
  const readyConnections = experience?.connections.filter((connection) => connection.ready).length ?? 0;
  const needsConnectionSetup = experience?.connections.filter((connection) => !connection.ready).length ?? 0;
  const goToSettings = () => {
    setActiveViewId('settings');
    setIsMobileMenuOpen(false);
  };

  const provisioningStageLabel: Record<string, string> = {
    REGISTRATION_ACCEPTED: 'Registration accepted',
    IDENTITY_READY: 'Identity ready',
    BLUEPRINT_READY: 'Blueprint ready',
    DNA_READY: 'Business DNA ready',
    ENTITLEMENT_READY: 'Entitlement ready',
    CAPABILITIES_READY: 'Capabilities ready',
    BRANCHES_READY: 'Branches ready',
    WORKSPACE_READY: 'Workspace ready',
    ACTIVATION_VERIFIED: 'Activation verified',
    FAILED: 'Provisioning failed',
  };

  const shellStatusLabel = experience?.shellReadiness === 'READY'
    ? 'Shell ready'
    : experience?.shellReadiness === 'BUILDING'
      ? 'Building workspace'
      : experience?.shellReadiness === 'BLOCKED'
        ? 'Provisioning blocked'
        : experience?.shellReadiness === 'SUSPENDED'
          ? 'Workspace suspended'
          : experience?.shellReadiness === 'ARCHIVED'
            ? 'Workspace archived'
            : 'Preparing workspace';

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F7F4] font-sans text-neutral-950">
      <header className="sticky top-0 z-40 border-b border-neutral-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <button
              type="button"
              onClick={() => (onSwitchToMaster ? onSwitchToMaster() : setViewMode('PORTFOLIO'))}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 text-xs font-semibold text-neutral-700 shadow-sm hover:bg-neutral-50"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">My organizations</span>
            </button>

            <div className="hidden h-6 w-px bg-neutral-200 sm:block" />

            <select
              aria-label="Switch organization"
              value={selectedDbkId}
              onChange={(event) => handleSelectDbk(event.target.value)}
              className="max-w-[180px] rounded-xl border border-neutral-200 bg-white px-3 py-2 text-xs font-bold text-neutral-900 outline-none focus:border-neutral-500 sm:max-w-[280px]"
            >
              {dbkList.map((dbk) => (
                <option key={dbk.dbkId} value={dbk.dbkId} className="bg-white text-neutral-900">
                  {dbk.displayName || dbk.legalName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            {experience?.availableBranches?.length > 0 && (
              <div className="hidden items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-2.5 py-2 sm:flex shadow-sm">
                <GitBranch className="h-3.5 w-3.5 text-emerald-400" />
                <select
                  aria-label="Switch location"
                  value={experience.activeBranch.branchId}
                  onChange={(event) => handleBranchSwitch(event.target.value)}
                  className="max-w-[150px] bg-transparent text-xs font-semibold text-neutral-700 outline-none"
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
              className={`inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-2 text-xs font-semibold transition ${activeViewId === 'view_doc_ai' ? 'border-neutral-950 bg-neutral-950 text-white' : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}
            >
              <Bot className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">AI & documents</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((open) => !open)}
              className="rounded-xl border border-neutral-200 bg-white p-2 text-neutral-700 hover:bg-neutral-50 md:hidden"
              aria-label="Open navigation"
            >
              {isMobileMenuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1">
        <div className="pointer-events-none fixed inset-x-0 top-[65px] z-20 mx-auto hidden max-w-7xl px-4 sm:px-6 md:block">
          <div className="flex justify-end pt-3">
            <div className="pointer-events-auto inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-white/95 px-3 py-2 text-[11px] font-semibold text-neutral-600 shadow-sm backdrop-blur">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {readyConnections} connection{readyConnections === 1 ? '' : 's'} ready
              {needsConnectionSetup > 0 && <><span className="text-neutral-300">·</span><button type="button" onClick={goToSettings} className="text-amber-700 hover:text-amber-900">{needsConnectionSetup} need setup</button></>}
            </div>
          </div>
        </div>
        <aside
          className={`w-64 shrink-0 border-r border-neutral-200 bg-white p-4 md:block ${isMobileMenuOpen ? 'fixed inset-y-0 left-0 z-50 block w-72' : 'hidden'}`}
        >
          {isMobileMenuOpen && (
            <div className="mb-4 flex items-center justify-between border-b border-neutral-200 pb-3 md:hidden">
              <span className="text-sm font-semibold">Organization menu</span>
              <button type="button" onClick={() => setIsMobileMenuOpen(false)} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {experience && (
            <nav aria-label="Organization navigation" className="space-y-6">
              {categories.map((category) => {
                const items = experience.navigation.filter((item) => item.category === category.key);
                if (items.length === 0) return null;

                return (
                  <div key={category.key}>
                    <p className="mb-2 px-2.5 text-[10px] font-black uppercase tracking-[0.16em] text-neutral-400">{category.label}</p>
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
                              if (item.viewType === 'CUSTOM_QUESTIONNAIRE' && item.customTargetId) setActiveViewId(`custom_questionnaire:${item.customTargetId}`);
                              else if (item.viewType === 'CUSTOM_WORKFLOW' && item.customTargetId) setActiveViewId(`custom_workflow:${item.customTargetId}`);
                              else setActiveViewId(item.capabilityId || item.id);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 text-left text-xs font-semibold transition ${isActive ? 'bg-neutral-950 text-white shadow-sm' : 'text-neutral-500 hover:bg-neutral-50 hover:text-neutral-900'}`}
                          >
                            <span className="flex min-w-0 items-center gap-2.5">
                              <DynamicIcon name={item.iconName} className="h-4 w-4 shrink-0" />
                              <span className="truncate">{item.label}</span>
                            </span>
                            {item.badge !== undefined && (
                              <span className="ml-2 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[9px] font-bold text-neutral-500">{item.badge}</span>
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

        <main className="min-w-0 flex-1 overflow-y-auto p-4 pt-8 sm:p-6 sm:pt-10">
          {isLoading && !experience ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <div className="max-w-sm text-center">
                <RefreshCw className="mx-auto h-7 w-7 animate-spin text-neutral-400" />
                <h1 className="mt-4 text-lg font-semibold">Opening your organization</h1>
                <p className="mt-1 text-sm text-neutral-500">Loading the workspace available to your account.</p>
              </div>
            </div>
          ) : errorKind === 'UNAUTHORIZED' ? (
            <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-amber-200 bg-amber-50 p-7 text-center">
              <AlertTriangle className="mx-auto h-7 w-7 text-amber-400" />
              <h1 className="mt-4 text-lg font-semibold">Access not available</h1>
              <p className="mt-2 text-sm leading-6 text-neutral-600">{error || 'Your account does not currently have access to this organization or action.'}</p>
              <button type="button" onClick={() => setViewMode('PORTFOLIO')} className="mt-5 inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-neutral-900 hover:bg-neutral-100">
                <ArrowLeft className="h-4 w-4" />
                Back to organizations
              </button>
            </div>
          ) : error ? (
            <div className="mx-auto mt-10 max-w-lg rounded-3xl border border-rose-200 bg-rose-50 p-7">
              <div className="flex items-start gap-3">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-400" />
                <div>
                  <h1 className="font-semibold">Something went wrong</h1>
                  <p className="mt-1 text-sm leading-6 text-neutral-400">{error}</p>
                  <button type="button" onClick={() => resolveExperience(selectedDbkId, selectedBranchId)} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-3.5 py-2 text-sm font-semibold text-white hover:bg-neutral-800">
                    <RefreshCw className="h-4 w-4" />
                    Try again
                  </button>
                </div>
              </div>
            </div>
          ) : experience ? (
            <div>
              <div className="mb-6 rounded-3xl border border-neutral-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-neutral-500">{experience.sector}</span>
                      <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">{experience.subscriptionTier}</span>
                      <span className="rounded-full bg-neutral-100 px-2.5 py-1 text-[10px] font-semibold text-neutral-600">{experience.activeBranch.name}</span>
                    </div>
                    <p className="mt-3 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700">Your TDBK workspace</p>
                    <h1 className="mt-1 truncate text-2xl font-bold tracking-tight sm:text-3xl">{experience.displayName}</h1>
                    <p className="mt-1 text-sm text-neutral-500">{currentNav?.label || 'Today at a glance'} · {experience.operationalState === 'ACTIVE' ? 'Operational' : experience.operationalState.toLowerCase()}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-[10px] font-bold text-neutral-600">
                        <span className={experience.shellReadiness === 'READY' ? 'h-1.5 w-1.5 rounded-full bg-emerald-500' : 'h-1.5 w-1.5 rounded-full bg-amber-500'} />
                        {shellStatusLabel}
                      </span>
                      {experience.provisioningStage && (
                        <span className="rounded-full border border-neutral-200 bg-white px-2.5 py-1 text-[10px] font-semibold text-neutral-500">
                          {provisioningStageLabel[experience.provisioningStage] || experience.provisioningStage}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {experience.customization?.buttons.filter(button => button.enabled && (!button.requiredRoles?.length || button.requiredRoles.some(role => experience.currentPrincipal.roles.includes(role))) && (!button.requiredPermissions?.length || button.requiredPermissions.every(permission => experience.currentPrincipal.permissions.includes('*') || experience.currentPrincipal.permissions.includes(permission)))).map(button => (
                      <button key={button.id} type="button" onClick={() => handleCustomButton(button)} className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold ${button.variant === 'PRIMARY' ? 'bg-neutral-950 text-white hover:bg-neutral-800' : button.variant === 'DANGER' ? 'border border-rose-200 bg-rose-50 text-rose-700' : 'border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50'}`}>
                        {button.label}
                      </button>
                    ))}
                    <button type="button" onClick={() => setActiveViewId('nav_overview')} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"><CheckCircle2 className="h-4 w-4 text-emerald-600" /> Today</button>
                    <button type="button" onClick={goToSettings} className="inline-flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs font-bold text-neutral-700 hover:bg-neutral-50"><Settings className="h-4 w-4" /> Connections</button>
                    <button type="button" onClick={() => setActiveViewId('view_doc_ai')} className="inline-flex items-center gap-2 rounded-xl bg-neutral-950 px-3.5 py-2.5 text-xs font-bold text-white hover:bg-neutral-800"><Bot className="h-4 w-4" /> AI assistant</button>
                  </div>
                </div>
              </div>

              {activeViewId === 'nav_experience_studio' || currentNav?.viewType === 'EXPERIENCE_STUDIO' ? (
                <ExperienceStudio experience={experience} onRefresh={() => resolveExperience(selectedDbkId, selectedBranchId)} />
              ) : activeViewId.startsWith('custom_questionnaire:') ? (
                (() => {
                  const questionnaireId = activeViewId.slice('custom_questionnaire:'.length);
                  const questionnaire = experience.customization?.questionnaires.find(item => item.id === questionnaireId && item.enabled);
                  if (!questionnaire) return <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">This questionnaire is unavailable in the current workspace configuration.</div>;
                  return <CustomQuestionnaireView questionnaire={questionnaire} onCancel={() => setActiveViewId('nav_overview')} onSubmit={async answers => {
                    const result = await handleDispatchCommand('SUBMIT_QUESTIONNAIRE', { questionnaireId, answers });
                    if (result?.commandResponse?.success !== true) throw new Error(result?.commandResponse?.error?.message || 'Submission was not accepted.');
                    await resolveExperience(selectedDbkId, selectedBranchId);
                  }} />;
                })()
              ) : activeViewId.startsWith('custom_workflow:') ? (
                (() => {
                  const workflowId = activeViewId.slice('custom_workflow:'.length);
                  const workflow = experience.customization?.workflows.find(item => item.id === workflowId && item.enabled);
                  return <div className="rounded-2xl border border-neutral-200 bg-white p-6"><h2 className="text-xl font-bold">{workflow?.name || 'Workflow unavailable'}</h2><p className="mt-2 text-sm text-neutral-500">{workflow?.description || 'The selected workflow is not configured.'}</p><div className="mt-5 space-y-3">{workflow?.steps.map((step,index)=><div key={step.id} className="flex gap-3 rounded-xl bg-neutral-50 p-4"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-neutral-200 text-xs font-bold">{index+1}</span><div><p className="text-sm font-semibold">{step.title}</p>{step.description && <p className="mt-1 text-xs text-neutral-500">{step.description}</p>}{step.assigneeRole && <p className="mt-1 text-[10px] text-neutral-400">Assigned role: {step.assigneeRole}</p>}{step.questionnaireId && <button type="button" onClick={()=>setActiveViewId('custom_questionnaire:'+step.questionnaireId)} className="mt-2 rounded-lg bg-neutral-950 px-3 py-2 text-xs font-bold text-white">Open step questionnaire</button>}</div></div>)}</div><p className="mt-4 text-xs text-neutral-500">This is the configured workflow guide. Durable workflow execution, task assignment and step approvals are a separate runtime capability.</p><button type="button" onClick={()=>setActiveViewId('nav_overview')} className="mt-4 rounded-xl border border-neutral-200 px-4 py-2 text-xs font-bold">Close workflow</button></div>;
                })()
              ) : activeViewId === 'view_doc_ai' ? (
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
                <SettingsView experience={experience} onDispatchCommand={handleDispatchCommand} onRefreshExperience={() => resolveExperience(selectedDbkId, selectedBranchId)} />
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