import { SecurityContext } from '../../kernel/types';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { bridgeRegistry } from '../../orchestration/bridge/registry';
import { ConnectorConnectionStatus, ConnectorHealthStatus } from '../../persistence/types';
import { connectionHub } from '../../orchestration/bridge/connectionHub';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { entitlementEngine } from '../../capability/entitlement';
import { capabilityRegistry } from '../../capability/registry';

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
  minimumTier: string;
  entitlementStatus: string;
}

export interface ConnectorActivationResult {
  tenantId: string;
  bridgeId: string;
  status: string;
  enabled: boolean;
  healthStatus: string;
  ready: boolean;
  blockers: string[];
  minimumTier: string;
  entitlementStatus: string;
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

  public async activate(context: SecurityContext, tenantId: string, bridgeId: string): Promise<ConnectorActivationResult> {
    await masterAuthority.assertTenantAuthority(context, tenantId, 'ACTIVATE_CONNECTOR');
    const definition = bridgeRegistry.getBridgeDefinition(bridgeId);
    if (!definition) throw new Error(`Unknown bridge '${bridgeId}'.`);
    const connection = await connectorConnectionRepository.getConnection(tenantId, `conn_${bridgeId}`);
    if (!connection) throw new Error(`Bridge '${bridgeId}' has no durable connection for DBK '${tenantId}'.`);

    const blockers: string[] = [];
    const entitlementStatus = await entitlementEngine.evaluatePersistentEntitlement(tenantId, definition.capabilityId);
    const minimumTier = capabilityRegistry.getCapability(definition.capabilityId)?.entitlementRequirements.minimumTier || definition.frontDoor.minimumTier;
    if (entitlementStatus !== 'ENTITLED') blockers.push(`UPGRADE_REQUIRED:${minimumTier}`);
    if (!definition.frontDoor.configurable) blockers.push('FRONT_DOOR_CONFIGURATION_DISABLED');
    if (definition.status === 'MOCK') blockers.push('BRIDGE_IMPLEMENTATION_IS_MOCK');
    if (!bridgeRegistry.getBridgeInstance(bridgeId)) blockers.push('BRIDGE_ADAPTER_NOT_REGISTERED');
    const missingConfiguration = definition.configurationRequirements.filter(
      (key) => !(key in connection.parameters) && !(key in connection.secretRefs),
    );
    if (missingConfiguration.length) blockers.push(`MISSING_CONFIGURATION:${missingConfiguration.join(',')}`);
    if (blockers.length) {
      return {
        tenantId, bridgeId, status: connection.status, enabled: connection.enabled,
        healthStatus: connection.lastHealthStatus, ready: false, blockers, minimumTier, entitlementStatus,
      };
    }

    const configured = await connectionHub.setStatus(context, bridgeId, 'CONFIGURED', true);
    let healthStatus: ConnectorHealthStatus = configured.lastHealthStatus;
    try {
      const health = await connectionHub.health(context, bridgeId);
      healthStatus = health.status === 'DEGRADED' ? 'ERROR' : health.status;
    } catch (error) {
      healthStatus = 'ERROR';
      blockers.push(error instanceof Error ? error.message : 'HEALTH_CHECK_FAILED');
    }

    if (healthStatus !== 'HEALTHY') blockers.push(`HEALTH_${healthStatus}`);
    return {
      tenantId, bridgeId, status: 'CONFIGURED', enabled: true,
      healthStatus, ready: blockers.length === 0, blockers,
    };
  }

  public async inspect(context: SecurityContext, tenantId: string): Promise<ConnectorReadinessReport> {
    await masterAuthority.assertTenantAuthority(context, tenantId, 'INSPECT_CONNECTORS');
    const connections = await connectorConnectionRepository.listConnections(tenantId);
    const byBridge = new Map(connections.map((connection) => [connection.bridgeId, connection]));

    const items: ConnectorReadinessItem[] = await Promise.all(bridgeRegistry.listBridgeDefinitions().map(async (definition) => {
      const connection = byBridge.get(definition.bridgeId);
      const blockers: string[] = [];
      const entitlementStatus = await entitlementEngine.evaluatePersistentEntitlement(tenantId, definition.capabilityId);
      const minimumTier = definition.frontDoor.minimumTier;

      if (entitlementStatus !== 'ENTITLED') blockers.push(`UPGRADE_REQUIRED:${minimumTier}`);
      if (!definition.frontDoor.configurable) blockers.push('FRONT_DOOR_CONFIGURATION_DISABLED');
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
        connectionStatus: connection?.status ?? 'MISSING',
        enabled: connection?.enabled || false,
        healthStatus: connection?.lastHealthStatus ?? 'UNKNOWN',
        adapterRegistered: Boolean(bridgeRegistry.getBridgeInstance(definition.bridgeId)),
        ready: blockers.length === 0 && entitlementStatus === 'ENTITLED',
        blockers,
        minimumTier,
        entitlementStatus,
      };
    }));

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
