export const TDBK_V2_DATA_MODEL = `# 4. FIRESTORE HIERARCHICAL DATA ARCHITECTURE & RULES SPECIFICATION

**Document ID:** \`TDBK_V2_DATA_MODEL\` (Deliverable 03)  
**Version:** 2.0.0-AUTHORITATIVE  
**Status:** AUTHORITATIVE & BINDING  

---

## 1. SELECTED PRODUCTION DATABASE: GOOGLE CLOUD FIRESTORE (NATIVE MODE)

TDBK V2 standardizes exclusively on **Google Cloud Firestore (Native Mode)** across all services. All legacy references to PostgreSQL, SQL schemas, table migrations, and Row-Level Security (RLS) have been completely eliminated.

### Key Architectural Rationale:
1. **Real-time Synchronization:** Native support for real-time document change listeners (\`onSnapshot\`) required by TDBK's live workspace views.
2. **Serverless Scaling:** Auto-scales from micro-enterprises to high-volume multi-branch networks without database cluster provisioning overhead.
3. **Path-Based Security Enforcement:** Granular, document-level security rules enforced natively via \`firestore.rules\` based on authenticated JWT claims.

---

## 2. FIRESTORE HIERARCHICAL COLLECTION TOPOLOGY

Tenant isolation in Cloud Firestore is enforced via a **Hierarchical Path + Declarative Security Rules** model. All operational data for a DBK tenant MUST reside under \`/tenants/{tenantId}/\` subcollections:

\`\`\`
/tenants/{tenantId}/
  ├── organization_profile (document)
  ├── branches/{branchId}/ (subcollection)
  ├── ledger_entries/{entryId}/ (subcollection)
  ├── school_students/{studentId}/ (subcollection)
  ├── inventory_items/{itemId}/ (subcollection)
  ├── clinic_patients/{patientId}/ (subcollection)
  └── pos_sales/{saleId}/ (subcollection)
\`\`\`

---

## 3. CANONICAL DOCUMENT SCHEMAS

### A. Ledger Entry Document (\`/tenants/{tenantId}/ledger_entries/{entryId}\`)
\`\`\`typescript
interface LedgerEntryDocument {
  entryId: string;
  tenantId: string; // Mandatory path & token validation match
  branchId: string;
  transactionRef: string;
  accountCode: string;
  debitAmount: number; // 4-decimal precision numeric
  creditAmount: number;
  currency: 'KES' | 'USD';
  entityId?: string;
  sourceBridge: 'MPESA' | 'CASH' | 'ETIMS' | 'BANK';
  narration: string;
  postedAt: string; // ISO 8601 UTC timestamp
  postedBy: string;
  version: number;
}
\`\`\`

### B. Business Entity Document (\`/tenants/{tenantId}/entities/{entityId}\`)
\`\`\`typescript
interface EntityDocument {
  entityId: string;
  tenantId: string;
  branchId: string;
  entityType: 'STUDENT' | 'PRODUCT' | 'PATIENT' | 'SHIPMENT' | 'CUSTOMER';
  code: string;
  displayName: string;
  attributes: Record<string, unknown>; // Sector Business DNA attributes
  status: 'ACTIVE' | 'INACTIVE' | 'ARCHIVED';
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}
\`\`\`
`;

