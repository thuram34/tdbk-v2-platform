# Provisioning Recovery and FREE Tier Policy

## Purpose

This document records the expected behavior for DBK provisioning, failed-provisioning recovery, and commercial tier authorization.

## Provisioning authorization

- A Business Owner may provision a DBK on the FREE or FOUNDATION tier.
- GROWTH, PRO, and ENTERPRISE are paid commercial tiers and require TDBK Master Admin authority.
- The paid-tier authorization check must happen before registry or blueprint access. A rejected request must not create or mutate a DBK, activate entitlements, or disclose registry/blueprint state.
- Tenant boundaries and the existing owner-or-master authorization check remain in force.

## Failed provisioning recovery

- A DBK in any state other than `PROVISIONING_FAILED` must not be recreated under the same DBK ID.
- A DBK in `PROVISIONING_FAILED` may enter the recovery path through `dbkRegistry.beginProvisioningRecovery()`.
- Recovery preserves the existing DBK identity and its immutable identity fields. It must not call `saveDbk()` to create the identity again.
- Recovery should retain auditable lifecycle transitions and re-enter the provisioning workflow through the established event/workflow path.
- A retry must not be treated as proof that earlier external side effects did not happen. Ambiguous provider outcomes must follow the existing reconciliation policy rather than blind replay.

## FREE core capability policy

The following foundational capabilities are intended to be available on FREE:

- `core_identity`
- `finance_ledger_core`
- `customer_directory`
- `supplier_registry`
- `inventory_foundation`
- `sales_counter`

FREE availability does not bypass authentication, role/permission checks, tenant isolation, input validation, idempotency, stock validation, or financial integrity controls. It also does not make every advanced or sector-specific capability free; capabilities that remain gated must continue to enforce their declared minimum tier.

## Required verification

Before merging a change to this behavior, verify:

1. A Business Owner can provision FREE and FOUNDATION DBKs.
2. A Business Owner is denied GROWTH, PRO, and ENTERPRISE before registry/blueprint access.
3. TDBK Master Admin can provision the paid commercial tiers subject to normal validation.
4. A failed provisioning attempt can recover through `beginProvisioningRecovery()` without recreating the identity.
5. Repeated provisioning for an existing DBK outside `PROVISIONING_FAILED` is rejected.
6. The canonical FREE journey enables the core sales capability and completes a persisted sale with correct totals, stock mutation, and outbox evidence.
7. TypeScript, lint, targeted capability/flow tests, full tests, and production build pass in CI.

## Evidence and status discipline

Test counts and CI results are commit-specific. Record the exact commit SHA and links to completed CI runs in the pull request or release notes. A passing status for one SHA does not establish that a different pull request head has passed. Provider integrations still require separate sandbox/live credential and callback validation; mocked CI tests do not certify external provider behavior.
