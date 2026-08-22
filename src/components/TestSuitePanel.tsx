import React, { useState, useEffect } from 'react';
import { Play, CheckCircle, XCircle, ShieldCheck, RefreshCw, AlertTriangle, Clock, Key } from 'lucide-react';
import { Phase0TestSuiteSummary, TestCaseResult } from '../kernel/tests/phase0TestRunner';

export const TestSuitePanel: React.FC = () => {
  const [testSummary, setTestSummary] = useState<Phase0TestSuiteSummary | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState<string>('ALL');

  const executeTestSuite = async () => {
    setIsRunning(true);
    try {
      const response = await fetch('/api/test/phase0', { method: 'POST' });
      if (response.ok) {
        const data = await response.json();
        setTestSummary(data.summary);
      } else {
        // Client fallback if needed
        const { phase0TestRunner } = await import('../kernel/tests/phase0TestRunner');
        const summary = await phase0TestRunner.runAllTests();
        setTestSummary(summary);
      }
    } catch {
      const { phase0TestRunner } = await import('../kernel/tests/phase0TestRunner');
      const summary = await phase0TestRunner.runAllTests();
      setTestSummary(summary);
    } finally {
      setIsRunning(false);
    }
  };

  useEffect(() => {
    executeTestSuite();
  }, []);

  const filterResults = (results: TestCaseResult[]) => {
    if (selectedFilter === 'PASSED') return results.filter((r) => r.status === 'PASSED');
    if (selectedFilter === 'FAILED') return results.filter((r) => r.status === 'FAILED');
    return results;
  };

  return (
    <div className="space-y-6">
      {/* Test Suite Control Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Mandatory Phase 0 Security & Tenant Isolation Suite</h2>
            </div>
            <p className="text-xs text-neutral-400 mt-1">
              Executes all 12 mandatory negative security tests, cross-tenant isolation barriers, forged token detections, and traceable audit log verifications.
            </p>
          </div>

          <button
            onClick={executeTestSuite}
            disabled={isRunning}
            className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-4 py-2.5 rounded transition disabled:opacity-50 self-start md:self-auto cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRunning ? 'animate-spin' : ''}`} />
            <span>{isRunning ? 'Executing Test Suite...' : 'Re-Run All 12 Security Tests'}</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        {testSummary && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-5 pt-4 border-t border-neutral-800">
            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Overall Status</span>
              <div className="flex items-center space-x-2 mt-1">
                {testSummary.overallStatus === 'PASS' ? (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                    PASS (100% OPERATIONAL)
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/40">
                    FAIL
                  </span>
                )}
              </div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Total Tests</span>
              <div className="text-lg font-bold text-white mt-1">{testSummary.totalTests} / 12</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Passed</span>
              <div className="text-lg font-bold text-emerald-400 mt-1">{testSummary.passedCount}</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Failed</span>
              <div className="text-lg font-bold text-neutral-400 mt-1">{testSummary.failedCount}</div>
            </div>

            <div className="bg-neutral-950 p-3 rounded border border-neutral-800 col-span-2 md:col-span-1">
              <span className="text-[10px] text-neutral-500 uppercase tracking-wider font-mono">Executed At</span>
              <div className="text-xs text-neutral-300 font-mono mt-1 truncate">
                {new Date(testSummary.executedAt).toLocaleTimeString()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
        <div className="flex space-x-2">
          {['ALL', 'PASSED', 'FAILED'].map((filter) => (
            <button
              key={filter}
              onClick={() => setSelectedFilter(filter)}
              className={`px-3 py-1 text-xs rounded font-medium transition ${
                selectedFilter === filter
                  ? 'bg-neutral-800 text-white font-semibold'
                  : 'text-neutral-400 hover:text-white'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
        <span className="text-xs text-neutral-500 font-mono">12 Mandatory Phase 0 Verification Cases</span>
      </div>

      {/* Test List */}
      {testSummary && (
        <div className="space-y-3">
          {filterResults(testSummary.results).map((test) => (
            <div
              key={test.testId}
              className={`p-4 rounded-lg border transition ${
                test.status === 'PASSED'
                  ? 'bg-neutral-900/90 border-emerald-900/40 hover:border-emerald-700/60'
                  : 'bg-neutral-900/90 border-red-900/40 hover:border-red-700/60'
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-2">
                <div className="flex items-start space-x-3">
                  {test.status === 'PASSED' ? (
                    <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  )}
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono font-bold text-white bg-neutral-800 px-2 py-0.5 rounded">
                        {test.testId}
                      </span>
                      <h3 className="text-xs font-semibold text-neutral-200">{test.name}</h3>
                      <span className="text-[10px] font-mono bg-neutral-950 text-neutral-400 px-2 py-0.5 rounded border border-neutral-800">
                        {test.category}
                      </span>
                    </div>

                    <div className="mt-2 space-y-1 text-xs font-mono">
                      <div className="text-neutral-400">
                        <span className="text-neutral-500">Expected:</span> {test.expectedResult}
                      </div>
                      <div className="text-emerald-300">
                        <span className="text-neutral-500">Actual:</span> {test.actualResult}
                      </div>
                    </div>

                    {test.traceableAuditEventId && (
                      <div className="mt-2 text-[11px] font-mono text-emerald-400 bg-emerald-950/40 border border-emerald-900/60 px-2 py-1 rounded inline-flex items-center gap-1.5">
                        <Key className="w-3 h-3 text-emerald-400" />
                        <span>Traceable Audit Event ID: {test.traceableAuditEventId}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center space-x-3 self-end md:self-center">
                  <div className="flex items-center space-x-1 text-xs text-neutral-500 font-mono">
                    <Clock className="w-3 h-3" />
                    <span>{test.durationMs}ms</span>
                  </div>
                  <span
                    className={`px-2.5 py-1 text-xs font-bold rounded font-mono ${
                      test.status === 'PASSED'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-red-500/20 text-red-300 border border-red-500/30'
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
