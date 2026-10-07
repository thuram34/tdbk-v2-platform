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

  /** Establishes the durable system readiness marker during process bootstrap. */
  public async initializeReadinessMarker(): Promise<void> {
    const existing = await firestoreClient.get<Record<string, unknown>>('/system/readiness');
    if (!existing || existing.schemaVersion !== 'v1') {
      await firestoreClient.set('/system/readiness', {
        schemaVersion: 'v1',
        service: 'tdbk-v2',
        initializedAt: new Date().toISOString(),
      });
    }
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
      const readinessMarker = await firestoreClient.get<Record<string, unknown>>('/system/readiness');
      components.firestore = Boolean(readinessMarker && readinessMarker.schemaVersion === 'v1' && readinessMarker.service === 'tdbk-v2');
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

    const requiredBridgeIds = ['bridge_mpesa', 'bridge_etims', 'bridge_whatsapp', 'bridge_sms', 'bridge_email', 'bridge_bank'];
    components.bridgeAdapters = requiredBridgeIds.every((bridgeId) => {
      const definition = bridgeRegistry.getBridgeDefinition(bridgeId);
      const adapter = bridgeRegistry.getBridgeInstance(bridgeId);
      return Boolean(
        adapter &&
        definition &&
        definition.status !== 'DEFINED',
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
