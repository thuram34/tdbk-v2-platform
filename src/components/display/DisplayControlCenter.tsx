import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Cast,
  CheckCircle2,
  ChevronRight,
  Monitor,
  Radio,
  RefreshCw,
  ScreenShare,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  buildSyncPlan,
  capabilitiesForNodeType,
  createDisplayCommand,
} from '../../platform/display/displayEngine';
import type { DisplayContent, DisplayEngineSnapshot, DisplayNode } from '../../platform/display/types';

interface DisplayControlCenterProps {
  tenantId: string;
}

const timestamp = new Date().toISOString();

const seedNodes = (tenantId: string): DisplayNode[] => [
  {
    displayId: 'reception-tv',
    tenantId,
    siteId: 'main',
    roomId: 'reception',
    name: 'Reception Display',
    nodeType: 'RASPBERRY_PI',
    capabilities: capabilitiesForNodeType('RASPBERRY_PI'),
    status: 'ONLINE',
    lastSeenAt: timestamp,
    appVersion: '1.0.0',
    networkQuality: 'GOOD',
    currentContentId: 'welcome',
    currentScheduleId: 'morning',
    offlineCacheVersion: 12,
  },
  {
    displayId: 'hallway-a',
    tenantId,
    siteId: 'main',
    roomId: 'hallway-a',
    name: 'Hallway A',
    nodeType: 'RASPBERRY_PI',
    capabilities: capabilitiesForNodeType('RASPBERRY_PI'),
    status: 'OFFLINE',
    lastSeenAt: new Date(Date.now() - 18 * 60_000).toISOString(),
    appVersion: '1.0.0',
    networkQuality: 'UNKNOWN',
    currentContentId: 'welcome',
    currentScheduleId: 'break',
    offlineCacheVersion: 11,
  },
  {
    displayId: 'class-6a',
    tenantId,
    siteId: 'main',
    buildingId: 'academic',
    roomId: '6A',
    name: 'Classroom 6A',
    nodeType: 'IDEAHUB',
    capabilities: capabilitiesForNodeType('IDEAHUB'),
    status: 'ONLINE',
    lastSeenAt: timestamp,
    appVersion: '1.0.0',
    networkQuality: 'GOOD',
    currentContentId: 'fractions',
    currentScheduleId: 'math-lesson',
    offlineCacheVersion: 27,
  },
  {
    displayId: 'class-6b',
    tenantId,
    siteId: 'main',
    buildingId: 'academic',
    roomId: '6B',
    name: 'Classroom 6B',
    nodeType: 'INTERACTIVE_PANEL',
    capabilities: capabilitiesForNodeType('INTERACTIVE_PANEL'),
    status: 'ONLINE',
    lastSeenAt: timestamp,
    appVersion: '1.0.0',
    networkQuality: 'FAIR',
    currentContentId: null,
    currentScheduleId: null,
    offlineCacheVersion: 8,
  },
  {
    displayId: 'auditorium-led',
    tenantId,
    siteId: 'main',
    roomId: 'auditorium',
    name: 'Auditorium LED',
    nodeType: 'LED_CONTROLLER',
    capabilities: capabilitiesForNodeType('LED_CONTROLLER'),
    status: 'ONLINE',
    lastSeenAt: timestamp,
    appVersion: '1.0.0',
    networkQuality: 'GOOD',
    currentContentId: 'welcome',
    currentScheduleId: 'assembly',
    offlineCacheVersion: 4,
  },
];

const content: DisplayContent[] = [
  {
    contentId: 'welcome',
    tenantId: 'demo',
    title: 'School Welcome',
    kind: 'ANNOUNCEMENT',
    body: 'Welcome to the school day.',
    published: true,
    version: 3,
    updatedAt: timestamp,
  },
  {
    contentId: 'fractions',
    tenantId: 'demo',
    title: 'Grade 6 — Fractions',
    kind: 'LESSON',
    body: 'Interactive lesson workspace',
    requiredCapabilities: ['LESSON_CONTENT', 'INTERACTIVE'],
    published: true,
    version: 7,
    updatedAt: timestamp,
  },
];

