# TDBK Provider–Client Boundary

**Status:** Architecture baseline / proposed implementation contract  
**Applies to:** TDBK V2 platform and all provisioned Digital Business Kernels (DBKs)

## 1. Product boundary

TDBK is the technology service provider and platform operator. A client is an independent business that consumes one or more TDBK services through an isolated Client Workspace (Digital Business Kernel, or DBK).

TDBK must not become the legal or operational owner of a client's business. The client remains responsible for its business decisions, staff, products, prices, transactions and day-to-day operations. TDBK is responsible for the contracted software, infrastructure, integrations, security controls, support and service availability.

## 2. Three-plane architecture

### A. TDBK Control Plane (provider side)
Owns platform-wide administration:
- provider identity, internal staff, roles and privileged access;
- tenant onboarding, verification status and provisioning orchestration;
- service catalogue, plans, entitlements, subscriptions and billing records;
- module catalogue, versions, deployment policies and feature flags;
- infrastructure inventory, connector registry and operational monitoring;
- support cases, audit review, incident response and platform-wide reporting.

The control plane stores only the minimum client metadata required to operate the service. It must not expose unrestricted client operational data to ordinary TDBK staff.

### B. Client Workspace / DBK (client side)
Each client workspace owns its business configuration and operational records:
- business profile, branches, staff, roles and local permissions;
- customers, suppliers, products, stock, orders, invoices and payments;
- business workflows, documents, reports and preferences;
- client-authorized integrations and device registrations.

A client may have multiple branches and modules within one workspace. A workspace is not a separate legal entity unless the client's contract and configuration explicitly establish that relationship.

### C. Service Gateway (boundary)
All cross-plane operations pass through authenticated, authorized service interfaces:
- identity and tenant-context resolution;
- entitlement and subscription checks;
- schema validation and API versioning;
- rate limiting, idempotency and replay protection;
- audit events and trace correlation;
- connector/device authorization;
- data export, support access and lifecycle operations.

No frontend-only tenant check is an authorization boundary. Every server-side read and write must enforce tenant scope and the caller's permission.

## 3. Tenant isolation invariants

1. Every tenant-owned record has an immutable `tenantId`; branch-scoped records also carry a validated `branchId`.
2. The server derives tenant membership from a verified identity/session and membership record. Never trust a tenantId supplied only by the browser.
3. Every repository/service method that accesses tenant data requires an explicit, validated tenant context.
4. Database queries, writes, storage paths, background jobs, exports, search indexes and event consumers enforce the same tenant boundary.
5. Cross-tenant access is denied by default. Provider support access is time-bound, least-privilege, reason-coded and audited.
6. Platform-wide collections are separated from tenant-owned collections and have explicit access policies.
7. Tests must attempt cross-tenant reads, writes, list queries, file access, exports and background-job execution.
8. Tenant identifiers are not authorization secrets. Knowing an ID must never grant access.

Suggested logical paths (adapt to the existing repository conventions before implementation):
- `/tenants/{tenantId}/...` for tenant-owned records;
- `/platform/...` for provider-owned control-plane records;
- storage objects partitioned by tenant and protected by server/rules enforcement.

Do not perform a broad path migration until the existing Firestore schema, security rules and consumers have been inventoried.

## 4. Identity and authorization model

Use separate, explicit role domains:
- **Provider roles:** platform_owner, platform_admin, support_agent, finance_operator, auditor, operations_operator.
- **Client roles:** client_owner, client_admin, branch_manager, supervisor, cashier, accountant, inventory_operator, read_only (module-specific roles may extend this set).

Authorization is the intersection of:
- authenticated principal;
- active tenant membership;
- role/permission grants;
- resource ownership/scope (tenant and optionally branch);
- active service entitlement;
- any required approval or step-up authentication.

Provider staff do not inherit client-owner privileges. Support access must be explicitly granted, scoped, expire automatically and produce immutable audit events. Break-glass access requires a reason and post-event review.

## 5. Data ownership, portability and lifecycle

