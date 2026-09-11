export interface TdbkContext {
  who: {
    personId: string;
    identityId: string;
    activeRole: string;
    organizationMembershipId: string;
    name: string;
  };
  where: {
    tenantId: string;
    branchId: string;
    workspaceId: string;
    environment: 'development' | 'production' | 'staging';
    surfaceType: 'WEB_WORKSPACE' | 'MOBILE_APP' | 'CLASSROOM_DISPLAY' | 'TV_DISPLAY';
  };
  what: {
    objectId?: string;
    resourceId?: string;
    activityId?: string;
    transactionId?: string;
    sessionId?: string;
    domainMetadata?: Record<string, any>; // Place domain context (e.g., school/grade/topic) here
  };
  why: {
    intent: string; // e.g., 'TEACH', 'RECONCILE', 'BILL', 'BROWSE'
    businessObjective?: string;
  };
  when: {
    timestamp: string;
    sessionId: string;
    eventId?: string;
  };
  state: {
    currentState: string;
    previousState?: string;
    availableCapabilities: string[];
    permissions: string[];
  };
}

export class TdbkContextEngine {
  private static instance: TdbkContextEngine;
  private currentContext: TdbkContext | null = null;

  private constructor() {}

  public static getInstance(): TdbkContextEngine {
    if (!TdbkContextEngine.instance) {
      TdbkContextEngine.instance = new TdbkContextEngine();
    }
    return TdbkContextEngine.instance;
  }

  public initializeContext(initial: TdbkContext): TdbkContext {
    this.currentContext = { ...initial };
    return this.currentContext;
  }

  public getContext(): TdbkContext | null {
    return this.currentContext;
  }

  public updateContext(updates: Partial<TdbkContext>): TdbkContext {
    if (!this.currentContext) {
      throw new Error('TDBK Context not initialized.');
    }
    this.currentContext = {
      ...this.currentContext,
      ...updates,
      when: {
        ...this.currentContext.when,
        timestamp: new Date().toISOString(),
      },
    };
    return this.currentContext;
  }

  public updateDomainMetadata(metadata: Record<string, any>): TdbkContext {
    if (!this.currentContext) {
      throw new Error('TDBK Context not initialized.');
    }
    this.currentContext = {
      ...this.currentContext,
      what: {
        ...this.currentContext.what,
        domainMetadata: {
          ...(this.currentContext.what.domainMetadata || {}),
          ...metadata,
        },
      },
    };
    return this.currentContext;
  }

  public clearDomainMetadata(): void {
    if (this.currentContext) {
      this.currentContext.what.domainMetadata = {};
    }
  }
}

export const tdbkContextEngine = TdbkContextEngine.getInstance();
