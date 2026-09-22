# TDBK Engine Public Discovery Boundary Contract

**Status:** ACTIVE — Engine architectural boundary/reconciliation contract
**Scope:** TDBK Engine only
**Authority:** TDBK Engine remains the authoritative source of business, tenant, capability, workflow, transaction, payment, receipt, event, audit, security, and authoritative projection state.
**Owner:** TDBK Engine / Master Authority
**Created:** 2026-09-22

## 1. Purpose

This document records repository-verified Engine authority and the boundary for future DBK/Sokoni public discovery work.

It is intentionally **not** an implementation approval for missing public-discovery subsystems. Missing contracts are explicitly marked `MASTER REVIEW REQUIRED` rather than being invented here.

The durable rule is:

> DBK and Sokoni are Experience Layer consumers. They must not create replacement business, publication, provider, product, service, discovery, workflow, transaction, or financial authority when the Engine owns or is expected to own that authority.

## 2. Repository-Verified Existing Authority

The following were inspected in the repository before recording this contract.

| Requirement | Existing Engine evidence | Decision |
|---|---|---|
| DBK identity | `src/platform/dbkRegistry.ts` | Consume existing authority |
| Business DNA | `src/blueprint/dnaManager.ts` | Consume existing authority |
| Branch context | `src/platform/branch/branchManager.ts` and workspace state | Consume existing authority |
| Capability registry | `src/capability/registry.ts` | Consume existing authority |
| Capability discovery | `src/capability/discovery.ts` | Consume; this is capability discovery, not public marketplace discovery |
| Capability entitlement/evaluation | `src/capability/evaluator.ts`, `src/capability/entitlement.ts` | Consume existing authority |
| DBK capability lifecycle | `src/capability/dbkCapabilityManager.ts` | Consume existing authority |
| Workspace compilation | `src/platform/workspace/workspaceManager.ts` | Consume existing authority |
| Authenticated experience projection | `src/platform/projection/experienceProjection.ts` | Reuse; do not create a parallel projection authority |
| Experience entities | `src/experience/types.ts`, `src/experience/entity/entityEngine.ts` | Reuse existing entity substrate where applicable |
| Experience entity persistence | `src/persistence/types.ts`, `src/persistence/firestore/repositories/entityRecordRepository.ts` | Reuse existing persistence authority |
| Runtime/business transactions | Existing runtime/business services | Consume existing runtime authority |
| Workflows/events/bridges | Existing orchestration/bridge infrastructure | Reuse existing runtime/orchestration authority |
| Financial truth | Existing transaction/ledger/reconciliation/receipt services | Preserve existing financial authority and invariants |
| Idempotency | Existing persistent idempotency contract | Reuse existing authority |
| AI interpretation/verification | Existing Agent Runtime | AI remains interpreter/assistant, not business truth authority |

## 3. Existing Experience Projection Boundary

`src/platform/projection/experienceProjection.ts` already provides an Engine-owned projection for a stateless client/UI surface.

It:

1. checks tenant access using `masterAuthority` / `BlueprintValidator`;
2. compiles authoritative workspace state through `workspaceManager`;
3. projects DBK identity, sector, status, branches, capabilities, terminology and permissions;
4. returns a server-authoritative timestamp.

This establishes the reusable architectural pattern for L7 projections.

It does **not** establish a generic public marketplace/discovery contract.

## 4. Critical Distinction: Capability Discovery vs Public Discovery

The Engine already has capability discovery.

Capability discovery answers a DBK-oriented question such as:

> Which capabilities are discoverable/eligible for this DBK given Business DNA, blueprint compatibility, entitlement, dependencies, and current capability state?

Public discovery is a different contract and must not silently reuse or redefine capability discovery.

Public discovery would answer questions such as:

> Which Engine-authorized public organizations, branches, providers, products, services, or opportunities are discoverable for this request and location?

Therefore:

- existing capability discovery remains authoritative for capabilities;
- no `SokoniDiscoveryEngine` or duplicate capability-discovery authority may be introduced;
- a future public-discovery contract requires explicit Engine/Master approval.

## 5. Public Projection Boundary