- Client owns or controls its business data, subject to applicable law and the signed service agreement.
- TDBK retains ownership of its platform software, reusable modules, deployment tooling, generic schemas, operating methods and provider infrastructure.
- Client-specific custom work, source-code rights and licences are governed by the individual statement of work; never imply that a subscription automatically transfers TDBK master IP.
- Provide documented export in practical formats for agreed data categories.
- Define retention, backup, restore, deletion and termination windows in the contract and implementation.
- On termination: revoke client access and credentials, stop billable services according to contract, preserve legally required records, offer agreed export, then delete or anonymize data according to the retention policy.
- Backups and logs must follow the same retention and deletion commitments, with documented exceptions for immutable audit/legal retention.

## 6. Commercial and entitlement boundary

A client may subscribe to a package and add modules, branches, users, devices or usage capacity. The entitlement service—not hidden UI state—determines whether a feature is available.

Commercial records should distinguish:
- one-time onboarding/setup fees;
- recurring subscription fees;
- usage-based charges;
- hardware supplied or purchased by the client;
- third-party charges paid directly or passed through;
- custom development and support agreements.

Never disable access to client-owned data merely because a subscription is overdue. Apply contractual service restrictions carefully while preserving lawful access, export and dispute processes.

## 7. Provisioning lifecycle

Recommended states:
`lead → qualified → proposal → accepted → provisioning → active → suspended → termination_pending → export_window → closed`

Provisioning must be idempotent and resumable. A failed step must not create duplicate tenants, users, billing records or resources. Maintain a provisioning journal with step status, correlation ID, retry count and operator actions.

Minimum activation gates:
- signed agreement / accepted order;
- verified client owner identity and contact;
- selected package and entitlements;
- tenant and initial owner membership created;
- baseline security policies applied;
- required modules configured;
- backup/export policy assigned;
- client acceptance/UAT recorded.

## 8. Audit and observability

Record at minimum: actor, actor type, tenant scope, action, resource type/id, timestamp, outcome, source/correlation ID and reason where applicable. Do not log passwords, tokens, payment secrets or unnecessary personal data.

Audit events should cover privileged access, role changes, exports, billing changes, integration credential changes, destructive actions, support access and security-policy changes. Separate operational telemetry from business data.

## 9. Integration and hardware boundary

Client integrations (M-Pesa, email, WhatsApp, accounting, printers, barcode scanners, weighing scales and other devices) are registered to a tenant and, where relevant, a branch. Secrets are stored in a managed secret store, never in client-readable documents or frontend bundles. Device credentials are revocable and scoped. Compatibility must be validated against exact hardware models and protocols before being represented as supported.

## 10. Delivery roadmap

**Phase 0 — Reconcile:** inventory current tenant model, auth provider, Firestore paths, rules, storage, Cloud Functions/Run services, jobs, connectors and existing admin modules. Produce a data-flow and permission map.

**Phase 1 — Boundary enforcement:** implement trusted tenant context, centralized authorization, tenant-scoped repositories, storage isolation and cross-tenant negative tests. Resolve any permissive rules before onboarding real clients.

**Phase 2 — Control plane:** formalize client lifecycle, provisioning journal, service catalogue, entitlements, subscription state and support-access workflow.

**Phase 3 — Client workspace:** expose client-owner onboarding, workspace settings, user/branch management, module activation, exports and support requests.

**Phase 4 — Operations:** backup/restore drills, audit review, monitoring, incident response, termination/export workflow and client acceptance.

**Phase 5 — Commercial scale:** reusable industry packages, partner/reseller model, usage billing and marketplace discovery.

## 11. Release acceptance criteria

Do not label the provider/client boundary production-ready until:
- automated tests prove tenant A cannot read, mutate, enumerate or export tenant B data;
- storage, APIs, background jobs, search and integrations enforce tenant scope;
- client roles are enforced server-side, not only in the UI;
- provider support access is least-privilege, expiring and audited;
- provisioning is idempotent and recoverable;
- export, backup/restore and termination procedures are tested;
- contracts clearly define data ownership, IP/licensing, service levels, support and exit rights.

## 12. Non-goals and guardrails

This document does not authorize a production schema migration, change security rules, grant provider staff blanket data access, or promise regulatory compliance. It is the architecture baseline against which the existing implementation must be audited. Preserve existing working modules and migrate incrementally with tests and rollback plans.
