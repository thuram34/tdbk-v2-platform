# TDBK Blueprint Engineering Standard — v1.0.0

**Status:** Canonical design and acceptance contract  
**Date:** 2026-11-15

## 1. Definition

A Blueprint is an immutable, versioned operating template for a business archetype. It describes supported business structure and behavior; it is not the business's live data and does not execute transactions.

Canonical selection chain:

`Industry → Subsector → Archetype → Blueprint ID + Version → Business DNA Instance`

## 2. Blueprint contract

A publishable blueprint must define:

1. Identity: stable ID, semantic version, name, owner, lifecycle status, description.
2. Classification: industry, subsector, archetype, supported geography/jurisdictions.
3. Entities: domain entities, relationships, cardinality and ownership.
4. Terminology: singular/plural labels and domain vocabulary.
5. Organisation: departments, operational units and branch patterns.
6. Roles: role templates, permission bundles, scope and separation of duties.
7. Capabilities: required, recommended, optional, excluded and conflicting capability IDs.
8. Configuration: validated schemas, defaults, constraints and dependencies.
9. Workflows: commands, states, transitions, actors, approvals, timeouts, retries and compensation.
10. Rules: domain invariants, validation, pricing/tax/credit/stock constraints.
11. Documents: document types, templates, retention and evidence requirements.
12. Finance: relevant ledgers, billing, payments, reconciliation and accounting mappings.
13. Inventory/assets: units, batches, serials, locations, movements and valuation where relevant.
14. Integrations: provider contracts, credential references, callback rules and readiness requirements.
15. Events: emitted/consumed event contracts and version compatibility.
16. Experience: navigation, dashboard widgets, forms, commands, cards and empty/error states.
17. Analytics: KPIs, report definitions, filters and calculation ownership.
18. Compliance: jurisdictional and sector-specific obligations, with source and effective date.
19. Extension points: supported custom fields/hooks without arbitrary executable tenant code.
20. Lifecycle: validation, release, migration, compatibility and retirement policy.

## 3. Capability selection semantics

Each capability reference must state one of:
- REQUIRED: necessary for minimum safe operation of this archetype.
- RECOMMENDED: strongly useful, but customer may defer.
- OPTIONAL: customer-selectable.
- CONDITIONAL: activated only when a DNA rule/prerequisite is true.
- EXCLUDED: incompatible or not supported.
- CONFLICTS_WITH: explicit incompatibility reference.

A blueprint default is not an entitlement. A plan entitlement is not activation. Activation is not readiness. The capability resolver must check, independently:

`Blueprint compatibility ∧ Plan entitlement ∧ Dependencies ∧ Business configuration ∧ Permission policy ∧ Runtime readiness`

## 4. Validation and publication

Before publication, validate:
- Unique stable IDs and valid semantic version
- All referenced capabilities exist and versions are compatible
- No dependency cycles or unresolved conflicts
- Every required capability has an owner and acceptance criteria
- Every workflow transition has an authorised actor and failure path
- Every visible command maps to a real runtime contract
- Every external provider dependency has a sandbox/production readiness status
- Roles obey least privilege and separation-of-duties rules
- Documents and compliance rules have jurisdiction/effective-date metadata
- Migration and rollback strategy exists for schema-affecting releases

Blueprint publication is immutable. Any change to behavior, schema, roles, workflow or required capabilities creates a new version.

## 5. Runtime compilation

The compiler may produce a workspace projection containing:
- Blueprint identity/version
- resolved terminology
- permitted domains/navigation
- capability status summaries
- role-aware UI metadata
- default dashboard composition
- branch topology summary
- validated feature configuration references

The compiled workspace is a projection, not the authority for transactions, permissions or financial records. Every command is re-authorised at execution time. Client-side visibility is not access control.

## 6. Migration contract