The Engine may expose public-safe projections of authoritative entities through the Experience Layer.

The public projection must never become a second master.

### Candidate public projections requiring contract approval

- Public Organization
- Public Branch
- Public Provider
- Public Product
- Public Service
- Public Offer
- Public Opportunity

Only the first two have a directly verified reusable foundation in the current Engine projection/DBK/branch model. The remaining generic public contracts are not asserted as existing merely because related concepts exist elsewhere in the repository.

### Public projection rules

A public projection must:

- derive from authoritative Engine state;
- apply Engine-owned authorization and eligibility rules;
- exclude private/PII/internal operational fields;
- respect publication state once a publication contract exists;
- never write business truth back from the public projection directly;
- remain consumable by DBK and Sokoni without duplicating the source of truth.

## 6. Publication Authority — MASTER REVIEW REQUIRED

A repository-verified generic public publication authority was not located.

The following lifecycle is therefore **not yet an approved Engine contract**:

```text
DRAFT -> ELIGIBLE -> PUBLISHED -> UNPUBLISHED -> ARCHIVED
```

Do not create a publication service, publication collection, publication event vocabulary, or publication state machine solely from this document.

Master decisions still required:

- publication owner;
- eligibility authority;
- who may publish/unpublish/archive;
- publication audit semantics;
- suspension/revocation semantics;
- relationship between capability entitlement and public visibility.

## 7. Public Discovery Contract — MASTER REVIEW REQUIRED

A canonical Engine public-discovery contract was not located.

The following conceptual boundary is recorded for continuation only; it is not a production API definition:

```text
Experience Request
    -> public eligibility
    -> public projection
    -> location constraints
    -> relevance/search
    -> public result
```

No search technology is selected by this contract.

Do not introduce a search index, vector database, external search service, or parallel discovery datastore until the authoritative contract is approved.

## 8. Location Boundary — MASTER REVIEW REQUIRED

The Engine already has authoritative branch/location context.

That does not establish all public-discovery location semantics.

The following concepts must remain distinct until a contract is approved:

- public business/branch location;
- public service area/coverage;
- public delivery area;
- user-selected discovery location;
- approximate discovery location;
- private customer/transaction location.

Private customer or transaction location must never become public discovery data merely because a public discovery experience needs location filtering.

## 9. Generic Provider Contract — MASTER REVIEW REQUIRED

Existing repository uses of `provider` include external integration/bridge providers. Those are not evidence of a generic real-world public provider master.

Do not reinterpret M-Pesa, bank, SMS, email, eTIMS, AI, or other integration providers as the public-provider authority.

A future generic provider contract must establish its authoritative owner before implementation.

No `SokoniProvider` master is authorized by this document.

## 10. Product / Service Boundary

The Engine already has a generic `ExperienceEntityRecord` substrate and business transaction services using it. This is reusable infrastructure.

However, the repository does not by itself establish one canonical public product/service contract covering all of:

- public identity;
- provider/DBK ownership;
- branch;
- price/quote;
- availability;
- inventory/capacity;
- coverage;
- requestability;
- public media/description;
- publication.

Therefore:

- existing entity/runtime authority must be reused where applicable;
- DBK/Sokoni must not create replacement product/service masters;
- the generic public product/service contract remains `MASTER REVIEW REQUIRED`.

## 11. Availability — MASTER REVIEW REQUIRED

No single generic Engine availability authority was established by repository inspection.

Do not infer that capability status, DBK status, branch status, or an entity boolean is a universal availability model.

Master must decide whether availability is:

1. a shared Engine primitive; or
2. domain-specific authoritative state projected through L7.

## 12. Discovery -> Action Boundary

The authoritative action path remains:

```text
DBK / Sokoni Experience
        -> L7 Experience/API boundary
        -> Engine command
        -> L5 authoritative runtime
        -> workflow/event/bridge as required
        -> authoritative state
        -> L7 projection
        -> DBK / Sokoni
```

Sokoni must not create a parallel workflow engine for discovery actions.

A generic discovery-to-request command vocabulary remains `MASTER REVIEW REQUIRED` until the target domain and authoritative runtime command are identified.

