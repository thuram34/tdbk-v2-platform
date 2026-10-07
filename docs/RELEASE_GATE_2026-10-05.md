# TDBK V2 — Release Gate — 2026-10-05

## Code gate

- Main head: d64ed359ad4776bcd20ef2e04cb68cf8876533a5
- Finalization PR #304: merged
- CI run #809: PASS
- Typecheck: PASS
- Lint: PASS
- Capability engineering gate: PASS
- Flow orchestration gate: PASS
- Full test suite: PASS
- Production build: PASS
- Production Docker validation: PASS

## Commercial authority

Workspace provisioning is separated from paid entitlement. A BUSINESS_OWNER cannot self-grant a paid tier at provisioning time. Paid capability activation requires durable subscription entitlement and payment-confirmed activation.

## Bridge code gate

Priority bridges are registered as executable adapters:
- M-Pesa / Safaricom Daraja
- KRA eTIMS VSCU
- Meta WhatsApp Cloud API

Connector configuration is tenant-scoped through the Connection Hub and durable Firestore connector state.

## Provider certification gate

Code readiness is not the same as external provider certification. Before declaring a customer tenant production-ready, the tenant-specific connection must have valid provider configuration, successful health verification, and any required Safaricom/Meta/KRA sandbox or production onboarding completed.

The platform release gate therefore has two levels:
1. Platform code release: automated CI + runtime readiness.
2. Tenant bridge activation: provider credentials + provider health + onboarding/certification evidence.

## Client journey gate

Canonical journey covered by the acceptance suite:

Owner -> provision business -> workspace activation -> durable subscription/payment confirmation -> capability entitlement -> workspace resolution -> operational sale -> authoritative Firestore state + outbox event.

The UI's new-business flow is designed to land directly in the newly provisioned workspace while preserving the Owner Command Center for existing multi-business portfolios.

## Current release posture

The platform codebase is green on the automated release gate. External provider onboarding remains a tenant/environment gate, not a reason to fabricate a global GREEN bridge status.
