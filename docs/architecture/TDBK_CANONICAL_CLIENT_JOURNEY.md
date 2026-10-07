# TDBK V2 — Canonical Client Journey Trace

Date: 2026-09-27
Status: ENGINEERING TRACE — repository verified
Source of truth: main repository inspected 2026-09-27

## 1. Canonical customer principle

> The client visits TDBK once for onboarding. TDBK provisions the client's digital business space. From then on, the client operates inside that space.

TDBK is the platform/factory. Workspace is the customer's operating destination. DBK is an internal/domain runtime identity and must not become a repeated customer-facing destination.

## 2. Actual current path

Unauthenticated:

DbkExperienceFlow -> LoginScreen -> authenticated session

Authenticated:

AuthContext -> listDbks() -> OwnerCommandCenter

New business:

OwnerCommandCenter -> BusinessDiscovery -> POST /api/platform/provision

Provisioning:

server.ts -> provisioningService.provisionDbk()

Provisioning workflow:

1. Validate identity
2. Validate blueprint
3. Initialize Business DNA
4. Assign entitlement
5. Initialize capabilities
6. Initialize branch topology
7. Create workspace state
8. Verify and activate

Runtime:

dbkId -> DbkApp -> DbkShell -> /api/experience/resolve/:dbkId -> ExperienceResolver

Transaction:

Experience command -> EXECUTE_SALE -> SaleTransactionService -> Firestore transaction + outbox event

## 3. What is already connected

- Authentication and owner identity initialization exist.
- Business discovery consumes registered blueprints.
- Provisioning has server authority, idempotency and a persistent workflow.
- Business DNA is initialized durably.
- Capabilities are initialized and entitlement-aware.
- Branch topology is created.
- Workspace state is compiled.
- DBK is activated only after the provisioning workflow completes.
- ExperienceResolver provides the authenticated workspace projection.
- SaleTransactionService enforces tenant, branch and RBAC boundaries.
- Sale + inventory mutation + outbox event are committed transactionally.

## 4. Current post-provisioning route

After authoritative provisioning and Business DNA verification, the frontend must render a provisioned-business handoff before entering the operating workspace. The handoff receives the authoritative business identity/capabilities returned by provisioning; it is not a local success state. `Enter my workspace` then routes to the resolved DBK workspace while OwnerCommandCenter remains the multi-business portfolio surface.

Workspace setup sequence:

1. Provisioned business handoff
2. Workspace resolution
3. Connector Hub configuration: M-Pesa, eTIMS, WhatsApp, SMS, Email and Bank
4. Connector health/readiness verification
5. RBAC / People & Roles configuration
6. Workspace readiness confirmation
7. Real business operation through Engine -> runtime -> persistence -> events

Connector configuration is tenant-scoped and authoritative. Secrets are represented only as provider references. Connector readiness requires entitlement, configuration, registered adapter, enabled connection and healthy provider state. RBAC is tenant/branch-scoped and must be enforced server-side; UI visibility is not authorization.

5. Historical finding: post-provisioning routing

The historical trace described a post-provisioning portfolio detour. The current `main` implementation has since been corrected: `BusinessDiscovery.onProvisioned()` sets the authoritative `dbkId` and `App.tsx` renders `DbkApp` directly. OwnerCommandCenter remains the multi-business management surface. This is therefore CLOSED on the current branch.

## 6. Critical finding: DBK terminology

Customer-facing onboarding currently exposes language such as:

- Existing Digital Business
- DBK will prepare a business space
- DBK-facing/internal concepts in surrounding experience documentation

Customer vocabulary should be:

- TDBK = the platform
- Account = identity
- Business = organization
- Workspace = operating home
- Action / Transaction = what the customer does

DBK, tenant, provisioning, runtime and kernel should remain engineering/platform vocabulary unless an administrative screen genuinely requires them.

## 7. Historical finding: app.tx

Repository search did not locate a literal `app.tx` file. This naming observation is not a runtime blocker: the authoritative transaction contract is already represented by `ExperienceCommandRequest` / `EXECUTE_SALE` and `SaleTransactionService`.

The actual operational sale path is:

Experience UI -> /api/experience/command -> ExperienceResolver -> EXECUTE_SALE -> SaleTransactionService

This means transaction execution exists, but the canonical app.tx customer transaction surface has not yet been established by name or contract.

The engineering team must define the canonical transaction lifecycle rather than allowing separate UI paths to invent their own transaction behavior.

## 8. Transaction completion contract

A customer operation is not complete merely because a button was clicked or an HTTP request returned.

Canonical lifecycle:

REQUESTED -> ACCEPTED -> PROCESSING -> PROVIDER RESULT (when applicable) -> CONFIRMED -> PERSISTED -> PROJECTED -> CUSTOMER SEES CONFIRMATION

For provider-backed operations, provider authority and reconciliation must be explicit.

## 9. Nine-layer trace

Client intent
  -> User Interface
  -> UI/Experience Engine
  -> Experience Services
  -> Runtime command
  -> Kernel authorization and tenant boundary
  -> Business state / persistence
  -> Event / workflow
  -> External bridge where required
  -> Provider result / callback
  -> Reconciliation
  -> Confirmed state
  -> Workspace projection

Every transition must have an actual repository file/function, input, output, state transition, security boundary and failure path.

## 10. Canonical acceptance test

Scenario: a new Mombasa hardware customer registers once, creates the business, receives a provisioned workspace, enters it directly, performs a sale, receives the authoritative result, and sees the confirmed transaction in the workspace.

The trace must cover:

UI -> Auth -> Kernel -> Provisioning -> Business DNA -> Capabilities -> Workspace -> Experience -> Runtime -> Transaction -> Persistence -> Event/Outbox -> Bridge -> Provider result -> Reconciliation -> Confirmation -> UI

No layer may be skipped.
No layer may claim completion without authoritative evidence.

## 11. Engineering rule

Do not add major features merely because individual modules work.

A feature is operational only when its complete client journey can be traced from customer intent through authoritative state change and, where applicable, external provider result and reconciliation, back to a confirmed customer-visible state.

## 12. Immediate engineering priorities

1. Maintain direct post-provisioning entry into the newly provisioned workspace (implemented on the active completion branch; CI/runtime proof still required).
2. Keep customer-facing vocabulary as Account / Business / Workspace / Action; DBK/tenant/runtime remain platform vocabulary.
3. Configure and verify the unified Connector Hub after workspace provisioning: M-Pesa, eTIMS, WhatsApp, SMS, Email and Bank.
4. Complete RBAC / People & Roles verification, including tenant isolation, branch scope, role assignment/revocation and server-side permission enforcement.
5. Keep one canonical transaction contract over the existing ExperienceResolver transaction path; a literal `app.tx` filename is not required.
6. Trace M-Pesa, eTIMS and WhatsApp operations from transaction initiation through provider result, reconciliation and final confirmation.
7. Add an end-to-end client-journey test that fails if any authoritative transition is missing.
8. Use this journey as the acceptance gate for future TDBK capabilities.