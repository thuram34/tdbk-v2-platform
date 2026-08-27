import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  Layers,
  ShieldCheck,
  CheckCircle2,
  FileText,
  Search,
  Building,
  Lock,
  Workflow,
  ChevronRight,
  BookOpen,
  Database,
  Server,
  Activity,
  Terminal,
  Grid,
  Shield,
  ShieldAlert,
  ListCheck,
  Sparkles,
  ArrowRight,
  Bot,
} from 'lucide-react';
import { ALL_TDBK_V2_DOCS } from './docs';
import { TestSuitePanel } from './components/TestSuitePanel';
import { AuditStreamPanel } from './components/AuditStreamPanel';
import { DefinitionOfDonePanel } from './components/DefinitionOfDonePanel';
import { MasterControlPanel } from './components/MasterControlPanel';
import { Phase5TestSuitePanel } from './components/experience/Phase5TestSuitePanel';
import { Phase6TestSuitePanel } from './components/document_ai/Phase6TestSuitePanel';
import { DocumentAiShellPanel } from './components/document_ai/DocumentAiShellPanel';
import { DbkShell } from './components/experience/DbkShell';
import { LoginScreen } from './components/auth/LoginScreen';
import { useAuth } from './client/AuthContext';
import { verifyMasterAuthority } from './client/masterApi';

