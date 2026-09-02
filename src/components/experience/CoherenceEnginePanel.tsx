import React, { useState, useEffect } from 'react';
import { useAuth } from '../../client/AuthContext';
import {
  Users,
  Building2,
  Shield,
  Layers,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Play,
  RotateCcw,
  Send,
  Lock,
  Compass,
  LayoutGrid,
  Monitor,
  Tv,
  Smartphone,
  MessageSquare,
  TrendingUp,
  ArrowRight,
  Clock,
  Briefcase,
  HelpCircle,
  Activity,
  Award,
  Check,
} from 'lucide-react';
import { DynamicIcon } from './IconHelper';

interface CoherenceEnginePanelProps {
  onBack?: () => void;
  defaultDbkId?: string;
}

interface SpaceOption {
  spaceId: string;
  spaceName: string;
  role: string;
  roleTitle: string;
  department?: string;
  permissions: string[];
}

interface Persona {
  id: string;
  name: string;
  title: string;
  avatarLetter: string;
  sector: string;
  dbkId: string;
  spaces: SpaceOption[];
}

const PRESET_PERSONAS: Persona[] = [
  {
    id: 'usr_school_admin',
    name: 'Dr. Margaret Mutua',
    title: 'Group Director & Principal',
    avatarLetter: 'M',
    sector: 'EDUCATION',
    dbkId: 'tenant_school_01',
    spaces: [
      {
        spaceId: 'space_mombasa_academy',
        spaceName: 'Mombasa Academy Primary Campus',
        role: 'SCHOOL_PRINCIPAL',
        roleTitle: 'School Principal & Head of Academy',
        department: 'Executive Leadership',
        permissions: ['school:admin', 'attendance:*', 'finance:view', 'students:*'],
      },
      {
        spaceId: 'space_kilifi_campus',
        spaceName: 'Kilifi Branch Campus',
        role: 'FINANCE_VIEWER',
        roleTitle: 'Finance & Compliance Inspector',
        department: 'Board Audit',
        permissions: ['finance:view', 'reports:read'],
      },
      {
        spaceId: 'space_education_group',
        spaceName: 'Central Group Headquarters',
        role: 'TENANT_ADMIN',
        roleTitle: 'Group General Administrator',
        department: 'Central HQ',
        permissions: ['*'],
      },
    ],
  },
  {
    id: 'usr_teacher_demo',
    name: 'Mr. David Ochieng',
    title: 'Senior Class Teacher',
    avatarLetter: 'D',
    sector: 'EDUCATION',
    dbkId: 'tenant_school_01',
    spaces: [
      {
        spaceId: 'space_mombasa_academy',
        spaceName: 'Mombasa Academy Primary Campus',
        role: 'TEACHER',
        roleTitle: 'Class Teacher & Department Head',
        department: 'Science & Mathematics',
        permissions: ['attendance:write', 'students:read', 'academics:write'],
      },
    ],
  },
  {
    id: 'usr_bursar_demo',
    name: 'Grace Wambui',
    title: 'Head School Bursar',
    avatarLetter: 'G',
    sector: 'EDUCATION',
    dbkId: 'tenant_school_01',
    spaces: [
      {
        spaceId: 'space_mombasa_academy',
        spaceName: 'Mombasa Academy Primary Campus',
        role: 'BURSAR',
        roleTitle: 'Finance Administrator & Bursar',
        department: 'Accounts & Treasury',
        permissions: ['finance:*', 'payments:*', 'etims:sign'],
      },
    ],
  },
];

