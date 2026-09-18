/**
 * TDBK V2 — UNIFIED CONNECTION HUB
 * Layer 6: Bridge Architecture
 *
 * Durable connection configuration is authoritative. Bridge adapters remain
 * executable implementations; this service owns tenant-scoped resolution,
 * lifecycle validation and health state.
 */

import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { ConnectorConnection, ConnectorConnectionStatus } from '../../persistence/types';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { bridgeRegistry } from './registry';
import { Bridge } from './types';

export interface ConnectionHealthResult {
  connection: ConnectorConnection;
  status: Awaited<ReturnType<Bridge['health']>>['status'];
  details?: Record<string, unknown>;
}

class ConnectionHubService {
  private connectionId(bridgeId: string): string {
    return `conn_${bridgeId}`;
  }

  private tenantId(context: SecurityContext): string {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'Connection Hub requires tenant context', 403, context.requestId);
    return tenantId;
  }

  public async getConnection(context: SecurityContext, bridgeId: string): Promise<ConnectorConnection | null> {
    return connectorConnectionRepository.getConnection(this.tenantId(context), this.connectionId(bridgeId));
  }

  public async listConnections(context: SecurityContext): Promise<ConnectorConnection[]> {
    return connectorConnectionRepository.listConnections(this.tenantId(context));
  }

  public async requireConfigured(context: SecurityContext, bridgeId: string): Promise<ConnectorConnection> {
    const tenantId = this.tenantId(context);
    const definition = bridgeRegistry.getBridgeDefinition(bridgeId);
    if (!definition) throw new KernelError('VALIDATION_ERROR', `Unknown bridge '${bridgeId}'`, 404, context.requestId);
    const connection = await connectorConnectionRepository.getConnection(tenantId, this.connectionId(bridgeId));
    if (!connection || connection.bridgeId !== bridgeId || connection.tenantId !== tenantId) {
      throw new KernelError('INTEGRATION_UNAVAILABLE', `Bridge '${bridgeId}' is not configured for this tenant`, 503, context.requestId);
    }
    if (!connection.enabled || connection.status !== 'CONFIGURED') {
      throw new KernelError('INTEGRATION_UNAVAILABLE', `Bridge '${bridgeId}' is not enabled/configured`, 503, context.requestId);
    }
    return connection;
  }

  public async resolveAdapter(context: SecurityContext, bridgeId: string): Promise<Bridge> {
    await this.requireConfigured(context, bridgeId);
    const adapter = bridgeRegistry.getBridgeInstance(bridgeId);
    if (!adapter) throw new KernelError('INTEGRATION_UNAVAILABLE', `Bridge adapter '${bridgeId}' is not registered`, 503, context.requestId);
    return adapter;
  }

  public async health(context: SecurityContext, bridgeId: string): Promise<ConnectionHealthResult> {
    const connection = await this.requireConfigured(context, bridgeId);
    const adapter = await this.resolveAdapter(context, bridgeId);
    const result = await adapter.health(context);
    await connectorConnectionRepository.updateHealth(
      connection.tenantId,
      connection.connectionId,
      result.status === 'HEALTHY' ? 'HEALTHY' : result.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'ERROR',
      result.status === 'HEALTHY' ? null : String(result.details?.reason || 'PROVIDER_UNAVAILABLE')
    );
    return { connection: await connectorConnectionRepository.getConnection(connection.tenantId, connection.connectionId) || connection, ...result };
  }

  public async setStatus(context: SecurityContext, bridgeId: string, status: ConnectorConnectionStatus, enabled: boolean): Promise<ConnectorConnection> {
    const connection = await this.getConnection(context, bridgeId);
    if (!connection) throw new KernelError('INTEGRATION_UNAVAILABLE', `Bridge '${bridgeId}' connection not found`, 404, context.requestId);
    if (connection.tenantId !== this.tenantId(context)) throw new KernelError('TENANT_ISOLATION_ERROR', 'Cross-tenant connection mutation denied', 403, context.requestId);
    const updated: ConnectorConnection = { ...connection, status, enabled, updatedAt: new Date().toISOString() };
    await connectorConnectionRepository.saveConnection(connection.tenantId, connection.connectionId, updated);
    return updated;
  }
}

export const connectionHub = new ConnectionHubService();
