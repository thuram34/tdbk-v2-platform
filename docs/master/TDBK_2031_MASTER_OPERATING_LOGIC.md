# TDBK 2031 — Master Operating Logic and Execution Map

Status: target operating model and engineering control contract  
Owner: TDBK platform programme  
Baseline: existing TDBK V2 repositories and services; this document does not assert that target capabilities are already implemented.

## 1. North-star outcome

TDBK is a reusable digital-business operating ecosystem. It provisions, connects, operates, measures and improves tenant-specific businesses using shared platform services and industry-specific applications. It earns through recurring software subscriptions, onboarding, managed IT, integrations, digital services and marketplace/partner revenue.

The product is not a collection of disconnected applications. It is a common business runtime plus governed industry capabilities and customer experiences.

## 2. End-to-end business lifecycle

Every customer journey follows this lifecycle:

1. Discover: prospect arrives through website, referral, partner, sales outreach or marketplace.
2. Qualify: capture need, industry, location, size, urgency, budget and decision authority.
3. Offer: recommend an industry blueprint, modules, implementation scope, price and service terms.
4. Contract: record accepted offer, billing terms, data-processing terms and applicable obligations.
5. Provision: create tenant/DBK, identity, owner, branch, entitlements, configuration, storage boundaries and audit context.
6. Compose: install the approved blueprint, capabilities, workflows, roles, templates and interfaces.
7. Connect: configure only supported integrations; validate credentials securely; run provider sandbox/health checks.
8. Migrate: import approved master data with mapping, validation, deduplication, reconciliation and rollback evidence.
9. Accept: execute customer acceptance tests against agreed workflows and obtain sign-off.
10. Activate: enable production access and billing only after readiness gates pass.
11. Operate: process business transactions through authoritative domain services and durable workflows.
12. Support: triage incidents, assign owners, communicate status and preserve evidence.
13. Improve: use telemetry, customer feedback, quality results and product analytics to prioritise improvements.
14. Renew, expand or exit: renew subscriptions, add capabilities, export customer data, revoke access and apply retention/deletion policy.

No customer should be marked production-ready merely because provisioning or a UI build succeeded.

## 3. Logical platform layers and ownership

### A. Experience and channels
Public TDBK website, customer portal, tenant workspaces, mobile-responsive experiences, admin console, support channels and partner interfaces. These are presentation layers; they do not own financial or permission truth.

### B. Industry applications / DBKs
Independent business experiences and domain workflows for:
- AquaFlow / water distribution
- Hardware and building supplies
- Schools and education
- Pharmacy and healthcare operations
- Retail and commerce
- Logistics and other approved verticals

Each vertical owns its domain vocabulary, validations, workflow definitions and user experience. Shared primitives must not erase sector-specific rules.

### C. Business runtime and control plane
Tenant/DBK registry, provisioning, lifecycle, branch topology, capability registry, entitlements, configuration, workflow orchestration, event contracts, API gateway and business-state projections.

The control plane manages tenant lifecycle and capability composition. Domain services remain authoritative for their own records.

### D. Domain services
Inventory, purchasing, sales, POS, quotations, orders, delivery, customer records, school admissions, attendance, academics, fee accounts, pharmacy stock, appointments, invoices, subscriptions and other bounded contexts.

Each domain service must define its authoritative write path, identifiers, validation rules, state transitions, audit events and reconciliation strategy.

### E. Integration and connectivity
M-Pesa, eTIMS/KRA, email, SMS, WhatsApp, banks, accounting exports, shipping/fleet and third-party APIs. Each connector needs a provider contract, credential reference, tenant scope, health state, callback verification, idempotency, retry policy, reconciliation and incident path.

Never treat a browser callback, client claim or unverified provider response as authoritative financial truth.

### F. Intelligence and automation
AI provider abstraction, specialist agents, tool registry, task planner, queue/worker execution, shared scoped context, memory/retrieval, policy checks, action execution, independent verification and audit. AI may interpret, recommend and prepare actions; authoritative services decide whether records change.

### G. Trust, security and compliance
Identity, session validation, RBAC/ABAC, tenant isolation, branch scope, secrets management, encryption, audit trails, data retention, consent, backup, disaster recovery, vulnerability management and statutory controls.

### H. Infrastructure and delivery
Source repositories, CI, tests, build artifacts, container images, environments, deployment approvals, runtime monitoring, logs, traces, metrics, backups, restore drills and incident response.

## 4. Cross-platform invariants

These are non-negotiable system-wide rules:

