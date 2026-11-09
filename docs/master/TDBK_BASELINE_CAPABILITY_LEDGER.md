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
