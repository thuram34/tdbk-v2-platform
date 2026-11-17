# TDBK Master DNA & Blueprint — v1.0.0

**Status:** Canonical architecture baseline / implementation contract  
**Date:** 2026-11-15  
**Repository:** `thuram34/tdbk-v2-platform`  
**Authority:** This document consolidates platform intent and existing repository evidence. It does not certify every capability or external integration as production-ready.

## 1. Executive definition

**TDBK is a configurable digital operating bridge for businesses and institutions.** It discovers how an organisation operates, compiles that knowledge into a versioned Business Blueprint and Business DNA, activates entitled capabilities, and provides a secure workspace through which people, workflows, devices, channels and external services operate.

TDBK is not one monolithic ERP and not a collection of unrelated apps. It is a governed platform that assembles reusable operating capabilities into sector- and archetype-specific experiences.

The product must make complex technology feel like a simple business operating home. Customers should not need to understand internal concepts such as tenant, DBK runtime, kernel, provisioning engine or capability registry.

### Product promise

1. Understand the organisation and its operating model.
2. Configure a fit-for-purpose business workspace.
3. Give each person the right tools and authority.
4. Execute business operations with trustworthy records.
5. Connect payments, tax, communications, devices and external providers.
6. Surface useful intelligence without inventing business facts.
7. Grow from a single outlet to a multi-branch or enterprise operation without rebuilding the system.

## 2. Names and authority boundaries

| Term | Canonical meaning | Audience |
|---|---|---|
| TDBK | Platform, control plane and managed digital bridge | Internal and customer-facing |
| Digital Bridge Kenya | Market-facing brand / service identity | Customer-facing |
| Business | A customer organisation or institution | Customer-facing |
| Business Workspace | The customer's operating home | Customer-facing |
| Business Profile | Customer-visible identity and configuration summary | Customer-facing |
| Business DNA | Complete structured operating model for a business | Engineering / assisted onboarding |
| Business Blueprint | Versioned reusable operating template for an archetype | Engineering / catalogue |
| Capability | Reusable business function with contracts and evidence | Engineering; expose as feature/service |
| Module | A packaged group of related capabilities | Both |
| Runtime | Execution boundary for an activated business workspace | Engineering |
| Connector / Integration | Controlled bridge to an external provider or system | Both |
| Portfolio | A business owner's collection of separately governed businesses | Customer-facing where applicable |
| Sokoni | Marketplace and commerce discovery layer | Customer-facing |

**Authority split:** TDBK Master owns platform governance, blueprints, capability definitions, entitlement policy, provisioning, connector governance, subscriptions, marketplace rules and platform observability. Each Business Workspace owns its business records, operational configuration, users, branch topology and authorised transactions. Master operators must not casually browse or mutate customer business data.

## 3. Canonical architecture: nine layers

```text
L9  User Interface & Channels
    Web / PWA / Mobile / WhatsApp / API / Device surfaces
L8  UI Engine
    Design system / layouts / cards / forms / dashboards / responsive composition
L7  Experience Services
    Context resolution / navigation / role projection / command presentation
L6  Workflow, Events & Bridges
    Durable workflows / outbox / automation / provider callbacks / reconciliation
L5  Business Runtime
    Commands / domain services / validation / state transitions / persistence
L4  Capability & Entitlement Engine
    Capability registry / dependencies / licensing / activation / readiness
L3  Business DNA & Blueprint Engine
    Discovery / archetypes / schema / compiler / versioning / migration
L2  Platform Services
    Provisioning / subscriptions / files / notifications / support / observability
L1  Kernel & Trust Boundary
    Identity / organisation isolation / authorisation / secrets / audit / policy
```

### Layer contracts

- **L1 Kernel:** establishes identity, trust, organisation isolation, policy evaluation and audit. It must not contain industry-specific business logic.
- **L2 Platform Services:** manages platform-wide lifecycle and shared services. It does not own customer domain transactions.
- **L3 DNA & Blueprint:** describes what an organisation is and how its operating model is configured. It does not execute sales, dispense medicine or post a payment.
- **L4 Capability Engine:** resolves what is available, compatible, entitled, enabled and ready. It does not pretend a catalogue declaration is a working runtime.
- **L5 Runtime:** executes authorised domain commands and persists authoritative business state. It owns validation and domain invariants.
- **L6 Workflow & Bridges:** coordinates durable multi-step work, events, retries, callbacks, compensation and reconciliation. Provider acceptance is not the same as final business confirmation.
- **L7 Experience Services:** projects runtime, DNA, capabilities, permissions and context into usable journeys and commands.
- **L8 UI Engine:** composes reusable visual components and layouts from validated experience definitions. Avoid arbitrary tenant-supplied executable JavaScript.
- **L9 UI & Channels:** presents the same authoritative operations through web, PWA, mobile, WhatsApp, APIs and devices. A channel never becomes the source of truth.

