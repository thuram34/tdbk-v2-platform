# TDBK V2 — PR Reconciliation & Execution Ledger

**Audit date:** 2026-11-03  
**Repository:** `thuram34/tdbk-v2-platform`  
**Audited main SHA:** `243641986146bb2ea94b76d30a3c67536e8a50a8`  
**Scope:** All 33 open pull requests returned by GitHub for this repository.  
**Disposition:** Reconcile and selectively port. Do not merge stale or overlapping branches as-is.

## 1. Mainline verification truth

The current `main` verification run is [GitHub Actions run 41415463980](https://github.com/thuram34/tdbk-v2-platform/actions/runs/41415463980). It failed in TypeScript typecheck. Lint, capability tests, flow tests, full tests, production build, and Docker validation were skipped.

The typecheck emitted 12 diagnostics:
- `experienceResolver.ts`: missing required `connections` in `DbkExperienceResolved`.
- `experienceResolver.ts`: `SupplierInvoiceResult` is not assignable to `Record<string, unknown>`.
- `tokenVerifier.ts`: `DecodedToken` does not declare `tdbk`, `user_id`, or `sub`; `isMaster` does not accept both boolean and string.
- `mpesaBridge.ts`: missing required `sideEffectCapabilities`, causing follow-on errors in bridge bootstrap and tests.

The same job confirms `npm ci` completed. Its audit output reported 31 dependency vulnerabilities (21 moderate, 9 high, 1 critical); this requires a separate dependency audit and reviewed upgrades, not an automatic `npm audit fix --force`.

The current main commit also has a failed Vercel production deployment check. Recent `ops` workflow successes are not application verification.

The current GitHub connection returned HTTP 403 for the branch-protection endpoint. A prior repository audit reported `main` as unprotected; current protection state must be confirmed by a repository administrator. CircleCI has not produced a verified run in the reviewed PR evidence.

One useful positive control: PR #567's head `aa426acbebab92e145796f0f4e42e3f6f46a3962` completed typecheck, lint, capability tests, flow tests, the full test suite, production build, and Docker validation. That run still used the old CI-time lockfile reconciliation step, so it is not an acceptable final release-control configuration and must be rerun after consolidation.

## 2. P0 reconciliation decisions

### A. One release pipeline
- Use the read-only CI change from PR #584 (also present in #542): `contents: read`, remove CI-time lockfile edits/commits/pushes, and use `npm ci`.
- Consolidate the duplicate CircleCI configurations in #583 and #585 into one optional secondary pipeline only after the CircleCI project connection is verified.
- Do not treat a Vercel preview status as a passing engineering gate.

### B. One canonical onboarding/provisioning path
- PR #567 is the strongest existing onboarding/checkout candidate because its full CI gate passed. It contains FREE-first registration, paid-tier checkout, server-side price configuration, and business-branded PWA work.
- PR #592 contains important FREE core capability entitlements and a persisted FREE sale acceptance path, but its `experienceResolver` change sets `connections: []`. Do not retain that empty projection.
- Use the authoritative workspace projection from #589 (also present in #542 and #567): `workspace.connections`, `provisioningStage`, and `shellReadiness`.
- Consolidate the token verifier and M-Pesa type fixes from #542/#567/#587/#592. Do not merge their branches independently.
- Provisioning policy must be internally consistent: an owner provisions a FREE DBK; paid tiers (including FOUNDATION where it is offered as paid) are activated only through verified subscription payment. TDBK Master may provision/override commercial tiers under explicit authority. The FREE/FOUNDATION contradiction in #592/#594 must not be carried forward.
- Incorporate the provisioning recovery implementation, but preserve immutable DBK identity and use the explicit recovery transition. Add tests for failed recovery, repeated provisioning, original blueprint/tier preservation, and external side-effect ambiguity.
- Keep the six FREE core capabilities from #592 only after entitlement and persisted-sale acceptance tests pass.

### C. Capability activation
- Retain the configuration-state logic from #565: blueprint inclusion is not proof of configuration; only entitled, default, configuration-free capabilities auto-enable.
- Combine #565 with the FREE capability catalogue changes from #592. A capability requiring configuration remains entitled but inactive until configuration is complete.

### D. Tenant and branch security
- The strict branch-claim logic proposed in #74 is already present in current `firestore.rules`; the PR is therefore not a fresh rules fix. Port its regression test if absent, then close #74 as superseded.
- PR #20 is not present in current `AiProposalRepository`: branch-scoped reads still include unbound proposals. Port strict equality (`proposal.branchId === branchId`) and its regression test. Unbound proposals must not leak into a branch-scoped view.

## 3. Open PR disposition register

| PR | Area | Reconciliation decision |
|---:|---|---|
| #592 | Provisioning recovery + FREE sales | Selectively port recovery, FREE core entitlements and persisted-sale acceptance. Replace empty connector projection; correct tier policy. |
| #594 | Provisioning error wording | Fold the accurate wording into the canonical provisioning change; do not merge its non-main prerequisite branch. |
| #593 | Public gateway UI | Retain as a small UI-only change; rebase/port after P0 and rerun CI plus mobile/tablet/desktop visual checks. |
| #587 | TypeScript/token verifier | Fold into the canonical P0 integration; duplicate prerequisite work is not a separate merge. |
| #583 | CircleCI | Duplicate pipeline proposal; consolidate with #585 or leave closed. |
| #584 | Deterministic CI | Use the read-only CI change as the release-control baseline. |
| #585 | CircleCI + prerequisite fixes | Do not merge independently; extract only the unique CircleCI configuration after #567/#592 fixes are consolidated. |
| #222 | M-Pesa + eTIMS bundle | Superseded by more focused provider branches; use only as historical source material. |
| #1 | Pub/Sub diagnostic branch | 855 commits behind main; do not merge. Reproduce only if current observability still lacks the required diagnostics. |
| #4 | Display engine | Overlaps #5/#6; consolidate into one display workstream after core release controls. |
| #5 | Display edge runtime | Overlaps #4/#6; do not merge independently. |
| #6 | Unified display stack | Most complete display candidate but 449 commits behind main and not mergeable; selectively port reviewed device-control functionality. |
| #9 | Command Agent | 338 commits behind main; main already has an agent runtime. Compare feature-by-feature and port only missing, tested behaviour. |
| #10 | Financial truth | Important ledger immutability, balance, and outbox improvements. Reconcile with #12 and #149 before porting. |
| #20 | AI proposal branch isolation | Port strict branch filtering and regression test; current main remains fail-open for unbound proposals. |
| #74 | Firestore branch isolation | Core rules change already exists on main; port/verify regression test, then close as superseded. |
| #131 | Gate 04 provider contract docs | Refresh after provider implementation is reconciled; documentation alone does not prove provider capability. |
| #156 | Durable execution regressions | Overlaps #154/#161. Selectively port unique persistence fixes after repository contract review. |
| #161 | Nine-tier capability/flow contracts | Large draft with overlapping flow and persistence changes. Audit existing main equivalents; port only missing contracts/tests. |
| #225 | M-Pesa Daraja | Preferred provider implementation source over #222: it includes STK query, transaction-status, reversal and pull operations. Add tests and verify callback/reconciliation semantics before certification. |
| #229 | KRA eTIMS VSCU | Preferred focused eTIMS source. Review endpoint mappings, payloads, error handling and duplicate submission safety; KRA certification remains external. |
| #291 | Sokoni participation/publication | Selectively port as a separate marketplace boundary. Paid publication/payment confirmation and owner-management remain incomplete; demo discovery is not authoritative discovery. |
| #390 | Vertical runtime baseline | 330 commits, 122 files and substantial overlap with current main. Do not merge as a monolith; port sector workflows individually against shared engines. |
| #589 | Workspace connector projection | Retain the authoritative projection from the workspace runtime. |
| #588 | Provisioning recovery/tier guard | Ancestor/overlap of the provisioning fixes; fold into one canonical change. |
| #537 | Chemist Pro local-first POS | Keep as a controlled single-device pilot, not as a production cloud pharmacy module. No cloud sync, M-Pesa, eTIMS, multi-user concurrency or production audit is claimed. |
| #567 | Onboarding, checkout and branded PWA | Best existing onboarding candidate; full CI passed on its head. Port selectively, correct the M-Pesa reconciliation capability declaration, reconcile FREE capability entitlements, and rerun CI against current main. |
| #565 | Capability configuration gates | Retain and combine with the FREE core capability policy. |
| #542 | Infrastructure-first roadmap | Retain/update its useful roadmap and credential-register findings; use its read-only CI and workspace projection changes. Its CI run failed, so it is not a release. |
| #224 | WhatsApp Cloud API | Child of the old #222 branch. Port only the reviewed WhatsApp adapter/registry changes and add webhook/signature, delivery and retry tests. |
| #154 | Identity/persistence regression suite | Overlaps #156/#161. Consolidate unique regression tests; no standalone merge. |
| #149 | Authoritative M-Pesa reconciliation posting | Reconcile with #10/#12 and the M-Pesa adapter. Preserve identity checks and atomic ledger/outbox posting. |
| #12 | Ledger/outbox reconstruction | Reconcile with #10/#149; do not port an isolated repository replacement. |

## 4. Provider capability truth

Current main's M-Pesa adapter accepts `QUERY_TRANSACTION` and `RECONCILE` names but returns HTTP 501 for non-`STK_PUSH` operations. Therefore it must not declare provider reconciliation as implemented.

PR #225 contains actual STK query and asynchronous transaction-status operations. That is a better implementation source, but still requires sandbox tests, callback correlation, timeout/unknown-outcome tests, duplicate callback tests, and live credential verification. Provider-side idempotency remains false unless Safaricom guarantees a caller-controlled deduplication key.

The eTIMS VSCU adapter in #229 has a real transport implementation in source, but source presence does not prove successful KRA onboarding, certification, production credentials, or fiscal receipt acceptance. WhatsApp likewise requires real webhook and delivery verification.

## 5. Dependency-ordered execution

1. **P0 release safety:** consolidate type fixes, read-only CI, one canonical workspace projection, branch protection confirmation, and a green mainline engineering gate.
2. **P0 authority and provisioning:** FREE-first registration, owner/master authority, durable failed-provisioning recovery, branch security tests, capability configuration gates.
3. **P0 commercial lifecycle:** server-priced checkout, M-Pesa payment initiation, callback verification, payment-to-subscription activation, entitlement projection, duplicate/ambiguous payment recovery.
4. **P1 shared engines:** commerce/inventory, finance/ledger, procurement, customer/supplier records, event/outbox recovery and reporting.
5. **P1 integrations:** M-Pesa, eTIMS, WhatsApp, email/SMS/banks; verify each provider per tenant and distinguish adapter registration from live connection health.
6. **P1 hardware:** device compatibility registry, edge runtime, protocol adapters and certification; customer procures hardware, TDBK supplies software integration.
7. **P2 industry packages:** port verticals one by one against shared engines, beginning with a complete acceptance journey.
8. **P2 ecosystem:** Sokoni, display control plane, Command Agent and other cross-industry automation after authority and persistence gates pass.

## 6. Acceptance evidence required

No workstream is marked complete solely because code exists or a PR is mergeable. Every completed item must record:
- source files and exact commit SHA;
- dependency and owner;
- targeted regression tests;
- full CI run URL and result;
- runtime/environment acceptance evidence;
- unresolved provider, security or operational limitations.

## 7. External blockers

- GitHub branch-protection state could not be read through the connected GitHub integration (HTTP 403); a repository administrator must confirm and enforce required checks.
- CircleCI project connection and account-level configuration are external actions; no successful CircleCI run was found in the reviewed evidence.
- M-Pesa sandbox/live credentials, callback URL registration and production verification require the authorised provider environment.
- eTIMS production certification and taxpayer/device configuration require the KRA process.
- No local shell execution is claimed in this reconciliation. Use the repository CI pipeline for actual code validation.

**Audit outcome:** 33 open PRs reconciled into a dependency-ordered disposition. No PR was merged or closed during this audit. The next code change should be a single P0 integration branch, not another parallel feature branch.


## 8. Execution addendum — 2026-11-03

Since the audit snapshot above:
- PR #601 was merged to `main` as commit `514ea4ec470bf65bc448043bb98248038b0402a8`.
- The merged P0 baseline includes TypeScript repairs, read-only CI, truthful M-Pesa capability declarations, FREE-first provisioning, immutable provisioning recovery, capability configuration gates, strict AI proposal branch isolation, and regression coverage.
- PR #601 passed its full GitHub Actions pipeline, including typecheck, lint, capability gate, flow gate, full tests, production build and Docker validation. Post-merge `main` run [41654247155](https://github.com/thuram34/tdbk-v2-platform/actions/runs/41654247155) also passed.
- PR #599 was closed as superseded. Eleven additional duplicate or superseded PRs were closed after their changes were merged or verified already present.
- The mainline M-Pesa adapter is now explicitly limited to `STK_PUSH`; provider query/reconciliation remains pending until the advanced adapter and its tests are integrated.
- PR #603 was merged at commit `03ab8ab4ae309f039c52b25416bd92ff94c77f69`; its financial-integrity, financial-truth and receipt-persistence verification passed in [run 41656487112](https://github.com/thuram34/tdbk-v2-platform/actions/runs/41656487112), and post-merge `main` run [41657142876](https://github.com/thuram34/tdbk-v2-platform/actions/runs/41657142876) passed.
- PR #10, #12 and #149 were closed as superseded after their useful verification or state-transition behaviour was incorporated into current mainline code.
- PR #607 restores the pre-existing conflicting-reversal replay regression test that was unintentionally replaced during finance test consolidation; it is pending CI.
- Additional payment-path review found that `MpesaBridge.handleCallback` has no HTTP route/caller in this repository. The subscription router has a payment initiation route but no callback route. The handler also does not query Safaricom before treating callback success as financial truth. A tenant-bound callback endpoint plus authoritative STK query verification is required before production payment activation.

The original 33-PR table remains an accurate snapshot of the audit date. It is not a claim that those PRs are still open today.

## 9. Cross-repository security follow-up

A separate review found that the TDBK-EDU repository contains permissive Firestore rules and no complete authenticated membership flow in the client. Its deployed Firebase rules have not been independently verified. Do not use real student, staff, health, fee or parent data in that project until authentication, tenant membership, role-based rules and server-side student PIN verification are implemented and tested.
