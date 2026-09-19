/** TDBK V2 — AUTONOMOUS OPERATIONS ENGINE */
import { TdbkControlPlaneSnapshot } from '../controlPlane/controlPlane';
import { AutonomousOperationsSnapshot, OperationSignal } from './types';

export class AutonomousOperationsEngine {
  public evaluate(controlPlane: TdbkControlPlaneSnapshot): AutonomousOperationsSnapshot {
    const signals: OperationSignal[] = [];
    const healthStatus = String((controlPlane.platform.health as any)?.status || '').toUpperCase();

    if (healthStatus && !['READY', 'HEALTHY', 'OK'].includes(healthStatus)) {
      signals.push({ code: 'PLATFORM_HEALTH_DEGRADED', severity: 'ERROR', message: 'Platform readiness reported as ' + healthStatus + '.', operationClass: 'REQUIRES_AUTHORIZATION' });
    }

    for (const dbk of controlPlane.dbks) {
      if (dbk.status !== 'ACTIVE') {
        signals.push({ code: 'DBK_NOT_ACTIVE', severity: 'WARNING', message: 'DBK ' + dbk.dbkId + ' is ' + dbk.status + '.', tenantId: dbk.dbkId, operationClass: 'OBSERVE_ONLY' });
      }
      if (dbk.stateVersion === null) {
        signals.push({ code: 'BUSINESS_STATE_MISSING', severity: 'ERROR', message: 'DBK ' + dbk.dbkId + ' has no projected business-state snapshot.', tenantId: dbk.dbkId, operationClass: 'AUTO_SAFE' });
      }
    }

    const hasCritical = signals.some((s) => s.severity === 'CRITICAL');
    const hasAction = signals.some((s) => s.severity === 'ERROR');

    return {
      generatedAt: new Date().toISOString(),
      status: hasCritical ? 'BLOCKED' : hasAction ? 'ACTION_REQUIRED' : signals.length ? 'DEGRADED' : 'HEALTHY',
      autonomousExecutionEnabled: process.env.TDBK_AUTONOMOUS_OPS_ENABLED === 'true',
      safeActionsEnabled: process.env.TDBK_AUTONOMOUS_SAFE_ACTIONS_ENABLED !== 'false',
      productionMutationRequiresAuthorization: true,
      signals,
    };
  }
}

export const autonomousOperations = new AutonomousOperationsEngine();
