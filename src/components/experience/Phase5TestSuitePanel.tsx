import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, ShieldCheck, RefreshCw, AlertTriangle, Clock, Layers, Sparkles } from 'lucide-react';
interface TestCaseResult {
  id: string;
  name: string;
  status: 'PASS' | 'FAIL';
  durationMs: number;
  error?: string;
  details?: Record<string, unknown>;
}

interface Phase5TestSummary {
  totalTests: number;
  passed: number;
  failed: number;
  durationMs: number;
  results: TestCaseResult[];
}

export const Phase5TestSuitePanel: React.FC = () => {
  const [testSummary, setTestSummary] = useState<Phase5TestSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const executeTestSuite = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/test/phase5', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setTestSummary(data.summary);
      } else {
        throw new Error(`Phase 5 test API returned HTTP ${response.status}`);
      }
    } catch (error) {
      console.error('Phase 5 test suite failed:', error);
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
              <Sparkles className="w-5 h-5 text-indigo-400" />
              <h2 className="text-base font-bold text-white">Phase 5 Experience Layer & Dynamic Views Suite</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Executes all 41 Phase 5 verification tests + 5 comprehensive cross-phase regression suites (Phases 0, 1, 2, 3, 4).
            </p>
          </div>

          <button
            onClick={executeTestSuite}
            disabled={isRunning}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded transition disabled:opacity-50 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Executing Test Suite...' : 'Re-Run All 46 Tests'}</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        {testSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5 pt-4 border-t border-neutral-800">
            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Overall Status</span>
              <div className="flex items-center space-x-2 mt-1">
                {testSummary.failed === 0 ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    PASS (100% OPERATIONAL)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                    FAIL ({testSummary.failed} FAILED)
                  </span>
                )}
              </div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Total Tests</span>
              <div className="text-lg font-bold text-white mt-1">{testSummary.totalTests} / 46</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Passed</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">{testSummary.passed}</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Failed</span>
              <div className="text-lg font-bold text-neutral-400 mt-1">{testSummary.failed}</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800 col-span-2 md:col-span-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Execution Time</span>
              <div className="text-lg font-bold text-indigo-400 mt-1 font-mono">{testSummary.durationMs}ms</div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      {testSummary && (
        <div className="flex items-center justify-between">
          <div className="flex space-x-2">
            {['ALL', 'PASSED', 'FAILED'].map((tab) => (
              <button
                key={tab}
                onClick={() => setSelectedFilter(tab)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition cursor-pointer ${
                  selectedFilter === tab
                    ? 'bg-neutral-800 text-white'
                    : 'bg-neutral-900/50 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
                }`}
              >
                {tab} ({tab === 'ALL' ? testSummary.totalTests : tab === 'PASSED' ? testSummary.passed : testSummary.failed})
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Test Case Breakdown */}
      {testSummary && (
        <div className="space-y-2">
          {filterResults(testSummary.results).map((test) => (
            <div
              key={test.id}
              className={`p-3.5 rounded-lg border transition ${
                test.status === 'PASS'
                  ? 'bg-neutral-900/60 border-neutral-800/80 hover:border-neutral-700'
                  : 'bg-red-950/20 border-red-900/50 hover:border-red-800'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3">
                  {test.status === 'PASS' ? (
                    <CheckCircle className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-neutral-400">{test.id}</span>
                      <span className="text-xs font-semibold text-white">{test.name}</span>
                    </div>
                    {test.error && (
                      <div className="mt-1.5 p-2 rounded bg-red-950/40 border border-red-900/40 text-[11px] font-mono text-red-300">
                        {test.error}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-2 shrink-0 ml-4">
                  <span className="text-[10px] font-mono text-neutral-500">{test.durationMs}ms</span>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-mono font-bold rounded ${
                      test.status === 'PASS'
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-400 border border-red-500/30'
                    }`}
                  >
                    {test.status}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
