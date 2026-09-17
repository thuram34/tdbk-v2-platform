/**
 * TDBK V2 OBSERVABILITY & HEALTH MONITORING
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { HealthStatus } from '../types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';

export class HealthMonitoringService {
  public getLiveStatus(): HealthStatus {
    return {
      status: 'HEALTHY', timestamp: new Date().toISOString(), version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      components: { kernel: true, tenancy: true, auth: true, audit: true },
    };
  }

  /** Readiness checks the authoritative persistence path, not merely process uptime. */
  public async getReadyStatus(): Promise<HealthStatus> {
    const components: HealthStatus['components'] & { firestore: boolean } = { kernel: true, tenancy: true, auth: true, audit: true, firestore: false };
    try {
      await firestoreClient.get('/system/readiness');
      components.firestore = true;
    } catch {
      return { status: 'DEGRADED', timestamp: new Date().toISOString(), version: '2.0.0', environment: process.env.NODE_ENV || 'development', components };
    }
    return { status: 'HEALTHY', timestamp: new Date().toISOString(), version: '2.0.0', environment: process.env.NODE_ENV || 'development', components };
  }
}

export const healthMonitoring = new HealthMonitoringService();