1. Tenant isolation: every tenant-owned read/write is scoped from a trusted security context; never trust tenant IDs supplied only by the client.
2. Branch scope: branch-level permissions are enforced in services, not only in UI.
3. Authoritative writes: domain services own canonical state; dashboards and projections are rebuildable.
4. Financial integrity: payment status, ledger postings, invoices and balances require verified evidence and immutable audit history.
5. Idempotency: externally visible operations use stable operation identities and provider idempotency/reconciliation where supported.
6. Durable execution: workflow/agent claims, leases, retries and completion records survive process restarts.
7. Least privilege: every human, service and agent receives only the minimum authority needed.
8. AI boundary: model output is untrusted input; validate schemas and evidence; AI cannot grant itself permissions or declare an external transaction successful.
9. Auditability: record actor, tenant, branch, correlation, causation, action, before/after evidence where appropriate, decision and outcome.
10. Recovery: every critical write path has retry, reconciliation, compensation or a documented manual recovery procedure.
11. Privacy: sensitive data is minimized, scoped, retained only as required and never copied into broad agent context.
12. Release integrity: no production release without reproducible build, passing required checks, reviewed changes and rollback plan.

## 5. Transaction logic: canonical pattern

A business operation follows:

Request -> authenticate -> resolve trusted tenant/branch -> authorize -> validate domain invariants -> claim idempotency key -> execute authoritative write or provider call -> persist result -> emit domain event -> update projections asynchronously -> verify postconditions -> audit -> notify.

Failure handling:
- Before external side effect: safe retry may be possible.
- After request sent but outcome unknown: mark UNKNOWN/PENDING and reconcile with provider; do not blindly repeat.
- Provider success but local persistence failure: recover using provider reference and stable operation identity.
- Projection failure: rebuild from authoritative records/events.
- Verification failure: stop dependent steps, preserve evidence, alert and route to repair.
- Compensation is explicit and domain-approved; never assume a reversal is equivalent to deleting history.

## 6. Specialist-agent operating model

The Chief Intelligence Agent is the coordinator, not an unrestricted superuser. Specialists are scoped roles:

- Engineering: code, architecture, technical debt and implementation.
- Infrastructure: runtime, CI/CD, capacity, backups and recovery.
- Security: threat review, access boundaries and tenant isolation.
- Finance: cash, billing, ledger and reconciliation analysis.
- Revenue: packaging, pricing analysis, retention and expansion.
- Sales: prospect research, qualification, proposals and pipeline.
- Education: school domain workflows.
- Retail: stock, POS, procurement and warranty workflows.
- Healthcare: pharmacy/clinic workflows with strict clinical boundaries.
- Compliance: regulatory requirements and evidence.
- Payments: provider integration and settlement reconciliation.
- Logistics: fulfilment, dispatch and delivery.
- Research: market and technical intelligence.
- Quality: test design, acceptance evidence and release verification.

Agent execution stages:
1. Receive a task with trusted principal, tenant, branch, correlation and objective.
2. Classify risk and decompose into bounded work items.
3. Assign a lead specialist and reviewers.
4. Retrieve only tenant-authorized, task-relevant context.
5. Produce a structured proposal with evidence, assumptions and expected postconditions.
6. Validate proposal schema and policy.
7. Execute only through registered tools and existing authority checks.
8. Require human approval for sensitive, external, financial, destructive or irreversible actions unless a narrowly defined policy explicitly permits automation.
9. Persist task, claims, tool calls, outputs and audit evidence.
10. Independently verify results; failed verification blocks dependent work.
11. Report outcome, remaining risks and next action.

Current baseline distinction: the coordinated agent PR introduces 15 role definitions and deterministic action routing over the existing runtime. It is not yet a fleet of independently running model workers. Real specialist model execution, task queueing, domain adapters, scoped memory and independent QA must be implemented and tested before claiming autonomous workforce operation.

## 7. Commercial operating system

Revenue lifecycle:
Lead -> qualified opportunity -> discovery -> scoped proposal -> approval -> contract -> invoice/subscription -> payment confirmation -> onboarding -> active usage -> support -> renewal/expansion.

Revenue streams:
- Recurring application subscriptions by tenant, capability or tier.
- One-time onboarding, migration, configuration and training.
- Managed IT, hardware support and maintenance.
- Integration and API services.
- Websites, commerce and digital transformation projects.
- Marketplace and partner commissions.

Commercial controls:
- Maintain a price book and approval history.
- Calculate delivery cost and gross margin before quoting.
- Separate contracted recurring revenue from one-off revenue.
- Reconcile invoices, receipts, provider settlements and ledger entries.
- Track acquisition cost, activation, retention, churn, expansion, support cost and cloud cost.
- Never claim revenue from an unverified payment or unsigned offer.

