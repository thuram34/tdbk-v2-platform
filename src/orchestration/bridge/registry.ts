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
const frontDoor = (minimumTier: 'FREE' | 'FOUNDATION' | 'GROWTH' | 'PRO' | 'ENTERPRISE', keys: string[]) => ({
  configurable: true as const,
  minimumTier,
  configurationFields: keys.map((key) => ({ key, label: key.replace(/_/g, ' '), type: /secret|password|token|passkey|key/i.test(key) ? 'secret' as const : /url/i.test(key) ? 'url' as const : /port/i.test(key) ? 'number' as const : 'text' as const, required: true })),
});


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
        supportedOperations: ['STK_PUSH'],
        status: 'IMPLEMENTED',
        configurationRequirements: ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY', 'MPESA_SHORTCODE', 'MPESA_CALLBACK_URL'],
        healthStatus: 'UNAVAILABLE',
        registeredAt: new Date().toISOString(),
        sideEffectCapabilities: {
          providerIdempotency: false,
          providerReconciliation: false,
          automaticUnknownReplay: false,
          providerOperationIdentityRequired: true,
        },
        frontDoor: frontDoor('FOUNDATION', ['MPESA_CONSUMER_KEY', 'MPESA_CONSUMER_SECRET', 'MPESA_PASSKEY', 'MPESA_SHORTCODE', 'MPESA_CALLBACK_URL']),
      },

      {
        bridgeId: 'bridge_etims',
        provider: 'KRA_ETIMS',
        bridgeVersion: 'v2.0',
        capabilityId: 'etims_compliance',
        supportedOperations: ['INITIALIZE', 'GET_CODES', 'GET_ITEM_CLASSES', 'GET_CUSTOMER', 'GET_BRANCHES', 'GET_NOTICES', 'SAVE_BRANCH_CUSTOMERS', 'SAVE_BRANCH_USERS', 'SAVE_BRANCH_INSURANCE', 'GET_ITEMS', 'SAVE_ITEM', 'SAVE_ITEM_COMPOSITION', 'SUBMIT_INVOICE', 'SAVE_SALES', 'GET_PURCHASES', 'SAVE_PURCHASE', 'GET_IMPORTS', 'UPDATE_IMPORT', 'GET_STOCK', 'SAVE_STOCK', 'SAVE_STOCK_MASTER'],
        status: 'IMPLEMENTED',
        configurationRequirements: ['ETIMS_PIN', 'ETIMS_DEVICE_SERIAL', 'ETIMS_BRANCH_CODE', 'ETIMS_VSCU_BASE_URL'],
        healthStatus: 'UNAVAILABLE',
        registeredAt: new Date().toISOString(),
        sideEffectCapabilities: {
          providerIdempotency: false,
          providerReconciliation: false,
          automaticUnknownReplay: false,
          providerOperationIdentityRequired: true,
        },
        frontDoor: frontDoor('GROWTH', ['ETIMS_PIN', 'ETIMS_DEVICE_SERIAL', 'ETIMS_BRANCH_CODE', 'ETIMS_VSCU_BASE_URL']),
      },
      {
        bridgeId: 'bridge_whatsapp',
        provider: 'META_WHATSAPP',
        bridgeVersion: 'v2.0',
        capabilityId: 'whatsapp_automation',
        supportedOperations: ['SEND_TEMPLATE', 'SEND_TEXT', 'VERIFY_DELIVERY', 'SUBSCRIBE_WABA'],
        status: 'IMPLEMENTED',
        configurationRequirements: ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WABA_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN'],
        healthStatus: 'UNAVAILABLE',
        registeredAt: new Date().toISOString(),
        sideEffectCapabilities: {
          providerIdempotency: false,
          providerReconciliation: false,
          automaticUnknownReplay: false,
          providerOperationIdentityRequired: true,
        },
        frontDoor: frontDoor('GROWTH', ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_WABA_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_APP_SECRET', 'WHATSAPP_VERIFY_TOKEN']),
      },
      {
        bridgeId: 'bridge_email',
        provider: 'SYSTEM_SMTP',
        bridgeVersion: 'v1.0',
        capabilityId: 'email_dispatch',
        supportedOperations: ['SEND_EMAIL', 'SEND_TEMPLATE_EMAIL'],
        status: 'MOCK',
        configurationRequirements: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD'],
        healthStatus: 'UNAVAILABLE',
        registeredAt: new Date().toISOString(),
        sideEffectCapabilities: {
          providerIdempotency: false,
          providerReconciliation: false,
          automaticUnknownReplay: false,
          providerOperationIdentityRequired: true,
        },
        frontDoor: frontDoor('FOUNDATION', ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD']),
      },
      {
        bridgeId: 'bridge_sms',
        provider: 'AFRICAS_TALKING',
        bridgeVersion: 'v1.0',
        capabilityId: 'sms_bridge',
        supportedOperations: ['SEND_SMS', 'BULK_SMS'],
        status: 'MOCK',
        configurationRequirements: ['SMS_API_KEY', 'SMS_USERNAME', 'SMS_SENDER_ID'],
        healthStatus: 'UNAVAILABLE',
        registeredAt: new Date().toISOString(),
        sideEffectCapabilities: {
          providerIdempotency: false,
          providerReconciliation: false,
          automaticUnknownReplay: false,
          providerOperationIdentityRequired: true,
        },
        frontDoor: frontDoor('GROWTH', ['SMS_API_KEY', 'SMS_USERNAME', 'SMS_SENDER_ID']),
      },
      {
        bridgeId: 'bridge_bank',
        provider: 'GENERIC_BANK',
        bridgeVersion: 'v1.0',
        capabilityId: 'bank_bridge',
        supportedOperations: ['INITIATE_TRANSFER', 'VERIFY_ACCOUNT', 'QUERY_STATUS'],
        status: 'MOCK',
        configurationRequirements: ['BANK_API_KEY', 'BANK_CLIENT_ID', 'BANK_ACCOUNT_NO'],
        healthStatus: 'UNAVAILABLE',
        registeredAt: new Date().toISOString(),
        sideEffectCapabilities: {
          providerIdempotency: false,
          providerReconciliation: false,
          automaticUnknownReplay: false,
          providerOperationIdentityRequired: true,
        },
        frontDoor: frontDoor('PRO', ['BANK_API_KEY', 'BANK_CLIENT_ID', 'BANK_ACCOUNT_NO']),
      },
    ];

    for (const b of defaultBridges) {
      this.bridgeDefinitions.set(b.bridgeId, b);
    }
  }

  /**
   * Normalizes the Gate 04 policy at the authoritative registry boundary.
   * Legacy adapters may expose only the original two provider capability flags;
   * conservative defaults prevent UNKNOWN replay and require the Engine identity.
   */
  private normalizeSideEffectCapabilities(definition: BridgeDefinition): BridgeDefinition {
    return {
      ...definition,
      sideEffectCapabilities: {
        ...definition.sideEffectCapabilities,
        automaticUnknownReplay: definition.sideEffectCapabilities.automaticUnknownReplay ?? false,
        providerOperationIdentityRequired: definition.sideEffectCapabilities.providerOperationIdentityRequired ?? true,
      },
    };
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

    const normalizedDefinition = this.normalizeSideEffectCapabilities(definition);
    this.bridgeDefinitions.set(normalizedDefinition.bridgeId, normalizedDefinition);

    auditLogger.logEvent(
      'SECURITY_CONFIGURATION_CHANGE',
      context.principal.id,
      'REGISTER_BRIDGE_DEFINITION',
      `bridge:${normalizedDefinition.bridgeId}`,
      'ALLOWED',
      {
        tenantId: null,
        requestId: context.requestId,
        details: { provider: normalizedDefinition.provider, status: normalizedDefinition.status },
      }
    );

    return normalizedDefinition;
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
   * Gets an executable bridge adapter instance by ID.
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
