import React, { useState, useEffect } from 'react';
import { Server, Filter, RefreshCw, Key, ShieldAlert, CheckCircle, XCircle } from 'lucide-react';
import { AuditEvent } from '../kernel/types';

export const AuditStreamPanel: React.FC = () => {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [tenantFilter, setTenantFilter] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  const fetchAuditLogs = async () => {
    setIsLoading(true);
    try {
      const query = tenantFilter ? `?tenantId=${tenantFilter}` : '';
      const response = await fetch(`/api/audit/logs${query}`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data.events || []);
      } else {
        const { auditLogger } = await import('../kernel/audit/auditLogger');
        setEvents(auditLogger.getEvents({ tenantId: tenantFilter || undefined }));
      }
    } catch {
      const { auditLogger } = await import('../kernel/audit/auditLogger');
      setEvents(auditLogger.getEvents({ tenantId: tenantFilter || undefined }));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAuditLogs();
    const interval = setInterval(fetchAuditLogs, 3000); // Poll every 3s
    return () => clearInterval(interval);
  }, [tenantFilter]);

  return (
    <div className="space-y-5">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-emerald-400" />
              <span>Real-Time Kernel Security Audit Event Stream</span>
            </h2>
            <p className="text-xs text-neutral-400 mt-1">
              Immutable stream recording every authorization check, cross-tenant isolation block, and master platform action.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center space-x-2 bg-neutral-950 px-2.5 py-1.5 rounded border border-neutral-800 text-xs">
              <Filter className="w-3.5 h-3.5 text-neutral-400" />
              <input
                type="text"
                placeholder="Filter tenantId..."
                value={tenantFilter}
                onChange={(e) => setTenantFilter(e.target.value)}
                className="bg-transparent text-white font-mono text-xs focus:outline-none w-32"
              />
            </div>

            <button
              onClick={fetchAuditLogs}
              className="p-1.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs font-mono">
            <thead>
              <tr className="bg-neutral-950 text-neutral-400 border-b border-neutral-800 text-[11px] uppercase tracking-wider">
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">Event Type</th>
                <th className="py-2.5 px-3">Principal ID</th>
                <th className="py-2.5 px-3">Action / Resource</th>
                <th className="py-2.5 px-3">Tenant ID</th>
                <th className="py-2.5 px-3">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60">
              {events.length > 0 ? (
                events.map((event) => (
                  <tr key={event.id} className="hover:bg-neutral-800/40 transition">
                    <td className="py-2 px-3 text-neutral-400 whitespace-nowrap">
                      {new Date(event.timestamp).toLocaleTimeString()}
                    </td>
                    <td className="py-2 px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold ${
                          event.eventType === 'TENANT_ISOLATION_VIOLATION'
                            ? 'bg-red-500/20 text-red-300 border border-red-500/40'
                            : event.eventType === 'MASTER_ACTION'
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                            : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        }`}
                      >
                        {event.eventType}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-neutral-300 truncate max-w-[120px]">{event.principalId}</td>
                    <td className="py-2 px-3 text-neutral-200">
                      <span className="text-emerald-400">{event.action}</span> on{' '}
                      <span className="text-neutral-400">{event.resource}</span>
                    </td>
                    <td className="py-2 px-3 text-neutral-400 font-semibold">{event.tenantId || 'NONE'}</td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded font-bold ${
                          event.result === 'ALLOWED'
                            ? 'text-emerald-400 bg-emerald-950/60'
                            : 'text-red-400 bg-red-950/60'
                        }`}
                      >
                        {event.result === 'ALLOWED' ? (
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                        ) : (
                          <XCircle className="w-3 h-3 text-red-400" />
                        )}
                        <span>{event.result}</span>
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-neutral-500">
                    No security audit events recorded yet. Run the security test suite or evaluate actions.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
