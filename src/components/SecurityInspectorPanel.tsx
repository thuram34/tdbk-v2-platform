import React, { useState } from 'react';
import { Shield, Lock, AlertOctagon, CheckCircle2, User, Key, Eye, ArrowRight } from 'lucide-react';
import { TokenVerifier } from '../kernel/identity/tokenVerifier';

interface PersonaOption {
  id: string;
  name: string;
  roleDescription: string;
  isMaster: boolean;
  tenantId: string | null;
  branchId: string | null;
  roles: string[];
  permissions: string[];
  token: string;
}

export const SecurityInspectorPanel: React.FC = () => {
  const personas: PersonaOption[] = [
    {
      id: 'master_admin',
      name: 'TDBK Master Admin',
      roleDescription: 'Platform-level master administrative authority across all DBKs',
      isMaster: true,
      tenantId: null,
      branchId: null,
      roles: ['TDBK_MASTER_ADMIN'],
      permissions: ['*'],
      token: TokenVerifier.mintTestToken({
        uid: 'usr_master_01',
        email: 'master@tdbk.co.ke',
        isMaster: true,
        tenantId: null,
        branchId: null,
        roles: ['TDBK_MASTER_ADMIN'],
        permissions: ['*'],
      }),
    },
    {
      id: 'tenant_a_admin',
      name: 'DBK-A Tenant Admin (School A)',
      roleDescription: 'Full administrative authority strictly within tenant_school_a',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'branch_hq',
      roles: ['TENANT_ADMIN'],
      permissions: ['school:read', 'school:write', 'finance:read', 'finance:write'],
      token: TokenVerifier.mintTestToken({
        uid: 'usr_schoola_admin',
        email: 'bursar@schoolA.ac.ke',
        isMaster: false,
        tenantId: 'tenant_school_a',
        branchId: 'branch_hq',
        roles: ['TENANT_ADMIN'],
        permissions: ['school:read', 'school:write', 'finance:read', 'finance:write'],
      }),
    },
    {
      id: 'tenant_a_staff',
      name: 'DBK-A Staff (HQ Branch)',
      roleDescription: 'Staff authority restricted to school:read within tenant_school_a (HQ)',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'branch_hq',
      roles: ['STAFF'],
      permissions: ['school:read'],
      token: TokenVerifier.mintTestToken({
        uid: 'usr_schoola_staff',
        email: 'teacher@schoolA.ac.ke',
        isMaster: false,
        tenantId: 'tenant_school_a',
        branchId: 'branch_hq',
        roles: ['STAFF'],
        permissions: ['school:read'],
      }),
    },
    {
      id: 'tenant_a_branch2',
      name: 'DBK-A Staff (Secondary Branch)',
      roleDescription: 'Staff authority restricted to branch_secondary within tenant_school_a',
      isMaster: false,
      tenantId: 'tenant_school_a',
      branchId: 'branch_secondary',
      roles: ['STAFF'],
      permissions: ['school:read'],
      token: TokenVerifier.mintTestToken({
        uid: 'usr_schoola_branch2',
        email: 'teacher2@schoolA.ac.ke',
        isMaster: false,
        tenantId: 'tenant_school_a',
        branchId: 'branch_secondary',
        roles: ['STAFF'],
        permissions: ['school:read'],
      }),
    },
    {
      id: 'tenant_b_admin',
      name: 'DBK-B Tenant Admin (Hardware B)',
      roleDescription: 'Full administrative authority strictly within tenant_hardware_b',
      isMaster: false,
      tenantId: 'tenant_hardware_b',
      branchId: 'branch_main',
      roles: ['TENANT_ADMIN'],
      permissions: ['hardware:read', 'hardware:write'],
      token: TokenVerifier.mintTestToken({
        uid: 'usr_hardwareb_admin',
        email: 'admin@hardwareB.co.ke',
        isMaster: false,
        tenantId: 'tenant_hardware_b',
        branchId: 'branch_main',
        roles: ['TENANT_ADMIN'],
        permissions: ['hardware:read', 'hardware:write'],
      }),
    },
    {
      id: 'guest',
      name: 'Unauthenticated Guest',
      roleDescription: 'Anonymous request with no authorization header',
      isMaster: false,
      tenantId: null,
      branchId: null,
      roles: ['GUEST'],
      permissions: [],
      token: '',
    },
  ];

  const [selectedPersona, setSelectedPersona] = useState<PersonaOption>(personas[1]); // Default DBK-A Admin
  const [targetTenantId, setTargetTenantId] = useState<string>('tenant_school_a');
  const [targetBranchId, setTargetBranchId] = useState<string>('branch_hq');
  const [action, setAction] = useState<string>('read');
  const [resource, setResource] = useState<string>('school:students');
  const [requiredRole, setRequiredRole] = useState<string>('');
  const [requiredPermission, setRequiredPermission] = useState<string>('school:read');
  const [evaluationResult, setEvaluationResult] = useState<unknown | null>(null);
  const [isEvaluating, setIsEvaluating] = useState(false);

  const evaluateAuthorization = async () => {
    setIsEvaluating(true);
    try {
      const response = await fetch('/api/kernel/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(selectedPersona.token ? { Authorization: `Bearer ${selectedPersona.token}` } : {}),
        },
        body: JSON.stringify({
          action,
          resource,
          tenantId: targetTenantId,
          branchId: targetBranchId,
          requiredRole: requiredRole || undefined,
          requiredPermission: requiredPermission || undefined,
        }),
      });

      const data = await response.json();
      setEvaluationResult(data);
    } catch (err) {
      setEvaluationResult({ error: (err as Error).message });
    } finally {
      setIsEvaluating(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Persona Selection & Target Configuration */}
      <div className="lg:col-span-5 space-y-5">
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <User className="w-4 h-4 text-emerald-400" />
            <span>Select Principal Persona</span>
          </h2>

          <div className="space-y-2">
            {personas.map((persona) => {
              const isSelected = selectedPersona.id === persona.id;
              return (
                <button
                  key={persona.id}
                  onClick={() => {
                    setSelectedPersona(persona);
                    if (persona.tenantId) setTargetTenantId(persona.tenantId);
                    if (persona.branchId) setTargetBranchId(persona.branchId);
                  }}
                  className={`w-full text-left p-3 rounded border transition ${
                    isSelected
                      ? 'bg-emerald-950/40 border-emerald-500/60 text-white'
                      : 'bg-neutral-950 border-neutral-800/80 text-neutral-300 hover:bg-neutral-900'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold">{persona.name}</span>
                    {persona.isMaster && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono">
                        MASTER
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-neutral-400 mt-1">{persona.roleDescription}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Operation Parameters */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-400" />
            <span>Target Operation Parameters</span>
          </h2>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-neutral-400 mb-1 font-mono text-[11px]">Target Tenant ID</label>
              <input
                type="text"
                value={targetTenantId}
                onChange={(e) => setTargetTenantId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-mono text-[11px]">Target Branch ID</label>
              <input
                type="text"
                value={targetBranchId}
                onChange={(e) => setTargetBranchId(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-neutral-400 mb-1 font-mono text-[11px]">Action</label>
              <input
                type="text"
                value={action}
                onChange={(e) => setAction(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-mono text-[11px]">Resource</label>
              <input
                type="text"
                value={resource}
                onChange={(e) => setResource(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-neutral-400 mb-1 font-mono text-[11px]">Required Role (Optional)</label>
              <input
                type="text"
                placeholder="e.g. TENANT_ADMIN"
                value={requiredRole}
                onChange={(e) => setRequiredRole(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-neutral-400 mb-1 font-mono text-[11px]">Required Permission</label>
              <input
                type="text"
                placeholder="e.g. school:read"
                value={requiredPermission}
                onChange={(e) => setRequiredPermission(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-2.5 py-1.5 text-white font-mono focus:border-emerald-500 focus:outline-none"
              />
            </div>
          </div>

          <button
            onClick={evaluateAuthorization}
            disabled={isEvaluating}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-semibold py-2.5 rounded text-xs transition flex items-center justify-center space-x-2 mt-2 cursor-pointer"
          >
            <span>Evaluate Server Authorization</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Real-Time Evaluation Result */}
      <div className="lg:col-span-7 bg-neutral-900 border border-neutral-800 rounded-lg p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between border-b border-neutral-800 pb-3 mb-4">
            <div className="flex items-center space-x-2">
              <Eye className="w-4 h-4 text-emerald-400" />
              <h2 className="text-sm font-bold text-white">Server Decision Projection</h2>
            </div>
            <span className="text-[10px] bg-neutral-800 text-neutral-400 px-2 py-0.5 rounded font-mono">
              authorize(...) Primitive
            </span>
          </div>

          {evaluationResult ? (
            <div className="space-y-4">
              {/* Decision Badge */}
              <div
                className={`p-4 rounded border flex items-center justify-between ${
                  (evaluationResult as any)?.result?.allowed
                    ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-300'
                    : 'bg-red-950/60 border-red-500/60 text-red-300'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {(evaluationResult as any)?.result?.allowed ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  ) : (
                    <AlertOctagon className="w-6 h-6 text-red-400" />
                  )}
                  <div>
                    <h3 className="text-sm font-bold font-mono">
                      {(evaluationResult as any)?.result?.allowed ? 'ACCESS ALLOWED' : 'ACCESS DENIED'}
                    </h3>
                    <p className="text-xs opacity-90 mt-0.5">{(evaluationResult as any)?.result?.reason}</p>
                  </div>
                </div>
              </div>

              {/* Evaluated Rule Details */}
              <div className="bg-neutral-950 p-4 rounded border border-neutral-800 space-y-2 text-xs font-mono">
                <div className="flex justify-between border-b border-neutral-900 pb-1">
                  <span className="text-neutral-500">Evaluated Rule:</span>
                  <span className="text-white">{(evaluationResult as any)?.result?.ruleEvaluated}</span>
                </div>
                <div className="flex justify-between border-b border-neutral-900 pb-1">
                  <span className="text-neutral-500">Evaluated At:</span>
                  <span className="text-neutral-300">{(evaluationResult as any)?.result?.evaluatedAt}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">Principal Tenant / Target Tenant:</span>
                  <span className="text-emerald-400">
                    {selectedPersona.tenantId || 'NONE'} / {targetTenantId}
                  </span>
                </div>
              </div>

              {/* Full JSON Response */}
              <div>
                <span className="text-xs font-mono text-neutral-400 block mb-1">Server Response JSON:</span>
                <pre className="bg-neutral-950 border border-neutral-800 p-3 rounded text-[11px] font-mono text-emerald-300 overflow-x-auto max-h-60">
                  {JSON.stringify(evaluationResult, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-neutral-500 text-xs font-mono">
              Select a persona and click &quot;Evaluate Server Authorization&quot; to test security barriers.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
