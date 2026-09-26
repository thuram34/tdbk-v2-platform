import { describe, expect, it } from 'vitest';
import { bridgeRegistry } from '../bridge/registry';
import { certifyBridgeDefinition, certifyBridgeDefinitions } from '../bridge/productionCertification';

describe('connector production certification gate', () => {
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
