import { SecurityContext } from '../../kernel/types';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { bridgeRegistry } from '../../orchestration/bridge/registry';
import { ConnectorConnectionStatus } from '../../persistence/types';

export interface ConnectorReadinessItem {
  bridgeId: string;
  provider: string;
  capabilityId: string;
  implementationStatus: string;
  requiredParameters: string[];
  connectionStatus: ConnectorConnectionStatus | 'MISSING';
  enabled: boolean;
  healthStatus: string;
  adapterRegistered: boolean;
  ready: boolean;
  blockers: string[];
}

export interface ConnectorReadinessReport {
  tenantId: string;
  generatedAt: string;
  totalBridges: number;
  configured: number;
  ready: number;
  blocked: number;
  items: ConnectorReadinessItem[];
}

class ConnectorReadinessService {
  public async inspect(context: SecurityContext, tenantId: string): Promise<ConnectorReadinessReport> {
    void context;
    const connections = await connectorConnectionRepository.listConnections(tenantId);
    const byBridge = new Map(connections.map((connection) => [connection.bridgeId, connection]));

    const items = bridgeRegistry.listBridgeDefinitions().map((definition) => {
      const connection = byBridge.get(definition.bridgeId);
      const blockers: string[] = [];

      if (!connection) blockers.push('CONNECTION_NOT_CONFIGURED');
      if (definition.status === 'MOCK') blockers.push('BRIDGE_IMPLEMENTATION_IS_MOCK');
      if (!bridgeRegistry.getBridgeInstance(definition.bridgeId)) blockers.push('BRIDGE_ADAPTER_NOT_REGISTERED');
      if (connection && connection.status !== 'CONFIGURED') blockers.push(`CONNECTION_STATUS_${connection.status}`);
      if (connection) {
        const missingConfiguration = definition.configurationRequirements.filter(
          (key) => !(key in connection.parameters) && !(key in connection.secretRefs),
        );
        if (missingConfiguration.length > 0) blockers.push(`MISSING_CONFIGURATION:${missingConfiguration.join(',')}`);
      }
      if (connection && !connection.enabled) blockers.push('CONNECTION_DISABLED');
      if (connection && connection.lastHealthStatus !== 'HEALTHY') blockers.push(`HEALTH_${connection.lastHealthStatus}`);

      return {
        bridgeId: definition.bridgeId,
        provider: definition.provider,
        capabilityId: definition.capabilityId,
        implementationStatus: definition.status,
        requiredParameters: [...definition.configurationRequirements],
        connectionStatus: connection?.status || 'MISSING',
        enabled: connection?.enabled || false,
        healthStatus: connection?.lastHealthStatus || 'UNKNOWN',
        adapterRegistered: Boolean(bridgeRegistry.getBridgeInstance(definition.bridgeId)),
        ready: blockers.length === 0,
        blockers,
      };
    });

    return {
      tenantId,
      generatedAt: new Date().toISOString(),
      totalBridges: items.length,
      configured: items.filter((item) => item.connectionStatus === 'CONFIGURED').length,
      ready: items.filter((item) => item.ready).length,
      blocked: items.filter((item) => !item.ready).length,
      items,
    };
  }
}

export const connectorReadinessService = new ConnectorReadinessService();
