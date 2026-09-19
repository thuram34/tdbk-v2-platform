/**
 * TDBK V2 — CONNECTOR CONFIGURATION PLANE
 *
 * Durable tenant-scoped connector configuration. Raw secret material is never
 * accepted or persisted; secret-bearing values must be represented by a
 * reference to the platform secret provider.
 */
import { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { masterAuthority } from '../../kernel/master/masterAuthority';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { ConnectorConnection, ConnectorSecretReference } from '../../persistence/types';
import { connectorConnectionRepository } from '../../persistence/firestore/repositories/connectorConnectionRepository';
import { bridgeRegistry } from '../../orchestration/bridge/registry';

export interface ConfigureConnectorRequest {
  tenantId: string;
  bridgeId: string;
  parameters?: Record<string, string>;
  secretRefs?: Record<string, ConnectorSecretReference>;
  enabled?: boolean;
}

export interface ConnectorConfigurationResult {
  connection: ConnectorConnection;
  created: boolean;
  configurationVersion: number;
}

class ConnectorConfigurationService {
  private assertConfigurationWriteAuthority(context: SecurityContext): void {
    const principal = context.principal;
    const isConnectorAdministrator = principal.roles.some((role) =>
      ['TENANT_ADMIN', 'OWNER_OPERATOR', 'BUSINESS_OWNER'].includes(role),
    );
    if (!isConnectorAdministrator && !rbacEngine.hasPermission(principal, 'connectors:write')) {
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        "Connector configuration requires the 'connectors:write' permission or tenant administrator role.",
        403,
        context.requestId,
      );
    }
  }

  private validateSecretReference(key: string, reference: ConnectorSecretReference, requestId: string): void {
    if (!reference || reference.provider !== 'GCP_SECRET_MANAGER') {
      throw new KernelError('VALIDATION_ERROR', `Secret reference '${key}' must use GCP_SECRET_MANAGER.`, 400, requestId);
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,254}$/.test(reference.name)) {
      throw new KernelError('VALIDATION_ERROR', `Invalid secret reference name for '${key}'.`, 400, requestId);
    }
  }

  private validate(
    context: SecurityContext,
    request: ConfigureConnectorRequest,
    definition: NonNullable<ReturnType<typeof bridgeRegistry.getBridgeDefinition>>,
  ): void {
    const parameters = request.parameters || {};
    const secretRefs = request.secretRefs || {};
    const required = new Set(definition.configurationRequirements);

    for (const key of Object.keys(parameters)) {
      if (!required.has(key)) {
        throw new KernelError('VALIDATION_ERROR', `Connector parameter '${key}' is not declared by bridge '${definition.bridgeId}'.`, 400, context.requestId);
      }
      if (typeof parameters[key] !== 'string') {
        throw new KernelError('VALIDATION_ERROR', `Invalid connector parameter '${key}'.`, 400, context.requestId);
      }
      if (/secret|password|token|passkey|consumer.*key|api.*key/i.test(key)) {
        throw new KernelError(
          'VALIDATION_ERROR',
          `Secret-bearing parameter '${key}' must be supplied as a secret reference, not a raw value.`,
          400,
          context.requestId,
        );
      }
    }

    for (const [key, reference] of Object.entries(secretRefs)) {
      if (!required.has(key)) {
        throw new KernelError('VALIDATION_ERROR', `Secret reference '${key}' is not required by bridge '${definition.bridgeId}'.`, 400, context.requestId);
      }
      this.validateSecretReference(key, reference, context.requestId);
    }

    for (const key of required) {
      if (!(key in parameters) && !(key in secretRefs)) {
        throw new KernelError('VALIDATION_ERROR', `Missing required connector configuration '${key}'.`, 400, context.requestId);
      }
    }
  }

  public async configure(context: SecurityContext, request: ConfigureConnectorRequest): Promise<ConnectorConfigurationResult> {
    if (!request.tenantId) throw new KernelError('VALIDATION_ERROR', 'tenantId is required.', 400, context.requestId);
    await masterAuthority.assertTenantAuthority(context, request.tenantId, 'CONFIGURE_CONNECTOR');
    this.assertConfigurationWriteAuthority(context);

    const definition = bridgeRegistry.getBridgeDefinition(request.bridgeId);
    if (!definition) throw new KernelError('VALIDATION_ERROR', `Unknown bridge '${request.bridgeId}'.`, 404, context.requestId);
    this.validate(context, request, definition);

    const connectionId = `conn_${definition.bridgeId}`;
    const existing = await connectorConnectionRepository.getConnection(request.tenantId, connectionId);
    const now = new Date().toISOString();
    const configurationVersion = existing ? existing.configurationVersion + 1 : 1;

    const connection: ConnectorConnection = {
      connectionId,
      tenantId: request.tenantId,
      bridgeId: definition.bridgeId,
      provider: definition.provider,
      status: 'CONFIGURED',
      enabled: request.enabled ?? false,
      configurationVersion,
      parameters: { ...(request.parameters || {}) },
      secretRefs: { ...(request.secretRefs || {}) },
      configuredAt: existing?.configuredAt || now,
      updatedAt: now,
      lastHealthCheckAt: existing?.lastHealthCheckAt || null,
      lastHealthStatus: 'UNKNOWN',
      lastErrorCode: null,
    };

    await connectorConnectionRepository.saveConnection(request.tenantId, connectionId, connection);
    auditLogger.logAuditEvent(context, {
      action: 'CONNECTOR_CONFIGURATION_CHANGED',
      targetResource: `connection:${definition.bridgeId}`,
      outcome: 'ALLOWED',
      details: {
        tenantId: request.tenantId,
        bridgeId: definition.bridgeId,
        configurationVersion,
        enabled: connection.enabled,
        parameterKeys: Object.keys(connection.parameters),
        secretReferenceKeys: Object.keys(connection.secretRefs),
      },
    });
    return { connection, created: !existing, configurationVersion };
  }

  public async list(context: SecurityContext, tenantId: string): Promise<ConnectorConnection[]> {
    await masterAuthority.assertTenantAuthority(context, tenantId, 'LIST_CONNECTOR_CONFIGURATION');
    return connectorConnectionRepository.listConnections(tenantId);
  }

  public async get(context: SecurityContext, tenantId: string, bridgeId: string): Promise<ConnectorConnection | null> {
    await masterAuthority.assertTenantAuthority(context, tenantId, 'READ_CONNECTOR_CONFIGURATION');
    if (!bridgeRegistry.getBridgeDefinition(bridgeId)) {
      throw new KernelError('VALIDATION_ERROR', `Unknown bridge '${bridgeId}'.`, 404, context.requestId);
    }
    return connectorConnectionRepository.getConnection(tenantId, `conn_${bridgeId}`);
  }
}

export const connectorConfigurationService = new ConnectorConfigurationService();
