# TDBK V2 — Grand Operation Audit & Completion Ledger

## Audit date
2026-10-07

## Scope
This audit treats TDBK as one product system rather than a collection of feature slices.

Repository snapshot audited: `e4fa6d53cf6f4bb03fb8474f032a77b003c3a4a0`

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

Current PR head at this audit update: `e92f3bbf47228a2fc58111c31387097de9c308b9`.

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
Gate 04 UNKNOWN/reconciliation enforcement is now wired end-to-end for providers that explicitly support authoritative reconciliation:
- durable execution state records UNKNOWN/RECONCILIATION_REQUIRED;
- workflow recovery refuses blind replay when provider idempotency is unavailable;
- `ExternalReconciliationService` authorizes reconciliation, requires provider reconciliation support and a provider reference, invokes the provider-specific reconciliation operation, durably records RECONCILED_SUCCESS/RECONCILED_FAILURE, and resumes the workflow;
- `POST /api/workflows/reconcile/:executionKey` exposes the authorized reconciliation boundary;
- Gate 04 tests now prove the ambiguous-outcome → reconciled terminal-state transition.

M-Pesa is currently the only provider with a registered authoritative reconciliation adapter. Providers without reconciliation support remain blocked from automatic replay after UNKNOWN.

### C. Sokoni commercial authority
Sokoni now has an authoritative payment state machine and server boundary:
- paid participants start in DRAFT/PAYMENT_REQUIRED;
- authorized owners can initiate an M-Pesa STK payment through `POST /api/sokoni/participants/:participantId/pay`;
- the resulting provider reference is durably stored as a Sokoni payment intent;
- `POST /api/sokoni/payments/:intentId/confirm` queries the configured M-Pesa provider;
- only an authoritative provider SUCCESS changes the payment intent to CONFIRMED and activates the participant;
- FAILED keeps the participant non-active;
- clients cannot directly activate a paid participant through Firestore rules.

Remaining production gate: `SOKONI_PAYMENT_TENANT_ID` and its production M-Pesa connector must be configured and certified. No payment success is fabricated when that merchant boundary is unavailable.

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
3. ~~Close Gate 04 UNKNOWN/reconciliation enforcement~~ — completed for the currently supported reconciliation contract.
4. Harden production readiness.
5. ~~Finish Sokoni ownership + payment authority~~ — implemented; production merchant configuration/certification and callback/reconciliation linkage remain release gates.
6. Build remaining Sokoni authoritative discovery/request domains where justified.
7. Replace/contain provider-unconnected bridge mocks.
8. Run vertical end-to-end transaction matrix.
9. Remove/classify legacy artifacts.
10. Reconcile all status documents against implementation.
11. Run final CI and release-gate review.


## J. Retail/Hardware POS → M-Pesa authoritative payment operation

The retail/hardware canonical operation now crosses the payment boundary after the authoritative sale transaction:

`cashier/RBAC → capability → inventory validation → atomic stock decrement + sale + durable outbox → pos.sale.completed.v1 → checkout workflow reconciliation → explicit POS M-Pesa payment command → durable payment_intent → M-Pesa STK_PUSH bridge → pending financial transaction → provider callback → atomic financial posting + payment.confirmed.v1 outbox → payment-intent + POS sale reconciliation → receipt`.

Implemented:
- POS sale input carries an explicit payment method and customer phone.
- M-Pesa payment initiation is a **separate authoritative command**: `EXECUTE_SALE_MPESA_PAYMENT`. It does not silently mutate payment state as a side effect of sale creation.
- The payment command validates tenant, branch, RBAC, sale state, payable amount and `capability_payments`.
- A durable `payment_intent` is created before provider execution.
- The M-Pesa bridge persists pending financial truth and returns the provider checkout reference.
- Provider callback is the authority that promotes the financial transaction to `POSTED`.
- The POS payment event handler requires posted financial truth, reconciles amount/identity, confirms the payment intent, marks the sale `PAID`, and creates the authoritative receipt idempotently.
- Generic `payment.confirmed.v1` is no longer used as the school fee workflow trigger; the fee catalog trigger is scoped to `school.payment.confirmed.v1` so a retail payment cannot instantiate a school workflow.
- Regression coverage proves confirmed payment → PAID sale + CONFIRMED intent + one receipt, duplicate confirmation delivery, and rejection of unposted financial state.

Important boundary:
- Test runtime uses the deterministic M-Pesa mock path. Production provider execution remains dependent on the tenant's configured Safaricom/Daraja connector and callback configuration.
- eTIMS fiscalization and reorder remain separate release-gated retail workflows; they are not claimed complete by this payment work.
- CI remains release-gated until a fresh GitHub Actions run proves the current branch.


