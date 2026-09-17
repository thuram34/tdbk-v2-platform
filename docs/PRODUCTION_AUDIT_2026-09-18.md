# TDBK V2 Production Audit — 2026-09-18

## Scope
Repository: `thuram34/tdbk-v2-platform`
Branch audited: `main`

This audit is based on direct inspection of the repository configuration and implementation. It separates repository-confirmable findings from external GCP state that GitHub cannot verify.

## Fixed in this audit

1. **Cloud Build image path** now uses the active `$PROJECT_ID` rather than a stale hard-coded project ID.
2. **Docker build dependencies** are installed before `npm run build`, with development dependencies pruned only after the production build.
3. **Cloud Run runtime service account** is explicitly set to `tdbk-runtime@$PROJECT_ID.iam.gserviceaccount.com`.
4. **Public gateway availability** is explicit via Cloud Run `--allow-unauthenticated`; application APIs still perform their own authentication/authorization.
5. **Cloud Build dynamic substitutions** are enabled so the image path can resolve `$PROJECT_ID` reliably for manual builds as well as triggers.
6. **Docker build context** now excludes local dependencies, Git metadata, environment files, build output, logs and other non-runtime material.
7. **Stale AI Studio deployment instructions** were removed from `.env.example`; production secret handling is documented as Google Cloud Secret Manager / Cloud Run based.

## Confirmed incomplete / production blockers

### P0 — External deployment evidence missing
GitHub currently reports no commit status checks for the latest `main` commit. The repository therefore does not contain independent evidence that the latest Cloud Build/Cloud Run deployment succeeded. The actual Cloud Build trigger, build history, Secret Manager IAM, Artifact Registry state and Cloud Run revision must be verified in GCP before calling deployment complete.

### P0 — External bridges are still MOCK
The bridge registry currently defines M-Pesa, eTIMS, WhatsApp, Email, SMS and Bank bridges with implementation status `MOCK`. The production adapter registration path is only exercised by the Phase 3 tests. These bridges are therefore contracts/simulations, not live production integrations.

### P0 — Several runtime surfaces remain in-memory/demo-oriented
The entity engine contains default demonstration records and an in-memory tenant entity store, although it also has a Firestore repository integration. The role-based coherence engine also keeps space memberships in memory. These must be migrated/verified against authoritative Firestore state before production business operations rely on them.

### P1 — Readiness is synthetic
`/api/health/ready` currently reports readiness based primarily on process uptime. It does not actually prove Firestore, event bus, secret configuration or external bridge readiness. This is not a sufficient production readiness gate.

### P1 — API authorization audit required
The server contains routes that do not establish the same security context as the tenant-scoped routes, including audit-log retrieval, subscription-tier mutation, direct entity retrieval and display rendering, plus test-suite endpoints. These routes need an explicit classification: public, authenticated, tenant-scoped, owner-scoped or master-only. Production test endpoints should be disabled or isolated.

### P1 — Firestore rules are broader than least-privilege
The tenant hierarchy has a catch-all recursive rule allowing tenant members to read/write future subcollections. This is convenient for dynamic entities but is broader than a strict production authorization model and can bypass more specific branch/role expectations. It needs to be reconciled with the actual persistence model before customer data is considered production-safe.

### P1 — Documentation drift
The repository contains historical documentation and UI checklists that still describe earlier phases as if final business UI/bridges were not implemented, while the live code has moved considerably beyond those statements. These documents should be converted into dated historical records or regenerated from current implementation state.

## Important architecture status

The repository is not an empty or disconnected project. It contains the kernel, identity, tenant isolation, blueprint/DNA, capability, provisioning, experience, document AI, orchestration, coherence and persistence layers. The remaining work is primarily **runtime completion, production hardening, live connector integration and deployment verification**, not another architecture rewrite.

## Completion gate

TDBK V2 should be considered production-ready only after:

- latest Cloud Build succeeds from `main`;
- Cloud Run revision is healthy and publicly reachable at the gateway;
- runtime service account has required Firestore/Pub/Sub/Secret Manager permissions;
- Firebase secrets resolve at build time;
- required server-side secrets resolve at runtime;
- `/api/health/ready` reflects real dependencies;
- production test/debug routes are disabled or protected;
- every business API route has an explicit authorization classification;
- authoritative entity and coherence state is persisted in Firestore;
- live connector adapters replace MOCK bridge implementations for the connectors being sold;
- end-to-end golden flows pass against the deployed service.