export const TDBK_V2_SECURITY_MODEL = `# 5. SERVER-AUTHORITATIVE MULTI-TENANT SECURITY & RBAC SPECIFICATION

**Document ID:** \`TDBK_V2_SECURITY_MODEL\` (Deliverable 02)  
**Version:** 2.0.0-AUTHORITATIVE  

---

## 1. HYBRID ACCESS CONTROL (RBAC + ABAC + PBAC)

- **Role-Based Access Control (RBAC):** Base permissions granted by functional role (e.g., \`Bursar\`, \`StoreManager\`, \`Clinician\`, \`TenantAdmin\`).
- **Attribute-Based Access Control (ABAC):** Contextual rules evaluated dynamically (e.g., \`BranchID == User.ActiveBranch\`, \`TransactionAmount <= User.MaxApprovalLimit\`).
- **Policy-Based Access Control (PBAC):** Blueprint capability gating (e.g., \`Tenant.Entitlements.contains('FINANCE_ETIMS_BRIDGE')\`).

---

## 2. CRYPTOGRAPHIC TENANT CONTEXT CLAIMS (FIREBASE AUTH CUSTOM CLAIMS)

All API requests and Firestore operations carry signed Firebase Auth JWT tokens containing explicit tenant claims injected upon authentication:

\`\`\`json
{
  "uid": "usr_98127391",
  "tenantId": "dbk_school_0041",
  "branchId": "br_main",
  "blueprint": "SCHOOL_V2",
  "roles": ["SCHOOL_BURSAR"],
  "entitlements": ["STUDENT_ACADEMICS", "FEE_COLLECTION", "MPESA_BRIDGE"],
  "iat": 1786610000,
  "exp": 1786613600
}
\`\`\`

---

## 3. DECLARATIVE FIRESTORE SECURITY RULES (\`firestore.rules\`)

Firestore rules guard every read and write operation at the database engine layer:

\`\`\`javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper function verifying authenticated tenant match
    function isTenantMember(tenantId) {
      return request.auth != null 
          && request.auth.token.tenantId == tenantId;
    }
    
    // Strict Path-Based Tenant Isolation
    match /tenants/{tenantId}/{document=**} {
      allow read: if isTenantMember(tenantId);
      allow write: if isTenantMember(tenantId) 
                  && request.auth.token.roles.hasAny(['TENANT_ADMIN', 'BURSAR', 'CLINICIAN']);
    }
  }
}
\`\`\`
`;

export const TDBK_V2_TENANCY_MODEL = `# 6. AUTHORITATIVE TENANT ISOLATION MECHANISM SPECIFICATION

**Document ID:** \`TDBK_V2_TENANCY_MODEL\`  
**Version:** 2.0.0-AUTHORITATIVE  

---

## 1. FIRESTORE PATH-BASED TENANT ISOLATION

TDBK V2 enforces tenant boundary isolation through **Cloud Firestore Hierarchical Collection Paths + Declarative Security Rules**:

1. **Path Isolation:** All business operational data resides inside subcollections under \`/tenants/{tenantId}/\`.
2. **Security Rules Guarding:** \`firestore.rules\` evaluates \`request.auth.token.tenantId == tenantId\` on every document read, query, write, or delete.
3. **Backend Middleware Validation:** Express backend middleware verifies that the \`tenantId\` parameter in route params matches the validated JWT claim before executing any Firestore transaction.

---

## 2. TENANT CONTAMINATION PREVENTION

- **Query Context Guard:** Client SDKs and backend services construct Firestore queries constrained strictly to the tenant path: \`db.collection('tenants').doc(tenantId).collection(subcollection)\`.
- **Cache Namespace Isolation:** In-Memory & Redis keys are explicitly namespaced: \`dbk:{tenantId}:{key}\`.
- **Storage Isolation:** File storage paths use \`gs://tdbk-vault/{tenantId}/{category}/{filename}\`.
`;

export const TDBK_V2_MASTER_DBK_MODEL = `# 7. PLATFORM MASTER & DBK TENANT BOUNDARY SPECIFICATION

**Document ID:** \`TDBK_V2_MASTER_DBK_MODEL\`  
**Version:** 2.0.0-AUTHORITATIVE  

---

## 1. AUTHORITATIVE TENANCY BOUNDARY MAP

\`\`\`
+---------------------------------------------------------------------------------+
|                        AUTHORITATIVE TENANCY BOUNDARY MAP                       |
|                                                                                 |
|  [PLATFORM MASTER]     Global System Supervisor (Multi-Tenant Administration)   |
|         |                                                                       |
|         v                                                                       |
|     [DBK TENANT]       Isolated Client Business Operating Environment           |
|         |                                                                       |
|         v                                                                       |
|      [BRANCH]          Physical or Operational Cost Center (e.g., Campus)       |
|         |                                                                       |
|         v                                                                       |
|       [USER]           Authenticated Identity assigned to specific Roles        |
+---------------------------------------------------------------------------------+
\`\`\`

---

## 2. BOUNDARY DEFINITIONS

1. **Platform Master:** Top-level administrative context governing tenant provisioning, subscription billing, global blueprint definitions, and platform audit logs.
2. **DBK Tenant:** Isolated client business operating environment defined by a unique \`tenantId\`.
3. **Branch:** Physical or operational sub-entity of a DBK tenant (e.g. Main Campus, Nairobi Branch). All branch data is scoped by \`branchId\` within the tenant's subcollections.
4. **User:** Authenticated user identity containing explicit role memberships (\`tenantId\`, \`branchId\`, \`role\`) managed via Firebase Auth custom claims.
`;
