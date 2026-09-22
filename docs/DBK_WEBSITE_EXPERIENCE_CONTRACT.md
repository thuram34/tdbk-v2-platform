# DBK Website Experience Contract

**Status:** ACTIVE — DBK domain contract
**Scope:** Public DBK/TDBK organization experience only
**Authority:** TDBK Engine remains authoritative for identity, tenancy, DBK identity, Business DNA, capabilities, entitlements, permissions, workflows, transactions, payments, receipts, events, AI orchestration, connectors, audit, security, and authoritative projections.
**Owner:** DBK Website Specialist
**Created:** 2026-09-22

## 1. Purpose

DBK is the organization-facing experience layer of TDBK. It guides an organization from discovery through registration, context definition, capability selection, activation, operation, and growth.

DBK is not a second business engine and must not create replacement authority for Engine-owned state.

## 2. Core Journey

PUBLIC

Landing -> Intent -> Solution -> Industry -> Capability -> Register/Enter

ONBOARDING

Account -> Organization -> Business Context -> Engine Recommendation -> Capability Selection -> Engine Provisioning -> Workspace

AUTHENTICATED

Owner Portfolio -> DBK Selection -> Engine Workspace Projection -> Operate -> Grow

PUBLIC ORGANIZATION

Engine Public Projection -> DBK Public Experience -> Authorized discovery/handoff to Sokoni

## 3. Authority Boundary

### DBK may own

- UI state
- Presentation and navigation
- Forms and interaction state
- Draft presentation state where appropriate
- Public presentation of Engine-authorized data
- Organization-facing interaction and progress states
- Mobile/responsive experience
- Human-readable error, empty, loading, and provisioning states

### DBK must not own

- Identity authority
- Tenant records or tenancy authority
- Business/DBK master records
- Business DNA authority
- Capability definitions or capability authority
- Subscription/entitlement authority
- Permission/RBAC authority
- Transaction truth
- Payment truth
- Receipt authority
- Workflow/event authority
- AI orchestration authority
- Audit authority
- Connector authority
- Public organization master records

If an Engine capability is missing or its DBK-facing contract is not verified, DBK must stop at the boundary and record `MASTER REVIEW REQUIRED`. It must not invent a local API or datastore.

## 4. Repository-Verified Engine Dependencies

The following were inspected in the repository before this contract was recorded.

| Requirement | Existing Engine evidence | DBK decision |
|---|---|---|
| Business DNA | `src/blueprint/dnaManager.ts` | Consume; do not duplicate |
| Capability discovery | `src/capability/discovery.ts` | Consume authoritative discovery surface |
| Capability registry | `src/capability/registry.ts` | Consume |
| Capability entitlement/dependency evaluation | `src/capability/discovery.ts`, `src/capability/evaluator.ts`, `src/capability/entitlement.ts` | Consume |
| DBK capability lifecycle | `src/capability/dbkCapabilityManager.ts` | Consume activation/configuration authority |
| DBK identity | `src/platform/dbkRegistry.ts` | Consume |
| Workspace compilation | `src/platform/workspace/workspaceManager.ts` | Consume |
| Experience resolution | `src/experience/experienceResolver.ts` | Primary DBK authenticated experience contract |
| Dynamic navigation | `src/experience/navigation/navigationEngine.ts` | Render resolved navigation; do not recreate authority |
| Experience types | `src/experience/types.ts` | Use as existing contract vocabulary |
| Branch context | `src/platform/branch/branchManager.ts` and workspace state | Consume |
| Transaction execution | `saleTransactionService` through `ExperienceResolver` | Consume; no local transaction truth |
| Audit | `auditLogger` through Engine services | Consume; no DBK audit authority |

## 5. Existing Experience Contract

`src/experience/experienceResolver.ts` already resolves an authenticated DBK experience using Engine authority. Its resolved payload includes:

- DBK identity/display name
- sector
- lifecycle status
- subscription tier
- workspace/configuration versions
- active branch
- available branches
- terminology
- dynamic navigation
- dashboard widgets
- capability discovery items
- current principal roles and permissions
- operational state
- server timestamp

The resolver also exposes Engine-backed commands for branch switching, entity submission, capability enablement/configuration, and sale execution.

DBK UI work should bind to this existing experience contract before introducing any new backend contract.

## 6. Capability Experience Contract

`src/capability/discovery.ts` is authoritative for DBK capability discovery. It evaluates Business DNA, blueprint compatibility, current DBK capability records, subscription entitlement, and capability dependencies.

The distinction `DISCOVERABLE != ENABLED` is mandatory.

