# TDBK V2 ENGINE — PRODUCTION HARDENING GATE 02

## Selected Gate
Runtime readiness authority (`/api/health/ready`).

## Why this gate
The prior production audit identified readiness as a P1 production-readiness boundary: `/api/health/ready` did not prove the dependencies required for production operation. This is the next documented high-impact boundary that can be audited without inventing a new business architecture. The provisioning service-identity decision is explicitly excluded from this gate.

## Scope
Only readiness semantics and the evidence behind the readiness result.

Excluded:
- provisioning identity model
- DBK
- Sokoni
- public discovery
- payment logic
- external bridges implementation
- audit-system redesign
- unrelated runtime or persistence defects

## Repository State
Current `main` at audit start: `54f62db149acb1f302cdeb6d92e6107cb834a7a5`.

## Exact Implementation
### HTTP boundary
`server.ts` exposes `/api/health/ready` and returns HTTP 200 when `healthMonitoring.getReadyStatus()` returns `HEALTHY`; otherwise it returns HTTP 503.

### Readiness implementation
`src/kernel/observability/health.ts` implements `getReadyStatus()`.

Current behavior:
1. Initializes `kernel`, `tenancy`, `auth`, and `audit` as `true` without performing dependency checks.
2. Initializes `firestore` as `false`.
3. Calls `firestoreClient.get('/system/readiness')`.
4. If the call throws, returns `DEGRADED` / HTTP 503 through the server boundary.
5. If the call does not throw, sets `firestore=true` and returns `HEALTHY` / HTTP 200.

### Persistence path
`src/persistence/firestore/firestoreClient.ts` routes `/system/*` through the authoritative server Firestore driver in non-browser, non-test execution.

`src/persistence/firestore/driver/googleCloudFirestoreDriver.ts` implements `get()` as a Firestore document read. A missing document returns `null` rather than throwing.

A repository search found no existing writer/initializer for `/system/readiness`.

## Finding
**PARTIAL**

### PASS elements
- The readiness endpoint is no longer based solely on process uptime.
- Production server execution uses the authoritative Google Cloud Firestore driver rather than the test-memory driver.
- A Firestore access failure produces `DEGRADED` and HTTP 503.
- The endpoint has a concrete liveness/readiness distinction.

### Gaps
1. The readiness check does not establish that a readiness document exists. Because Firestore `get()` returns `null` for a missing document, `/system/readiness` can currently produce a `HEALTHY` result without the expected document being present.
2. `kernel`, `tenancy`, `auth`, and `audit` are reported `true` without independent checks.
3. The current readiness contract does not verify event-bus availability.
4. It does not verify runtime secret configuration.
5. It does not verify external bridge readiness.
6. No existing authoritative `/system/readiness` document contract or producer was found, so changing the check to require such a document would invent a new readiness contract.

## Classification of Specific Questions
- Process/runtime availability: **PASS** — endpoint executes and returns health state.
- Firestore connectivity attempt: **PASS** — authoritative Firestore driver is used in production runtime.
- Firestore readiness proof: **PARTIAL** — a successful `get()` is treated as success even when the target document is absent.
- Event-bus readiness: **PARTIAL** — not checked by current implementation.
- Secret readiness: **PARTIAL** — not checked by current implementation.
- External bridge readiness: **PARTIAL** — not checked by current implementation.
- Existing readiness authority contract sufficient for broader dependency checks: **MASTER REVIEW REQUIRED** — no existing system readiness contract/registry for these dependencies was found.

## Why no code change was made
A safe narrow correction would require an already-established readiness authority. The repository currently has no producer/contract for `/system/readiness`, nor an existing dependency-health aggregation authority covering event bus, secrets, and bridges. Creating one during this audit would be architecture invention.

Therefore no production source was changed.

## Verification
Repository inspection only.

Inspected:
- `server.ts`
- `src/kernel/observability/health.ts`
- `src/persistence/firestore/firestoreClient.ts`
- `src/persistence/firestore/driver/googleCloudFirestoreDriver.ts`
- `docs/PRODUCTION_AUDIT_2026-09-18.md`
- current `docs/master/ENGINE-STATUS.md`

Tests/typecheck/lint/build: **NOT EXECUTED**. The connected repository tooling does not provide local npm command execution. No passing result is claimed.

## MASTER REVIEW REQUIRED
- Define/authorize the authoritative readiness dependency model before changing readiness semantics beyond the existing Firestore connectivity check.
- Specifically determine whether readiness must cover event bus, runtime secrets, external bridge connectivity, and/or a concrete Firestore readiness marker.

## DBK Impact
None. No DBK code, authority, or contract changed.

## Sokoni Impact
None. No Sokoni code, authority, or contract changed.

## Files Changed
Only documentation is changed by this gate:
- `docs/PRODUCTION_HARDENING_GATE_02_2026-09-22.md`
- `docs/master/ENGINE-STATUS.md`

No production source files were changed.

## Conclusion
The current readiness boundary is materially better than the historical process-uptime-only implementation, but it is not a complete production dependency gate. It is therefore **PARTIAL**, with the broader readiness contract at **MASTER REVIEW REQUIRED** rather than being invented in this task.
