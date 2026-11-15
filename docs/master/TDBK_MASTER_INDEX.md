# TDBK Master Architecture Index

**Baseline:** DNA & Blueprint v1.0.0  
**Last consolidated:** 2026-11-15

Use this index as the entry point for the TDBK platform architecture and operating model.

## Authority documents

1. [Master DNA & Blueprint](./TDBK_MASTER_DNA_BLUEPRINT_V1.md) — overall platform definition, nine-layer architecture, business model, security, AI policy, governance and acceptance rule.
2. [Business DNA Standard](./TDBK_BUSINESS_DNA_STANDARD.md) — canonical 16-domain business operating model, data authority and schema/migration rules.
3. [Blueprint Engineering Standard](./TDBK_BLUEPRINT_ENGINEERING_STANDARD.md) — archetype taxonomy, blueprint contract, capability semantics, compilation, lifecycle and migration.
4. [Ecosystem & Capability Map](./TDBK_ECOSYSTEM_CAPABILITY_MAP.md) — product boundaries, shared capability domains and integration rules.
5. [DNA & Blueprint Gap Register](./TDBK_DNA_BLUEPRINT_GAP_REGISTER.md) — open decisions, risk priorities and closure evidence.

## Existing implementation evidence

- [Canonical Client Journey](../architecture/TDBK_CANONICAL_CLIENT_JOURNEY.md) — current onboarding, provisioning, workspace and sale trace.
- [Baseline Capability Ledger](./TDBK_BASELINE_CAPABILITY_LEDGER.md) — evidence-backed capability inventory and operational risks.
- [Engineering Implementation Ledger](../engineering/TDBK_IMPLEMENTATION_LEDGER.md) — capability-by-capability implementation declarations and audit verdicts.

## Change-control rules

- Do not silently replace or contradict existing architecture documents. Record and resolve discrepancies in the gap register.
- Treat published blueprint versions as immutable.
- Separate design specification, code implementation, test verification and production evidence.
- Any schema or identity migration requires a separate reviewed implementation change with compatibility and rollback plans.
- Update the gap register and implementation ledger when evidence changes.
