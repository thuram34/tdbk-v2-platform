# TDBK DNA & Blueprint Gap Register — v1.0.0

**Status:** Open engineering decisions and evidence register  
**Date:** 2026-11-15  
**Rule:** A gap is closed only with code, tests and/or operational evidence. A written decision alone closes a documentation ambiguity, not an implementation gap.

## 1. Confirmed repository facts at inspection

- `src/blueprint/types.ts` currently defines nine `SectorType` values and compact `BusinessDNA` / `Blueprint` interfaces.
- `src/blueprint/catalog.ts` contains initial blueprints including school, hardware and retail archetypes.
- `src/persistence/types.ts` explicitly defines the invariant `tenantId === dbkId` for tenant boundaries.
- `src/persistence/firestore/firestoreClient.ts` enforces `/tenants/{tenantId}/...` as the canonical server persistence namespace.
- `BusinessDnaRepository` persists DNA at `/tenants/{tenantId}/configuration/business_dna`; Firebase custom claims and Firestore rules use the top-level `tenantId` claim.
- Therefore `tenantId` is the storage/security-boundary name and `dbkId` is the domain name for the same identifier. This is an established mapping, not an unresolved ID mismatch.
- Existing journey documentation traces authentication, business discovery, provisioning, workspace experience resolution and a sale transaction path.
- Existing capability ledger records 83 catalogue entries: 10 labelled IMPLEMENTED, 28 DEFINED and 45 SPECIFIED at the ledger's stated baseline. These are not production-readiness counts.
- Existing implementation and capability ledgers explicitly require production, tenant-isolation, provider, workflow and deployment evidence.

## 2. Gap register

| ID | Gap / ambiguity | Risk | Required action | Closure evidence | Priority |
|---|---|---|---|---|---|
| G-01 | Enforce the established `tenantId === dbkId` invariant consistently across all APIs, auth claims, repositories, rules and domain objects | Cross-tenant data leakage or broken lookups if any boundary accepts a divergent identifier | Preserve `dbkId` as domain terminology and `tenantId` as storage/security terminology; add boundary assertions and route-level negative tests | Identity contract tests, cross-tenant API tests, Firestore rule tests | P0 |
| G-02 | DNA is a compact aggregate, not the full 16-domain model | Missing operational context and untyped config | Introduce domain schemas/repositories incrementally; keep sensitive data and secrets out of root DNA | Schema validation, provenance, revision and migration tests | P1 |
| G-03 | Sector enum narrower than market archetype map | Industry-specific branching and catalogue gaps | Separate industry/subsector/archetype from implementation enum; publish archetype registry | Registry validation and representative archetype tests | P1 |
| G-04 | Blueprint fields do not yet express all workflow/rule/entity/compliance contracts | Incomplete generated workspaces | Expand schema in a backward-compatible versioned contract | Blueprint validator and publish gate | P1 |
| G-05 | Capability catalogue declarations can be mistaken for delivered functionality | False sales/readiness claims | Reconcile IDs, aliases, dependencies, entitlement, runtime and acceptance evidence | Capability evidence ledger with verified status | P1 |
| G-06 | Blueprint default vs entitlement vs enabled vs configured vs operational are easy to conflate | Unauthorised or broken activation | Model each state separately in resolver and provisioning | Unit/integration tests for every state combination | P1 |
| G-07 | Multiple subscription naming models exist across prior plans and current code | Pricing/entitlement inconsistency | Keep revenue pillars separate from plan tiers; centralise canonical plan IDs and aliases | Plan registry, migration map, pricing tests | P1 |
| G-08 | Product repositories and deployments have different maturity | Duplicate logic and unclear data ownership | Inventory product repos; map contracts, data owner, release, deployment and migration | Product portfolio register with verified evidence | P1 |
| G-09 | UI card/button implementation may not be bound to real commands | Dead controls or misleading confirmations | Trace each visible action through command, permission, runtime, persistence and result | Button/action acceptance matrix and E2E tests | P1 |
| G-10 | External connector adapter code may be mistaken for live provider integration | Failed or false payment/tax/communication outcomes | Verify credentials, sandbox/production, callbacks, signatures, idempotency and reconciliation | Provider evidence and end-to-end test | P0 |
| G-11 | Durable workflow/event behavior requires production failure testing | Lost/duplicate actions and stuck processes | Verify outbox, leases, retry, dead-letter, recovery and compensation | Fault-injection tests and production telemetry | P0 |
| G-12 | AI fallback paths can generate synthetic operational narratives | Fabricated invoice/payment/vendor facts | Make deterministic provider test-only; production unavailable must fail explicitly | Regression tests prove no fabricated authoritative facts | P0 |
| G-13 | UI/experience projection could be confused with authority | Client-side permission bypass | Re-authorise every command at runtime; projection is not access control | Negative API authorization tests | P0 |
| G-14 | Kenya defaults could be treated as universal assumptions | Incorrect tax, currency and locale behavior | Country/blueprint-based defaults with explicit configuration | Multi-country config tests and tax rules review | P2 |
| G-15 | Production deployment and recovery evidence is separate from CI | Unverified production claims | Record deployed revision, health, secrets, logs, alerts, backup and restore drill | Deployment evidence and recovery exercise | P0 |

## 3. Decisions adopted in this baseline

1. Nine-layer architecture is authoritative. Earlier six-layer diagrams are explanatory abstractions, not a competing architecture.
2. Blueprint is a versioned template; Business DNA is a versioned organisation-specific configuration; capability resolution is a separate activation decision; runtime owns business execution.
3. Industry → subsector → archetype → blueprint version is the canonical classification chain.
4. Three revenue pillars (Connectivity, Managed IT, Sovereign Enterprise) are distinct from subscription tiers.
5. Customer-facing terms are Business, Workspace, Feature, Service and Integration; internal platform terms remain behind the scenes.
6. UI visibility never substitutes for server-side authorisation.
7. A provider adapter or successful CI run is not proof of a live production integration.
8. Product repositories remain separate where appropriate and integrate through explicit contracts and data ownership.
9. Dynamic customer catalogue, pricing, variants, stock and configuration must not be hardcoded.
10. No feature is operational without an end-to-end acceptance trace.

## 4. Immediate execution order

### P0 — protect correctness
- G-01 enforce and verify the established identity mapping across every boundary
- G-10 provider integration evidence
- G-11 durable workflow and event failure tests
- G-12 AI provider fallback safety
- G-13 command-level authorization
- G-15 production and recovery verification

### P1 — complete the DNA/blueprint contract
- G-02 versioned DNA domains
- G-03 archetype taxonomy
- G-04 blueprint schema and validator
- G-05 capability evidence ledger
- G-06 capability state semantics
- G-07 subscription plan reconciliation
- G-08 product integration map
- G-09 UI action traceability

### P2 — scale safely
- G-14 multi-country configuration
- Broader archetype coverage and marketplace ecosystem
- Support, analytics and AI autonomy maturity

## 5. Explicit non-claims

This register does not claim:
- all DNA domains are implemented;
- all blueprint archetypes are available;
- every catalogue capability works end-to-end;
- M-Pesa, eTIMS, WhatsApp or bank connectors are certified/live;
- every product repository has been reconciled;
- production deployment, backup restoration or disaster recovery has been verified.
