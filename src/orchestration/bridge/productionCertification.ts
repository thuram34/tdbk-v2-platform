import { BridgeDefinition } from './types';

export interface ConnectorCertificationResult {
  bridgeId: string;
  provider: string;
  eligible: boolean;
  reasons: string[];
}

export interface ConnectorCertificationSummary {
  eligible: boolean;
  results: ConnectorCertificationResult[];
}

export function certifyBridgeDefinition(definition: BridgeDefinition): ConnectorCertificationResult {
  const reasons: string[] = [];

  if (definition.status !== 'PRODUCTION_READY') {
    reasons.push(`implementation status is ${definition.status}`);
  }

  if (definition.healthStatus !== 'HEALTHY') {
    reasons.push(`health status is ${definition.healthStatus}`);
  }

  const sideEffects = definition.sideEffectCapabilities;
  if (sideEffects.providerOperationIdentityRequired !== true) {
    reasons.push('provider operation identity is not required');
  }

  if (sideEffects.providerIdempotency !== true && sideEffects.providerReconciliation !== true) {
    reasons.push('neither provider idempotency nor authoritative provider reconciliation is available');
  }

  if (sideEffects.automaticUnknownReplay === true && sideEffects.providerIdempotency !== true) {
    reasons.push('automatic UNKNOWN replay is enabled without provider idempotency');
  }

  return {
    bridgeId: definition.bridgeId,
    provider: definition.provider,
    eligible: reasons.length === 0,
    reasons,
  };
}

export function certifyBridgeDefinitions(definitions: BridgeDefinition[]): ConnectorCertificationSummary {
  const results = definitions.map(certifyBridgeDefinition);
  return {
    eligible: results.length > 0 && results.every((result) => result.eligible),
    results,
  };
}