Blueprint upgrade plan must include:
1. Source and target blueprint versions.
2. Compatibility assessment.
3. DNA schema changes and data transformation.
4. Capability additions/removals and entitlement impact.
5. Role and permission changes.
6. Workflow state migration and in-flight operation handling.
7. Document/report changes.
8. Provider/integration changes.
9. Dry-run report and affected-record counts.
10. Customer/administrator approval when required.
11. Rollback or forward-recovery strategy.
12. Audit event and post-migration verification.

Do not automatically migrate an active business merely because a newer blueprint exists.

## 7. Initial archetype backlog

These are catalogue targets, not implementation claims:

| Family | Candidate archetypes |
|---|---|
| Commerce | Hardware yard; supermarket; mini-market; electronics/appliance retailer; pharmacy; wholesaler/distributor; online merchant |
| Education | Primary/secondary school; college; university; vocational centre; daycare |
| Healthcare | Hospital; outpatient clinic; laboratory; dental clinic; pharmacy; medical supplier |
| Hospitality | Hotel; restaurant; caterer; salon; spa; events venue |
| Logistics | Courier; fleet; freight/cargo; passenger transport; boda network; warehouse |
| Construction/property | General contractor; specialist contractor; property manager; facilities manager; equipment hire |
| Agriculture/manufacturing | Farm; dairy; livestock; cooperative; food processor; water/beverage manufacturer |
| Institutions/services | Consultancy; agency; legal/accounting practice; NGO; SACCO; faith/community institution |

Current source `src/blueprint/types.ts` has a narrower `SectorType` union and `src/blueprint/catalog.ts` contains initial sector blueprints. Extend through catalogue/schema evolution; avoid broad sector-union edits without auditing all consumers and persisted values.

## 8. Current repository mapping

| Existing asset | Role in target standard | Follow-up |
|---|---|---|
| `src/blueprint/types.ts` | Type seed for Blueprint, BusinessDNA and compiled workspace | Add schema-backed versioned domain contracts while preserving and enforcing `tenantId === dbkId` |
| `src/blueprint/catalog.ts` | Initial blueprint catalogue | Validate references and separate archetypes from sector enum |
| `src/blueprint/registry.ts` | Blueprint lookup/registration | Verify immutable versions, publication and deprecation semantics |
| `src/blueprint/compiler.ts` | Compile blueprint and DNA into workspace projection | Ensure compiler does not grant authority or bypass entitlement |
| `src/blueprint/dnaManager.ts` | DNA orchestration | Verify domain revisions, provenance and validation |
| `src/persistence/firestore/repositories/businessDnaRepository.ts` | DNA persistence | Resolve `dbkId` / `tenantId` contract; test isolation |
| `src/capability/catalog.ts`, `registry.ts` | Capability catalogue and registry | Add canonical IDs/aliases/version compatibility |
| `src/capability/dependencyEngine.ts` | Dependency resolution | Test cycles, conflicts and missing dependencies |
| `src/capability/entitlement.ts` | Plan entitlement | Keep entitlement distinct from enabled/operational |
| `src/capability/recommendation.ts` | Recommendations | Advisory only; persist acceptance separately |
| `src/platform/provisioning/provisioningService.ts` | Workspace provisioning | Enforce ordered, idempotent and recoverable activation |
| `src/experience/experienceResolver.ts` | Experience projection | Ensure every command re-authorises server-side |

## 9. Blueprint acceptance test

For each published blueprint, create a test business and demonstrate:
- Discovery selects the correct archetype.
- DNA is collected and validated with missing prerequisites visible.
- The exact blueprint version is pinned.
- Required capabilities are compatible and entitled.
- Workspace provisioning is idempotent and recoverable.
- Only permitted roles see and execute relevant actions.
- A representative workflow changes authoritative state correctly.
- Failures, retries and duplicate requests are safe.
- External provider outcomes are reconciled where applicable.
- UI shows the confirmed outcome and audit history.
- Upgrade dry-run identifies changes without mutating production data.
