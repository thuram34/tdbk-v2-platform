/**
 * TDBK V2 OBSERVABILITY & HEALTH MONITORING
 * Architectural Layer: LAYER 1 — KERNEL
 */

import { HealthStatus } from '../types';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { eventBus } from '../../orchestration/events/eventBus';
import { bridgeRegistry } from '../../orchestration/bridge/registry';

export class HealthMonitoringService {
  public getLiveStatus(): HealthStatus {
    return {
      status: 'HEALTHY', timestamp: new Date().toISOString(), version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      components: { kernel: true, tenancy: true, auth: true, audit: true },
    };
  }

  /** Readiness checks the core runtime dependencies required to serve production traffic. */
  public async getReadyStatus(): Promise<HealthStatus> {
    const components = {
      kernel: true,
      tenancy: true,
      auth: true,
      audit: true,
      firestore: false,
      eventBus: false,
      bridgeAdapters: false,
    };

    try {
      // A successful read proves the authoritative Firestore driver is reachable.
      // The readiness document may legitimately be absent; the read itself is the
      // dependency probe and does not mutate business state.
      await firestoreClient.get('/system/readiness');
      components.firestore = true;
    } catch {
      return {
        status: 'DEGRADED',
        timestamp: new Date().toISOString(),
        version: '2.0.0',
        environment: process.env.NODE_ENV || 'development',
        components,
      };
    }

    components.eventBus = eventBus.isReady();

    const requiredBridgeIds = ['bridge_mpesa', 'bridge_etims', 'bridge_whatsapp'];
    components.bridgeAdapters = requiredBridgeIds.every((bridgeId) => {
      const definition = bridgeRegistry.getBridgeDefinition(bridgeId);
      const adapter = bridgeRegistry.getBridgeInstance(bridgeId);
      return Boolean(
        adapter &&
        definition &&
        definition.status !== 'MOCK',
      );
    });

    const allReady = components.firestore && components.eventBus && components.bridgeAdapters;

    return {
      status: allReady ? 'HEALTHY' : 'DEGRADED',
      timestamp: new Date().toISOString(),
      version: '2.0.0',
      environment: process.env.NODE_ENV || 'development',
      components,
    };
  }
}

export const healthMonitoring = new HealthMonitoringService();
