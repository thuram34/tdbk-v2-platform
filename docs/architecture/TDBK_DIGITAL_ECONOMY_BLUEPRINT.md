# TDBK Digital Economy — Architecture and 12-Day Delivery Contract

Status: implementation baseline and delivery contract  
Decision: hybrid economy — subscriptions + owned/licensed assets + future regulated financial services  
Execution window: 12 days from approval  
Canonical repository: `thuram34/tdbk-v2-platform`

## 1. Product decision

TDBK is one multi-tenant platform with multiple commercial faces. It is not six disconnected products and it is not initially a cryptocurrency project.

The economic model has three layers:

1. Cash-flow layer: subscriptions, onboarding, managed IT, integrations, support, marketplace commissions and usage-based services.
2. Asset layer: software/IP, domains, content, equipment, contracts, receivables and documented real-world asset interests.
3. Financial layer: KES invoicing and payment collection, immutable double-entry accounting, settlement/reconciliation, service entitlements and (only after legal clearance) regulated virtual-asset services.

TDC is a reserved product concept, not a live token, deposit, investment product, legal tender or promise of redemption. Initial service credits must be non-transferable, non-cash-redeemable, restricted to defined TDBK services and reviewed by Kenyan counsel before launch.

## 2. System boundaries

- Experience: public site, tenant workspace, owner portfolio, WhatsApp and partner/API channels.
- Control plane: identity, tenant/DBK registry, provisioning, catalogue, price book, subscriptions, entitlements and feature flags.
- Domain plane: industry-specific business workflows and data.
- Economy plane: invoices, payment intents, verified provider events, financial transactions, journal entries, receipts, settlement and reconciliation.
- Asset plane: tenant-owned asset records, evidence references, append-only ownership events, valuation history, licences and revenue attribution.
- Intelligence plane: scoped agents and workflows; models propose, authoritative services validate and execute.
- Trust plane: tenant/branch authorization, audit, privacy, secrets, backup, recovery and compliance evidence.

The control plane owns subscription state; domain services own their domain records; the finance service owns financial truth; the asset service owns the registry and its event history. UI projections are never authoritative.

## 3. Canonical tenancy and storage

All tenant-owned records use the existing canonical namespace `/tenants/{tenantId}/...`. Do not introduce a parallel tenant namespace.

Existing paths to reuse:
- `/tenants/{tenantId}/subscriptions/{subscriptionId}`
- `/tenants/{tenantId}/financialTransactions/{transactionId}`
- `/tenants/{tenantId}/ledgerTransactions/{transactionId}/entries/{entryId}`
- `/tenants/{tenantId}/outbox/{eventId}`

New asset paths:
- `/tenants/{tenantId}/digitalAssets/{assetId}`
- `/tenants/{tenantId}/digitalAssets/{assetId}/ownershipEvents/{eventId}`
- `/tenants/{tenantId}/digitalAssets/{assetId}/valuations/{valuationId}`

Asset ownership is a claim with a recorded basis and evidence references, not proof of legal title. Valuations are dated estimates, not guaranteed realizable values. Ownership and valuation histories are append-only; current fields on the asset are projections.

## 4. Financial invariants

- KES is the default billing currency; each invoice explicitly stores currency and amount in integer minor units where practical.
- A payment request is PENDING until a trusted provider callback/query is verified.
- A browser redirect or client-supplied payment status never activates a subscription.
- Duplicate provider callbacks are idempotent.
- A payment, receipt, ledger posting and outbox event must be linked by stable IDs and reconciled.
- Every posted transaction has balanced immutable debit and credit entries.
- Corrections use reversal/counter-entries; never edit posted entries.
- Unknown provider outcomes remain PENDING/RECONCILIATION_REQUIRED and are queried/reconciled, not blindly retried.
- Subscription entitlements are activated only from a verified payment event or another explicitly approved non-payment grant.

## 5. Service contracts

| Service | Owns | Does not own |
|---|---|---|
| Identity / Tenant | principals, tenant and branch scope | money, asset title |
| Catalogue / Pricing | plans, SKUs, price versions | payment status |
| Subscription | contract period, tier, entitlement state | provider truth |
| Payment | provider intent, callback, reconciliation | subscription entitlement directly |
| Ledger | financial transactions and journal entries | UI balances |
| Asset Registry | asset records, ownership and valuation events | legal title adjudication |
| AI / Workflow | proposals, orchestration, evidence | authority to bypass domain checks |

## 6. Security and compliance gates

- Resolve tenant and branch from trusted SecurityContext; never trust a client-supplied tenant ID alone.
- Enforce permissions server-side for every command and query.
- Keep service credentials in Secret Manager / approved runtime secrets.
- Keep raw payment credentials, private keys and secrets out of Firestore documents, logs and model context.
- Apply data minimization, retention, consent and access logging to personal data.
- Before offering virtual-asset exchange, brokerage, custody, payment processing, stablecoin issuance or tokenized investment services, obtain Kenyan regulatory advice and all applicable CBK/CMA licences or operate through properly licensed providers under a reviewed agreement.
- No public token sale, yield promise, cash-redeemable stored value or pooled customer funds in the initial release.

Kenya's VASP Act 2025 commenced on 4 November 2025; the VASP Regulations 2026 were gazetted on 22 July 2026. CBK/CMA's 13 November 2026 notice confirms operationalisation. The National Payment System Policy/Bill 2026 is a separate evolving policy process and must be tracked.

## 7. Twelve-day implementation sequence

| Day | Delivery | Acceptance evidence |
|---:|---|---|
| 1 | Baseline audit, domain ownership and schema contract | Source map, gaps and signed-off invariants |
| 2 | Asset registry model and tenant-scoped persistence | Register/read/ownership/valuation tests |
| 3 | Catalogue and versioned price book | Price changes do not rewrite existing invoices |
| 4 | Subscription lifecycle hardening | Trial, paid, past-due, cancel, renew tests |
| 5 | Payment intent and callback verification | Signature/authentication, replay and duplicate tests |
| 6 | Ledger integration and reconciliation | Balanced journal, receipt and reversal tests |
| 7 | Entitlement projection and service access gates | Paid plan grants; expiry/cancel revokes |
| 8 | Customer portal and portfolio views | Tenant and owner isolation tests |
| 9 | WhatsApp order/support integration | Template, opt-in, retry and audit evidence |
| 10 | Revenue attribution and asset income records | Invoice-to-payment-to-revenue trace |
| 11 | Security, privacy, backup and recovery drills | Negative tests, restore evidence, runbooks |
| 12 | Pilot deployment and paid-customer acceptance | Production smoke tests and signed acceptance |

Parallel work is allowed only where service contracts are stable. Days are targets, not claims that integrations or production approval can be skipped.

## 8. Commercial launch priority

Prioritize revenue-producing, low-regulatory-risk offers:
1. TDBK Business subscriptions.
2. Setup, migration and onboarding fees.
3. Managed IT / connectivity contracts.
4. WhatsApp ordering and workflow automation.
5. Marketplace commissions after merchant terms and fulfilment rules exist.

Publish plans only after price, scope, support cost, cloud cost, taxes and payment fees are approved. Track gross collected cash separately from invoiced, contracted and forecast revenue.

## 9. Release gates

A capability is not COMPLETE because a file or UI exists. Completion requires:
- authenticated route and authorization,
- tenant/branch negative tests,
- authoritative persistence,
- idempotency and failure/retry behavior,
- audit evidence,
- unit/integration tests,
- CI pass on the proposed commit,
- deployed environment verification,
- end-to-end acceptance evidence.

No direct push to main. Implement on a feature branch, run CI, review the diff, then merge through an approved PR.