**Canonical flow:** Account → Business discovery → Archetype → Business DNA → Blueprint version → Entitlements → Provisioning → Workspace → Experience → Authorised command → Runtime state → Workflow/event/bridge → Confirmed result → Customer-visible projection.

## 4. Business DNA and Blueprint relationship

- A **Blueprint** defines a reusable, versioned operating pattern for a business archetype: entities, relationships, terminology, roles, workflows, rules, required capabilities, documents, reports, integrations and experience defaults.
- **Business DNA** is the specific organisation's structured and versioned configuration: identity, business model, branches, departments, people, catalogue, rules, channels, integrations, permissions and preferences.
- **Capability resolution** determines which blueprint-supported functions are available, compatible, entitled, enabled and operational.
- **Runtime** executes actual commands and business state transitions using the resolved configuration.

A sector is not a blueprint. A subsector is not necessarily an archetype. Use:

`Industry → Subsector → Business Archetype → Blueprint ID + Version → Business DNA Instance`

One organisation may use multiple business lines, but the initial model should select one primary archetype and explicitly model additional business units rather than silently mixing incompatible rules.

## 5. Business DNA domains

The canonical DNA domain model is defined in [TDBK_BUSINESS_DNA_STANDARD.md](./TDBK_BUSINESS_DNA_STANDARD.md). It covers:

1. Identity and legal registration
2. Industry, subsector and business model
3. Products, services and configurable catalogue
4. Organisation, departments and people
5. Geography, branches and operational sites
6. Customers, suppliers and counterparties
7. Operations, processes and service hours
8. Finance, tax and commercial rules
9. Inventory, assets and locations
10. Compliance, records and documents
11. Channels and communications
12. Technology, devices and integrations
13. Security, roles and approval authority
14. Automation and AI policy
15. Analytics, targets and growth
16. Experience, terminology and preferences

DNA is not a free-form profile blob. Each domain needs a schema, owner, validation rules, version, provenance, sensitivity classification and migration policy. Dynamic business values—catalogue items, variants, units, prices, tax settings, stock rules, payment configuration and contact details—must not be hardcoded in application logic.

## 6. Industry and archetype catalogue

Initial catalogue families (not a claim that every archetype is already implemented):

| Family | Example subsectors / archetypes |
|---|---|
| Commerce & retail | Hardware/building materials, supermarket, mini-market, electronics/appliances, pharmacy/chemist, wholesale/distribution, online merchant |
| Education | Primary/secondary school, college, university, vocational/training, daycare |
| Healthcare | Hospital, clinic, laboratory, dental practice, pharmacy, medical supplier |
| Hospitality & lifestyle | Hotel, restaurant, catering, salon, spa, beauty/wellness, events venue |
| Transport & logistics | Fleet operator, courier, freight, cargo, passenger transport, boda network, warehouse |
| Construction & property | Contractor, hardware yard, property manager, real-estate operator, facilities, equipment hire |
| Agriculture & manufacturing | Farm, dairy/livestock, cooperative, manufacturer, food processor, water/beverage producer |
| Professional & institutional | Consultancy, agency, legal/accounting practice, NGO, SACCO/cooperative, faith/community institution, public institution |

The repository's current `SectorType` union and initial catalogue are implementation seeds, not the final market taxonomy. Add new archetypes through governed blueprint definitions, not one-off conditionals throughout the kernel.

## 7. Capability and module model

Capabilities are atomic, versioned contracts. Modules group capabilities into coherent business outcomes. A capability definition must specify:

- Stable ID, semantic version, owner and lifecycle status
- Business purpose and supported archetypes / blueprint versions
- Dependencies, conflicts and compatibility constraints
- Configuration schema and defaults
- Permission and approval requirements
- Domain entities, persistence ownership and data classification
- Commands, queries, APIs and runtime handlers
- Events emitted and consumed
- Workflow states, retries, idempotency and compensation
- Connector/provider dependencies
- UI/experience contribution and customer journey
- Tests, observability, runbooks and deployment requirements
- Acceptance evidence and known limitations

**Capability states are distinct:** catalogued → compatible → entitled → enabled → configured → operational → verified. Never collapse these into one boolean.

