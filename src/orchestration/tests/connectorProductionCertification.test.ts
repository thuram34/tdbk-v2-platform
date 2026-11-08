import { describe, expect, it } from 'vitest';
import { bridgeRegistry } from '../bridge/registry';
import { certifyBridgeDefinition, certifyBridgeDefinitions } from '../bridge/productionCertification';

describe('connector production certification gate', () => {
  it('advertises the full implemented eTIMS VSCU operation contract without overclaiming M-Pesa support', () => {
    expect(bridgeRegistry.getBridgeDefinition('bridge_etims')?.supportedOperations).toEqual([
      'INITIALIZE', 'GET_CODES', 'GET_ITEM_CLASSES', 'GET_CUSTOMER', 'GET_BRANCHES',
      'GET_NOTICES', 'SAVE_BRANCH_CUSTOMERS', 'SAVE_BRANCH_USERS', 'SAVE_BRANCH_INSURANCE',
      'GET_ITEMS', 'SAVE_ITEM', 'SAVE_ITEM_COMPOSITION', 'SUBMIT_INVOICE', 'SAVE_SALES',
      'GET_PURCHASES', 'SAVE_PURCHASE', 'GET_IMPORTS', 'UPDATE_IMPORT', 'GET_STOCK',
      'SAVE_STOCK', 'SAVE_STOCK_MASTER',
    ]);
    expect(bridgeRegistry.getBridgeDefinition('bridge_mpesa')?.supportedOperations).toEqual(['STK_PUSH']);
  });

  it('fails closed for every seeded connector that is not production-ready', () => {
    const definitions = bridgeRegistry.listBridgeDefinitions();
    const summary = certifyBridgeDefinitions(definitions);

    expect(summary.results).toHaveLength(6);
    expect(summary.eligible).toBe(false);

    for (const result of summary.results) {
      expect(result.eligible).toBe(false);
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it('exposes every seeded connector through the tier-aware configurable front door', () => {
    for (const definition of bridgeRegistry.listBridgeDefinitions()) {
      expect(definition.frontDoor.configurable).toBe(true);
      expect(definition.frontDoor.minimumTier).toBeDefined();
      expect(definition.frontDoor.configurationFields.length).toBeGreaterThan(0);
      expect(definition.configurationRequirements).toEqual(
        definition.frontDoor.configurationFields.map((field) => field.key),
      );
    }
  });

  it('does not permit a non-idempotent, non-reconcilable side effect to certify', () => {
    const definition = {
      ...bridgeRegistry.getBridgeDefinition('bridge_bank')!,
      status: 'PRODUCTION_READY' as const,
      healthStatus: 'HEALTHY' as const,
    };

    const result = certifyBridgeDefinition(definition);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      'neither provider idempotency nor authoritative provider reconciliation is available'
    );
  });

  it('does not permit automatic UNKNOWN replay without provider idempotency', () => {
    const definition = {
      ...bridgeRegistry.getBridgeDefinition('bridge_mpesa')!,
      status: 'PRODUCTION_READY' as const,
      healthStatus: 'HEALTHY' as const,
      sideEffectCapabilities: {
        ...bridgeRegistry.getBridgeDefinition('bridge_mpesa')!.sideEffectCapabilities,
        automaticUnknownReplay: true,
      },
    };

    const result = certifyBridgeDefinition(definition);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain(
      'automatic UNKNOWN replay is enabled without provider idempotency'
    );
  });

  it('requires the Engine-derived provider operation identity', () => {
    const definition = {
      ...bridgeRegistry.getBridgeDefinition('bridge_mpesa')!,
      status: 'PRODUCTION_READY' as const,
      healthStatus: 'HEALTHY' as const,
      sideEffectCapabilities: {
        ...bridgeRegistry.getBridgeDefinition('bridge_mpesa')!.sideEffectCapabilities,
        providerOperationIdentityRequired: false,
      },
    };

    const result = certifyBridgeDefinition(definition);

    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain('provider operation identity is not required');
  });
});
