# TDBK Baseline Capability Ledger

Last inspected: 2026-11-09  
Repository inspected: `thuram34/tdbk-v2-platform`  
Branch inspected: `feature/coordinated-agent-workforce`  
Purpose: evidence-backed baseline, not a declaration of production readiness.

## Status vocabulary

- **PRESENT — CODE**: implementation files exist; production behavior is not implied.
- **PRESENT — TESTS**: test files exist; passing status must be verified against the current commit.
- **PARTIAL / VERIFY**: implementation exists but an important production contract, deployment state or end-to-end proof remains unverified.
- **BLOCKED**: current evidence shows a failing required check or missing dependency.
- **NOT INVENTORIED**: repository/service not yet inspected; never interpret as absent.

## 1. Repository baseline observed

The inspected TDBK V2 repository contains these relevant subsystems:

| Capability | Evidence paths | Baseline status | Required next proof |
|---|---|---|---|
| AI provider abstraction | `src/document_ai/ai/aiProvider.ts` | PRESENT — CODE; PARTIAL / VERIFY | Verify provider selection, key availability, model response validation, error semantics and production configuration. |
| AI command boundary | `src/document_ai/ai/aiCommandBoundary.ts` | PRESENT — CODE | Verify durable proposal lifecycle, approval policy, replay protection and production route integration. |
| AI conversation memory | `src/document_ai/memory/aiMemoryManager.ts`; `src/persistence/firestore/repositories/aiConversationRepository.ts` | PRESENT — CODE | Verify durable reads/writes, principal/branch scoping, retention and redaction. |
| Agent command runtime | `src/platform/agent/agentRuntime.ts` | PRESENT — CODE; PARTIAL / VERIFY | Verify authorization, durable claims, lease expiry/recovery, result persistence and route behavior under crash/replay. |
| Agent role catalogue | `src/platform/agent/agentCatalog.ts` | PRESENT — CODE | Role definitions are not independent workers. Dedicated model/tool adapters remain required. |
| Agent team routing | `src/platform/agent/agentTeamCoordinator.ts` | PRESENT — CODE | Currently deterministic assignment metadata; it does not invoke specialist collaborators. |
| Agent execution persistence | `src/persistence/firestore/repositories/agentExecutionRepository.ts`; `agentActionExecutionRepository.ts` | PRESENT — CODE | Verify lease ownership, crash recovery, idempotency and Firestore rules under concurrent executions. |
| Event bus | `src/orchestration/events/eventBus.ts` | PRESENT — CODE | Verify durable publish semantics, outbox handoff, ordering, retries and duplicate delivery in production. |
| Pub/Sub transport and consumer | `src/orchestration/events/pubsubTransport.ts`; `pubsubConsumer.ts` | PRESENT — CODE; PARTIAL / VERIFY | Verify live GCP topic/subscription, IAM, push audience/service identity, dead-letter/retry configuration and end-to-end event delivery. |
| Durable workflow engine | `src/orchestration/workflow/engine.ts` | PRESENT — CODE | Verify persisted workflow transitions, lease/recovery, compensation and real provider side effects. |
| Firestore persistence | `src/persistence/firestore/` | PRESENT — CODE | Verify production project, security rules, indexes, backup policy, restore drills and tenant-scoped access. |
| Connector readiness | `src/platform/connectors/connectorReadinessService.ts` | PRESENT — CODE | Verify each provider against real sandbox/production contracts and tenant credentials. |
| Finance / ledger / reconciliation | `src/finance/`; repositories include `financialLedgerRepository.ts`, `reconciliationRepository.ts`, `receiptRepository.ts` | PRESENT — CODE | Trace a real payment-to-receipt-to-ledger-to-invoice reconciliation with provider evidence and reversal handling. |
| Subscription payment handler | `src/platform/subscription/subscriptionPaymentHandler.ts` | PRESENT — CODE | Verify authoritative callback authentication, duplicate handling and subscription activation against real provider events. |
| Identity and tenant controls | `src/kernel/`; `firestore.rules` | PRESENT — CODE | Run cross-tenant and branch-scope adversarial tests; verify deployed rules and production identity configuration. |
| CI/CD | `.github/workflows/ci.yml` | PRESENT — CODE; BLOCKED at last completed run | Current feature branch run must complete all gates; earlier run failed TypeScript due to duplicate AgentAssignment export, now corrected and rerunning. |
| Customer acquisition / CRM | NOT YET INVENTORIED | NOT INVENTORIED | Inspect public site, lead capture, CRM records, pricing, proposals, contracts and customer onboarding. |
| Product-specific applications | NOT YET INVENTORIED ACROSS REPOSITORIES | NOT INVENTORIED | Inventory every product repository and trace a complete customer journey per vertical. |
| Production operations | NOT YET VERIFIED | NOT INVENTORIED | Verify deployments, domains, secrets configuration, logs, metrics, alerts, SLOs, backups and restore tests. |

## 2. Confirmed agent-workforce CI defect and correction

The failed CI log for run `42585819108` identified:

