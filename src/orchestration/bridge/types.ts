/**
 * TDBK V2 EXTERNAL BRIDGE PRIMITIVES & TYPE DEFINITIONS
 * Architectural Layer: LAYER 6 — BRIDGE ARCHITECTURE
 */

import { SecurityContext } from '../../kernel/types';
import { SubscriptionTier } from '../../capability/types';

export type BridgeImplementationStatus =
  | 'DEFINED'
  | 'MOCK'
  | 'IMPLEMENTED'
  | 'PRODUCTION_READY';

export type BridgeHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNAVAILABLE';

export type NormalizedBridgeResultStatus =
  | 'SUCCESS'
  | 'PENDING'
  | 'FAILED'
  | 'UNKNOWN'
  | 'REQUIRES_RECONCILIATION';

export interface BridgeSideEffectCapabilities {
  /** Provider accepts a caller-controlled stable key and guarantees deduplication for it. */
  providerIdempotency: boolean;
  /** Provider exposes authoritative state recovery after an ambiguous outcome. */
  providerReconciliation: boolean;
  /** True only where provider-side idempotency makes automatic UNKNOWN replay safe. */
  automaticUnknownReplay?: boolean;
  /** True for side-effecting operations whose recovery identity must remain the Engine execution-derived identity. */
  providerOperationIdentityRequired?: boolean;
}

export interface NormalizedBridgeResult<T = unknown> {
  status: NormalizedBridgeResultStatus;
  provider: string;
  providerReference: string;
  amount?: number;
  currency?: string;
  occurredAt: string;
  correlationId: string;
  data?: T;
  errorDetails?: string;
}

export interface CallbackVerificationResult {
  verified: boolean;
  providerIdentity: string;
  reason?: string;
  replayProtectionPassed: boolean;
  tenantId?: string;
  correlationId?: string;
}

export interface BridgeConfigurationField {
  key: string;
  label: string;
  type: 'text' | 'secret' | 'url' | 'boolean' | 'number';
  required: boolean;
}

export interface BridgeFrontDoorPolicy {
  configurable: true;
  minimumTier: SubscriptionTier;
  configurationFields: BridgeConfigurationField[];
}

export interface BridgeDefinition {
  bridgeId: string;
  provider: string;
  bridgeVersion: string;
  capabilityId: string;
  supportedOperations: string[];
  status: BridgeImplementationStatus;
  configurationRequirements: string[];
  healthStatus: BridgeHealthStatus;
  registeredAt: string;
  sideEffectCapabilities: BridgeSideEffectCapabilities;
  /** Universal front-door configuration contract; entitlement remains authoritative in Layer 4. */
  frontDoor?: BridgeFrontDoorPolicy;
}

export interface Bridge<TReq = any, TRes = any, TCB = any> {
  bridgeId: string;
  provider: string;
  capabilityId: string;
  version: string;
  sideEffectCapabilities: BridgeSideEffectCapabilities;
  health(context: SecurityContext): Promise<{ status: BridgeHealthStatus; details?: Record<string, unknown> }>;
  execute(context: SecurityContext, operation: string, payload: TReq): Promise<NormalizedBridgeResult<TRes>>;
  handleCallback(context: SecurityContext, rawCallback: TCB): Promise<NormalizedBridgeResult<TRes>>;
  verifyCallback(rawCallback: TCB, signatureHeader?: string): Promise<CallbackVerificationResult>;
  normalizeResponse(rawResponse: unknown): NormalizedBridgeResult<TRes>;
}
