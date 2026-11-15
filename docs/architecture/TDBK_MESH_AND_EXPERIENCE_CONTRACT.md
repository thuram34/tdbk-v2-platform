# TDBK Master Mesh & Experience-to-Engine Contract

**Status:** Architecture contract and implementation audit baseline  
**Canonical repository:** `thuram34/tdbk-v2-platform`  
**Principle:** The customer-facing experience must be a truthful, usable projection of capabilities that the platform can actually execute.

## 1. Product vision

TDBK is one connected digital operating ecosystem for Kenyan businesses and institutions. It gives each business an independent operating space while sharing trusted platform capabilities: identity, data, workflows, integrations, intelligence, commercial services and marketplace access.

The product is not a collection of disconnected sector applications. It is one governed engine with industry-shaped experiences.

**Customer promise:** Run your business, connect your services, understand your operations and grow through one digital space.

**Operating principle:** One Engine. Multiple Industries. Shared Intelligence. Independent Businesses. Connected Economy.

## 2. The mesh: business language and engineering responsibility

| Mesh node | Customer-facing meaning | Authoritative responsibility | Current source anchors |
|---|---|---|---|
| Master Command | TDBK administration and oversight | Platform governance, policy, audit, operator authority | `src/components/master/OwnerCommandCenter.tsx`, `src/kernel/master/masterAuthority.ts` |
| Business Identity | Each business has its own secure space | Identity claims, DBK registry, tenant and branch boundaries | `src/platform/dbkRegistry.ts`, `src/kernel/identity/`, `src/kernel/tenancy/` |
| Business Operations | Run sales, stock, people, records and daily work | Sector blueprints, capabilities, entities and workflows | `src/blueprint/`, `src/capability/`, `src/experience/`, `src/platform/flow/` |
| Shared Core | Information and work move across the business | Canonical persistence, APIs, event bus, outbox and workflow orchestration | `src/persistence/`, `src/orchestration/`, `src/platform/flow/` |
| Connections | Use WhatsApp, payments and external services | Connector configuration, provider adapters, authenticated callbacks and reconciliation | `src/orchestration/bridge/`, `src/platform/connectors/` |
| Business Intelligence | See what is happening and what needs action | Scoped agent execution, knowledge, proposals, monitoring and auditable actions | `src/platform/agent/`, `src/platform/knowledgeResource.ts`, `src/platform/proactiveIntelligence.ts` |
| Commercial Services | Choose a plan and pay for what is used | Price book, subscription lifecycle, licences/entitlements, invoicing and ledger | `src/platform/subscription/`, `src/capability/entitlement.ts`, proposed commerce price-book work in PR #654 |
| Digital Infrastructure | Establish a professional online presence | Domain verification, DNS, TLS, hosting, backups and business email provisioning | Tracked in issue #656; provider execution is not yet verified |
| Sokoni Economy | Discover, list, order and fulfil | Public discovery, merchant identity, catalogues, orders, logistics and settlement | `src/sokoni/`, `src/platform/public/` |

These are logical mesh nodes, not a requirement to deploy every node as a separate microservice. Keep bounded contexts explicit while reusing the existing platform runtime and canonical persistence.

## 3. Required node contract

Every production node must define and document:

1. **Identity:** stable node/capability identifier and owning bounded context.
2. **Purpose:** one clear business outcome, described without engineering jargon in customer surfaces.
3. **Authority:** allowed actors, tenant scope, branch scope and permitted actions.
4. **State:** authoritative persistent records and lifecycle transitions.
5. **Interface:** typed API/command contract and validation rules.
6. **Events:** emitted/consumed events, idempotency key, correlation and causation identifiers.
7. **Dependencies:** upstream/downstream nodes and provider dependencies.
8. **Failure behaviour:** retry, timeout, compensation, reconciliation and human escalation.
9. **Observability:** health, last successful execution, failures and audit evidence.
10. **Experience projection:** what the customer sees, what actions are enabled and what state labels mean.
11. **Verification:** unit/integration tests, tenant-isolation tests and production acceptance evidence.

A node is not "live" because a menu item, card, connector registry entry or mock dashboard exists. It is live only when its authorized end-to-end path succeeds against its real persistence/provider dependencies and is observable.

## 4. End-to-end mesh flow

A representative retail sale should move through the mesh as follows:

1. The operator signs into the correct business and branch.
2. The workspace resolves only capabilities enabled for that business and subscription.
3. A sale command is authorized against the tenant, branch and operator role.
4. The sales domain validates items, stock, tax and pricing.
5. The payment connector requests payment; the browser response is not treated as proof of payment.
6. A trusted provider callback/query is authenticated and reconciled.
7. The financial service posts the balanced ledger transaction and receipt.
8. Inventory records the stock movement exactly once.
9. The event/outbox layer publishes the committed business event.
10. Customer history, reporting and scoped intelligence update from authoritative records.
11. The workspace projection refreshes and exposes the resulting state.

The same pattern applies to school fee collection, clinic billing, hotel folios, pharmacy sales and manufacturing procurement, with sector-specific domain rules.

## 5. Commercial lifecycle contract

The customer-facing commercial journey must be:

**Discover → Configure → Quote → Subscribe → Verify payment → Activate licence/entitlements → Provision services → Operate → Renew/upgrade/suspend/cancel.**

Rules:

- Use one configurable, versioned price book. Never hardcode plan, module, domain, mailbox, hosting or usage prices in the UI.
- A subscription is tenant-scoped and has explicit amount, currency, interval, term and status.
- A payment request remains pending until the provider outcome is authenticated and reconciled.
- Entitlements derive from authoritative subscription and payment state, not a client-side success screen.
- Domain registration, cloud hosting, storage, backup, mailbox and support are separately configurable service line items.
- Provider provisioning uses idempotent operations and records provider references and lifecycle state.
- Failed/ambiguous provisioning enters reconciliation; do not silently claim completion.
- Suspension, grace periods, renewal, proration and cancellation are configurable policy decisions with audit history.

## 6. Experience-to-engine truth rules

The public gateway and tenant workspace must obey these rules:

- Demo metrics and sample activity are explicitly labelled illustrative. Never imply sample businesses or sample transactions are live TDBK customers.
- A success message is shown only after a server operation returns a durable success result. Local React state is not request persistence.
- A displayed price must come from an authoritative published price-book version or be clearly labelled as a non-binding estimate.
- A payment button must show pending until a verified provider outcome is received.
- A domain, hosting, SSL, backup or email feature must show its actual lifecycle state and must not imply provider provisioning where no adapter exists.
- A disabled or unavailable feature must explain what is needed to activate it.
- Every visible button must navigate to a real destination or execute a real, authorized operation. No decorative controls masquerading as actions.
- Each sector's menu and workspace is projected from its enabled capabilities and business configuration, not copied static screens.

## 7. Verified implementation observations (main branch audit)

The following observations were verified against the main branch at commit `777e4461218e3380a09822291661e75da32e36bc`:

### Implemented foundations

- The public gateway provides a sector-oriented customer journey and an illustrative workspace carousel. The showcase explicitly labels itself as illustrative, not live organization data.
- The authenticated owner command centre loads the owner's DBKs and their experience projections; it derives active, provisioning and attention counts from returned DBK state.
- The DBK shell resolves an experience for a selected DBK/branch and dispatches authenticated commands.
- Subscription routes and a subscription service exist, with payment event validation against the persisted subscription amount and currency.
- PR #652 (payment evidence validation) and PR #653 (scoped provisioning service identity guardrail) were merged into main during the 2026-11-15 execution session.

### Verified gaps requiring engineering

- `src/public/CommercialBridge.tsx` currently hardcodes quote service base amounts and a 16% VAT estimate in frontend state. This must be replaced by the published, versioned commercial price book before the UI is treated as a source of current prices.
- The same component's consultation submit handler only sets local `consultationSuccess` state. It does not call an API or persist a lead. The "Request Received" screen is therefore not a real receipt and must not be presented as one.
- The workspace showcase contains sample names, metrics and activities. It is correctly labelled as illustrative; preserve that distinction unless it is replaced with a public-safe, permissioned live projection.
- PR #654 contains the commercial price-book/subscription/digital-asset work but was observed with CI failures and a merge conflict after #652/#653 were merged. Reconcile the branch and rerun CI before merging.
- Issue #656 tracks the missing end-to-end domain, DNS, TLS, cloud hosting, backup and branded-email lifecycle. A digital asset registry record alone is not provider provisioning.
- Production M-Pesa activation remains fail-closed pending authenticated transaction-status reconciliation and provider UAT evidence.

## 8. Priority execution sequence

### P0 — Make the public promise truthful
1. Replace local-only consultation success with a durable public lead-intake API and an operator-visible lead queue.
2. Replace frontend hardcoded quote amounts/tax assumptions with a published price-book read model. Until connected, present "Request a quote" rather than a fabricated live price.
3. Ensure every public CTA has a verified destination or a clearly explained unavailable state.

### P1 — Finish the commercial control plane
1. Reconcile and merge the price-book/subscription implementation in PR #654 after conflict resolution and green CI.
2. Complete customer subscription creation, payment initiation, verified reconciliation and entitlement activation.
3. Expose licence, plan, module, branch and user entitlements in the owner/business control panels.
4. Implement renewal, upgrade, grace period, suspension and cancellation transitions.

### P2 — Connect digital infrastructure
1. Deliver issue #656: domain verification/DNS, TLS, hosting/deployments, backups and business email.
2. Add provider adapters with encrypted secrets, idempotency, retries and reconciliation.
3. Expose service lifecycle and renewal state in the tenant control panel.

### P3 — Complete the operating mesh
1. Inventory every visible menu item, button, capability and workflow.
2. Map each to an authoritative API, service, persistent record, permission and test.
3. Remove duplicate/obsolete paths only after dependency and data migration checks.
4. Add end-to-end tests for retail, school, chemist, hospitality and manufacturing journeys.

## 9. Definition of done

TDBK is aligned with its vision when a real business can:

- discover its industry solution and understand what it does;
- register an account and create an independent business space;
- receive correct tenant identity, roles, branch structure and enabled capabilities;
- choose a configurable plan and see a truthful quote;
- pay through a verified payment flow and receive a durable receipt;
- have its licence and entitlements activated from authoritative state;
- configure its domain, cloud environment, email and connected services;
- operate real industry workflows with reliable persistence and integrations;
- see its business activity reflected consistently across dashboards, reports, notifications and marketplace surfaces;
- manage renewals, users, branches and service changes without TDBK staff manually editing database records.

No production, provider or customer-success claim is accepted without an auditable end-to-end test or live operational evidence.