## K. Retail POS → eTIMS fiscalization boundary

The retail/hardware operation now has an explicit fiscalization command after the completed POS sale and payment lifecycle:

`completed sale → tenant/branch/RBAC → capability_statutory_tax → authoritative sale lines → eTIMS SAVE_SALES → confirmed provider result → fiscalization record → sale fiscal state`.

Implemented:
- `EXECUTE_SALE_ETIMS_FISCALIZATION` is exposed through the Experience command boundary.
- Fiscalization validates tenant, branch, cashier authority, sale completion and statutory-tax capability.
- The service derives the eTIMS payload from the persisted sale rather than trusting a second client-side amount.
- A durable fiscalization record is created with deterministic identity `etims_<saleId>`.
- Successful provider response atomically records fiscal state on the sale and the fiscalization record.
- Deterministic configuration/authorization failures are not converted into provider ambiguity.
- Provider-ambiguous outcomes are recorded as `REQUIRES_RECONCILIATION`; the sale is not falsely marked fiscalized.
- Test runtime has a deterministic eTIMS boundary; production still requires an actual configured KRA/VSCU connection.
- This remains separate from school fee operations.

Remaining retail operation:
- Reorder/replenishment remains the next authoritative runtime boundary.
- eTIMS production certification/provider evidence and fresh CI are still release gates.

## Release rule
PR #390 must not be merged merely because it is mergeable. It is mergeable only after the grand-operation acceptance criteria above are satisfied for the scope actually claimed.


### H. Coherence event durability — sprint hardening
The shared-contribution path previously mutated persistent entity state and then attempted direct in-process Event Bus publication. That meant a process crash after the state mutation could lose the domain event even though the business state existed.

Implemented on this sprint:
- ContributionDispatcher now commits every domain contribution event to the tenant-scoped durable outbox before attempting immediate Event Bus delivery.
- Event identity is stable (`contribution-{contributionId}`), so immediate delivery and later recovery share one idempotency identity.
- Immediate Event Bus failure is no longer fatal to the persisted contribution; the durable outbox remains the recovery authority.
- The coherence acceptance test now proves the `attendance.recorded.v1` event exists in the durable outbox with `PENDING` status after the contribution.
- This closes the event-loss-on-process-restart gap for the shared-contribution path.

Important remaining gap:
- `workflowsTriggered` in the coherence model is currently a catalog declaration/result field. The contribution dispatcher does not yet instantiate and execute the corresponding durable Workflow Engine instances from `PLATFORM_WORKFLOW_CATALOG`. Therefore workflow names shown in the coherence result must not be treated as proof of workflow execution. A dedicated event-to-workflow trigger adapter remains release-gated.

## I. Coherence event → workflow trigger boundary — sprint implementation

Implemented on the canonical vertical-completion branch:

- `src/coherence/coherenceWorkflowTriggerAdapter.ts` maps authoritative catalog trigger events to their `PLATFORM_WORKFLOW_CATALOG` workflow definitions.
- The adapter reconstructs tenant/branch/principal authority from the triggering event envelope and rejects events without authoritative tenant identity.
- Each matched event creates a Firestore-persisted workflow instance through `createPersistentWorkflow`, with the triggering event ID/source/correlation retained in workflow metadata.
- The workflow then executes through the existing durable Workflow Engine and `COHERENCE_WORKFLOW_TRIGGER` step handler.
- `src/orchestration/events/eventBus.ts` subscribes the catalog trigger events to the adapter at initialization and after test-store reset.
- `src/coherence/tests/coherenceWorkflowTriggerAdapter.test.ts` proves `attendance.recorded.v1` → `wf_record_attendance` → persisted workflow → completed trigger step.

This closes the **event-to-workflow-instantiation boundary**. It does **not** claim that every catalog downstream outcome is implemented: the catalog's business outcomes (for example parent SMS, eTIMS fiscalization, reorder actions, doctor queue mutation) remain release-gated until each has an authoritative step handler/runtime contract.

Evidence commit sequence:
- `abf188dddf375557ccc6b77f2b80e9667ac35168` — adapter
- `9ac763cc223e02f5b37983f2f014b7a340527a20` — event-bus subscriptions
- `9d5a2a5c06175a8abf5d2771093e542a5d394860` — trigger proof test

Initialization-cycle hardening was added after the first implementation: the adapter no longer statically imports the Event Bus or Workflow Engine in a circular path; the Workflow Engine is lazy-loaded only when a trigger is actually consumed. The Event Bus also re-registers the trigger subscriptions after its test-store reset.

