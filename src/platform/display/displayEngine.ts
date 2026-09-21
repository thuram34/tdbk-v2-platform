import type {
  DisplayCapability, DisplayCommand, DisplayContent, DisplayEngineSnapshot, DisplayNode,
  DisplayScheduleEntry, DisplaySyncPlan,
} from './types';
const nowIso = () => new Date().toISOString();
export function isNodeEligibleForContent(node: DisplayNode, content: DisplayContent): boolean {
  if (content.tenantId !== node.tenantId || !content.published) return false;
  return (content.requiredCapabilities ?? []).every((c) => node.capabilities.includes(c));
}
export function scheduleTargetsNode(node: DisplayNode, schedule: DisplayScheduleEntry): boolean {
  if (schedule.tenantId !== node.tenantId || !schedule.enabled) return false;
  if (schedule.targetDisplayIds?.length && !schedule.targetDisplayIds.includes(node.displayId)) return false;
  if (schedule.targetRoomIds?.length && !schedule.targetRoomIds.includes(node.roomId ?? '')) return false;
  if (schedule.targetCapabilities?.length &&
      !schedule.targetCapabilities.every((c) => node.capabilities.includes(c))) return false;
  return true;
}
export function buildSyncPlan(node: DisplayNode, snapshot: DisplayEngineSnapshot): DisplaySyncPlan {
  if (snapshot.tenantId !== node.tenantId) throw new Error('DISPLAY_TENANT_MISMATCH');
  const content = snapshot.content.filter((item) => isNodeEligibleForContent(node, item));
  const schedules = snapshot.schedules.filter((item) =>
    scheduleTargetsNode(node, item) && content.some((c) => c.contentId === item.contentId));
  return {
    displayId: node.displayId, generatedAt: nowIso(), content, schedules, commands: [],
    cacheVersion: node.offlineCacheVersion + 1,
  };
}
export function createDisplayCommand(
  tenantId: string, displayId: string, type: DisplayCommand['type'], payload: Record<string, unknown> = {},
): DisplayCommand {
  return { commandId: crypto.randomUUID(), tenantId, displayId, type, payload, issuedAt: nowIso() };
}
export function capabilitiesForNodeType(nodeType: DisplayNode['nodeType']): DisplayCapability[] {
  switch (nodeType) {
    case 'INTERACTIVE_PANEL':
    case 'IDEAHUB':
      return ['SIGNAGE','ANNOUNCEMENTS','SCHEDULES','MEDIA','EMERGENCY_ALERTS','LESSON_CONTENT',
        'PRESENTATION','WHITEBOARD','INTERACTIVE','CASTING','COLLABORATION'];
    case 'RASPBERRY_PI':
    case 'ANDROID_TV':
    case 'TV_KIOSK':
    case 'BROWSER_KIOSK':
    case 'LED_CONTROLLER':
      return ['SIGNAGE','ANNOUNCEMENTS','SCHEDULES','MEDIA','EMERGENCY_ALERTS'];
    case 'TABLET':
      return ['SIGNAGE','ANNOUNCEMENTS','SCHEDULES','MEDIA','LESSON_CONTENT','INTERACTIVE'];
    default: return [];
  }
}
