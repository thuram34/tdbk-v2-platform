# TDBK Infrastructure-First Dominance Roadmap

**Status:** Proposed engineering control plan  
**Planning window:** 2026-10-16 to 2027-01-14  
**Release posture:** Do not certify production readiness until the gates in this document have evidence attached to an exact commit and environment.

## Mission

Make TDBK the dependable digital operating infrastructure for Kenyan businesses. Every DBK must inherit tested guarantees for identity and tenant isolation, durable data, transaction integrity, workflows, connectors, deployment, observability, and engineering governance.

The strategy is infrastructure-first: expand product breadth only after the kernel contract is proven.

## Preliminary repository observations

These are observations from a repository-level inspection and are not a complete production audit:

- The current `main` commit inspected for this report was `0b0b8eeb5d213d6e99c89fae3bdf8bb9a1bbe15f` (2026-10-08).
- `.github/workflows/ci.yml` runs typecheck, lint, capability tests, flow tests, the test suite, production build, and Docker image validation.
- The workflow grants `contents: write` and includes a step that may reconcile and push `package-lock.json`. Normal verification CI should be read-only; lockfile changes should be reviewed as a separate commit.
- Branch metadata reported protection disabled and no required status checks for `main`. Confirm current settings and enable protection/rulesets.
- Scheduled autonomous-operations success is not a substitute for a full release-gate result on the exact release commit.
- Chemist Pro has had failing dedicated workflow runs in the inspected history. Do not infer product readiness from a passing platform workflow alone.

No code tests were executed as part of this initial repository inspection. Each observation must be rechecked before implementation or release decisions.

## P0 release gates

### G1 — Identity, authorization, tenant and branch isolation
- Derive tenant and branch authority from verified server-side identity/membership, not untrusted client input.
- Test owner, staff, branch, revoked member, stale token, master-admin, and cross-tenant boundaries.
- Acceptance: all defined isolation tests pass; zero known critical authorization defects.

### G2 — Durable persistence and recovery
- Declare the authoritative store for every business record.
- Treat local storage/IndexedDB as an explicit offline queue/cache, not a silent competing source of truth.
- Test browser/device restart, server restart, network interruption, failed writes, conflicts, replay and reconnect.
- Demonstrate backup restoration and document retention/deletion behavior.
- Acceptance: zero lost acknowledged transactions in the defined fault-injection suite; every queued operation is completed, rejected visibly, or recoverably pending.

### G3 — Transaction and ledger integrity
- Define canonical transaction IDs, immutable movement records, idempotency keys, and explicit correction/reversal semantics.
- Test concurrent checkout, duplicate requests, partial failure, stock updates, receipts and audit events.
- Acceptance: zero duplicate financial postings and zero unexplained stock/ledger differences in the defined test suite.

### G4 — Durable workflow and external side effects
- Verify lease ownership/fencing so a stale worker cannot commit after losing its lease.
- Use idempotency, durable outbox/inbox patterns where appropriate, bounded retries, dead-letter handling and reconciliation for external actions.
- Never blindly repeat an external payment request whose outcome is unknown.
- Acceptance: crash/retry tests produce one authoritative logical outcome; ambiguous provider outcomes remain explicitly unresolved until reconciled.

### G5 — Connector contracts
- Define adapter contracts for M-Pesa, banks, WhatsApp, eTIMS and other providers: credential scoping, signature verification where supported, timeouts, error mapping, replay protection, auditability and reconciliation.
- Separate mocked, sandbox, approved/live and reconciled states.
- Acceptance: each advertised operation has contract tests and a documented live-readiness checklist. Adapter existence alone is not proof of provider approval or live operation.

### G6 — Deployment and recovery
- Build immutable artifacts from an approved commit; validate environment configuration and secrets; use health checks and migration discipline.
- Demonstrate rollback and backup restore in a controlled environment.
- Acceptance: repeatable deployment, successful rollback/restore drills, and no production secrets in client bundles or logs.

### G7 — Observability and operations
- Correlation IDs and structured audit/logging for provisioning, sales, inventory movements, payments, sync and connector callbacks.
- Alerts for failed jobs, sync backlog, payment uncertainty and abnormal error rates.
- Acceptance: every critical failure can be traced to a cause or an explicit unresolved state.

### G8 — Engineering governance
- Protect `main`; require reviewed pull requests and required CI checks.
- Make verification CI read-only and deterministic; move lockfile reconciliation out of the CI verification path.
- Add dependency, secret and appropriate static/security scanning.
- Acceptance: release decision references exact commit SHA and all required checks pass on that SHA.