Deterministic trigger identity hardening is now implemented: coherence workflow IDs are derived from tenant + catalog workflow + triggering event ID, and durable creation uses a Firestore transaction with create-if-absent semantics. A replay after clearing the in-process EventBus/Workflow caches must resolve to the same persisted workflow rather than creating a second instance. This protects the event-to-workflow boundary against process restart and duplicate delivery.

CI evidence is still pending; GitHub currently reports no pull-request workflow run for the latest commit. Therefore this gate is **implemented but not CI-closed**.


## J. Retail POS → M-Pesa payment operation

The retail/hardware vertical now has a distinct payment boundary after checkout:

COMPLETED SALE
→ PosPaymentService
→ M-Pesa STK_PUSH
→ durable PENDING financial transaction
→ Safaricom callback
→ atomic financial posting + ledger + payment.confirmed.v1
→ EventBus
→ POS payment reconciliation
→ authoritative sale paymentStatus = PAID.

The implementation deliberately does not mark a sale paid on STK initiation. The sale is marked PAID only from an authoritative MpesaBridge confirmation event whose amount reconciles against the persisted sale.

Proof artifacts:
- src/business/sales/saleMpesaPaymentService.ts
- src/business/sales/posMpesaPaymentHandler.ts
- src/experience/tests/canonicalClientJourney.test.ts
- src/orchestration/tests/externalBridgeHardening.test.ts
- src/orchestration/bridge/adapters/mpesaBridge.ts

The provider-specific live Safaricom transaction remains production-certification gated; test-runtime proof uses the existing mock boundary and the real callback/reconciliation path.

Further hardening in the current sprint:
- A durable sale-scoped `payment_intent` is created before STK Push.
- The payment command is exposed through `EXECUTE_SALE_MPESA_PAYMENT` and requires tenant authority, branch authority, RBAC `execute:sales`, and `capability_payments`.
- The POS payment handler resolves the payment intent and authoritative POSTED financial transaction rather than trusting event correlation alone.
- M-Pesa callback events carry the authoritative financial transaction ID and CheckoutRequestID for downstream reconciliation.
- Confirmed payment updates the sale and payment intent atomically; the receipt is then created from POSTED financial truth.
- Regression proof covers duplicate confirmation delivery and rejection of unposted financial state.
- Retail/hardware/general commerce remains strictly separated from school workflows.

This payment boundary is implemented but remains **RELEASE-GATED** until CI executes and passes.


## L. Retail POS → low-stock reorder → replenishment intent

The retail/hardware operation now has an authoritative replenishment boundary after the sale event:

COMPLETED SALE
→ authoritative stock balance
→ configured reorderLevel / targetStockLevel policy
→ deterministic reorder decision
→ durable procurement intent
→ supplier-selection state
→ inventory.reorder.triggered.v1
→ EventBus
→ durable coherence workflow `wf_reorder_replenishment`.

Implementation:
- `src/business/inventory/reorderEngine.ts` evaluates only the authoritative persisted stock record for the tenant and sold inventory item.
- `reorderLevel` is the trigger threshold. `targetStockLevel` is optional; when absent the policy targets twice the reorder level. An explicit `reorderQuantity` takes precedence.
- Reorder decision identity is deterministic from inventory record + triggering sale event. Repeated delivery is idempotent.
- The procurement intent is persisted separately from the reorder decision.
- If no authoritative `supplierId` exists, the intent is `SUPPLIER_SELECTION_REQUIRED`; TDBK does not invent a supplier.
- If a supplier is configured, the intent becomes `READY_FOR_PURCHASE_ORDER`; actual PO issuance remains a separate purchasing-capability operation.
- The reorder event is written through the durable outbox in the same transaction as the decision and procurement intent.
- `eventBus.ts` subscribes completed POS sales to the Reorder Engine.
- `wf_reorder_replenishment` is registered in `PLATFORM_WORKFLOW_CATALOG`, so the durable event-to-workflow adapter also persists its workflow instance.

Canonical proof was extended in `src/experience/tests/canonicalClientJourney.test.ts`:
- the sale reduces stock from 5 to 3;
- reorderLevel is 3 and targetStockLevel is 8;
- exactly one procurement intent is created for quantity 5;
- the intent remains supplier-selection gated because no supplier was fabricated;
- the reorder outbox event is created and delivered;
- `wf_reorder_replenishment` is persisted and completes its trigger boundary.

This closes the **retail reorder-decision and replenishment-intent boundary**. It does not claim supplier selection, PO issuance, goods receipt, or physical replenishment as complete. Those remain separate purchasing execution stages.

CI evidence remains pending. This item is therefore **IMPLEMENTED / PROVEN BY TEST CODE / RELEASE-GATED FOR CI**.