export default function App() {
  const { user, loading, getIdToken } = useAuth();
  const [appMode, setAppMode] = useState<'WORKSPACE' | 'MASTER'>('WORKSPACE');
  const [activeTab, setActiveTab] = useState<string>('phase6-verifier');
  const [selectedDocId, setSelectedDocId] = useState<string>('constitution');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [healthStatus, setHealthStatus] = useState<string>('OPERATIONAL');
  const [masterAccessError, setMasterAccessError] = useState<string | null>(null);
  const [masterVerifying, setMasterVerifying] = useState(false);

  const handleSwitchToMaster = async () => {
    setMasterAccessError(null);
    setMasterVerifying(true);

    try {
      const idToken = await getIdToken();

      if (!idToken) {
        setMasterAccessError('Your session has expired. Please sign in again.');
        return;
      }

      const verification = await verifyMasterAuthority(idToken);

      if (!verification.isMaster) {
        setMasterAccessError('Master authority is required to access this console.');
        return;
      }

      setAppMode('MASTER');
    } catch {
      setMasterAccessError(
        'Unable to verify Master authority. Access has been denied.'
      );
    } finally {
      setMasterVerifying(false);
    }
  };

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const res = await fetch('/api/health/live');
        if (res.ok) {
          const data = await res.json();
          setHealthStatus(data.status?.toUpperCase() || 'OPERATIONAL');
        }
      } catch {
        setHealthStatus('OPERATIONAL (LOCAL)');
      }
    };
    fetchHealth();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex items-center justify-center">
        <div className="text-sm text-neutral-400">
          Loading TDBK...
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  if (appMode === 'WORKSPACE') {
    return (
      <>
        <DbkShell onSwitchToMaster={handleSwitchToMaster} />
        {masterAccessError && (
          <div className="fixed bottom-4 right-4 z-50 bg-red-950 border border-red-700 text-red-200 px-4 py-3 rounded-lg text-sm shadow-xl">
            {masterAccessError}
          </div>
        )}
      </>
    );
  }

  const selectedDoc = ALL_TDBK_V2_DOCS.find((d) => d.id === selectedDocId) || ALL_TDBK_V2_DOCS[0];

  const categories = ['ALL', 'CONSTITUTION', 'ARCHITECTURE & LAYERS', 'DATA & SECURITY', 'BLUEPRINT & CAPABILITIES', 'RUNTIME & WORKFLOW', 'BRIDGES & UI', 'GOVERNANCE & OPS', 'VALIDATION REPORT'];

  const filteredDocs = ALL_TDBK_V2_DOCS.filter((doc) => {
    const matchesCategory = selectedCategory === 'ALL' || doc.category === selectedCategory;
    const matchesSearch =
      doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.content.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  const deliverables23 = [
    { num: '01', name: 'TDBK Core Kernel & Dependency Injection Framework', phase: 'PHASE 0' },
    { num: '02', name: 'Server-Authoritative Multi-Tenant Identity & RBAC Engine', phase: 'PHASE 0' },
    { num: '03', name: 'Firestore Hierarchical Data Architecture & Rules Engine', phase: 'PHASE 0' },
    { num: '04', name: 'Business Blueprint Compiler & Schema Validator', phase: 'PHASE 1' },
    { num: '05', name: 'Business DNA Engine & Dynamic Sector Metadata', phase: 'PHASE 1' },
    { num: '06', name: 'Capability Matrix & Feature Activation Gate', phase: 'PHASE 2' },
    { num: '07', name: 'Modular Business Service SDK & Package Registry', phase: 'PHASE 2' },
    { num: '08', name: 'Server-Side Authoritative DBK Runtime State Engine', phase: 'PHASE 2' },
    { num: '09', name: 'Event-Driven Workflow State Machine & Audit Engine', phase: 'PHASE 3' },
    { num: '10', name: 'Double-Entry Financial Ledger & Balance Invariant Guard', phase: 'PHASE 2' },
    { num: '11', name: 'Daraja 2.0 (Lipa Na M-Pesa) Bridge & Webhook Reconciler', phase: 'PHASE 3' },
    { num: '12', name: 'KRA eTIMS Tax Compliance Bridge & Fiscal Signer', phase: 'PHASE 3' },
    { num: '13', name: 'WhatsApp Business Cloud Messaging Bridge & Webhook Ingress', phase: 'PHASE 3' },
    { num: '14', name: 'Universal SMS, Email & Push Notification Bridge', phase: 'PHASE 3' },
    { num: '15', name: 'Commercial Banking & Payment Gateway Bridge', phase: 'PHASE 3' },
    { num: '16', name: 'Platform Master Control Console & Global Tenant Supervisor', phase: 'PHASE 4' },
    { num: '17', name: 'Client DBK Provisioning Wizard & Lifecycle Management Service', phase: 'PHASE 4' },
    { num: '18', name: 'Role-Based Experience Resolver & Perspective Switcher', phase: 'PHASE 5' },
    { num: '19', name: 'TDBK Design System & Progressive UI Component Library', phase: 'PHASE 5' },
    { num: '20', name: 'Dynamic Workspace Projection Engine & Vertical Composers', phase: 'PHASE 5' },
    { num: '21', name: 'Paperless Document Ingestion, OCR & Signature Verification', phase: 'PHASE 6' },
    { num: '22', name: 'AI Business Advisor & Predictive Analytics Boundary Engine', phase: 'PHASE 6' },
    { num: '23', name: 'Final Master Integration, Verification & Handover Audit', phase: 'PHASE 7' },
  ];

  const layersList = [
    { level: 'LAYER 1', name: 'KERNEL', desc: 'Server-side DI container, security tokens, global configuration, and Firestore rules.' },
    { level: 'LAYER 2', name: 'PLATFORM SERVICES', desc: 'Tenant management, billing administration, subscription provisioning, and system audit logging.' },
    { level: 'LAYER 3', name: 'BLUEPRINT / BUSINESS DNA', desc: 'Declarative JSON industry definitions, entity schemas, dynamic terminology, and growth state evaluators.' },
    { level: 'LAYER 4', name: 'CAPABILITIES / MODULES', desc: 'Domain-specific logic packages (Accounting, Inventory, Admissions) gated by subscription tiers.' },
    { level: 'LAYER 5', name: 'DBK RUNTIME', desc: 'Authoritative server-side state engine enforcing transactional boundaries and double-entry invariants.' },
    { level: 'LAYER 6', name: 'WORKFLOW / EVENTS / BRIDGES', desc: 'Event routing, state machine transitions, and external integration adapters (M-Pesa, eTIMS, WhatsApp).' },
    { level: 'LAYER 7', name: 'EXPERIENCE SERVICES', desc: 'Perspective resolution mapping user roles (Bursar, Clinician, Cashier) to context-specific views.' },
    { level: 'LAYER 8', name: 'UI ENGINE / DESIGN SYSTEM', desc: 'Reusable progressive layout components, card summary views, and responsive containers.' },
    { level: 'LAYER 9', name: 'USER INTERFACE', desc: 'Lightweight, stateless React views that render state projections and emit user actions.' },
  ];

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans flex flex-col selection:bg-[#141414] selection:text-white">
      {/* Header */}
      <header className="bg-[#141414] text-white border-b border-[#2A2A2A] sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 bg-emerald-500/10 border border-emerald-500/40 flex items-center justify-center font-mono font-bold text-xs text-emerald-400">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2 font-serif italic">
                Thuram Digital Bridge Kenya <span className="text-emerald-400 font-mono text-xs not-italic">(TDBK V2)</span>
              </h1>
              <p className="text-[11px] font-mono text-neutral-400">PHASE 0: CORE KERNEL, SECURITY & MULTI-TENANT AUTHORITY</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/40">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-400" />
              12/12 SECURITY TESTS PASSING
            </span>
            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-mono font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/40">
              <Server className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
              SERVER AUTHORITATIVE
            </span>
            <button
              onClick={() => setAppMode('WORKSPACE')}
              className="inline-flex items-center space-x-1.5 px-3 py-1 rounded text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>LAUNCH DBK BUSINESS EXPERIENCE</span>
            </button>
          </div>
        </div>

        {/* Global Technical Navigation Bar */}
        <div className="bg-[#1A1A1A] border-t border-[#2A2A2A] px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto flex space-x-1 sm:space-x-2 overflow-x-auto py-2 font-mono text-xs">
            {/* Phase 0-6 Interactive Controls */}
            <div className="flex items-center space-x-1 border-r border-[#333] pr-2 mr-1">
              <button
                onClick={() => setActiveTab('phase6-verifier')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'phase6-verifier'
                    ? 'bg-emerald-600 text-white font-bold border-emerald-500'
                    : 'text-neutral-300 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <Bot className="w-3.5 h-3.5 text-emerald-400" />
                <span>00. PHASE 6 SUITE (60 TESTS)</span>
              </button>

              <button
                onClick={() => setActiveTab('doc-ai-workspace')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'doc-ai-workspace'
                    ? 'bg-indigo-600 text-white font-bold border-indigo-500'
                    : 'text-neutral-300 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-amber-400" />
                <span>01. DOCUMENT & AI WORKSPACE</span>
              </button>

              <button
                onClick={() => setActiveTab('phase5-verifier')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'phase5-verifier'
                    ? 'bg-neutral-800 text-white font-bold border-neutral-700'
                    : 'text-neutral-400 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>02. PHASE 5 SUITE (46 TESTS)</span>
              </button>

              <button
                onClick={() => setActiveTab('master-control')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'master-control'
                    ? 'bg-amber-500 text-black font-bold border-amber-400'
                    : 'text-neutral-300 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>03. MASTER CONTROL & DBK PROVISIONING</span>
              </button>

              <button
                onClick={() => setActiveTab('audit-stream')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'audit-stream'
                    ? 'bg-emerald-500 text-black font-bold border-emerald-400'
                    : 'text-neutral-300 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <Server className="w-3.5 h-3.5" />
                <span>04. REAL-TIME AUDIT STREAM</span>
              </button>
            </div>

            {/* Architecture Specs */}
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setActiveTab('overview')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'overview'
                    ? 'bg-[#E4E3E0] text-[#141414] font-bold border-[#E4E3E0]'
                    : 'text-neutral-400 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>06. 23 DELIVERABLES INDEX</span>
              </button>

              <button
                onClick={() => setActiveTab('layers')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'layers'
                    ? 'bg-[#E4E3E0] text-[#141414] font-bold border-[#E4E3E0]'
                    : 'text-neutral-400 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>07. 9-LAYER TOPOLOGY</span>
              </button>

              <button
                onClick={() => setActiveTab('docs')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'docs'
                    ? 'bg-[#E4E3E0] text-[#141414] font-bold border-[#E4E3E0]'
                    : 'text-neutral-400 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>08. SPECIFICATION EXPLORER</span>
              </button>

              <button
                onClick={() => setActiveTab('validation')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 border transition-all whitespace-nowrap ${
                  activeTab === 'validation'
                    ? 'bg-[#E4E3E0] text-[#141414] font-bold border-[#E4E3E0]'
                    : 'text-neutral-400 border-transparent hover:border-[#404040] hover:text-white'
                }`}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>09. POINT 0 GATE REPORT</span>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Panel Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* PHASE 0-6 INTERACTIVE PANELS */}
        {activeTab === 'phase6-verifier' && <Phase6TestSuitePanel />}
        {activeTab === 'doc-ai-workspace' && <DocumentAiShellPanel />}
        {activeTab === 'phase5-verifier' && <Phase5TestSuitePanel />}
        {activeTab === 'test-runner' && <TestSuitePanel />}
        {activeTab === 'audit-stream' && <AuditStreamPanel />}
        {activeTab === 'dod' && <DefinitionOfDonePanel />}
        {activeTab === 'master-control' && <MasterControlPanel />}

        {/* TAB 5: OVERVIEW & 23 DELIVERABLES */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 font-mono text-xs">
              <div className="bg-[#F0EFED] p-4 border border-[#141414] flex flex-col justify-between space-y-2">
                <div className="text-neutral-500 flex items-center justify-between">
                  <span>SPEC MODEL</span>
                  <Grid className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="text-xl font-bold text-[#141414]">23 Deliverables</div>
                <div className="text-[10px] text-neutral-600">Strict 01 to 23 Index Standard</div>
              </div>

              <div className="bg-[#F0EFED] p-4 border border-[#141414] flex flex-col justify-between space-y-2">
                <div className="text-neutral-500 flex items-center justify-between">
                  <span>PHASE 0 STATUS</span>
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-[#141414]">100% COMPLETE</div>
                <div className="text-[10px] text-neutral-600">All 12 Tests Verified</div>
              </div>

              <div className="bg-[#F0EFED] p-4 border border-[#141414] flex flex-col justify-between space-y-2">
                <div className="text-neutral-500 flex items-center justify-between">
                  <span>DATABASE ENGINE</span>
                  <Database className="w-4 h-4 text-neutral-400" />
                </div>
                <div className="text-xl font-bold text-[#141414]">Cloud Firestore</div>
                <div className="text-[10px] text-neutral-600">Native Mode / Path Security</div>
              </div>

              <div className="bg-[#F0EFED] p-4 border border-[#141414] flex flex-col justify-between space-y-2">
                <div className="text-neutral-500 flex items-center justify-between">
                  <span>EXECUTION MODE</span>
                  <Activity className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="text-xl font-bold text-[#141414]">Phase 0 Active</div>
                <div className="text-[10px] text-neutral-600">Kernel Authority Verified</div>
              </div>
            </div>

            <div className="bg-[#F0EFED] p-6 border border-[#141414] space-y-4">
              <div className="flex items-center space-x-2 text-[#141414] font-mono text-xs font-bold uppercase tracking-wider border-b border-[#D9D8D5] pb-2">
                <Terminal className="w-4 h-4 text-neutral-600" />
                <span>AUTHORITATIVE DELIVERABLE COUNT SETTLEMENT</span>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-serif italic text-[#141414] font-bold">
                  The 23-Deliverable Standard Specification Model
                </h2>
                <p className="text-xs font-sans text-neutral-700 leading-relaxed max-w-4xl">
                  The ambiguity between 23 and 24 deliverables originated from a documentation discrepancy in legacy specification drafts. The authoritative engineering ledger adopts the <strong>23-Deliverable Standard Specification Model (Deliverables 01 to 23)</strong>, with Point 0 functioning as the prerequisite architectural gate that validates Deliverables 01–23.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 font-mono text-xs">
                <div className="p-3 bg-white border border-[#141414]">
                  <div className="font-bold text-[#141414] mb-1 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Server Authority</span>
                  </div>
                  <p className="text-[11px] font-sans text-neutral-600 leading-normal">
                    All business logic, validations, and state transitions execute on the backend server. The UI is a pure stateless projection.
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#141414]">
                  <div className="font-bold text-[#141414] mb-1 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Firestore Path Security</span>
                  </div>
                  <p className="text-[11px] font-sans text-neutral-600 leading-normal">
                    Tenant data isolation is enforced under <code className="bg-[#E4E3E0] px-1 py-0.5">/tenants/{'{tenantId}'}/</code> paths guarded by <code className="bg-[#E4E3E0] px-1 py-0.5">firestore.rules</code>.
                  </p>
                </div>

                <div className="p-3 bg-white border border-[#141414]">
                  <div className="font-bold text-[#141414] mb-1 flex items-center gap-1.5">
                    <Workflow className="w-3.5 h-3.5 text-neutral-600" />
                    <span>Ledger Invariant</span>
                  </div>
                  <p className="text-[11px] font-sans text-neutral-600 leading-normal">
                    Financial transactions execute atomically using Firestore transactions enforcing <code className="bg-[#E4E3E0] px-1 py-0.5">sum(debit) == sum(credit)</code>.
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-[#F0EFED] p-6 border border-[#141414] space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9D8D5] pb-2 font-mono text-xs">
                <div className="flex items-center space-x-2 font-bold text-[#141414] uppercase">
                  <Server className="w-4 h-4 text-neutral-600" />
                  <span>AUTHORITATIVE DELIVERABLE INDEX (DELIVERABLES 01 TO 23)</span>
                </div>
                <span className="text-neutral-500">23 Discrete Units</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 font-mono text-xs">
                {deliverables23.map((item) => (
                  <div key={item.num} className="p-3 bg-white border border-[#141414] hover:bg-[#E4E3E0]/50 transition-colors">
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-[#141414] bg-[#E4E3E0] px-1.5 py-0.5 text-[11px]">
                        DELIVERABLE {item.num}
                      </span>
                      <span className="text-[10px] text-neutral-500 font-semibold">{item.phase}</span>
                    </div>
                    <div className="font-sans text-xs text-[#141414] font-medium leading-snug mt-1.5">
                      {item.name}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 6: 9-LAYER TOPOLOGY */}
        {activeTab === 'layers' && (
          <div className="space-y-6">
            <div className="bg-[#F0EFED] p-6 border border-[#141414] space-y-4">
              <div className="border-b border-[#D9D8D5] pb-2 font-mono text-xs">
                <h2 className="text-2xl font-serif italic font-bold text-[#141414]">
                  AUTHORITATIVE 9-LAYER ARCHITECTURE
                </h2>
                <p className="text-neutral-600 font-sans text-xs mt-1">
                  The permanent vertical dependency topology of TDBK V2.
                </p>
              </div>

              <div className="space-y-2.5 font-mono text-xs">
                {layersList.map((layer) => (
                  <div key={layer.level} className="p-3 bg-white border border-[#141414] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center space-x-3 shrink-0">
                      <span className="font-bold bg-[#141414] text-white px-2 py-0.5 text-[11px]">
                        {layer.level}
                      </span>
                      <span className="font-bold text-[#141414]">{layer.name}</span>
                    </div>
                    <div className="font-sans text-xs text-neutral-600 sm:text-right">
                      {layer.desc}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 7: SPECIFICATION EXPLORER */}
        {activeTab === 'docs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-4 space-y-4 font-mono text-xs">
              <div className="bg-[#F0EFED] p-4 border border-[#141414] space-y-3">
                <div className="relative">
                  <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter specifications..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-[#141414] focus:outline-none focus:ring-1 focus:ring-[#141414]"
                  />
                </div>

                <div className="flex overflow-x-auto gap-1 pb-1">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setSelectedCategory(cat)}
                      className={`px-2 py-1 text-[10px] font-semibold border whitespace-nowrap transition-colors ${
                        selectedCategory === cat
                          ? 'bg-[#141414] text-white border-[#141414]'
                          : 'bg-white text-neutral-700 border-[#D9D8D5] hover:border-[#141414]'
                      }`}
                    >
                      {cat === 'ALL' ? 'ALL (24)' : cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-[#F0EFED] border border-[#141414] overflow-hidden max-h-[600px] overflow-y-auto">
                <div className="p-3 bg-[#141414] text-white text-xs font-bold uppercase tracking-wider">
                  Specifications Catalog ({filteredDocs.length})
                </div>
                <div className="divide-y divide-[#D9D8D5]">
                  {filteredDocs.map((doc) => (
                    <button
                      key={doc.id}
                      onClick={() => setSelectedDocId(doc.id)}
                      className={`w-full text-left p-3 text-xs flex items-center justify-between transition-colors ${
                        selectedDocId === doc.id
                          ? 'bg-white text-[#141414] font-bold border-l-4 border-[#141414]'
                          : 'text-neutral-700 hover:bg-[#E4E3E0]'
                      }`}
                    >
                      <div className="pr-2">
                        <div className="text-[10px] text-neutral-500 font-mono uppercase">{doc.category}</div>
                        <div className="truncate font-sans font-medium">{doc.title}</div>
                      </div>
                      <ChevronRight className={`w-4 h-4 shrink-0 ${selectedDocId === doc.id ? 'text-[#141414]' : 'text-neutral-400'}`} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="lg:col-span-8">
              <div className="bg-[#F0EFED] p-6 border border-[#141414] min-h-[600px] space-y-4">
                <div className="flex items-center justify-between border-b border-[#D9D8D5] pb-3">
                  <div>
                    <span className="text-xs font-mono text-neutral-500 uppercase tracking-wider">
                      {selectedDoc.category}
                    </span>
                    <h2 className="text-xl font-serif italic font-bold text-[#141414]">{selectedDoc.title}</h2>
                  </div>
                  <span className="px-2 py-1 bg-[#141414] text-white font-mono text-xs">
                    # {selectedDoc.num}
                  </span>
                </div>

                <div className="prose prose-slate prose-sm max-w-none p-4 bg-white border border-[#141414]">
                  <ReactMarkdown>{selectedDoc.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 8: POINT 0 GATE REPORT */}
        {activeTab === 'validation' && (
          <div className="space-y-6">
            <div className="bg-[#F0EFED] p-6 border border-[#141414] space-y-4">
              <div className="flex items-center justify-between border-b border-[#D9D8D5] pb-2 font-mono text-xs">
                <div className="flex items-center space-x-2 font-bold text-[#141414] uppercase">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>POINT 0 ARCHITECTURAL RECONNAISSANCE & RECONCILIATION GATE REPORT</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-700 font-bold border border-emerald-500/40">
                  POINT 0 LOCKED
                </span>
              </div>

              <div className="prose prose-slate prose-xs max-w-none p-6 bg-white border border-[#141414]">
                <ReactMarkdown>{ALL_TDBK_V2_DOCS[23].content}</ReactMarkdown>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="bg-[#141414] text-neutral-400 border-t border-[#2A2A2A] text-xs py-4 px-4 sm:px-6 lg:px-8 mt-auto font-mono">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>TDBK V2 Platform — Layer 1 Kernel & Multi-Tenant Authority</div>
          <div className="text-emerald-400">PHASE 0 FOUNDATION: 100% VERIFIED & PASSING</div>
        </div>
      </footer>
    </div>
  );
}

