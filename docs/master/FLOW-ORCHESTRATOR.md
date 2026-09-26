# TDBK V2 — Flow Orchestrator

The Flow Orchestrator is the cross-layer coordinator for end-to-end business flows.

It does not replace Kernel authority, Capability/Entitlement engines, Runtime, WorkflowEngine, Outbox, or Bridge adapters.

## Responsibility

It provides one execution envelope around a business flow:

IDENTITY → TENANT → BRANCH → CAPABILITY → ENTITLEMENT → RUNTIME → WORKFLOW → PERSISTENCE → INTEGRATION → PROJECTION.

Each stage remains owned by its existing authoritative subsystem.

## Failure contract

Failures are classified as:

- AUTHENTICATION — terminal; never silently retried as success.
- AUTHORIZATION — terminal; security boundary remains intact.
- TENANT_ISOLATION — terminal; no cross-tenant recovery.
- VALIDATION — terminal until corrected.
- CONFLICT — retryable/resumable.
- NOT_FOUND — terminal.
- TRANSIENT — retryable.
- EXTERNAL_UNKNOWN — do not infer success; reconcile.
- PERSISTENCE — preserve state and retry/resume when safe.
- INTERNAL — terminal until diagnosed.

Security failures become DENIED; operational failures become FAILED.

## Design rule

The orchestrator coordinates. It never grants authority.

A successful flow means the delegated authoritative stages completed; it is not a replacement for their individual invariants.
