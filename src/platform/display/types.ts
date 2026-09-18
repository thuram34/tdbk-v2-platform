/**
 * TDBK Unified Display Engine — canonical domain types.
 * One display node abstraction covers signage, classroom, LED and interactive surfaces.
 */
export type DisplayNodeType =
  | 'TV_KIOSK' | 'RASPBERRY_PI' | 'ANDROID_TV' | 'INTERACTIVE_PANEL'
  | 'IDEAHUB' | 'LED_CONTROLLER' | 'BROWSER_KIOSK' | 'TABLET';
export type DisplayNodeStatus = 'ONLINE' | 'OFFLINE' | 'DEGRADED' | 'UNKNOWN';
export type DisplayCapability =
  | 'SIGNAGE' | 'ANNOUNCEMENTS' | 'SCHEDULES' | 'MEDIA' | 'EMERGENCY_ALERTS'
  | 'LESSON_CONTENT' | 'PRESENTATION' | 'WHITEBOARD' | 'INTERACTIVE' | 'CASTING' | 'COLLABORATION';
export type DisplayContentKind =
  | 'ANNOUNCEMENT' | 'IMAGE' | 'VIDEO' | 'WEB' | 'LESSON' | 'PLAYLIST' | 'ALERT' | 'CUSTOM';
export interface DisplayNode {
  displayId: string; tenantId: string; siteId: string; buildingId?: string | null; roomId?: string | null;
  name: string; nodeType: DisplayNodeType; capabilities: DisplayCapability[]; status: DisplayNodeStatus;
  lastSeenAt: string | null; appVersion: string | null; networkQuality: 'GOOD' | 'FAIR' | 'POOR' | 'UNKNOWN';
  currentContentId: string | null; currentScheduleId: string | null; offlineCacheVersion: number;
  metadata?: Record<string, unknown>;
}
export interface DisplayContent {
  contentId: string; tenantId: string; title: string; kind: DisplayContentKind; body?: string | null;
  mediaUrl?: string | null; durationSeconds?: number | null; requiredCapabilities?: DisplayCapability[];
  published: boolean; version: number; updatedAt: string;
}
export interface DisplayScheduleEntry {
  scheduleId: string; tenantId: string; title: string; contentId: string; startsAt: string; endsAt: string | null;
  daysOfWeek?: number[]; targetDisplayIds?: string[]; targetRoomIds?: string[];
  targetCapabilities?: DisplayCapability[]; enabled: boolean;
}
export type DisplayCommandType =
  | 'SYNC' | 'PLAY_CONTENT' | 'CLEAR_CONTENT' | 'REFRESH'
  | 'ENTER_INTERACTIVE_MODE' | 'EXIT_INTERACTIVE_MODE' | 'SHOW_ALERT';
export interface DisplayCommand {
  commandId: string; tenantId: string; displayId: string; type: DisplayCommandType;
  payload?: Record<string, unknown>; issuedAt: string;
}
export interface DisplaySyncPlan {
  displayId: string; generatedAt: string; content: DisplayContent[];
  schedules: DisplayScheduleEntry[]; commands: DisplayCommand[]; cacheVersion: number;
}
export interface DisplayEngineSnapshot {
  tenantId: string; generatedAt: string; nodes: DisplayNode[];
  content: DisplayContent[]; schedules: DisplayScheduleEntry[];
}