export const DisplayControlCenter: React.FC<DisplayControlCenterProps> = ({ tenantId }) => {
  const [nodes, setNodes] = useState(() => seedNodes(tenantId));
  const [selectedId, setSelectedId] = useState(nodes[0]?.displayId ?? '');
  const [message, setMessage] = useState('Control plane ready');

  const snapshot: DisplayEngineSnapshot = useMemo(
    () => ({
      tenantId,
      generatedAt: timestamp,
      nodes,
      content: content.map((item) => ({ ...item, tenantId })),
      schedules: [],
    }),
    [tenantId, nodes],
  );

  const selected = nodes.find((node) => node.displayId === selectedId) ?? nodes[0];
  const online = nodes.filter((node) => node.status === 'ONLINE').length;

  const issueCommand = (type: Parameters<typeof createDisplayCommand>[2]) => {
    if (!selected) return;
    const command = createDisplayCommand(tenantId, selected.displayId, type);
    setMessage(`${type.replaceAll('_', ' ')} queued for ${selected.name} · ${command.commandId.slice(0, 8)}`);
    setNodes((current) =>
      current.map((node) =>
        node.displayId === selected.displayId
          ? { ...node, currentContentId: type === 'CLEAR_CONTENT' ? null : node.currentContentId }
          : node,
      ),
    );
  };

  if (!selected) return null;

  const syncPlan = buildSyncPlan(selected, snapshot);

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-indigo-300 text-xs font-mono uppercase tracking-wider">
            <ScreenShare className="h-4 w-4" /> Unified Display Engine
          </div>
          <h1 className="mt-2 text-2xl font-semibold text-white">Display Control Center</h1>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            One TDBK control plane for signage, classroom and interactive display nodes.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-emerald-300">
            {online}/{nodes.length} online
          </span>
          <button
            onClick={() => setMessage('Node heartbeats refreshed')}
            className="inline-flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-neutral-300 hover:bg-neutral-800"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 px-4 py-3 text-xs text-indigo-200">
        {message}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_.9fr]">
        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 overflow-hidden">
          <div className="border-b border-neutral-800 px-4 py-3 text-xs font-semibold text-neutral-300">All display nodes</div>
          <div className="divide-y divide-neutral-800">
            {nodes.map((node) => (
              <button
                key={node.displayId}
                onClick={() => setSelectedId(node.displayId)}
                className={`w-full p-4 text-left transition hover:bg-neutral-800/60 ${selectedId === node.displayId ? 'bg-indigo-950/30' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-xl border border-neutral-700 bg-neutral-950 p-2">
                    {node.nodeType === 'IDEAHUB' || node.nodeType === 'INTERACTIVE_PANEL' ? (
                      <ScreenShare className="h-5 w-5 text-indigo-300" />
                    ) : node.nodeType === 'LED_CONTROLLER' ? (
                      <Radio className="h-5 w-5 text-amber-300" />
                    ) : (
                      <Monitor className="h-5 w-5 text-neutral-300" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white">{node.name}</span>
                      {node.status === 'ONLINE' ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      ) : (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                      )}
                    </div>
                    <div className="mt-1 text-[11px] text-neutral-500">
                      {node.nodeType.replaceAll('_', ' ')} · {node.roomId ?? 'unassigned'} · cache v{node.offlineCacheVersion}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-neutral-600" />
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-neutral-800 bg-neutral-900/70 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">Selected node</div>
              <h2 className="mt-1 text-lg font-semibold text-white">{selected.name}</h2>
              <p className="text-xs text-neutral-500">{selected.nodeType.replaceAll('_', ' ')}</p>
            </div>
            {selected.status === 'ONLINE' ? <Wifi className="h-5 w-5 text-emerald-400" /> : <WifiOff className="h-5 w-5 text-amber-400" />}
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Metric label="Status" value={selected.status} />
            <Metric label="Network" value={selected.networkQuality} />
            <Metric label="Cache" value={`v${selected.offlineCacheVersion}`} />
            <Metric label="App" value={selected.appVersion ?? '—'} />
          </div>

          <div className="mt-5">
            <div className="mb-2 text-[10px] font-mono uppercase tracking-wider text-neutral-500">Capabilities</div>
            <div className="flex flex-wrap gap-1.5">
              {selected.capabilities.map((capability) => (
                <span key={capability} className="rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-[10px] text-neutral-300">
                  {capability.replaceAll('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2">
            <Action label="Sync" onClick={() => issueCommand('SYNC')} />
            <Action label="Refresh" onClick={() => issueCommand('REFRESH')} />
            <Action label="Interactive mode" onClick={() => issueCommand('ENTER_INTERACTIVE_MODE')} />
            <Action label="Clear content" onClick={() => issueCommand('CLEAR_CONTENT')} />
          </div>

          <div className="mt-5 rounded-xl border border-neutral-800 bg-neutral-950 p-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-neutral-300">
              <Cast className="h-3.5 w-3.5 text-indigo-300" /> Sync plan
            </div>
            <div className="mt-2 text-[11px] text-neutral-500">
              {syncPlan.content.length} content items · {syncPlan.schedules.length} schedules · next cache v{syncPlan.cacheVersion}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

const Metric = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-3">
    <div className="text-[9px] uppercase tracking-wider text-neutral-600">{label}</div>
    <div className="mt-1 text-xs font-semibold text-neutral-200">{value}</div>
  </div>
);

const Action = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="rounded-lg border border-neutral-700 bg-neutral-800 px-2.5 py-2 text-[11px] font-semibold text-neutral-200 hover:bg-neutral-700"
  >
    {label}
  </button>
);