The current engineering ledger lists 83 capability records (10 declared IMPLEMENTED, 28 DEFINED, 45 SPECIFIED at its recorded baseline). Those are catalogue declarations, not audited production completion counts. See [TDBK_IMPLEMENTATION_LEDGER.md](../engineering/TDBK_IMPLEMENTATION_LEDGER.md).

## 8. Workflow and transaction integrity

Every business action must have a traceable contract from intent to confirmed outcome.

Example sale lifecycle:

```text
DRAFT → VALIDATED → STOCK_RESERVED → PAYMENT_PENDING
      → PAYMENT_CONFIRMED → LEDGER_POSTED → STOCK_COMMITTED
      → RECEIPT_ISSUED → CUSTOMER_NOTIFIED → COMPLETED
```

The actual order may differ by payment method and blueprint; the state machine must be explicit and tested. Required controls include server-side validation, idempotency keys, durable state, transactional outbox, duplicate callback handling, bounded retries, dead-letter/recovery, compensation/reversal, audit trail and reconciliation.

A button click, HTTP 200, queued job, local fallback identifier or provider request acceptance does not prove a transaction completed. The customer must see a confirmed result only after the authoritative state and required provider evidence are reconciled.

## 9. Integration architecture

Provider bridges must implement explicit contracts, tenant-scoped credentials, secret storage, callback authentication, idempotency, rate limits, error classification, observability, reconciliation and sandbox/production certification.

Priority integration families:
- Payments: M-Pesa Daraja and supported banks/payment providers
- Tax: KRA eTIMS
- Communications: WhatsApp Business Cloud API, SMS, email
- Identity: Firebase Authentication / Identity Platform or approved identity provider
- Cloud and data: Firestore, Cloud Run, Cloud Storage, Pub/Sub
- AI: Gemini / Vertex AI through a policy-controlled provider abstraction
- Commerce: Sokoni and approved external commerce channels
- Documents: generation, storage, extraction and approved signing services

Kenya-first defaults: KES, Africa/Nairobi, Kenyan business/tax configuration, M-Pesa and local communication providers. These are configurable defaults, not global constants.

## 10. Experience and interface

Experience is resolved from:

`Blueprint + Business DNA + Enabled Capabilities + Entitlements + User Role + Permissions + Current Context + User Preferences`

The interface must be consistent across the product family:
- Clear business identity and workspace context
- Role-aware navigation and dashboards
- Reusable cards, tables, forms, command surfaces and status indicators
- Responsive web/PWA baseline, with mobile-first operational paths where needed
- Accessible contrast, keyboard navigation and clear error states
- No dead buttons: every visible action has a defined command, permission, validation, pending state, success state, failure state and audit consequence
- Dynamic catalogue and pricing; no hardcoded business-specific product lists or prices
- WhatsApp as a high-value customer channel, not as the authoritative database
- Sokoni listing cards are gateways to real backend-backed detail, order, booking, quotation or storefront flows—not decorative mock cards

Customer vocabulary: Account, Business, Workspace, Feature, Service, Integration, Setup. Reserve internal vocabulary (tenant, DBK ID, runtime, kernel, provisioning) for engineering and administration.

## 11. Commercial and revenue architecture

Keep the three commercial pillars separate from subscription tiers:

**Revenue pillars**
1. Connectivity: Starlink/MikroTik/GSM branch connectivity, network operations and support.
2. Managed IT: business workspaces, POS, inventory, websites/commerce, devices, support and automation.
3. Sovereign Enterprise: multi-branch systems, dedicated integrations, governance, private infrastructure and enterprise automation.

**Subscription engine:** the current repository baseline uses FREE, FOUNDATION, GROWTH, PRO and ENTERPRISE. Treat these as plan identifiers to reconcile and govern centrally. Do not conflate them with revenue pillars or earlier Starter/Growth/Pro naming. Commercial rules must support monthly/annual billing, included entitlements, usage charges, onboarding/setup fees, managed services, integration add-ons, marketplace commissions and negotiated enterprise contracts. Pricing is configurable and historical transaction prices must be snapshotted.

## 12. Security and data governance

Canonical conceptual hierarchy:

`Platform → Portfolio Owner → Business → Branch/Site → Department/Operational Unit → Workspace Context → Capability Data`

The repository establishes one identifier under two context-specific names: `dbkId` in domain objects and `tenantId` in persistence paths, auth claims and security rules. `src/persistence/types.ts` explicitly states `tenantId === dbkId`. Preserve this mapping; do not globally rename either term. Enforce equality at aggregate and API boundaries and verify cross-tenant behavior with negative tests.

