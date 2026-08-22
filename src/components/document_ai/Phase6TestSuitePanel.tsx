import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, ShieldCheck, RefreshCw, AlertTriangle, Clock, Layers, Sparkles, FileText, Bot, ShieldAlert } from 'lucide-react';
interface TestCaseResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface Phase6TestSummary {
  phase: string;
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}

export const Phase6TestSuitePanel: React.FC = () => {
  const [testSummary, setTestSummary] = useState<Phase6TestSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const executeTestSuite = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/test/phase6', { method: 'POST' });
      if (!response.ok) {
        throw new Error(`Phase 6 test API returned HTTP ${response.status}`);
      }

      const data = await response.json();
      setTestSummary(data.summary);
    } catch (err) {
      setTestSummary({
        phase: 'Phase 6',
        totalTests: 0,
        passed: 0,
        failed: 1,
        durationMs: 0,
        results: [{
          id: 'P6_API_ERROR',
          name: 'Phase 6 server test endpoint',
          status: 'FAIL',
          durationMs: 0,
          error: err instanceof Error ? err.message : String(err),
        }],
      });
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeTestSuite();
  }, []);

  const filterResults = (results: TestCaseResult[]) => {
    if (selectedFilter === 'PASSED') return results.filter((r) => r.status === 'PASS');
    if (selectedFilter === 'FAILED') return results.filter((r) => r.status === 'FAIL');
    return results;
  };

  return (
    <div className="space-y-6">
      {/* Test Suite Control Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Phase 6 Document Ingestion & AI Boundaries Suite</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Executes all 54 Phase 6 tests (P6_TEST_01 through P6_TEST_54) + 6 regression suites (Phases 0–5). Total 60 test vectors.
            </p>
          </div>

          <button
            onClick={executeTestSuite}
            disabled={isRunning}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded transition disabled:opacity-50 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Executing Test Suite...' : 'Re-Run All 60 Tests'}</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        {testSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5 pt-4 border-t border-neutral-800">
            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Overall Status</span>
              <div className="flex items-center space-x-1.5 mt-1">
                {testSummary.failed === 0 ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-emerald-400" />
                    <span className="text-xs font-bold text-emerald-400 font-mono">PASSING (100%)</span>
                  </>
                ) : (
                  <>
                    <XCircle className="w-4 h-4 text-red-400" />
                    <span className="text-xs font-bold text-red-400 font-mono">{testSummary.failed} FAILING</span>
                  </>
                )}
              </div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Total Tests</span>
              <div className="text-base font-bold text-white font-mono mt-1">{testSummary.totalTests}</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Passed</span>
              <div className="text-base font-bold text-emerald-400 font-mono mt-1">{testSummary.passed}</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Failed</span>
              <div className="text-base font-bold text-red-400 font-mono mt-1">{testSummary.failed}</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Suite Duration</span>
              <div className="flex items-center space-x-1 text-neutral-300 font-mono text-xs mt-1.5">
                <Clock className="w-3.5 h-3.5 text-neutral-500" />
                <span>{testSummary.durationMs} ms</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center space-x-2 border-b border-neutral-800 pb-2">
        {['ALL', 'PASSED', 'FAILED'].map((f) => (
          <button
            key={f}
            onClick={() => setSelectedFilter(f)}
            className={`text-xs px-3 py-1.5 rounded font-medium transition cursor-pointer ${
              selectedFilter === f
                ? 'bg-neutral-800 text-white font-semibold'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            {f} ({f === 'ALL' ? testSummary?.totalTests || 0 : f === 'PASSED' ? testSummary?.passed || 0 : testSummary?.failed || 0})
          </button>
        ))}
      </div>

      {/* Results List */}
      {testSummary && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg divide-y divide-neutral-800">
          {filterResults(testSummary.results).map((test) => (
            <div key={test.id} className="p-3.5 flex items-start justify-between gap-3 hover:bg-neutral-800/40 transition">
              <div className="space-y-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-[11px] font-bold text-emerald-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800 shrink-0">
                    {test.id}
                  </span>
                  <h4 className="text-xs font-semibold text-white truncate">{test.name}</h4>
                </div>
                {test.error && (
                  <div className="text-[11px] text-red-400 bg-red-950/40 border border-red-900/60 p-2 rounded mt-1 font-mono">
                    {test.error}
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 shrink-0">
                <span className="text-[10px] text-neutral-500 font-mono">{test.durationMs}ms</span>
                {test.status === 'PASS' ? (
                  <span className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
                    <CheckCircle className="w-3 h-3" />
                    <span>PASS</span>
                  </span>
                ) : (
                  <span className="flex items-center space-x-1 text-[11px] font-semibold text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-900/60">
                    <XCircle className="w-3 h-3" />
                    <span>FAIL</span>
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
