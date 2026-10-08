import React, { useState } from 'react';
type MultiBusinessTestSummary = {
  total: number;
  passed: number;
  failed: number;
  timestamp: string;
  results: Array<{
    id: string;
    name: string;
    passed: boolean;
    invariant?: string;
    details?: string;
    error?: string;
    durationMs?: number;
  }>;
  durationMs?: number;
};

type DbkProvisioningTestSummary = {
  total: number;
  passed: number;
  failed: number;
  timestamp: string;
  results: Array<{
    id: string;
    name: string;
    passed: boolean;
    invariant?: string;
    details?: string;
    error?: string;
    durationMs?: number;
  }>;
  durationMs?: number;
};
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Play,
  ArrowLeft,
  Loader2,
  Building2,
  Cpu,
} from 'lucide-react';

interface MultiBusinessSuitePanelProps {
  onBackToPortfolio: () => void;
}

export const MultiBusinessSuitePanel: React.FC<MultiBusinessSuitePanelProps> = ({
  onBackToPortfolio,
}) => {
  const [activeTab, setActiveTab] = useState<'multibusiness' | 'provisioning'>('provisioning');
  const [mbSummary, setMbSummary] = useState<MultiBusinessTestSummary | null>(null);
  const [provSummary, setProvSummary] = useState<DbkProvisioningTestSummary | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);

  const handleRunTests = async () => {
    setIsRunning(true);

    try {
      if (activeTab === 'provisioning') {
        const response = await fetch('/api/test/dbk-provisioning', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(
            `DBK provisioning test request failed: ${response.status}`
          );
        }

        const data = await response.json();
        setProvSummary(data.summary ?? data);
      } else {
        const response = await fetch('/api/test/multi-business', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(
            `Multi-business test request failed: ${response.status}`
          );
        }

        const data = await response.json();
        setMbSummary(data.summary ?? data);
      }
    } catch (err) {
      console.error('Failed to run test suite:', err);
    } finally {
      setIsRunning(false);
    }
  };

  const currentSummary = activeTab === 'multibusiness' ? mbSummary : provSummary;

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-neutral-200">
          <div className="flex items-center space-x-3">
            <button
              onClick={onBackToPortfolio}
              className="p-2 text-neutral-600 hover:text-black hover:bg-neutral-100 rounded-xl transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-neutral-900 flex items-center gap-2">
                <Cpu className="w-5 h-5 text-indigo-600" />
                TDBK V2 Verification & Invariant Suite
              </h1>
              <p className="text-xs text-neutral-500">
                {activeTab === 'provisioning'
                  ? 'Verifying DBK_PROVISION_01 through DBK_PROVISION_25 provisioning lifecycle invariants'
                  : 'Verifying MULTI_BUSINESS_01 through MULTI_BUSINESS_15 multi-owner portfolio invariants'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="bg-neutral-200 p-1 rounded-xl flex items-center gap-1 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('provisioning')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'provisioning' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600 hover:text-black'
                }`}
              >
                DBK Provisioning (25)
              </button>
              <button
                onClick={() => setActiveTab('multibusiness')}
                className={`px-3 py-1.5 rounded-lg transition-colors ${
                  activeTab === 'multibusiness' ? 'bg-white text-neutral-900 shadow-2xs' : 'text-neutral-600 hover:text-black'
                }`}
              >
                Multi-Business Portfolio (15)
              </button>
            </div>

            <button
              onClick={handleRunTests}
              disabled={isRunning}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            >
              {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
              <span>Run {activeTab === 'provisioning' ? '25 Provisioning Tests' : '15 Portfolio Tests'}</span>
            </button>
          </div>
        </div>

        {/* Summary Card */}
        {currentSummary && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs mb-8 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white font-bold text-lg ${
                  currentSummary.failed === 0 ? 'bg-emerald-600' : 'bg-rose-600'
                }`}
              >
                {currentSummary.passed}/{currentSummary.total}
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {currentSummary.failed === 0
                    ? 'All Invariants Verified Successfully'
                    : 'Invariant Failures Detected'}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">Executed at {new Date(currentSummary.timestamp).toLocaleTimeString()}</p>
              </div>
            </div>

            <div className="flex items-center space-x-6 text-xs font-semibold">
              <div className="flex items-center gap-1.5 text-emerald-700">
                <CheckCircle2 className="w-4 h-4" />
                <span>{currentSummary.passed} Passed</span>
              </div>
              {currentSummary.failed > 0 && (
                <div className="flex items-center gap-1.5 text-rose-700">
                  <XCircle className="w-4 h-4" />
                  <span>{currentSummary.failed} Failed</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Test Results List */}
        {!currentSummary && !isRunning && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-12 text-center shadow-xs">
            <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-3" />
            <h3 className="text-base font-bold text-neutral-900">
              Ready to Validate {activeTab === 'provisioning' ? 'DBK Provisioning Lifecycle' : 'Multi-Business Portfolio'}
            </h3>
            <p className="text-xs text-neutral-500 mt-1 mb-6 max-w-md mx-auto">
              Click the button above to execute the complete verification suite for authoritative DBK provisioning, workspace creation, DNA binding, and tenant isolation.
            </p>
            <button
              onClick={handleRunTests}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-sm transition-colors inline-flex items-center gap-2"
            >
              <Play className="w-4 h-4 fill-current" />
              Run Invariant Test Suite
            </button>
          </div>
        )}

        {isRunning && (
          <div className="bg-white rounded-2xl border border-neutral-200 p-16 text-center shadow-xs">
            <Loader2 className="w-8 h-8 animate-spin text-neutral-900 mx-auto mb-3" />
            <p className="text-sm font-medium text-neutral-700">
              Executing Authoritative {activeTab === 'provisioning' ? 'DBK Provisioning (25 invariants)' : 'Multi-Business Portfolio'} Verification...
            </p>
          </div>
        )}

        {currentSummary && (
          <div className="space-y-3">
            {currentSummary.results.map((test) => (
              <div
                key={test.id}
                className={`bg-white rounded-xl border p-4 shadow-2xs flex items-start justify-between gap-4 transition-all ${
                  test.passed ? 'border-emerald-200 bg-emerald-50/20' : 'border-rose-200 bg-rose-50/20'
                }`}
              >
                <div className="flex items-start space-x-3">
                  {test.passed ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded border border-neutral-200">
                        {test.id}
                      </span>
                      <h4 className="text-sm font-bold text-neutral-900">{test.name}</h4>
                    </div>
                    <p className="text-xs text-neutral-600 mt-1 font-medium">{test.invariant}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 font-mono bg-white/80 p-2 rounded border border-neutral-200/60">
                      {test.details}
                    </p>
                  </div>
                </div>

                <span
                  className={`text-[11px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wide shrink-0 ${
                    test.passed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-rose-100 text-rose-800 border border-rose-200'
                  }`}
                >
                  {test.passed ? 'Verified' : 'Failed'}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