Minimum controls:
- Server-side authentication and authorisation on every command/query
- Organisation and branch-scoped access checks
- RBAC plus contextual policy checks for sensitive operations
- Separate platform-admin and customer-business authority
- Secret isolation and encryption
- Immutable audit records for sensitive mutations
- Data retention, export and deletion policies
- Backup and tested restore procedures
- AI output is advisory until validated; never fabricate financial, clinical, identity or provider evidence
- Explicit approval for payments, financial posting, sensitive disclosure, destructive and irreversible actions

## 13. AI and automation policy

AI services may assist with discovery, DNA completion, capability recommendations, document extraction, support, operational analysis and workflow preparation. Use three authority levels:

1. **Advisory:** explain, classify, recommend; no mutation.
2. **Assisted execution:** prepare a proposed action; authorised user approves.
3. **Bounded autonomous execution:** execute only pre-authorised, reversible, low-risk tasks within explicit policy and audit boundaries.

Financial posting, external payments, regulated decisions, sensitive disclosures and destructive actions require deterministic validation and approval policy. Provider failure must produce an explicit unavailable/error state, not synthetic business facts.

## 14. Product ecosystem boundaries

| Product / initiative | Intended role | Integration rule |
|---|---|---|
| TDBK V2 | Shared platform, control plane and runtime | Own shared contracts and platform governance |
| Digital Bridge Kenya | Market-facing identity and managed service proposition | Avoid creating a second platform implementation |
| Sokoni | Marketplace and commerce discovery | Use approved catalogue, merchant identity, orders and payment contracts |
| TDBK School Pro | Education solution | Map school workflows to capabilities and education archetypes |
| Chemist Pro / TRAIL Pharmacy | Pharmacy/retail solutions | Preserve regulated pharmacy-specific controls and data ownership |
| Ugatuzi Hospital Management | Healthcare solution | Integrate through healthcare contracts; protect clinical data |
| AquaFlow / Pride Industries | Water and manufacturing customer deployment | Dynamic catalogue, variants, pricing, inventory and fulfilment |
| DRIP DISTRICT POS | Retail/POS product lineage | Reuse tested POS capabilities; avoid duplicate transaction engines |
| TDBK Support | Customer success and support operations | Ticketing, SLAs, knowledge, health and feedback |
| Autonomous Operations | Internal operations intelligence | Read-only by default; policy-gated actions and audit |

Do not merge every product repository into one monolith. For each product, document its owner, data authority, shared capabilities, API/event boundary, migration status, deployment and acceptance evidence.

## 15. Governance and version lifecycle

Blueprint lifecycle:

`DRAFT → REVIEW → VALIDATED → PUBLISHED → DEPRECATED → RETIRED`

A published blueprint version is immutable. Changes create a new version. Business DNA references an exact blueprint ID and version. Upgrades require compatibility analysis, schema migration, data transformation, permission/workflow review, regression tests, customer approval where material, rollback plan and audit event.

Capability lifecycle is separately governed. A blueprint cannot activate a capability that is not compatible, entitled and ready.

## 16. Engineering acceptance rule

A capability is operational only when its end-to-end journey can be demonstrated:

`Customer Intent → UI Action → Experience Command → Authorization → Capability → Runtime Handler → Validation → Persistence → Event/Workflow → External Provider (if applicable) → Reconciliation → Confirmed State → Customer Projection`

Every transition must identify its source file/function, contract, authority boundary, failure mode and test. For each button, document:
- Purpose and visible state
- Command/API and payload
- Required role/permission
- Validation and business invariants
- Persistence and events
- Pending, success, empty and failure states
- Retry/duplicate behavior
- Audit impact
- Automated test and production evidence

## 17. Implementation sequencing

1. Ratify this architecture and terminology baseline.
2. Map current types, registries, repositories and provisioning code to the DNA standard.
3. Enforce and test the established identity mapping (`tenantId === dbkId`) across all API, auth, persistence and domain boundaries before schema expansion.
4. Build schema-backed DNA domains incrementally with backward-compatible migrations.
5. Govern industry → archetype → blueprint registry and validation.
6. Reconcile capability IDs, aliases, dependencies, entitlements and runtime evidence.
7. Trace workflows and connectors end-to-end, starting with sale/payment/receipt and customer onboarding.
8. Bind UI buttons/cards to real commands and acceptance tests.
9. Map product repositories and define integration boundaries.
10. Verify deployed environments, security, backups, monitoring and support readiness.

## 18. Source-of-truth policy

This document is the architectural index, not a replacement for code. Detailed contracts live in the linked standards and implementation ledgers. If code and documents conflict, record the discrepancy in the gap register; inspect the runtime and tests; do not silently assume either side is correct. Amend this baseline through reviewed, versioned changes.