```
src/platform/agent/index.ts(10,1): error TS2308:
Module './types' has already exported a member named 'AgentAssignment'.
```

Cause: `AgentAssignment` was declared in both `types.ts` and `agentTeamCoordinator.ts`, while the barrel exported both modules.

Correction committed as `a53c69c3edd888519e3cba00e947d33437e99ee1`: coordinator now imports the shared `AgentAssignment` contract from `types.ts` instead of redeclaring/exporting it.

The subsequent CI run `42587821578` was in progress at the time of this ledger update. Do not call the correction verified until that run completes successfully.

## 3. Material design risks requiring engineering follow-up

### 3.1 Deterministic AI fallback can fabricate business assertions

The current `LocalDeterministicAiProvider` in `src/document_ai/ai/aiProvider.ts` returns fixed illustrative invoice, vendor, amount and reconciliation narratives, and the Gemini provider falls back to it when the key is absent or a request fails.

This is unsafe if any caller treats that output as extracted evidence or a real reconciliation result. Required remediation:
- Clearly mark deterministic outputs as synthetic/test-only.
- In production, return an explicit unavailable/provider error when no real model response exists.
- Never emit fabricated payment matches, invoice references, vendor identities, totals or confidence claims.
- Add regression tests proving provider outages cannot produce authoritative-looking financial facts.
- Keep authoritative financial decisions in ledger/provider-backed services.

### 3.2 Agent assignments are not specialist execution

`agentTeamCoordinator.coordinate()` currently attaches deterministic lead/collaborator IDs to actions. `agentRuntime.run()` continues executing the existing action loop; it does not dispatch independent specialist model calls or run collaborators in parallel.

Required sequence:
1. Keep existing authority and idempotency gates.
2. Define a specialist task contract and structured output schema.
3. Connect through the existing provider abstraction only after provider behavior is made trustworthy.
4. Add tenant-scoped retrieval and tool allowlists.
5. Persist specialist task claims/results with durable leases.
6. Add independent QA review and explicit dependency barriers.
7. Measure latency, token/cost use, failures and verification rates.
8. Preserve human approval for high-impact external, financial, destructive and irreversible actions.

### 3.3 Pub/Sub fallback must not be mistaken for delivery

`pubsubTransport.ts` returns a fallback identifier for some permission/API-disabled errors. That return value is not proof the message reached Pub/Sub. Production health and event delivery must distinguish accepted-by-provider, queued-in-outbox, locally simulated and failed/unavailable states.

## 4. Execution sequence

| Order | Work item | Exit evidence |
|---|---|---|
| 1 | Complete current PR CI | Typecheck, lint, capability gate, flow gate, tests, production build and Docker validation all pass. |
| 2 | Correct AI provider fallback semantics | Tests prove unavailable model paths never fabricate operational/financial facts. |
| 3 | Audit security and tenant isolation | Cross-tenant/branch negative tests and deployed Firestore rules evidence. |
| 4 | Verify event/outbox/workflow reliability | Integration tests for duplicate, timeout, crash, retry and reconciliation paths. |
| 5 | Build real specialist execution | Model-backed, schema-validated specialist tasks with durable queues, policy checks and independent verification. |
| 6 | Inventory all product repositories | Repository-to-capability map with branch, deployment, test and customer workflow evidence. |
| 7 | Trace commercial lifecycle | Verified lead-to-contract-to-invoice-to-payment-to-activation and renewal workflow. |
| 8 | Production readiness | Monitoring, runbooks, backups, restore drills, incident ownership and verified deployments. |

## 5. Completion rule

No row becomes COMPLETE without code-level evidence, passing relevant tests, production configuration evidence where applicable, and a verified end-to-end business outcome. Missing repository access or external credentials must be recorded as a blocker, not silently assumed successful.


## 6. Connected GitHub repository inventory

The authenticated GitHub account currently exposes seven repositories owned by `thuram34` in this inventory call. All seven were enumerated at their `main` branch roots; product source top-level directories and package manifests were inspected where available. This is a repository inventory, not proof of deployment or customer usage.

| Repository | Initial product/domain classification | Evidence inspected | Baseline / next action |
|---|---|---|---|
| `thuram34/tdbk-v2-platform` | Shared multi-tenant platform and control plane | Root, package manifest, agent, AI, persistence, event, workflow and connector source paths | Primary platform repository. Continue platform security, agent runtime and production-readiness audit. |
| `thuram34/my-home-electronics` | Electronics retail / e-commerce | Root, package manifest, `src/App.tsx`, `CartContext.tsx`, catalogue data and pages structure | No README found at root. Inspect checkout, inventory authority, payment, order fulfilment, admin, persistence and deployed state. |
| `thuram34/ugatuzi-hospital-management-system` | Hospital management / healthcare | Root, architecture/README, package manifest and `src` structure | README explicitly describes mock M-Pesa frontend by default and SHA deterministic development adapter; live SHA remains UAT-gated. Verify live integrations, clinical access controls, deployment and complete patient-to-billing workflow. |
| `thuram34/Sajid-intergrayed` | School management / education | Root, package manifest and `src` structure | No README found at root. Inspect admissions, academics, attendance, fee ledger, parent portal, roles, persistence and deployment. |
| `thuram34/chemist-pro` | Standalone pharmacy POS | Root, package manifest, README, `src` structure and integration documentation | README explicitly says independent of TDBK production and lists subscription, M-Pesa, FEFO/lot workflow, deployment and eTIMS gaps. Treat as separate standalone product until architecture/integration decision is made. |
| `thuram34/TRAIL-PHARMACY` | Pharmacy application / alternative pharmacy product | Root, package manifest, README and `src` structure | README describes a different single-user pharmacy OS and makes production/compliance claims. Those claims are not independently verified. Compare its actual code, tests and deployment with Chemist Pro before deciding whether this is a separate product, successor or duplicate. |
| `thuram34/Aquaflow` | Water business operating application | Root, package manifest and `src` structure | No README found at root. Inspect receiving/production, stock movements, orders, sales, delivery, payments, customer accounts, reporting and deployment against the active AquaFlow scope. |