## 90-day milestones

### M1 — Control and baseline (2026-10-16 to 2026-10-30)
- Freeze unrelated feature expansion on the release candidate.
- Confirm the canonical repository, release branch, deploy target and environment.
- Protect `main`, tighten CI permissions, and separate lockfile updates from verification.
- Recheck current fixes for tenant isolation, lease fencing and idempotency.
- Publish a gate report listing evidence, failures, owners and blockers.

**Exit:** one identified release candidate; all required checks recorded against its exact SHA; zero unresolved critical security defects.

### M2 — Kernel proof (2026-10-31 to 2026-11-15)
- Complete adversarial authorization tests.
- Complete persistence/restart/offline/recovery tests.
- Test worker crash, stale lease, duplicate callback and unknown payment outcomes.
- Demonstrate backup restore and deployment rollback.

**Exit:** all defined P0 tests pass; recovery procedures are demonstrated.

### M3 — End-to-end business lifecycle (2026-11-16 to 2026-11-30)
- Validate registration → DBK provisioning → owner membership → workspace.
- Validate sale → stock movement → receipt → payment state → reconciliation → audit.
- Test cash and M-Pesa separately, including pending, failed and duplicate outcomes.
- Run at least 100 scripted lifecycle tests including fault injection.

**Exit:** zero unexplained stock/ledger discrepancies in the scripted suite; unresolved external outcomes remain visible and recoverable.

### M4 — Staging operations (2026-12-01 to 2026-12-15)
- Deploy the approved artifact to staging.
- Verify health checks, telemetry, alerts, secrets handling and rollback.
- Measure representative latency, error rate and recovery-time baselines.

**Exit:** successful staging deploy and rollback; critical failure paths are traceable.

### M5 — Controlled pilot (2026-12-16 to 2027-01-14)
- Select one business and define scope, data ownership, support and rollback.
- Parallel-check operational records before relying on the system as authoritative.
- Review discrepancies and incidents daily.
- Expand only after agreed targets are met.

**Exit:** reconciled pilot records, no unresolved critical incident, demonstrated restore evidence, and a documented go/no-go decision.

## Weekly scorecard

| Metric | Initial acceptance target |
|---|---:|
| Defined tenant-isolation tests passing | 100% |
| Required release CI checks passing on exact SHA | 100% |
| Unresolved critical security defects | 0 |
| Unexplained test stock/ledger discrepancies | 0 |
| Duplicate financial postings in retry tests | 0 |
| Critical operations with trace/audit coverage | 100% |
| Backup restore and rollback drills | Demonstrated |
| Scripted DBK provisioning success | ≥99% initial target |
| Critical incidents with owner and documented resolution | 100% |

Do not claim uptime or throughput targets before collecting representative production baselines.

## Release decision policy

- **NO-GO:** any unresolved critical security issue, missing required CI evidence, data-loss defect, duplicate financial posting, or failed restore/rollback.
- **CONDITIONAL GO:** only for a clearly scoped, reversible pilot with explicit limitations, monitored operation and a tested rollback. Never use this status to bypass tenant isolation or financial-integrity requirements.
- **GO:** all applicable gates pass on the exact release commit and environment, evidence is linked, and operational ownership is assigned.

## Architecture contract for all DBKs

Industry modules may add domain-specific behavior but must not bypass kernel contracts for identity/authorization, tenant scoping, durable persistence, audit trails, transaction integrity, workflow idempotency, connector handling, observability and versioned capability APIs.

Sokoni and the Owner Command Center should inherit these guarantees rather than create independent security or data paths.

## First execution checklist

- [ ] Confirm current main SHA and canonical deployment target.
- [ ] Capture full CI run and job-level results for the candidate SHA.
- [ ] Enable branch protection/rulesets and required checks.
- [ ] Remove write permissions from ordinary CI; move lockfile changes to reviewed commits.
- [ ] Produce automated tenant-isolation test evidence.
- [ ] Produce persistence/recovery test evidence.
- [ ] Produce idempotency/worker-fencing test evidence.
- [ ] Produce backup restore and rollback evidence.
- [ ] Publish GO / CONDITIONAL GO / NO-GO report.

**Governance rule:** a feature is not production-ready because it compiles, has a UI, or passes a general platform build. It is production-ready only when its relevant security, data, workflow, integration and recovery contracts are tested and evidenced.
