/**
 * TDBK V2 BRIDGE REGISTRY & GOVERNANCE ENGINE
 * Architectural Layer: LAYER 6 — BRIDGE ARCHITECTURE
 */

import {
  Bridge,
  BridgeDefinition,
} from './types';
import { SecurityContext } from '../../kernel/types';
import { auditLogger } from '../../kernel/audit/auditLogger';
import { KernelError } from '../../kernel/errors/kernelErrors';

class BridgeRegistryService {
  private bridgeDefinitions: Map<string, BridgeDefinition> = new Map();
  private bridgeInstances: Map<string, Bridge> = new Map();

  constructor() {
    this.seedDefaultBridges();
  }

  /**
   * Seeds default platform bridge contracts and registry definitions.
   */
  private seedDefaultBridges(): void {
    const defaultBridges: BridgeDefinition[] = [
      {
        bridgeId: 'bridge_mpesa',
        provider: 'SAFARICOM_MPESA',
        bridgeVersion: 'v1.0',
        capabilityId: 'mpesa_bridge',
        supportedOperations: ['STK_PUSH', 'C2B_SIMULATION', 'QUERY_TRANSACTION', 'RECONCILE'],
        status: 'MOCK',
        configurationRequirements: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY', 'MPESA_SHORTCODE'],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      },
      {
        bridgeId: 'bridge_etims',
        provider: 'KRA_ETIMS',
        bridgeVersion: 'v1.0',
        capabilityId: 'etims_bridge',
        supportedOperations: ['SUBMIT_INVOICE', 'CANCEL_INVOICE', 'QUERY_INVOICE_STATUS'],
        status: 'MOCK',
        configurationRequirements: ['ETIMS_PIN', 'ETIMS_DEVICE_SERIAL', 'ETIMS_BRANCH_CODE'],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      },
      {
        bridgeId: 'bridge_whatsapp',
        provider: 'META_WHATSAPP',
        bridgeVersion: 'v1.0',
        capabilityId: 'whatsapp_bridge',
        supportedOperations: ['SEND_TEMPLATE', 'SEND_TEXT', 'VERIFY_DELIVERY'],
        status: 'MOCK',
        configurationRequirements: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN'],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      },
      {
        bridgeId: 'bridge_email',
        provider: 'SYSTEM_SMTP',
        bridgeVersion: 'v1.0',
        capabilityId: 'email_bridge',
        supportedOperations: ['SEND_EMAIL', 'SEND_TEMPLATE_EMAIL'],
        status: 'MOCK',
        configurationRequirements: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      },
      {
        bridgeId: 'bridge_sms',
        provider: 'AFRICAS_TALKING',
        bridgeVersion: 'v1.0',
        capabilityId: 'sms_bridge',
        supportedOperations: ['SEND_SMS', 'BULK_SMS'],
        status: 'MOCK',
        configurationRequirements: ['SMS_API_KEY', 'SMS_USERNAME', 'SMS_SENDER_ID'],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      },
      {
        bridgeId: 'bridge_bank',
        provider: 'GENERIC_BANK',
        bridgeVersion: 'v1.0',
        capabilityId: 'bank_bridge',
        supportedOperations: ['INITIATE_TRANSFER', 'VERIFY_ACCOUNT', 'QUERY_STATUS'],
        status: 'MOCK',
        configurationRequirements: ['BANK_API_KEY', 'BANK_CLIENT_ID', 'BANK_ACCOUNT_NO'],
        healthStatus: 'HEALTHY',
        registeredAt: new Date().toISOString(),
      },
    ];

    for (const b of defaultBridges) {
      this.bridgeDefinitions.set(b.bridgeId, b);
    }
  }

  /**
   * Registers or updates a bridge definition (MASTER AUTHORITY ONLY).
   */
  public registerBridgeDefinition(
    context: SecurityContext,
    definition: BridgeDefinition
  ): BridgeDefinition {
    if (!context.principal.isMaster) {
      auditLogger.logEvent(
        'AUTHORIZATION_DENIED',
        context.principal.id,
        'REGISTER_BRIDGE_DEFINITION',
        `bridge:${definition.bridgeId}`,
        'DENIED',
        {
          tenantId: context.principal.tenantId,
          requestId: context.requestId,
          details: { reason: 'DBK Tenants are unauthorized to mutate Platform Bridge definitions' },
        }
      );
      throw new KernelError(
        'AUTHORIZATION_ERROR',
        'Authorization Denied: Only Master Admin can manage platform Bridge definitions',
        403,
        context.requestId
      );
    }

    this.bridgeDefinitions.set(definition.bridgeId, definition);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      'REGISTER_BRIDGE_DEFINITION',
      `bridge:${definition.bridgeId}`,
      'ALLOWED',
      {
        tenantId: null,
        requestId: context.requestId,
        details: { provider: definition.provider, status: definition.status },
      }
    );

    return definition;
  }

  /**
   * Binds an executable Bridge adapter instance to the registry.
   */
  public registerBridgeInstance(bridge: Bridge): void {
    this.bridgeInstances.set(bridge.bridgeId, bridge);
  }

  /**
   * Gets a bridge definition by ID.
   */
  public getBridgeDefinition(bridgeId: string): BridgeDefinition | undefined {
    return this.bridgeDefinitions.get(bridgeId);
  }

  /**
   * Gets an executable bridge instance by ID.
   */
  public getBridgeInstance(bridgeId: string): Bridge | undefined {
    return this.bridgeInstances.get(bridgeId);
  }

  /**
   * Lists all platform bridge definitions.
   */
  public listBridgeDefinitions(): BridgeDefinition[] {
    return Array.from(this.bridgeDefinitions.values());
  }

  public clearStoreForTesting(): void {
    this.bridgeDefinitions.clear();
    this.bridgeInstances.clear();
    this.seedDefaultBridges();
  }
}

export const bridgeRegistry = new BridgeRegistryService();