DBK must display the Engine result rather than infer eligibility locally.

Relevant lifecycle/status concepts already exposed by the Engine include:

- `DISCOVERABLE`
- `ENTITLED`
- `ENABLED`
- `CONFIGURED`
- `DISABLED`
- `SUSPENDED`
- `UPGRADE_REQUIRED`
- `CONFIGURATION_REQUIRED`
- `DEPENDENCY_REQUIRED`

## 7. Owner / Multi-DBK Model

The DBK experience must support one owner/operator managing multiple DBKs.

Conceptual UI:

Owner -> DBK A / DBK B / DBK C / DBK D

The UI may present and switch organizations, but the Engine remains authoritative for identity, tenancy, membership, role, permission, and active DBK/branch context.

DBK must never treat `one user = one business` as an architectural assumption.

## 8. Public DBK Boundary

A public organization website must consume an authoritative Engine public/projection contract.

Before implementing public profile, products, services, offers, availability, publication state, or Sokoni handoff, the DBK specialist must verify the actual repository contract.

A search of the current repository on 2026-09-22 did not locate a concrete implementation containing `Sokoni` or a clearly named public-organization/public-profile projection contract. Therefore:

**SOKONI INTEGRATION / PUBLIC ORGANIZATION PROJECTION: MASTER REVIEW REQUIRED.**

DBK must not invent either contract.

## 9. Dependencies Outside DBK Domain

These remain Engine/Master responsibilities:

1. Production payment bridge contracts.
2. Production eTIMS, M-Pesa, WhatsApp, SMS, Email, and Bank bridge readiness/contracts.
3. Authoritative document service contract where not already exposed to Experience Layer.
4. Authoritative notification retrieval/delivery contract where not already exposed.
5. Public organization projection/publication contract.
6. Sokoni discovery integration contract.
7. Production security/readiness hardening.
8. Growth/recommendation authority where the DBK-facing contract is not already exposed.

DBK must consume these once a verified contract exists.

## 10. Required UI State Handling

Every Engine-backed DBK action must provide explicit UI treatment for:

- Loading
- Success
- Empty
- Error
- Unauthorized
- Provisioning
- Disabled
- Requires action

Internal infrastructure errors must not be presented as raw technical errors to organization users.

## 11. Implementation Rule

Before adding a DBK feature:

1. Search the repository for the requested authority/contract.
2. Read the relevant implementation, not just a filename or UI.
3. Determine whether the capability already exists.
4. Reuse existing Engine authority when it exists.
5. If the required contract is incomplete, mark `MASTER REVIEW REQUIRED`.
6. Implement only DBK presentation/interaction code within the DBK domain.
7. Record any durable DBK architectural decision in this document or a more specific DBK contract document.
8. Leave enough contract information for the next specialist to continue without reconstructing decisions from chat history.

## 12. Current DBK Build Order

### DBK-01 — Experience shell

Build public/authenticated DBK layouts, routing, responsive behavior, navigation presentation, organization switcher presentation, and shared UI primitives.

### DBK-02 — Public intent experience

Build landing -> intent -> solution -> industry -> capability discovery presentation using authoritative Engine capability metadata where applicable.

### DBK-03 — Onboarding experience

Build account/business-context/capability-selection UX against verified Engine contracts. Do not create local identity, DBK, or Business DNA persistence.

### DBK-04 — Authenticated workspace

Bind UI to `ExperienceResolver` / existing Experience types and Engine workspace projections.

### DBK-05 — Capability activation UX

Bind selection and configuration actions to existing Engine commands. Do not bypass entitlement, dependency, authorization, or provisioning checks.

### DBK-06 — Public DBK projection

Blocked until the authoritative public organization projection contract is verified.

### DBK-07 — Sokoni handoff

Blocked until the Engine/Sokoni integration contract is defined by the responsible authority.

## 13. Stop Conditions

DBK work must stop and record `MASTER REVIEW REQUIRED` when:

- an authoritative Engine contract cannot be located;
- a required public projection is not defined;
- a Sokoni integration contract is absent;
- a payment/connector action has no verified production contract;
- implementation would require DBK to become the source of truth;
- implementation would duplicate tenancy, authorization, entitlement, transaction, receipt, workflow, AI, event, audit, or connector authority.

## 14. Continuation State

The repository is now carrying this DBK domain contract so future DBK work can continue from the repository rather than from conversation history.

Next DBK implementation target: **DBK-01 Experience Shell**, followed by DBK-02 public intent experience, using existing Engine contracts as dependencies and without modifying Engine authority.
