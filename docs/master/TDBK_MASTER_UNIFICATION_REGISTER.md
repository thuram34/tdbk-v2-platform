# TDBK Master Unification Register — Stage 1 Baseline

**Baseline date:** 2026-11-17  
**Status:** INITIAL INVENTORY — NOT A PRODUCTION READINESS CERTIFICATION  
**Canonical register location:** `docs/master/TDBK_MASTER_UNIFICATION_REGISTER.md`  
**Baseline branch:** `main`  
**Register working branch:** `audit/stage-1-master-unification-register`

## 1. Purpose and control rules

This register establishes the evidence-backed inventory for the TDBK ecosystem before consolidation or architectural changes.

TDBK is the whole tree and governing root organisation:
- **Roots:** infrastructure, identity, data, security, integrations, capital, governance and knowledge.
- **Trunk:** TDBK Master Engine and control plane — tenancy, provisioning, permissions, capabilities, workflows, subscriptions, payments and shared services.
- **Branches:** DBK operations, SOKONI commerce/media, and independent industry businesses/products.
- **Canopy/leaves:** public storefronts, portals, apps, catalogues, profiles, campaigns and customer experiences.
- **Fruits:** paying customers, projects, recurring subscriptions, marketplace orders, advertising revenue and reinvestment.

No product repository is to be merged or retired merely because another repository has a similar name. Preserve working client systems and domain logic until equivalence, migration, rollback and ownership are proven.

### Status vocabulary
- **PRESENT — REPOSITORY EVIDENCE:** supported by files inspected; not proof of runtime operation.
- **PARTIAL / VERIFY:** code or documentation exists, but integration, production configuration or end-to-end proof is incomplete.
- **BLOCKED:** documented blocker or unresolved required dependency.
- **NOT INVENTORIED:** no sufficient evidence inspected yet; does not mean absent.
- **NOT VERIFIED LIVE:** no authenticated production test performed in this baseline.

## 2. Repository inventory

