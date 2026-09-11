import { CanvasObject } from './interactiveExperienceRuntime';
import { TdbkContext } from './contextEngine';

export interface TdbkSession {
  sessionId: string;
  tenantId: string;
  branchId: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
  context: TdbkContext;
  canvasObjects: CanvasObject[];
  metadata: Record<string, any>;
  historyLog: string[];
}

export class TdbkSessionRuntime {
  private static instance: TdbkSessionRuntime;
  private activeSessions: Map<string, TdbkSession> = new Map();

  private constructor() {}

  public static getInstance(): TdbkSessionRuntime {
    if (!TdbkSessionRuntime.instance) {
      TdbkSessionRuntime.instance = new TdbkSessionRuntime();
    }
    return TdbkSessionRuntime.instance;
  }

  public createSession(
    tenantId: string,
    branchId: string,
    userId: string,
    context: TdbkContext,
    initialObjects: CanvasObject[] = []
  ): TdbkSession {
    const sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`;
    const newSession: TdbkSession = {
      sessionId,
      tenantId,
      branchId,
      userId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      context: {
        ...context,
        when: {
          ...context.when,
          sessionId,
        },
      },
      canvasObjects: initialObjects,
      metadata: {},
      historyLog: ['Session initialized.'],
    };

    this.activeSessions.set(sessionId, newSession);
    return newSession;
  }

  public saveSession(sessionId: string, objects: CanvasObject[], metadata: Record<string, any> = {}): TdbkSession {
    const session = this.activeSessions.get(sessionId);
    if (!session) {
      throw new Error(`Session with ID '${sessionId}' does not exist.`);
    }

    const updated: TdbkSession = {
      ...session,
      canvasObjects: [...objects],
      metadata: { ...session.metadata, ...metadata },
      updatedAt: new Date().toISOString(),
      historyLog: [...session.historyLog, `Session state saved at ${new Date().toLocaleTimeString()}`],
    };

    this.activeSessions.set(sessionId, updated);
    
    // Standard localStorage backup for client durability
    try {
      localStorage.setItem(`tdbk_session_${sessionId}`, JSON.stringify(updated));
    } catch {
      // Safely ignore if not available in headless/node
    }

    return updated;
  }

  public getSession(sessionId: string): TdbkSession | undefined {
    let sess = this.activeSessions.get(sessionId);
    if (!sess) {
      try {
        const stored = localStorage.getItem(`tdbk_session_${sessionId}`);
        if (stored) {
          sess = JSON.parse(stored);
          if (sess) {
            this.activeSessions.set(sessionId, sess);
          }
        }
      } catch {
        // Safe check
      }
    }
    return sess;
  }

  public listSessionsForTenant(tenantId: string): TdbkSession[] {
    return Array.from(this.activeSessions.values()).filter((s) => s.tenantId === tenantId);
  }
}

export const tdbkSessionRuntime = TdbkSessionRuntime.getInstance();
