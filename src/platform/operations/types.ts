/** TDBK V2 — AUTONOMOUS OPERATIONS CONTRACTS */

export type OperationClass = 'AUTO_SAFE' | 'REQUIRES_AUTHORIZATION' | 'OBSERVE_ONLY';
export type OperationStatus = 'HEALTHY' | 'DEGRADED' | 'ACTION_REQUIRED' | 'BLOCKED';

export interface OperationSignal {
  code: string;
  severity: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
  tenantId?: string | null;
  operationClass: OperationClass;
  metadata?: Record<string, unknown>;
}

export interface AutonomousOperationsSnapshot {
  generatedAt: string;
  status: OperationStatus;
  autonomousExecutionEnabled: boolean;
  safeActionsEnabled: boolean;
  productionMutationRequiresAuthorization: boolean;
  signals: OperationSignal[];
}