## 8. Operations and service management

Every production capability needs:
- Named service owner and escalation path.
- Health/readiness endpoint or equivalent observable signal.
- Structured logs with correlation IDs and redaction.
- Metrics for volume, latency, errors and saturation.
- Alerts tied to actionable runbooks.
- Backup and restore objective.
- Incident severity, communication and post-incident review.
- Support ticket lifecycle and customer-facing status.
- Release notes and compatibility/migration policy.

Minimum service lifecycle states:
PLANNED -> IMPLEMENTING -> IN_REVIEW -> TESTING -> RELEASE_READY -> DEPLOYED -> VERIFIED -> OPERATING.
Failure states include BLOCKED, DEGRADED, ROLLBACK_REQUIRED and RETIRED. A status transition requires evidence.

## 9. Capability completion contract

A capability is COMPLETE only when all applicable conditions are evidenced:

- Business owner and user journey defined.
- Domain data model and authoritative service identified.
- Tenant and branch scope enforced.
- Roles and permissions tested.
- Happy path and negative paths implemented.
- Validation, concurrency and idempotency addressed.
- Failure/retry/reconciliation path documented and tested.
- Audit events emitted.
- UI connected to real service behavior.
- Unit, integration and end-to-end tests pass.
- Accessibility and responsive behavior checked where applicable.
- Security and privacy review completed.
- Monitoring, support runbook and recovery path exist.
- CI checks pass and deployment is verified in target environment.
- Customer acceptance criteria pass.
- Commercial packaging and support ownership defined if customer-facing.

A page, mock, stub, passing typecheck or successful deployment alone is not completion.

## 10. Delivery sequence and dependencies

### Foundation gate
Repository inventory, architecture map, environment/secret inventory, CI health, identity, tenant/branch isolation, persistence contracts, audit and backup/recovery.

### Transaction gate
Domain service contracts, authoritative records, workflow engine, event contracts, idempotency, retry/reconciliation and projections.

### Vertical-product gate
Complete one real customer journey per priority vertical, beginning with the existing products and their actual customer requirements. Reuse shared services without forcing incompatible domain models.

### Integration gate
M-Pesa, eTIMS and communications only when real provider contracts, credentials, callback validation, sandbox tests, production approval and reconciliation are available.

### Agent gate
Role registry -> specialist prompts/contracts -> model provider adapter -> scoped retrieval -> tool registry -> durable task queue -> policy enforcement -> parallel execution -> independent QA -> observability -> controlled autonomy.

### Commercial gate
Lead capture, CRM/pipeline, pricing, contracts, subscriptions, billing, payment reconciliation, onboarding, support and renewal.

### Scale gate
Blueprint catalogue, self-service provisioning, partner APIs, marketplace, multi-region resilience and expansion markets.

## 11. Programme control registers

Maintain five linked registers as the source of truth:

1. Future capability register: capability ID, desired outcome, acceptance criteria, owner, priority and dependencies.
2. Repository implementation register: repository, branch, paths, current implementation, test evidence and deployment state.
3. Gap/dependency register: missing work, blockers, risk, prerequisite and resolution.
4. Execution register: work item, assigned team/agent, branch, PR, CI run, review, release and verification evidence.
5. Commercial register: offer, customer segment, price, delivery cost, lead stage, contract, payment, activation, renewal and margin.

Each register entry must reference stable IDs so that a capability can be traced from business need to code, tests, deployment and revenue.

## 12. Initial execution priorities

1. Reconcile all known TDBK repositories and live integrations before adding overlapping systems.
2. Restore CI reliability and resolve the current agent-workforce PR typecheck failure before expanding that change.
3. Establish the canonical tenant/branch/security and persistence contracts.
4. Trace one end-to-end business transaction in each priority application.
5. Validate real M-Pesa and eTIMS integration contracts; label unavailable production dependencies honestly.
6. Establish commercial onboarding and subscription-to-payment reconciliation.
7. Extend the agent runtime only after inspecting existing AI provider, event bus, Pub/Sub, workflow and persistence capabilities.
8. Release in small, verifiable increments; never merge or deploy a failing or unreviewed production change.

## 13. Definition of TDBK success

TDBK succeeds when a real customer can discover, buy, onboard, operate, get support for, renew and safely exit a TDBK service; their business records remain correct and isolated; critical integrations reconcile; the platform is observable and recoverable; releases are repeatable; and each deployment contributes measurable recurring or service revenue.

The programme is measured by customer outcomes, uptime, workflow completion, data integrity, security incidents, time-to-onboard, support resolution, gross margin, recurring revenue, retention and verified delivery—not by repository count, feature count or agent count.