### 6.1 Cross-repository architecture decisions

- Do not merge standalone product repositories into the TDBK platform by default. First identify which domain services should remain standalone, which should integrate through versioned APIs/events, and which shared platform services are actually reusable.
- Do not assume Chemist Pro and TRAIL-PHARMACY are interchangeable. They have different package manifests, source layouts and README product claims. Conduct a parity/security/release comparison before selecting a canonical pharmacy product.
- Do not assume the product names imply completeness. For every application, verify a full user journey against real persistence, authorization, provider integrations, audit and recovery.
- Repository inventory pagination was requested with a 100-item page; seven owned repositories were returned. Re-run the inventory if repositories are transferred, newly created or shared through another account.

### 6.2 Next cross-repository audit batch

1. Inspect every product's routes, server functions, Firestore rules, indexes, payment services, subscription model and tests.
2. Compare product workflows with the platform's capability registry and tenant/branch model.
3. Identify shared contracts versus duplicated domain logic.
4. Record CI health and deployment provider/state for each repository.
5. Decide canonical product per vertical only after code and operational evidence.
6. Create integration contracts and migration plans without disrupting standalone deployments.


## 7. Cross-repository CI evidence (latest runs observed during this audit)

| Repository | Latest observed main-branch workflow | Result | Failure stage / evidence | Classification |
|---|---|---|---|---|
| `tdbk-v2-platform` | Run `42587821578` on feature branch commit `a53c69c` | IN PROGRESS at last poll; typecheck, lint, capability and flow gates passed; tests running | Full tests, production build and Docker validation had not yet completed. A subsequent documentation commit was pushed after this run began. | BLOCKED pending full run and current-head verification. |
| `my-home-electronics` | Run `38849483433` (2026-10-16) | FAILURE | Typecheck and production build passed; Google Cloud authentication failed because service account `github-firebase-deploy@project-d966df20-6e50-477b-8e2.iam.gserviceaccount.com` lacked `iam.serviceAccounts.getAccessToken`. Firebase deploy was skipped. | External IAM configuration blocker; not a TypeScript/build defect. |
| `ugatuzi-hospital-management-system` | Run `37052933228` (2026-10-02) | SUCCESS | Historical workflow success. No recent run was returned in the latest query. | Stale CI evidence; rerun and validate current head before production claims. |
| `Sajid-intergrayed` | No run returned for main in latest query | NOT VERIFIED | No workflow run evidence returned. | Inspect workflow configuration and establish CI. |
| `chemist-pro` | Run `42528963769` (2026-11-08) | PARTIAL FAILURE | Main app typecheck, tests and build passed. Separate Functions build failed at `functions/src/index.ts:269`: callback parameter `ref` implicitly has `any` type (TS7006). | Code-level type defect in Functions package; inspect installed Firestore types and annotate callback precisely. |
| `TRAIL-PHARMACY` | Run `42264784272` (2026-11-06) | FAILURE | Typecheck failed because `src/__tests__/posAndStockReceiving.test.ts` imports `STARTER_CATEGORIES` from `src/services/pharmacyService.ts`, but that module does not export it (TS2305). Production build was skipped. | Code/test contract mismatch; decide whether constant belongs in service or whether test should target the real catalogue contract. |
| `Aquaflow` | No run returned for main in latest query | NOT VERIFIED | No workflow run evidence returned. | Inspect workflow configuration and establish CI. |

### 7.1 Immediate follow-up order

1. Finish TDBK V2 PR #644 verification on the latest branch head; resolve any new failures.
2. Fix Chemist Pro Functions TypeScript error in an isolated branch, then run the Functions build and full app checks.
3. Fix TRAIL-PHARMACY's missing starter-category export/test contract in an isolated branch, then run typecheck, tests and production build.
4. Resolve My Home Electronics deployment IAM with the minimum required service-account impersonation/token-creation permission through the authorized Google Cloud administrator; do not weaken IAM or change credentials in source code.
5. Establish CI for Sajid Integrated and AquaFlow and run current-head checks for Ugatuzi.
6. Keep all six product repositories separate until the product parity and shared-platform integration review is complete.