| System | Repository / default branch | Observed scope | Baseline assessment | Next evidence required |
|---|---|---|---|---|
| Master platform | [tdbk-v2-platform](https://github.com/thuram34/tdbk-v2-platform) / main | Multi-tenant kernel, DBK portfolio, capability/blueprint model, workflows, projections, agent and finance subsystems | PRESENT — REPOSITORY EVIDENCE; integration and production readiness PARTIAL / VERIFY | Current CI/workflow state, open PR reconciliation, tenant adversarial tests, deployed service map, provider E2E |
| Pride Industries | [Aquaflow](https://github.com/thuram34/Aquaflow) / main | Water/consumer products operations: inventory, sales, credit, delivery, containers, expenses, staff, M-Pesa boundary | PRESENT — REPOSITORY EVIDENCE; durable hosting and live payment proof NOT VERIFIED LIVE | Active hosting/data path, backup/restore, current client workflow, payment callbacks, delivery/stock lifecycle |
| Pharmacy product A | [chemist-pro](https://github.com/thuram34/chemist-pro) / main | Standalone React/TS pharmacy POS, Firebase Auth/API, tenant-scoped operations, stock and sales | PARTIAL / VERIFY; README explicitly says not approved for live pharmacy trading | Draft hardening PR, dedicated Firebase project, deployed E2E, M-Pesa, subscription lifecycle, FEFO and regulatory boundary |
| Pharmacy product B | [TRAIL-PHARMACY](https://github.com/thuram34/TRAIL-PHARMACY) / main | README describes a broader Kenya pharmacy OS with Firestore, FEFO, procurement, prescriptions, payments and reporting | NOT VERIFIED LIVE; README claims require code and deployment validation | Compare source, data model, features, branch history, tests, deployments and migration risk against chemist-pro |
| Hospital | [ugatuzi-hospital-management-system](https://github.com/thuram34/ugatuzi-hospital-management-system) / main | Hospital workflow, identity, patient records, clinical, ward, lab, pharmacy, billing, M-Pesa and SHA boundaries | PRESENT — REPOSITORY EVIDENCE; production integrations PARTIAL / VERIFY | Runtime, privacy/security, clinical workflow QA, Daraja/SHA UAT, tenant isolation and deployment |
| Education | [Sajid-intergrayed](https://github.com/thuram34/Sajid-intergrayed) / main | Repository discovered; README.md not found at root | NOT INVENTORIED | Inspect root tree, package manifests, docs, deployment and owner/customer context |
| Electronics | [my-home-electronics](https://github.com/thuram34/my-home-electronics) / main | Repository discovered; README.md not found at root | NOT INVENTORIED | Inspect root tree, package manifests, docs, deployment and owner/customer context |

**Important:** repository discovery confirms visibility and default branch only. It does not establish that any system is deployed, has active customers, or is production-ready.

## 3. Master platform — observed capability map

The repository README describes a multi-tenant, multi-DBK platform with three authorization tiers:
1. TDBK master authority.
2. Business owner / portfolio.
3. DBK tenant operations.

The repository's baseline capability ledger (last inspected 2026-11-09 on feature branch `feature/coordinated-agent-workforce`) records code for:
- AI provider abstraction, command boundary and conversation memory.
- Agent runtime, role catalogue, team routing and Firestore execution repositories.
- Event bus, Pub/Sub transport/consumer and durable workflow engine.
- Firestore persistence and connector readiness.
- Finance ledger, reconciliation and receipts.
- Subscription payment handler.
- Kernel identity/tenant controls and Firestore rules.
- CI workflow.

That ledger explicitly requires further proof for durable execution/recovery, real provider delivery, production Firestore configuration, payment-to-ledger reconciliation, tenant adversarial tests and CI. It also warns that deterministic AI fallback can produce synthetic invoice/vendor/payment assertions and must never be mistaken for evidence.

The DBK website experience contract states that the Engine is authoritative for identity, tenancy, DBK identity, Business DNA, capabilities, entitlements, permissions, transactions, payments, receipts, workflows, events, AI orchestration, connectors, audit and security. DBK is an experience layer and must not create competing local authority. It also flags public organisation projection and SOKONI integration as MASTER REVIEW REQUIRED in the inspected contract.

## 4. Cross-repository dependency map (initial)

| Dependency | Producer / authority | Consumers | Current status |
|---|---|---|---|
| Master identity, tenancy, roles and permissions | TDBK Master Engine | DBK and industry partitions | Contract/code evidence exists; production isolation NOT VERIFIED LIVE |
| Business DNA, blueprint and capability entitlement | TDBK Master Engine | DBK workspace and industry products | Contract/code evidence exists; full consumer integration NOT VERIFIED |
| Subscription, licensing and entitlement | TDBK Master Engine | DBK and all paid industry branches | Code evidence exists; real payment activation and enforcement NOT VERIFIED |
| Payments, receipts and ledger | Master finance/payment services with provider-specific adapters | Pride, pharmacy, hospital, marketplace | Production callback authenticity/reconciliation remains a gate |
| Product, seller and service catalogue | Authoritative product/tenant services (to be confirmed) | SOKONI, DBK public experiences, POS | Ownership/schema not yet unified |
| Customer orders and delivery | Industry/product services; shared contracts to be defined | Pride, SOKONI, other branches | End-to-end cross-system contract NOT INVENTORIED |
| Public organisation profile and SOKONI handoff | Engine-authorised public projection | DBK and SOKONI | MASTER REVIEW REQUIRED in inspected contract |
| AI workforce and automation | Master orchestration with specialist adapters | All branches | Catalogue/routing code exists; autonomous specialist execution NOT VERIFIED |
| Cloud, domains, hosting and deployments | Provider accounts / project-level owners | All services | NOT INVENTORIED across projects |

## 5. Immediate engineering and operational risks already evidenced

1. **Master release and CI recovery:** TDBK issue [#590](https://github.com/thuram34/tdbk-v2-platform/issues/590) tracks reconciliation of open PRs and trustworthy CI. Issue [#637](https://github.com/thuram34/tdbk-v2-platform/issues/637) and related CI issues record failures. Do not merge or close PRs without inspecting diffs, checks, dependencies and overlap.
2. **Public commercial actions:** issue [#658](https://github.com/thuram34/tdbk-v2-platform/issues/658) records hardcoded quote/VAT values and consultation submission success without confirmed persistence. Public actions must use authoritative pricing/tax and durable lead creation.
3. **Domain and cloud lifecycle:** issue [#656](https://github.com/thuram34/tdbk-v2-platform/issues/656) tracks business identity, domain, DNS, hosting and branded email lifecycle.
4. **Tenant isolation and transaction integrity:** issue [#543](https://github.com/thuram34/tdbk-v2-platform/issues/543) calls for proof of kernel tenant isolation, durability and transaction integrity.
5. **M-Pesa production trust boundary:** the existing production callback verification audit records fail-closed behavior where Safaricom-origin authentication cannot be established. This is a security gate, not a reason to accept unauthenticated callbacks. Provider authenticity, transaction query, tenant resolution, amount/reference validation, idempotency, reversals and ledger reconciliation must be proven before live activation.
6. **Pride data durability:** Aquaflow README documents JSON persistence and requires durable storage, off-host encrypted backup and isolated restore testing. Hosting/data path must be identified before any migration.
7. **Pharmacy duplication:** two separate pharmacy repositories exist. Neither is to be declared canonical until a feature/data/security/deployment comparison is completed.
8. **Claims versus evidence:** repository README badges or prose (including “production ready” and “compliant”) are not production evidence.

## 6. Business and revenue inventory

| Revenue line | Evidence in current baseline | Status |
|---|---|---|
| Client software / implementation services | Prior reported client projects; current commercial pipeline not connected to this repository inspection | PARTIAL / VERIFY |
| Pride Industries implementation and support | Prior engagement and quoted package/monthly fee recorded in project context; current acceptance, balance and live status not verified here | PARTIAL / VERIFY |
| Managed IT / connectivity | Business model established in project context; active customer/contract register not inspected | NOT INVENTORIED |
| Industry software subscriptions | Tier/activation code or documentation exists in some products; paid lifecycle not proven | PARTIAL / VERIFY |
| SOKONI marketplace transaction fees | Product direction established; production seller/order/payment loop not evidenced in this repository pass | NOT INVENTORIED |
| Cinematic advertising services | Commercial concept and channel strategy established; customer pipeline and delivered campaigns not inventoried | NOT INVENTORIED |

Near-term revenue collection and Pride client delivery remain parallel priorities while the technical baseline is assembled. Do not delay paid client work for speculative platform expansion.

## 7. Missing evidence register

The following have not been verified in this Stage 1 pass:
- All live URLs, DNS records, TLS, hosting provider, deployment project IDs and production revisions.
- GCP/Firebase project inventory, regions, billing plans, IAM, secrets, Firestore rules/indexes, backup policy and restore evidence.
- GitHub Actions latest run status and branch protection for every repository.
- Full PR/branch graph and merge-base analysis across the seven repositories.
- Runtime smoke tests and production-like end-to-end journeys.
- Active customers, contracts, invoices, receivables, subscriptions and current monthly recurring revenue.
- Current staff/agent ownership and responsibility register.
- SOKONI deployed application, catalogue schema, seller onboarding, order lifecycle, advertising workflow and payment integration.
- WhatsApp Business Cloud, M-Pesa Daraja, KRA eTIMS, email, SMS, bank and SHA provider credentials/configuration and UAT/production evidence.
- Network infrastructure and remote substations (Starlink, MikroTik, WireGuard, 5G routers) and operational monitoring.
- Data ownership, retention, privacy controls, incident response, RPO/RTO and disaster recovery drills.

## 8. Stage 1 completion checklist

- [x] Discover repositories accessible to connected GitHub account.
- [x] Identify default branches for seven relevant repositories.
- [x] Inspect master README and existing baseline capability ledger.
- [x] Inspect DBK experience authority contract.
- [x] Inspect available root READMEs for five product repositories; identify two missing root READMEs.
- [x] Record initial dependencies, blockers and evidence gaps.
- [ ] Inspect all repository manifests, source trees, workflows, branches, PRs and issue backlogs.
- [ ] Verify deployment and cloud resources using authorized connected providers.
- [ ] Inventory customers, contracts, revenue, tasks and operational ownership.
- [ ] Publish evidence-linked final baseline and obtain explicit freeze decision.

**Stage 1 status: IN PROGRESS.** This document is the first controlled register, not the final frozen baseline. Continue inventorying before proposing repository consolidation, migrations or production changes.
