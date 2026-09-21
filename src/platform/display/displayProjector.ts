import { createHash } from 'node:crypto';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { eventBus } from '../../orchestration/events/eventBus';
import type { EventEnvelope } from '../../orchestration/events/types';
import type { DisplayContent, DisplayNode, DisplayCommandType } from './types';

type ProjectablePayload = Record<string, unknown>;

const contentPath = (tenantId: string, id: string) => `/tenants/${tenantId}/displayContent/${id}`;
const commandPath = (tenantId: string, id: string) => `/tenants/${tenantId}/displayCommands/${id}`;

function stableId(eventId: string): string {
  return `event_${createHash('sha256').update(eventId).digest('hex').slice(0, 24)}`;
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function project(event: EventEnvelope<ProjectablePayload>): { content: DisplayContent; commandType: DisplayCommandType; targetDisplayIds?: string[]; targetRoomIds?: string[] } | null {
  const payload = event.payload ?? {};
  const tenantId = event.tenantId || text(payload.dbkId, '');
  if (!tenantId) return null;

  const explicitBroadcast = event.eventType === 'display.broadcast.v1';
  const title = explicitBroadcast
    ? text(payload.title, 'Digital Notice')
    : text(payload.title, event.eventType.replace('.v1', '').replaceAll('.', ' '));
  const body = explicitBroadcast
    ? text(payload.primaryMessage, text(payload.message, 'New business update'))
    : text(payload.message, text(payload.primaryMessage, 'A new business event has been recorded.'));

  const content: DisplayContent = {
    contentId: stableId(event.eventId),
    tenantId,
    title,
    kind: explicitBroadcast && payload.priority === 'HIGH' ? 'ALERT' : 'ANNOUNCEMENT',
    body,
    mediaUrl: typeof payload.mediaUrl === 'string' ? payload.mediaUrl : null,
    durationSeconds: typeof payload.durationSeconds === 'number' ? payload.durationSeconds : null,
    requiredCapabilities: explicitBroadcast && payload.priority === 'HIGH' ? ['EMERGENCY_ALERTS'] : ['ANNOUNCEMENTS'],
    published: true,
    version: 1,
    updatedAt: event.occurredAt,
  };

  return {
    content,
    commandType: content.kind === 'ALERT' ? 'SHOW_ALERT' : 'PLAY_CONTENT',
    targetDisplayIds: Array.isArray(payload.targetDisplayIds) ? payload.targetDisplayIds.filter((v): v is string => typeof v === 'string') : undefined,
    targetRoomIds: Array.isArray(payload.targetRoomIds) ? payload.targetRoomIds.filter((v): v is string => typeof v === 'string') : undefined,
  };
}

async function handle(event: EventEnvelope<ProjectablePayload>): Promise<void> {
  const result = project(event);
  if (!result) return;

  const { content, commandType, targetDisplayIds, targetRoomIds } = result;
  await firestoreClient.set(contentPath(content.tenantId, content.contentId), content);

  const nodes = await firestoreClient.listCollection<DisplayNode>(`/tenants/${content.tenantId}/displayNodes`);
  const targets = nodes.filter((node) => {
    if (targetDisplayIds?.length && !targetDisplayIds.includes(node.displayId)) return false;
    if (targetRoomIds?.length && !targetRoomIds.includes(node.roomId ?? '')) return false;
    return (content.requiredCapabilities ?? []).every((capability) => node.capabilities.includes(capability));
  });

  await Promise.all(targets.map(async (node) => {
    const commandId = `cmd_${content.contentId}_${node.displayId}`;
    await firestoreClient.set(commandPath(content.tenantId, commandId), {
      commandId,
      tenantId: content.tenantId,
      displayId: node.displayId,
      type: commandType,
      payload: { contentId: content.contentId, sourceEventId: event.eventId },
      issuedAt: event.occurredAt,
      status: 'PENDING',
    });
  }));
}

const subscribedEventTypes = [
  'display.broadcast.v1',
  'attendance.recorded.v1',
  'pos.sale.completed.v1',
  'payment.confirmed.v1',
  'document.issued.v1',
  'dbk.activated.v1',
  'capability.enabled.v1',
];

let registered = false;
export function registerDisplayProjector(): void {
  if (registered) return;
  registered = true;
  for (const eventType of subscribedEventTypes) eventBus.subscribe(eventType, handle);
}
