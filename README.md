# Thuram Digital Bridge Kenya (TDBK) V2 Platform

TDBK V2 is a robust, multi-tenant kernel, blueprint validation, and dynamic experience projection engine designed for Kenyan micro, small, and medium enterprises (MSMEs) and diversified business owners.

---

## 1. System Purpose

TDBK V2 provides an enterprise-grade digital operating platform that empowers business operators across multiple sectors (Education, Retail/Hardware, Healthcare/Clinics, Hospitality, Logistics, Salons, and Professional Services) to run independent Digital Business Kits (DBKs) with strong tenant boundaries, automated workflow orchestration, dynamic UI projection, and outbox event reliability.

---

## 2. 3-Tier Authorization Model

TDBK V2 enforces a strict, hierarchical 3-tier authorization model:

1. **Tier 1 — TDBK Master Authority (`TDBK_MASTER_ADMIN`)**:
   - Platform-wide governance, global registry management, capability suspension, and comprehensive cross-tenant audit logging.
   - Master authority is isolated and cannot be accessed by tenant administrators or business owners.
2. **Tier 2 — Business Owner / Portfolio (`BUSINESS_OWNER` / `OWNER_OPERATOR`)**:
   - Multi-DBK portfolio management, provisioning new DBKs into the owner portfolio, and cross-DBK context switching.
   - Strictly prohibited from escalating to TDBK Master operations or accessing other owners' DBKs.
3. **Tier 3 — DBK Operational Scope (`TENANT_ADMIN`, `OPERATOR`, `STAFF`)**:
   - Day-to-day operations locked strictly to the user's assigned `tenantId` (DBK ID).
   - Zero access to cross-tenant records, other DBKs, or platform portfolio controls.

---

## 3. Multi-DBK Owner Portfolio Model

Diversified business owners can own and operate arbitrary numbers of DBKs (e.g. a School, a Pharmacy, a Hardware Store, and a Fleet Depot):
- **Unified Portfolio Registry**: The owner can list all their active DBKs without leaking data between them.
- **Context Switching**: Switching between DBKs recompiles the client workspace, resetting sector taxonomy, business DNA, navigation menus, and operational views.
- **Independent Lifecycles**: Each DBK maintains its own branches, capability states, billing tiers, and data boundaries.

---

## 4. DBK Tenant Isolation

- **Partitioned Storage**: All database entities, branch structures, outbox messages, and capability states are partitioned by `dbkId`.
- **Runtime Boundary Enforcement**: `BlueprintValidator.assertTenantAccess` validates every inbound request to ensure principals cannot read or mutate data outside their assigned tenant ID.
- **Branch Scoping**: Multi-branch setups (HQ, outlets, satellite stores) are strictly contained within their parent DBK.

---

## 5. Blueprint & Capability Isolation

- **Sector-Specific Blueprints**: Blueprints (`school_v1`, `hardware_v1`, `clinic_v1`, `hotel_v1`, `logistics_v1`, etc.) declare strict capability bindings.
- **Zero Leakage**: Capabilities designed for one industry cannot leak into or be discovered by another industry DBK (e.g. POS registers cannot attach to schools; academic grades cannot attach to hardware stores).
- **Commercial Entitlement Tiers**: Capabilities are evaluated against commercial subscription tiers (Starter, Growth, Scale, Enterprise) before activation.

---

## 6. Development & Verification Commands

```bash
# Execute full Vitest test suite (11 suites, 112 tests)
npm test

# Run TypeScript type validation
npm run typecheck

# Run ESLint codebase validation
npm run lint

# Build full-stack application (client bundle + CommonJS server)
npm run build

# Start production server
npm start
```