## 13. Request -> Quote -> Approval

The Engine already contains workflow/event infrastructure and financial truth infrastructure.

Existing workflow lifecycle and payment events may be reused where their semantics match, but they do not automatically establish a generic marketplace/service quote lifecycle.

The following remains unapproved:

```text
REQUESTED
-> PROVIDER_RESPONDED
-> QUOTE_CREATED
-> CUSTOMER_APPROVAL
-> SCHEDULED
-> IN_PROGRESS
-> COMPLETED
-> PAYMENT
-> RECEIPT
```

Do not create a generic quote/request state machine without Master/domain-owner approval.

## 14. Financial Truth Invariants

Existing Engine financial invariants remain authoritative and must not be weakened by public-discovery work.

Mandatory existing invariants include:

```text
Debit total === Credit total
```

and:

```text
POSTED ledger entries are immutable
```

Public discovery/actions must route financial mutations through the existing financial/runtime authority rather than introducing marketplace payment truth.

## 15. AI Boundary

Existing Agent Runtime infrastructure may interpret natural-language intent and assist with actions.

AI must not become authoritative for:

- tenancy;
- identity;
- authorization;
- entitlement;
- publication authority;
- transaction state;
- financial truth;
- receipts;
- workflow truth;
- public-provider truth.

A future natural-language discovery flow must translate AI interpretation into an Engine-owned discovery contract rather than allowing AI to create an independent discovery datastore.

## 16. Security Boundary

Public discovery must reuse existing Engine security/tenant authority.

Required controls for a future public-discovery implementation include:

- tenant isolation;
- branch isolation where applicable;
- public/private field filtering;
- publication eligibility;
- PII protection;
- location privacy;
- authorization for public actions;
- idempotency for state-changing actions;
- auditability;
- abuse/rate controls.

The public-discovery-specific policy contract is not yet fully established and remains `MASTER REVIEW REQUIRED`.

## 17. Cross-Domain Dependencies

### DBK domain owns

- public organization presentation;
- organization website UI;
- navigation/presentation;
- interaction state;
- human-readable states;
- presentation of Engine-authorized public projections.

DBK must consume Engine contracts and must not create public organization master records.

### Sokoni domain owns

- public discovery UI/experience;
- search/filter presentation;
- marketplace/discovery interaction presentation;
- opportunity/discovery UX.

Sokoni must consume Engine authority and must not create provider/product/service/publication truth.

### Engine/Master owns

- authoritative identity;
- tenancy;
- Business DNA;
- capabilities;
- entitlement;
- authoritative business state;
- transactions;
- workflows/events/bridges;
- financial truth;
- receipts;
- security/audit;
- public authority contracts once approved.

## 18. Stop Conditions

Engine work must stop and record `MASTER REVIEW REQUIRED` when:

- a public authority cannot be located;
- implementation would require inventing a provider/product/service master;
- implementation would require choosing a search technology before the contract is defined;
- a public action has no verified Engine command/runtime authority;
- public projection would expose private state;
- DBK/Sokoni would need to become a source of truth;
- a proposed API conflicts with an existing Engine contract;
- a proposed persistence model duplicates existing authority.

## 19. Continuation State

This document is the durable handoff for Engine/public-discovery work.

### Safe to reuse immediately

- DBK registry
- Business DNA
- branch authority
- capability registry/discovery
- workspace compilation
- Experience Projection Service
- Experience Entity Record/persistence substrate
- runtime commands/state transitions
- workflow/event infrastructure
- bridges
- financial truth
- receipts/reconciliation
- idempotency
- Agent Runtime authority boundary

### Blocked pending Master/domain decision

- generic public publication authority
- generic public discovery API
- generic public search contract/index
- generic public provider master
- generic public product/service master
- generic availability authority
- generic request/quote marketplace lifecycle
- generic opportunity/job authority
- public-discovery-specific location/privacy semantics

### Next specialist continuation

The next Engine specialist should not rebuild any existing authority. The next actionable step is to resolve the blocked contracts above with Master, then implement only the approved Engine-owned contracts and tests. DBK and Sokoni specialists can continue independently on presentation work that depends only on already verified contracts.