export const CoherenceEnginePanel: React.FC<CoherenceEnginePanelProps> = ({
  onBack,
  defaultDbkId = 'tenant_school_01',
}) => {
  const { getIdToken } = useAuth();

  // Selected persona & space
  const [selectedPersona, setSelectedPersona] = useState<Persona>(PRESET_PERSONAS[0]);
  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(PRESET_PERSONAS[0].spaces[0].spaceId);
  const [activeTab, setActiveTab] = useState<'MY_DAY' | 'SHARED_REALITY' | 'CATALOGUE' | 'SURFACES' | 'TEST_SUITE'>('MY_DAY');

  // Resolved experience data
  const [experience, setExperience] = useState<any | null>(null);
  const [loadingExperience, setLoadingExperience] = useState<boolean>(false);
  const [experienceError, setExperienceError] = useState<string | null>(null);

  // Surface preview selection
  const [selectedSurface, setSelectedSurface] = useState<'DESKTOP' | 'COUNTER' | 'WALL_TV' | 'WHATSAPP'>('DESKTOP');

  // Contribution simulation state
  const [contributionType, setContributionType] = useState<string>('RECORD_ATTENDANCE');
  const [contributionData, setContributionData] = useState<string>('{"className":"Grade 4-Blue","learnerCount":38,"status":"PRESENT"}');
  const [isSubmittingContribution, setIsSubmittingContribution] = useState<boolean>(false);
  const [contributionOutcome, setContributionOutcome] = useState<any | null>(null);

  // Collaboration request state
  const [requestTargetCap, setRequestTargetCap] = useState<any | null>(null);
  const [requestJustification, setRequestJustification] = useState<string>('Required for weekly parent updates.');
  const [isSubmittingRequest, setIsSubmittingRequest] = useState<boolean>(false);
  const [requestSuccessMessage, setRequestSuccessMessage] = useState<string | null>(null);

  // Test suite execution state
  const [isRunningTests, setIsRunningTests] = useState<boolean>(false);
  const [testResults, setTestResults] = useState<any | null>(null);

  // Current active membership
  const activeSpaceMembership = selectedPersona.spaces.find((s) => s.spaceId === selectedSpaceId) || selectedPersona.spaces[0];

  // Fetch resolved experience when persona or space changes
  const fetchCoherentExperience = async () => {
    setLoadingExperience(true);
    setExperienceError(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) {
        throw new Error('Your session has expired. Please sign in again.');
      }

      const res = await fetch('/api/coherence/experience', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          dbkId: selectedPersona.dbkId,
          spaceId: selectedSpaceId,
          surface: selectedSurface,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error?.message || 'Failed to resolve coherent experience');
      }

      const data = await res.json();
      setExperience(data.experience);
    } catch (err: any) {
      setExperienceError(err.message || 'Error resolving coherence');
    } finally {
      setLoadingExperience(false);
    }
  };

  useEffect(() => {
    fetchCoherentExperience();
  }, [selectedPersona.id, selectedSpaceId, selectedSurface]);

  // Handle Dispatch Contribution
  const handleDispatchContribution = async () => {
    setIsSubmittingContribution(true);
    setContributionOutcome(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Session expired');

      let parsedData: any = {};
      try {
        parsedData = JSON.parse(contributionData);
      } catch {
        parsedData = { raw: contributionData };
      }

      const res = await fetch('/api/coherence/dispatch-contribution', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          dbkId: selectedPersona.dbkId,
          spaceId: selectedSpaceId,
          contributionType,
          data: parsedData,
          actorName: selectedPersona.name,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Contribution failed');
      }

      const result = await res.json();
      setContributionOutcome(result.outcome);
      // Refresh experience so feed is live
      await fetchCoherentExperience();
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch contribution');
    } finally {
      setIsSubmittingContribution(false);
    }
  };

  // Handle Request Access
  const handleSendAccessRequest = async () => {
    if (!requestTargetCap) return;
    setIsSubmittingRequest(true);
    setRequestSuccessMessage(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Session expired');

      const res = await fetch('/api/coherence/request-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          tenantId: selectedPersona.dbkId,
          spaceId: selectedSpaceId,
          capabilityId: requestTargetCap.capabilityId,
          capabilityName: requestTargetCap.name,
          justification: requestJustification,
          requesterName: selectedPersona.name,
          requesterRole: activeSpaceMembership.role,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Access request failed');
      }

      setRequestSuccessMessage(`Request for ${requestTargetCap.name} submitted to Space Administrator.`);
      setRequestTargetCap(null);
    } catch (err: any) {
      alert(err.message || 'Request failed');
    } finally {
      setIsSubmittingRequest(false);
    }
  };

  // Run RBCE Test Suite
  const handleRunTestSuite = async () => {
    setIsRunningTests(true);
    setTestResults(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Session expired');

      const res = await fetch('/api/coherence/verify', {
        headers: {
          'Authorization': `Bearer ${idToken}`,
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || 'Test run failed');
      }

      const data = await res.json();
      setTestResults(data.summary);
    } catch (err: any) {
      alert(err.message || 'Test execution failed');
    } finally {
      setIsRunningTests(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col font-sans">
      {/* ------------------------------------------------------------- */}
      {/* TOP COHERENCE ENGINE BANNER                                   */}
      {/* ------------------------------------------------------------- */}
      <header className="bg-neutral-900 border-b border-neutral-800 px-6 py-4 sticky top-0 z-30 shadow-md">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            {onBack && (
              <button
                onClick={onBack}
                className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-neutral-300 text-xs font-semibold border border-neutral-700 transition"
              >
                ← Return to Workspace
              </button>
            )}
            <div className="w-9 h-9 rounded-xl bg-indigo-950/80 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-bold text-white tracking-tight">Role-Based Coherence Engine</h1>
                <span className="text-[10px] font-mono uppercase bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                  RBCE Active
                </span>
              </div>
              <p className="text-xs text-neutral-400">
                One Business • One Shared Reality • Different Roles • Different Experiences
              </p>
            </div>
          </div>

          {/* Quick Stats & Run Tests */}
          <div className="flex items-center gap-3 self-start md:self-auto">
            <button
              onClick={() => {
                setActiveTab('TEST_SUITE');
                handleRunTestSuite();
              }}
              disabled={isRunningTests}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>{isRunningTests ? 'Running Verification...' : 'Run RBCE Verification Suite'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ------------------------------------------------------------- */}
      {/* ACTOR & SPACE CONTEXT SELECTOR BAR                            */}
      {/* ------------------------------------------------------------- */}
      <section className="bg-neutral-900/60 border-b border-neutral-800/80 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Persona selector */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs font-medium text-neutral-400 shrink-0 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-neutral-400" />
              <span>Simulate User:</span>
            </span>
            <div className="flex items-center gap-2">
              {PRESET_PERSONAS.map((p) => {
                const isSelected = p.id === selectedPersona.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => {
                      setSelectedPersona(p);
                      setSelectedSpaceId(p.spaces[0].spaceId);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition flex items-center gap-2 border cursor-pointer ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                        : 'bg-neutral-800 hover:bg-neutral-700/80 text-neutral-300 border-neutral-700'
                    }`}
                  >
                    <span className="w-4 h-4 rounded-full bg-white/20 text-[10px] font-bold flex items-center justify-center">
                      {p.avatarLetter}
                    </span>
                    <span>{p.name}</span>
                    <span className="text-[10px] opacity-75">({p.title})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Space Switcher (Demonstrating USER + SPACE = ROLE) */}
          <div className="flex items-center gap-2 bg-neutral-950/80 border border-neutral-800 rounded-lg p-1">
            <span className="text-xs text-neutral-400 px-2 flex items-center gap-1 font-mono">
              <Building2 className="w-3.5 h-3.5 text-neutral-400" />
              <span>Active Space:</span>
            </span>
            <div className="flex items-center gap-1">
              {selectedPersona.spaces.map((s) => {
                const isActive = s.spaceId === selectedSpaceId;
                return (
                  <button
                    key={s.spaceId}
                    onClick={() => setSelectedSpaceId(s.spaceId)}
                    className={`px-2.5 py-1 rounded text-xs transition cursor-pointer font-medium ${
                      isActive
                        ? 'bg-neutral-800 text-indigo-300 border border-indigo-500/30 font-bold'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {s.spaceName.split(' ')[0]} ({s.role})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* CONTEXT RESOLUTION BANNER (The Core Mathematical Axiom)       */}
      {/* ------------------------------------------------------------- */}
      <section className="bg-gradient-to-r from-neutral-900 to-neutral-950 border-b border-neutral-800/80 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 font-mono">
            <span className="text-neutral-400">Context:</span>
            <span className="text-white font-semibold">{selectedPersona.name}</span>
            <span className="text-neutral-500">+</span>
            <span className="text-indigo-400 font-semibold">{activeSpaceMembership.spaceName}</span>
            <span className="text-neutral-500">=</span>
            <span className="bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">
              {activeSpaceMembership.role} ({activeSpaceMembership.roleTitle})
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-neutral-400">
            <span>Dept: <strong className="text-neutral-200">{activeSpaceMembership.department || 'General'}</strong></span>
            <span>Perms: <strong className="text-neutral-200">{activeSpaceMembership.permissions.join(', ')}</strong></span>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------- */}
      {/* NAVIGATION TABS                                               */}
      {/* ------------------------------------------------------------- */}
      <nav className="bg-neutral-900 border-b border-neutral-800 px-6">
        <div className="max-w-7xl mx-auto flex space-x-6">
          <button
            onClick={() => setActiveTab('MY_DAY')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'MY_DAY'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Compass className="w-4 h-4" />
            <span>Role-Tailored "My Day"</span>
          </button>
          <button
            onClick={() => setActiveTab('SHARED_REALITY')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'SHARED_REALITY'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Shared Business Reality & Contributions</span>
          </button>
          <button
            onClick={() => setActiveTab('CATALOGUE')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'CATALOGUE'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            <span>3-Level Coherent Catalogue</span>
          </button>
          <button
            onClick={() => setActiveTab('SURFACES')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'SURFACES'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Monitor className="w-4 h-4" />
            <span>Multi-Surface Projections</span>
          </button>
          <button
            onClick={() => setActiveTab('TEST_SUITE')}
            className={`py-3 text-xs font-bold border-b-2 flex items-center gap-2 transition cursor-pointer ${
              activeTab === 'TEST_SUITE'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>RBCE Verification Engine</span>
          </button>
        </div>
      </nav>

      {/* ------------------------------------------------------------- */}
      {/* MAIN CONTENT PANELS                                           */}
      {/* ------------------------------------------------------------- */}
      <main className="max-w-7xl mx-auto px-6 py-8 flex-1 w-full">
        {/* Loading / Error States */}
        {loadingExperience && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-8 text-center">
            <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-xs text-neutral-400">Resolving authoritative role-based experience projection...</p>
          </div>
        )}

        {experienceError && (
          <div className="bg-rose-950/40 border border-rose-800/60 rounded-xl p-4 mb-6 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-rose-200">Resolution Error</h4>
              <p className="text-xs text-rose-300 mt-1">{experienceError}</p>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 1: ROLE-TAILORED "MY DAY"                               */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'MY_DAY' && experience && (
          <div className="space-y-6">
            {/* Header / Hero Greeting */}
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 relative overflow-hidden">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold mb-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{experience.home.myDay.roleBadge}</span>
                  </div>
                  <h2 className="text-2xl font-bold text-white tracking-tight">
                    {experience.home.myDay.greeting}
                  </h2>
                  <p className="text-sm text-neutral-400 mt-1 max-w-2xl">
                    {experience.home.myDay.headline}
                  </p>
                </div>

                <div className="flex flex-col items-start md:items-end text-xs text-neutral-400 bg-neutral-950/60 border border-neutral-800/80 px-3.5 py-2 rounded-xl">
                  <span className="font-mono text-neutral-300">Space: {experience.space.spaceName}</span>
                  <span className="text-[11px] text-neutral-500">Tenant: {experience.tenant.displayName}</span>
                </div>
              </div>

              {/* Role-Specific Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
                {experience.home.myDay.metrics.map((m: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-neutral-950/70 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
                  >
                    <span className="text-xs text-neutral-400 font-medium">{m.label}</span>
                    <div className="flex items-baseline justify-between mt-2">
                      <span className="text-2xl font-bold text-white font-mono">{m.value}</span>
                      {m.trend && (
                        <span className="text-xs text-emerald-400 flex items-center gap-0.5">
                          <TrendingUp className="w-3.5 h-3.5" />
                          <span>{m.trend}</span>
                        </span>
                      )}
                    </div>
                    {m.sublabel && (
                      <span className="text-[11px] text-neutral-500 mt-1">{m.sublabel}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Relevant Tasks & Urgent Alerts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Tasks */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Briefcase className="w-4 h-4 text-indigo-400" />
                    <span>My Role-Specific Operational Tasks</span>
                  </h3>
                  <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-2 py-0.5 rounded">
                    {experience.home.relevantTasks?.length || 0} active
                  </span>
                </div>

                <div className="space-y-3">
                  {experience.home.relevantTasks?.map((task: any) => (
                    <div
                      key={task.taskId}
                      className="bg-neutral-950/60 border border-neutral-800 hover:border-neutral-700 rounded-xl p-3.5 transition flex items-start justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-neutral-200">{task.title}</h4>
                          <span
                            className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                              task.urgency === 'HIGH'
                                ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                                : 'bg-neutral-800 text-neutral-400'
                            }`}
                          >
                            {task.urgency}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">{task.summary}</p>
                      </div>
                      <button className="px-2.5 py-1 text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white rounded transition shrink-0 cursor-pointer">
                        Act
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Alerts & AI Coherence Summary */}
              <div className="space-y-6">
                {/* Alerts */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                    <AlertCircle className="w-4 h-4 text-amber-400" />
                    <span>Operational Alerts for My Role</span>
                  </h3>
                  <div className="space-y-2.5">
                    {experience.home.alerts?.map((alt: any) => (
                      <div
                        key={alt.alertId}
                        className="bg-amber-950/20 border border-amber-500/30 rounded-xl p-3 text-xs"
                      >
                        <span className="font-bold text-amber-300">{alt.title}</span>
                        <p className="text-neutral-400 mt-0.5">{alt.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Role-Scoped AI Context Card */}
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    <h3 className="text-sm font-bold text-white">AI Assistant Boundary</h3>
                  </div>
                  <p className="text-xs text-neutral-400 mb-3">
                    AI responses in this session are strictly constrained by the active role and space boundaries.
                  </p>
                  <div className="bg-neutral-950 rounded-xl p-3 border border-neutral-800 text-xs font-mono space-y-1.5 text-neutral-300">
                    <div>User Role: <strong className="text-indigo-400">{experience.aiContext?.userRole}</strong></div>
                    <div>Permitted Domains: <strong className="text-emerald-400">{experience.aiContext?.permittedDomains?.join(', ')}</strong></div>
                    <div>Tone: <strong className="text-neutral-400">{experience.aiContext?.tone}</strong></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 2: SHARED BUSINESS REALITY & CONTRIBUTIONS              */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'SHARED_REALITY' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left 2 Cols: Shared Reality Feed & Pulse */}
            <div className="lg:col-span-2 space-y-6">
              {/* Business Pulse */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-emerald-400" />
                    <h3 className="text-sm font-bold text-white">Live Business Pulse</h3>
                  </div>
                  <span className="text-[11px] text-emerald-400 font-mono flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Synchronized
                  </span>
                </div>

                <div className="space-y-3">
                  {experience?.home?.businessPulse?.map((pulse: any) => (
                    <div
                      key={pulse.id}
                      className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-3.5 flex items-start justify-between gap-4"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <h4 className="text-xs font-bold text-neutral-200">{pulse.title}</h4>
                          <span className="text-[10px] font-mono text-neutral-500">
                            {pulse.sourceModule}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1">{pulse.description}</p>
                      </div>
                      <span className="text-[11px] font-mono text-neutral-500 shrink-0">
                        {pulse.timestamp}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Peer Contributions Feed */}
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-indigo-400" />
                  <span>Recent Cross-Role Contributions (One Shared Reality)</span>
                </h3>
                <div className="space-y-3">
                  {experience?.home?.recentContributions?.map((cnt: any) => (
                    <div
                      key={cnt.contributionId}
                      className="bg-neutral-950/60 border border-neutral-800 rounded-xl p-4"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-neutral-200">{cnt.actorName}</span>
                          <span className="text-[10px] bg-neutral-800 text-neutral-400 px-1.5 py-0.5 rounded font-mono">
                            {cnt.actorRole}
                          </span>
                        </div>
                        <span className="text-[11px] text-neutral-500">{cnt.timestamp}</span>
                      </div>
                      <p className="text-xs font-medium text-indigo-300 mt-1.5">{cnt.actionSummary}</p>
                      <p className="text-xs text-neutral-400 mt-0.5">
                        <strong className="text-neutral-300">Shared Impact:</strong> {cnt.impactSummary}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Col: Interactive Shared Contribution Dispatcher */}
            <div className="space-y-6">
              <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
                <h3 className="text-sm font-bold text-white flex items-center gap-2 mb-2">
                  <Send className="w-4 h-4 text-indigo-400" />
                  <span>Simulate Contribution</span>
                </h3>
                <p className="text-xs text-neutral-400 mb-4">
                  Demonstrates how a single action emits a domain event, mutates shared state, notifies other roles, and informs Business DNA.
                </p>

                <div className="space-y-3 text-xs">
                  <div>
                    <label className="block text-neutral-400 mb-1">Action / Contribution Type</label>
                    <select
                      value={contributionType}
                      onChange={(e) => {
                        setContributionType(e.target.value);
                        if (e.target.value === 'RECORD_ATTENDANCE') {
                          setContributionData('{"className":"Grade 4-Blue","learnerCount":38,"status":"PRESENT"}');
                        } else if (e.target.value === 'RECORD_FEE_PAYMENT') {
                          setContributionData('{"studentId":"std_101","amountKes":25000,"method":"MPESA"}');
                        } else {
                          setContributionData('{"action":"INVENTORY_CHECK","item":"Cement 50kg","quantity":100}');
                        }
                      }}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg px-3 py-2 text-white font-medium cursor-pointer"
                    >
                      <option value="RECORD_ATTENDANCE">Teacher: Record Class Attendance</option>
                      <option value="RECORD_FEE_PAYMENT">Bursar: Record Fee Payment (M-Pesa)</option>
                      <option value="LOG_INVENTORY">Store Clerk: Log Stock Adjustment</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-neutral-400 mb-1">Payload JSON</label>
                    <textarea
                      value={contributionData}
                      onChange={(e) => setContributionData(e.target.value)}
                      rows={3}
                      className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2 font-mono text-neutral-200 text-xs"
                    />
                  </div>

                  <button
                    onClick={handleDispatchContribution}
                    disabled={isSubmittingContribution}
                    className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{isSubmittingContribution ? 'Dispatching...' : 'Dispatch Contribution'}</span>
                  </button>
                </div>

                {/* Outcome Display */}
                {contributionOutcome && (
                  <div className="mt-4 p-3.5 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-xs space-y-1.5 font-mono">
                    <div className="flex items-center gap-1.5 text-emerald-400 font-bold">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Contribution Executed</span>
                    </div>
                    <div className="text-neutral-300">Event: <strong className="text-white">{contributionOutcome.domainEventEmitted}</strong></div>
                    <div className="text-neutral-300">Notified Roles: <strong className="text-indigo-300">{contributionOutcome.notifiedRoles.join(', ')}</strong></div>
                    <div className="text-neutral-300">Workflows: <strong className="text-white">{contributionOutcome.workflowsTriggered.join(', ')}</strong></div>
                    <div className="text-neutral-400 text-[11px] pt-1 border-t border-emerald-900/50">
                      {contributionOutcome.summaryMessage}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 3: THREE-LEVEL COHERENT CATALOGUE                       */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'CATALOGUE' && experience && (
          <div className="space-y-8">
            {/* Success message */}
            {requestSuccessMessage && (
              <div className="bg-emerald-950/40 border border-emerald-800/60 rounded-xl p-4 flex items-center justify-between">
                <span className="text-xs text-emerald-300">{requestSuccessMessage}</span>
                <button
                  onClick={() => setRequestSuccessMessage(null)}
                  className="text-emerald-400 text-xs font-bold"
                >
                  Dismiss
                </button>
              </div>
            )}

            {/* Level 1: My Tools */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Level 1: My Tools</h3>
                  <p className="text-xs text-neutral-400">
                    Tools that are active and directly available for {activeSpaceMembership.roleTitle}.
                  </p>
                </div>
                <span className="text-xs font-mono bg-neutral-800 text-neutral-300 px-2.5 py-1 rounded-full">
                  {experience.catalogue.myTools.length} tools active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {experience.catalogue.myTools.map((tool: any) => (
                  <div
                    key={tool.toolId}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between hover:border-neutral-700 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-indigo-400 bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-500/20">
                          {tool.category}
                        </span>
                        <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          Ready
                        </span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{tool.name}</h4>
                      <p className="text-xs text-neutral-400 mt-1">{tool.description}</p>
                    </div>
                    <button className="mt-4 w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-semibold transition cursor-pointer">
                      Open Tool
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Level 2: Available to My Space (Collaborative Discovery) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Level 2: Available to My Space</h3>
                  <p className="text-xs text-neutral-400">
                    Capabilities enabled or available for this space. Roles without direct activation permissions can request access rather than seeing a dead-end "Access Denied" message.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {experience.catalogue.availableToMySpace.map((cap: any) => (
                  <div
                    key={cap.capabilityId}
                    className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between hover:border-neutral-700 transition"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-neutral-400 bg-neutral-800 px-2 py-0.5 rounded">
                          {cap.category}
                        </span>
                        {cap.isEnabledInSpace ? (
                          <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Active in Space
                          </span>
                        ) : (
                          <span className="text-[10px] font-mono text-amber-400">
                            Available
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-white">{cap.name}</h4>
                      <p className="text-xs text-neutral-400 mt-1">{cap.description}</p>
                      <p className="text-[11px] text-neutral-500 mt-2 italic">
                        {cap.collaborationMessage}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-neutral-800/80">
                      {cap.isEnabledInSpace ? (
                        <button className="w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded text-xs font-semibold cursor-pointer">
                          Active
                        </button>
                      ) : cap.canUserDirectlyEnable ? (
                        <button className="w-full py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded text-xs font-semibold cursor-pointer shadow-xs">
                          Enable for Space
                        </button>
                      ) : (
                        <button
                          onClick={() => setRequestTargetCap(cap)}
                          className="w-full py-1.5 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-500/30 rounded text-xs font-semibold transition cursor-pointer"
                        >
                          Request Access from Admin
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Level 3: Explore More (Growth & Expansion) */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-base font-bold text-white">Level 3: Explore More</h3>
                  <p className="text-xs text-neutral-400">
                    Advanced capabilities recommended to elevate operational maturity (Growth & Scale tiers).
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {experience.catalogue.exploreMore.map((cap: any) => (
                  <div
                    key={cap.capabilityId}
                    className="bg-neutral-900/80 border border-neutral-800 rounded-xl p-4 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] font-mono text-purple-400 bg-purple-950/60 px-2 py-0.5 rounded border border-purple-500/20">
                          {cap.tierRequired} TIER
                        </span>
                        <span className="text-[10px] font-mono text-neutral-500">{cap.category}</span>
                      </div>
                      <h4 className="text-sm font-bold text-white">{cap.name}</h4>
                      <p className="text-xs text-neutral-400 mt-1">{cap.description}</p>
                      <p className="text-[11px] text-indigo-300 mt-2 font-medium">
                        ✦ {cap.recommendedReason}
                      </p>
                    </div>

                    <button
                      onClick={() => setRequestTargetCap(cap)}
                      className="mt-4 w-full py-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-200 rounded text-xs font-semibold transition cursor-pointer"
                    >
                      {cap.actionLabel}
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Request Access Modal */}
            {requestTargetCap && (
              <div className="fixed inset-0 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 z-50">
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-md w-full p-6 shadow-2xl">
                  <h4 className="text-base font-bold text-white">
                    Send Capability Collaboration Request
                  </h4>
                  <p className="text-xs text-neutral-400 mt-1">
                    Request authorization for <strong className="text-white">{requestTargetCap.name}</strong> on {activeSpaceMembership.spaceName}.
                  </p>

                  <div className="mt-4 space-y-3 text-xs">
                    <div>
                      <label className="block text-neutral-400 mb-1">Business Justification</label>
                      <textarea
                        value={requestJustification}
                        onChange={(e) => setRequestJustification(e.target.value)}
                        rows={3}
                        className="w-full bg-neutral-950 border border-neutral-700 rounded-lg p-2.5 text-white font-sans text-xs"
                      />
                    </div>

                    <div className="p-3 bg-neutral-950 rounded-lg text-neutral-400 text-[11px]">
                      Your space administrator (Dr. Margaret Mutua) will be notified immediately. Once approved, the tool will instantly appear in your "My Tools" view.
                    </div>
                  </div>

                  <div className="mt-6 flex items-center justify-end gap-3">
                    <button
                      onClick={() => setRequestTargetCap(null)}
                      className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSendAccessRequest}
                      disabled={isSubmittingRequest}
                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold cursor-pointer"
                    >
                      {isSubmittingRequest ? 'Submitting...' : 'Submit Request'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 4: MULTI-SURFACE PROJECTIONS                            */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'SURFACES' && (
          <div className="space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">Headless Multi-Surface Projections</h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    One unified business reality rendered into dedicated operational form factors without duplicating backend services.
                  </p>
                </div>

                <div className="flex items-center gap-2 bg-neutral-950 p-1 rounded-xl border border-neutral-800">
                  <button
                    onClick={() => setSelectedSurface('DESKTOP')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      selectedSurface === 'DESKTOP' ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Desktop SHA UI</span>
                  </button>
                  <button
                    onClick={() => setSelectedSurface('COUNTER')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      selectedSurface === 'COUNTER' ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Counter / POS</span>
                  </button>
                  <button
                    onClick={() => setSelectedSurface('WALL_TV')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      selectedSurface === 'WALL_TV' ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <Tv className="w-3.5 h-3.5" />
                    <span>Wall / TV Display</span>
                  </button>
                  <button
                    onClick={() => setSelectedSurface('WHATSAPP')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition cursor-pointer ${
                      selectedSurface === 'WHATSAPP' ? 'bg-indigo-600 text-white font-bold' : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>WhatsApp Bot</span>
                  </button>
                </div>
              </div>

              {/* Surface Rendering Simulation Box */}
              {selectedSurface === 'DESKTOP' && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6">
                  <div className="flex items-center justify-between pb-4 border-b border-neutral-800">
                    <div className="flex items-center gap-2">
                      <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                      <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                      <span className="text-xs font-mono text-neutral-500 ml-2">https://app.tdbk.ke/workspace</span>
                    </div>
                    <span className="text-xs font-mono text-neutral-400">Desktop SHA UI Projection</span>
                  </div>
                  <div className="py-6 grid grid-cols-3 gap-4 text-xs">
                    <div className="col-span-1 bg-neutral-900 p-4 rounded-lg border border-neutral-800">
                      <span className="font-bold text-neutral-300">Navigation Hierarchy</span>
                      <ul className="mt-2 space-y-1 text-neutral-400">
                        <li className="text-indigo-400 font-bold">● Overview</li>
                        <li>○ Class Attendance</li>
                        <li>○ Learner Roster</li>
                        <li>○ Fee Registry</li>
                      </ul>
                    </div>
                    <div className="col-span-2 bg-neutral-900 p-4 rounded-lg border border-neutral-800">
                      <span className="font-bold text-neutral-300">Operational Workspace View</span>
                      <p className="text-neutral-400 mt-1">
                        High-density data grids, action toolbars, batch CSV exports, and interactive filtering designed for full keyboard and mouse precision.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {selectedSurface === 'COUNTER' && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 max-w-lg mx-auto">
                  <div className="text-center pb-4 border-b border-neutral-800">
                    <span className="text-xs font-mono uppercase text-indigo-400 tracking-wider">
                      Counter / Handheld POS Terminal (Touch-First)
                    </span>
                    <h4 className="text-sm font-bold text-white mt-1">Mombasa Academy Primary — Bursar Till</h4>
                  </div>
                  <div className="py-6 space-y-3">
                    <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white text-base font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm">
                      <span>KES 25,000 — Tap to Collect Fee (M-Pesa)</span>
                    </button>
                    <button className="w-full py-3 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 text-sm font-semibold rounded-xl border border-neutral-800">
                      Quick Receipt Print (eTIMS Sign)
                    </button>
                  </div>
                </div>
              )}

              {selectedSurface === 'WALL_TV' && (
                <div className="bg-neutral-950 border-2 border-indigo-500/40 rounded-xl p-8 text-center">
                  <span className="text-xs font-mono uppercase text-neutral-400 tracking-widest">
                    Wall / TV Display Mode — Staff Room Broadcast
                  </span>
                  <div className="mt-4 text-4xl font-black text-white font-mono">
                    98.4% ATTENDANCE TODAY
                  </div>
                  <p className="text-sm text-neutral-400 mt-2">
                    784 of 796 learners present • 2 unexcused absences flagged for guardian SMS
                  </p>
                  <div className="mt-6 flex items-center justify-center gap-8 text-xs font-mono text-neutral-400">
                    <span>MOMBASA CAMPUS</span>
                    <span>WEATHER: 29°C</span>
                    <span>NEXT ASSEMBLY: 10:30 AM</span>
                  </div>
                </div>
              )}

              {selectedSurface === 'WHATSAPP' && (
                <div className="bg-neutral-950 border border-neutral-800 rounded-xl p-6 max-w-md mx-auto">
                  <div className="bg-emerald-900/60 text-white p-3 rounded-t-xl flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 text-emerald-300" />
                    <div>
                      <h4 className="text-xs font-bold">TDBK Business Concierge (WhatsApp)</h4>
                      <p className="text-[10px] text-emerald-200">Official Business Bot</p>
                    </div>
                  </div>
                  <div className="p-4 bg-neutral-900 space-y-3 text-xs rounded-b-xl">
                    <div className="bg-neutral-800 p-3 rounded-lg max-w-[85%] text-neutral-200">
                      Good morning, Dr. Margaret Mutua! Here is your 08:00 AM Mombasa Academy digest:
                      <br /><br />
                      • Total Learners: 784 Present (98.4%)<br />
                      • Collections: KES 148,500 settled via M-Pesa<br />
                      • Pending: 2 Staff access requests awaiting approval<br />
                      <br />
                      Reply with <strong>1</strong> to approve requests, or <strong>2</strong> for fee arrears summary.
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------- */}
        {/* TAB 5: RBCE VERIFICATION TEST SUITE                         */}
        {/* ----------------------------------------------------------- */}
        {activeTab === 'TEST_SUITE' && (
          <div className="space-y-6">
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-base font-bold text-white">
                    RBCE Architectural & Coherence Verification Suite
                  </h3>
                  <p className="text-xs text-neutral-400 mt-1">
                    Executes tests across all 8 architectural categories: Membership Context, Experience Divergence, Capability Layer, 3-Level Catalogue, Shared Contribution Pipeline, Approval Flows, AI Boundaries, and Multi-Surface Projections.
                  </p>
                </div>
                <button
                  onClick={handleRunTestSuite}
                  disabled={isRunningTests}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-current" />
                  <span>{isRunningTests ? 'Executing Tests...' : 'Run All Tests Now'}</span>
                </button>
              </div>

              {/* Live Test Results */}
              {testResults && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <span className="text-xs text-neutral-400">Total Tests</span>
                      <div className="text-2xl font-bold text-white font-mono mt-1">{testResults.totalTests}</div>
                    </div>
                    <div className="bg-emerald-950/40 p-4 rounded-xl border border-emerald-500/30">
                      <span className="text-xs text-emerald-400">Passed</span>
                      <div className="text-2xl font-bold text-emerald-300 font-mono mt-1">{testResults.passedTests}</div>
                    </div>
                    <div className="bg-neutral-950 p-4 rounded-xl border border-neutral-800">
                      <span className="text-xs text-neutral-400">Failed</span>
                      <div className="text-2xl font-bold text-neutral-300 font-mono mt-1">{testResults.failedTests}</div>
                    </div>
                  </div>

                  <div className="space-y-3 mt-6">
                    {testResults.results.map((res: any, idx: number) => (
                      <div
                        key={idx}
                        className={`p-4 rounded-xl border transition ${
                          res.passed
                            ? 'bg-neutral-950/60 border-neutral-800'
                            : 'bg-rose-950/30 border-rose-800/60'
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs mb-1">
                          <div className="flex items-center gap-2">
                            {res.passed ? (
                              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <AlertCircle className="w-4 h-4 text-rose-400" />
                            )}
                            <span className="font-bold text-white">{res.testName}</span>
                          </div>
                          <span className="font-mono text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded">
                            {res.category}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-400 mt-1 pl-6">{res.message}</p>
                        {res.evidence && (
                          <pre className="mt-2 ml-6 p-2 bg-neutral-950 rounded text-[11px] font-mono text-neutral-300 overflow-x-auto border border-neutral-800/80">
                            {JSON.stringify(res.evidence, null, 2)}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
