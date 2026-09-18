/**
 * TDBK V2 — TENANT CONNECTOR CONNECTION REPOSITORY
 * Firestore Path: /tenants/{tenantId}/connections/{connectionId}
 *
 * Connection state is business configuration and must survive process restart.
 * Secret material is intentionally represented only by references; raw secret
 * values must never be persisted by this repository.
 */

import { ConnectorConnection, IConnectorConnectionRepository } from '../../types';
import { firestoreClient } from '../firestoreClient';

export class ConnectorConnectionRepository implements IConnectorConnectionRepository {
  private static instance: ConnectorConnectionRepository;

  private constructor() {}

  public static getInstance(): ConnectorConnectionRepository {
    if (!ConnectorConnectionRepository.instance) {
      ConnectorConnectionRepository.instance = new ConnectorConnectionRepository();
    }
    return ConnectorConnectionRepository.instance;
  }

  private getPath(tenantId: string, connectionId: string): string {
    return `/tenants/${tenantId}/connections/${connectionId}`;
  }

  private assertTenantBoundary(tenantId: string, connection: ConnectorConnection): void {
    if (connection.tenantId !== tenantId) {
      throw new Error('Connector connection tenant boundary violation.');
    }
  }

  private sanitize(connection: ConnectorConnection): ConnectorConnection {
    for (const value of Object.values(connection.secretRefs)) {
      if (!value?.name || !value?.provider) {
        throw new Error('Invalid connector secret reference.');
      }
    }
    return {
      ...connection,
      parameters: { ...connection.parameters },
      secretRefs: { ...connection.secretRefs },
    };
  }

  public async saveConnection(
    tenantId: string,
    connectionId: string,
    connection: ConnectorConnection
  ): Promise<void> {
    this.assertTenantBoundary(tenantId, connection);
    if (connection.connectionId !== connectionId) {
      throw new Error('Connector connection identity mismatch.');
    }
    await firestoreClient.set(
      this.getPath(tenantId, connectionId),
      this.sanitize(connection) as unknown as Record<string, unknown>
    );
  }

  public async getConnection(
    tenantId: string,
    connectionId: string
  ): Promise<ConnectorConnection | null> {
    const connection = await firestoreClient.get<ConnectorConnection>(
      this.getPath(tenantId, connectionId)
    );
    if (!connection) return null;
    this.assertTenantBoundary(tenantId, connection);
    return connection;
  }

  public async listConnections(tenantId: string): Promise<ConnectorConnection[]> {
    const connections = await firestoreClient.listCollection<ConnectorConnection>(
      `/tenants/${tenantId}/connections`
    );
    return connections.filter((connection) => connection.tenantId === tenantId);
  }

  public async deleteConnection(tenantId: string, connectionId: string): Promise<void> {
    await firestoreClient.delete(this.getPath(tenantId, connectionId));
  }

  public async updateHealth(
    tenantId: string,
    connectionId: string,
    healthStatus: ConnectorConnection['lastHealthStatus'],
    lastErrorCode: string | null = null
  ): Promise<void> {
    const connection = await this.getConnection(tenantId, connectionId);
    if (!connection) throw new Error(`Connector connection '${connectionId}' not found.`);

    const updated: ConnectorConnection = {
      ...connection,
      lastHealthStatus: healthStatus,
      lastHealthCheckAt: new Date().toISOString(),
      lastErrorCode,
      status: healthStatus === 'ERROR' ? 'ERROR' : connection.status,
      updatedAt: new Date().toISOString(),
    };

    await firestoreClient.set(
      this.getPath(tenantId, connectionId),
      updated as unknown as Record<string, unknown>
    );
  }
}

export const connectorConnectionRepository = ConnectorConnectionRepository.getInstance();
