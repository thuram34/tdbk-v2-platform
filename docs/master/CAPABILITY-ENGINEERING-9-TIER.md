# TDBK V2 Capability Engineering Standard — 9-Tier Contract

A TDBK capability is an end-to-end business contract. It is not complete because a menu renders, a unit test passes, or a provider API responds.

## Nine accountable tiers
1. Kernel — authority, identity, tenant/branch isolation, audit.
2. Platform Services — DBK provisioning and persistent configuration.
3. Blueprint / Business DNA — business compatibility and truth.
4. Capabilities / Entitlements — lifecycle, entitlement and dependencies.
5. DBK Runtime — authoritative commands, validation, persistence and recovery.
6. Workflows / Events / Bridges — provider adapters, callbacks, idempotency, retries and reconciliation.
7. Experience Services — business workflow and state projection.
8. UI Engine — dynamic surfaces driven by capability contracts.
9. User Interface — human interaction, state, errors and next action.

## Stable API rule
The TDBK capability API is the stable boundary. Provider APIs are implementation details behind adapters.
User -> Experience -> Capability API -> Runtime -> Provider Adapter -> Provider
No UI, business module or workflow may depend directly on a provider-specific API.

## Configuration rule
Configuration is data, not capability logic. Capability configuration must be versioned, validated, DBK/tenant scoped, and represented through configuration keys or secret references. Provider replacement must not require changing business callers.

## Signing reference
Digital signing is exposed through the provider-neutral document-management contract:
SIGN_DOCUMENT
VERIFY_SIGNATURE
GET_SIGNING_STATUS
The provider is selected through signing.provider.

Authoritative flow:
User -> Experience -> Kernel Authority -> Entitlement -> Runtime -> Signing Contract -> Configured Adapter -> Provider

Return flow:
Provider Result/Callback -> Verification -> Idempotency -> Runtime State -> Audit -> Event -> Experience/UI Projection

A provider success response is not automatically TDBK truth; TDBK validates, persists and reconciles it.

## Production gate
A capability is production-ready only when all nine tier checks pass and its API contract is stable, configurable and provider-independent. Tenant/branch authority, persistence, idempotency, audit, recovery, restart safety, observability and end-to-end regression coverage are mandatory.
