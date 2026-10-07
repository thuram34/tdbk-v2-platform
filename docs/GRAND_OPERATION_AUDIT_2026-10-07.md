# TDBK V2 — Grand Operation Audit & Completion Ledger

## Audit date
2026-10-07

## Scope
This audit treats TDBK as one product system rather than a collection of feature slices.

Repository snapshot audited: `cc47ffa4976b9a478308ebe5ec91ebc73ac68f85`

Inventory:
- 359 tracked files
- 303 source files under `src/`
- 76 test files
- 15 architecture/status documents
- 28 root/configuration files
- 7 legacy/backup-labelled files

The audit covers:
- Kernel, identity, tenancy, branch authority and RBAC
- Blueprint / Business DNA
- Capability registry, discovery, entitlement and lifecycle
- DBK provisioning, workspace and lifecycle
- Experience resolver, navigation, views and dashboard
- Coherence / membership / role experience
- Workflow, events, outbox and external side effects
- Financial ledger / sales authority
- Connector Hub and all six external bridge definitions
- Document AI and AI command boundaries
- Public DBK publication/discovery
- Sokoni participation, discovery, publication, commercial boundary and future Engine handoff
- Firestore/Storage persistence and security rules
- Client routing / Owner Command Center / new-business landing
- CI, build, deployment and readiness boundaries
- Legacy/demo/test authority and documentation drift

## Product invariant
The target architecture is:

Registration → Identity → Blueprint/DNA → Tier/Entitlement → DBK Provisioning → Branch/Workspace → Membership/RBAC → Capability → Vertical Domain → Workflow → Operation → Persistence → Event/Outbox → External Bridge → Audit → Public Projection/Sokoni where explicitly published.

A UI is not considered complete unless its authoritative server path exists. A bridge is not considered production-ready merely because its adapter exists. A public listing is not authoritative unless publication authority exists. A test double must never masquerade as production state.

## Current corrections completed during this grand operation
1. Durable DBK membership is now used as runtime role/permission authority.
2. Tenant role assignment persists the corresponding DBK membership.
3. Owner-operator promotion persists a DBK membership.
4. Role revocation suspends durable DBK memberships.
5. DBK provisioning creates the initiating owner’s OWNER_OPERATOR membership.
6. Provisioning workflow steps now preserve the initiating actor snapshot instead of inventing a synthetic TDBK_MASTER_ADMIN identity.
7. Blueprint capability compatibility is enforced during activation and navigation.
8. Vertical operations have an authoritative runtime path with workflow validation and durable entity persistence.
9. DBK public publication now has an explicit durable publication lifecycle.
10. Public discovery now exposes only explicitly published, lifecycle-eligible, public-safe DBK projections.
11. Sokoni now consumes the governed TDBK public organization projection instead of using the old demo provider adapter as its primary discovery source.
12. Sokoni participant ownership is bound to authenticated UID.
13. Sokoni participant media writes are owner-scoped.
14. Paid Sokoni participant offerings no longer imply immediate paid publication; paid listings remain draft until payment confirmation exists.
15. Stale demo-only Sokoni presentation dependencies were removed from the main discovery path.
16. Canonical post-provisioning workspace flow now includes connector configuration/health and durable People & Roles authority.

## CI evidence

The prior GitHub Actions run #922 tested PR #390's merge ref, not the current head. It failed during TypeScript typecheck before lint/tests/build.

Current PR head: `cc47ffa4976b9a478308ebe5ec91ebc73ac68f85`.

At audit time, no workflow run or status check had yet been reported for the current head. Therefore no green CI claim is made for the current head.

The known #922 typecheck failures were:
- `src/platform/public/publicPublicationRepository.ts`
- `src/platform/tests/publicPublication.test.ts` import path
- `src/platform/tests/publicPublication.test.ts` DBK fixture shape

The current branch contains the corresponding publication-service/test-path and fixture corrections; this must be proven by a fresh CI run against the current head.

## Material gaps still being worked

### A. External bridge execution
Email, SMS and Generic Bank remain provider-unconnected in the repository. They must not report production success while their provider clients are absent.

M-Pesa, eTIMS and WhatsApp have executable provider adapters, but tenant-specific provider configuration/certification remains an environment gate.

### B. Gate 04 external side-effect safety
The repository still needs complete authoritative UNKNOWN/reconciliation enforcement for non-idempotent external operations after execution ownership is lost. No provider idempotency semantics will be invented.

### C. Sokoni commercial authority
Sokoni payment initiation and authoritative payment confirmation are not yet implemented. Until this is complete:
- paid offerings must remain non-active/draft;
- no payment success may be fabricated;
- publication and payment remain separate state machines.

### D. Sokoni discovery depth
TDBK publication is now a real discovery source, but the complete Sokoni marketplace contract is broader:
- relevance/matching
- provider coverage
- availability
- request creation
- quote/approval
- products
- services
- jobs
- opportunities
- offers
- trust projections
- authenticated activity

These require authoritative contracts and persistence, not presentation-only cards.

### E. Production readiness
Readiness must distinguish:
- process health
- Firestore reachability and expected system readiness state
- event infrastructure
- adapter code readiness
- tenant provider health
- secrets readiness
- external certification

A single synthetic boolean must not represent all of these.

### F. Legacy/demo cleanup
The repository still contains legacy/backup-labelled UI files and historical documentation. They must be classified as:
- retained reference artifact,
- test fixture,
- deprecated code,
- or removed.

No obsolete surface should remain accidentally routable or authoritative.

### G. Vertical depth
Blueprint/capability/workflow/view routing is now explicit for the major verticals, but the final acceptance test must verify real domain operations rather than merely verifying navigation:
- School
- Healthcare
- Hospitality
- Beauty
- Logistics
- Professional Services
- Manufacturing
- Construction
- Community
- Retail/Hardware/Electronics

## Grand acceptance standard
The system is not called complete because CI is green.

Completion requires:
1. Every authoritative state transition has one source of truth.
2. Every mutation has server-side tenant/branch/RBAC authority.
3. Every DBK is routed by blueprint/DNA, not generic fallback.
4. Every sold connector has a truthful production status.
5. Every ambiguous external side effect ends in pending/unknown/reconciliation rather than false success.
6. Public publication is explicit and revocable.
7. Sokoni never fabricates provider, price, availability, trust, transaction or payment truth.
8. Persistent state survives process restart.
9. Direct client persistence cannot bypass server/business authority.
10. The canonical client journey executes an actual vertical transaction.
11. CI passes typecheck, lint, engineering gates, tests, build and Docker validation.
12. The final repository contains no unresolved architectural decision disguised as an implementation.

## Evidence rule
No item is marked COMPLETE from source inspection alone when runtime/provider/deployment evidence is required.

## Next execution order
1. Obtain fresh CI evidence for current PR head.
2. Fix every failing CI gate until the complete pipeline executes.
3. Close Gate 04 UNKNOWN/reconciliation enforcement.
4. Harden production readiness.
5. Finish Sokoni ownership + payment authority.
6. Build remaining Sokoni authoritative discovery/request domains where justified.
7. Replace/contain provider-unconnected bridge mocks.
8. Run vertical end-to-end transaction matrix.
9. Remove/classify legacy artifacts.
10. Reconcile all status documents against implementation.
11. Run final CI and release-gate review.

## Release rule
PR #390 must not be merged merely because it is mergeable. It is mergeable only after the grand-operation acceptance criteria above are satisfied for the scope actually claimed.
