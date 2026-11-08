import React, { useState, useEffect } from 'react';
import { DbkExperienceResolved, ExperienceEntityRecord, ExperienceEntityField } from '../../experience/types';
import { capabilityViewRegistry } from '../../experience/registry/viewRegistry';
import { useAuth } from '../../client/AuthContext';
import { Plus, Search, Filter, RefreshCw, CheckCircle2, FileText, Download } from 'lucide-react';

interface EntityListViewProps {
  experience: DbkExperienceResolved;
  capabilityId: string;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => Promise<any>;
}

export const EntityListView: React.FC<EntityListViewProps> = ({
  experience,
  capabilityId,
  onDispatchCommand,
}) => {
  const [records, setRecords] = useState<ExperienceEntityRecord[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ExperienceEntityRecord | null>(null);
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(false);
  const { getIdToken } = useAuth();
  const [loadError, setLoadError] = useState<string | null>(null);

  const viewDef = capabilityViewRegistry.getViewDefinition(capabilityId);
  const termKey = viewDef?.terminologyKey;
  const terminology = experience.terminology as Record<string, { singular: string; plural: string }>;

  const singularName = (termKey && terminology?.[termKey]?.singular) || viewDef?.defaultNavLabel || 'Record';
  const pluralName = (termKey && terminology?.[termKey]?.plural) || viewDef?.defaultNavLabel || 'Records';
  const fields: ExperienceEntityField[] = (viewDef?.entitySchema || []).map((f: any) => ({
    key: f.key || f.name || '',
    label: f.label,
    type: f.type || 'string',
    required: f.required,
    options: f.options,
  }));

  const loadRecords = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const idToken = await getIdToken();
      if (!idToken) throw new Error('Your session has expired. Please sign in again.');
      const res = await fetch(`/api/experience/entities/${experience.dbkId}/${capabilityId}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRecords(data.records || []);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error?.message || 'Unable to load records');
      }
    } catch (err: any) {
      setRecords([]);
      setLoadError(err?.message || 'Unable to load records');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRecords();
  }, [experience.dbkId, capabilityId]);

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const primaryId = formData[fields[0]?.key] || `ID-${Date.now().toString().slice(-4)}`;
    const secondaryId = formData[fields[1]?.key] || '';

    const newRecord: ExperienceEntityRecord = {
      id: `rec_${Date.now()}`,
      entityType: capabilityId,
      primaryIdentifier: primaryId,
      secondaryIdentifier: secondaryId,
      status: formData.status || 'ACTIVE',
      attributes: { ...formData },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await onDispatchCommand('SUBMIT_ENTITY', {
      capabilityId,
      record: newRecord,
    });

    setIsCreateModalOpen(false);
    setFormData({});
    await loadRecords();
  };

  const filteredRecords = records.filter((r) => {
    const term = searchTerm.toLowerCase();
    return (
      r.primaryIdentifier.toLowerCase().includes(term) ||
      (r.secondaryIdentifier && r.secondaryIdentifier.toLowerCase().includes(term)) ||
      JSON.stringify(r.attributes).toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      {/* Entity Header */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
                {capabilityId}
              </span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                {filteredRecords.length} {pluralName}
              </span>
            </div>
            <h1 className="text-xl font-bold text-white mt-2">{pluralName} Directory</h1>
            <p className="text-xs text-neutral-400 mt-1">
              Sector-specific entity records projected with live schema validation and terminology mapping.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsCreateModalOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add New {singularName}</span>
            </button>

            <button
              onClick={loadRecords}
              className="p-2 text-xs font-semibold rounded bg-neutral-800 hover:bg-neutral-700 text-neutral-300 border border-neutral-700 transition cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-neutral-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder={`Search ${pluralName.toLowerCase()} by ID, name, or metadata...`}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-indigo-500"
          />
        </div>
      </div>

      {loadError && (
        <div className="bg-red-950/30 border border-red-900 rounded-lg p-3 text-xs text-red-300" role="alert">
          {loadError}
        </div>
      )}

      {/* Entity Table */}
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-950 text-neutral-400 uppercase font-mono text-[10px] tracking-wider border-b border-neutral-800">
              <tr>
                <th className="px-4 py-3">Identifier / Name</th>
                {fields.slice(1, 5).map((f) => (
                  <th key={f.key} className="px-4 py-3">
                    {f.label}
                  </th>
                ))}
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800/60 text-neutral-300">
              {filteredRecords.length === 0 ? (
                <tr>
                  <td colSpan={fields.length + 2} className="px-4 py-8 text-center text-neutral-500">
                    No {pluralName.toLowerCase()} found matching your criteria.
                  </td>
                </tr>
              ) : (
                filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-neutral-800/30 transition">
                    <td className="px-4 py-3 font-semibold text-white">
                      <div>{r.primaryIdentifier}</div>
                      {r.secondaryIdentifier && (
                        <div className="text-[11px] text-neutral-400 font-normal">{r.secondaryIdentifier}</div>
                      )}
                    </td>

                    {fields.slice(1, 5).map((f) => (
                      <td key={f.key} className="px-4 py-3">
                        {f.type === 'currency' ? (
                          <span className="font-mono font-semibold text-emerald-400">
                            KES {Number(r.attributes[f.key] || 0).toLocaleString()}
                          </span>
                        ) : (
                          String(r.attributes[f.key] ?? '—')
                        )}
                      </td>
                    ))}

                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        {r.status || 'ACTIVE'}
                      </span>
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedRecord(r)}
                        className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                        aria-label={`View details for ${r.primaryIdentifier}`}
                      >
                        View Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Record Details */}
      {selectedRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setSelectedRecord(null)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="entity-record-details-title"
            className="max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-lg border border-neutral-800 bg-neutral-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-neutral-800 pb-4">
              <div className="min-w-0">
                <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-indigo-400">{capabilityId}</p>
                <h2 id="entity-record-details-title" className="mt-1 truncate text-base font-bold text-white">{selectedRecord.primaryIdentifier}</h2>
                {selectedRecord.secondaryIdentifier && <p className="mt-1 text-xs text-neutral-400">{selectedRecord.secondaryIdentifier}</p>}
              </div>
              <button type="button" onClick={() => setSelectedRecord(null)} className="rounded-lg px-3 py-2 text-xs font-semibold text-neutral-300 hover:bg-neutral-800">Close</button>
            </div>
            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
                <dt className="text-[10px] font-mono uppercase text-neutral-500">Record status</dt>
                <dd className="mt-1 text-xs font-semibold text-white">{selectedRecord.status || 'ACTIVE'}</dd>
              </div>
              {Object.entries(selectedRecord.attributes || {}).map(([key, value]) => (
                <div key={key} className="min-w-0 rounded border border-neutral-800 bg-neutral-950 p-3">
                  <dt className="text-[10px] font-mono uppercase text-neutral-500">{fields.find((field) => field.key === key)?.label || key}</dt>
                  <dd className="mt-1 break-words text-xs text-neutral-200">{value === null || value === undefined || value === '' ? '—' : String(value)}</dd>
                </div>
              ))}
              <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
                <dt className="text-[10px] font-mono uppercase text-neutral-500">Created</dt>
                <dd className="mt-1 text-xs text-neutral-200">{selectedRecord.createdAt ? new Date(selectedRecord.createdAt).toLocaleString() : '—'}</dd>
              </div>
              <div className="rounded border border-neutral-800 bg-neutral-950 p-3">
                <dt className="text-[10px] font-mono uppercase text-neutral-500">Last updated</dt>
                <dd className="mt-1 text-xs text-neutral-200">{selectedRecord.updatedAt ? new Date(selectedRecord.updatedAt).toLocaleString() : '—'}</dd>
              </div>
            </dl>
          </section>
        </div>
      )}

      {/* Modal: Create Entity */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-3">
              <h2 className="text-base font-bold text-white">Add New {singularName}</h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="text-neutral-400 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              {fields.map((f) => (
                <div key={f.key}>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                    {f.label} {f.required && <span className="text-red-400">*</span>}
                  </label>
                  <input
                    type={f.type === 'number' || f.type === 'currency' ? 'number' : 'text'}
                    required={f.required}
                    value={formData[f.key] || ''}
                    onChange={(e) => setFormData({ ...formData, [f.key]: e.target.value })}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    placeholder={`Enter ${f.label}...`}
                  />
                </div>
              ))}

              <div className="flex items-center justify-end space-x-2 pt-4 border-t border-neutral-800">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-3 py-2 text-xs font-semibold rounded bg-neutral-800 text-neutral-300 hover:bg-neutral-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                >
                  Save {singularName}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
