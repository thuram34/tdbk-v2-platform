export const TDBK_V2_BLUEPRINT_SPEC = `# 8. TDBK V2 BLUEPRINT SPECIFICATION

**Document ID:** \`TDBK_V2_BLUEPRINT_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. BLUEPRINT DEFINITION

A Blueprint defines the **operational world** of an entire industry sector. It is not merely a custom navigation menu or label overrides.

### Blueprint Structure Schema
\`\`\`json
{
  "blueprint_id": "BLUEPRINT_SCHOOL_V2",
  "industry": "EDUCATION",
  "terminology": {
    "primary_entity": "Student",
    "primary_entity_plural": "Students",
    "location_unit": "Classroom / Stream",
    "transaction_type": "Fee Payment",
    "actor_primary": "Teacher / Tutor",
    "actor_secondary": "Parent / Guardian"
  },
  "entities": [
    "STUDENT", "CLASS_STREAM", "ACADEMIC_TERM", "FEE_STRUCTURE", "EXAM_SCORE", "HOSTEL"
  ],
  "actors": [
    "HEADTEACHER", "BURSAR", "TEACHER", "PARENT", "DRIVER"
  ],
  "supported_capabilities": [
    "CAP_ACADEMICS", "CAP_FEE_MANAGEMENT", "CAP_ATTENDANCE", "CAP_TRANSPORT", "CAP_MPESA_BRIDGE"
  ],
  "workflows": [
    "STUDENT_ADMISSION_WORKFLOW", "FEE_BILLING_WORKFLOW", "EXAM_MARKING_WORKFLOW"
  ]
}
\`\`\`

---

## 2. STANDARD BLUEPRINT CATALOG AT POINT 0

1. **\`BLUEPRINT_SCHOOL_V2\`**: Primary entity: Student. Workflows: Admissions, Fee Structure, Grading, Term Reports.
2. **\`BLUEPRINT_HARDWARE_RETAIL_V2\`**: Primary entity: Inventory Item. Workflows: Stock Receive, Counter Sales, Supplier PO, Batch Tracking.
3. **\`BLUEPRINT_HEALTHCARE_CLINIC_V2\`**: Primary entity: Patient. Workflows: Triage, Consultation, Pharmacy Dispense, SHA Insurance Claim.
4. **\`BLUEPRINT_LOGISTICS_TRANSPORT_V2\`**: Primary entity: Shipment / Trip. Workflows: Waybill Creation, Waypoint Check-in, Fuel Allocation,POD.
5. **\`BLUEPRINT_GENERAL_SME_V2\`**: Primary entity: Customer. Workflows: Invoicing, Expense Tracking, Simple Sales, Cash Ledger.
`;

export const TDBK_V2_BUSINESS_DNA_SPEC = `# 9. TDBK V2 BUSINESS DNA SPECIFICATION

**Document ID:** \`TDBK_V2_BUSINESS_DNA_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. BUSINESS DNA CONTEXT

While a Blueprint defines the industry template, **Business DNA** captures the unique operational context and growth state of a specific client's DBK.

### Business DNA Data Structure
\`\`\`typescript
interface BusinessDNA {
  dbkId: string;
  businessName: string;
  tradingName?: string;
  registrationNumber?: string;
  kraPin?: string;
  industrySector: string;
  operationalScale: 'MICRO' | 'SMALL' | 'MEDIUM' | 'ENTERPRISE';
  branches: Array<{
    branchId: string;
    branchName: string;
    county: string;
    town: string;
    isHeadquarters: boolean;
  }>;
  operationalPreferences: {
    currency: 'KES' | 'USD';
    fiscalYearStartMonth: number;
    allowNegativeStock: boolean;
    requireApprovalForExpensesOver: number;
    automaticReceiptDeliveryChannel: 'WHATSAPP' | 'SMS' | 'EMAIL' | 'NONE';
  };
  healthMetrics: {
    activeUsersCount: number;
    monthlyTransactionVolumeKES: number;
    lastStateAuditTimestamp: string;
    systemHealthScore: number; // 0 - 100
  };
}
\`\`\`
`;

export const TDBK_V2_CAPABILITY_SPEC = `# 10. TDBK V2 CAPABILITY SPECIFICATION

**Document ID:** \`TDBK_V2_CAPABILITY_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. THE CAPABILITY PRINCIPLE

### \`DISCOVERABLE ≠ ENABLED\`

1. **Discoverability Filter:** A DBK can only view and explore capabilities that are listed in its active **Blueprint**. (e.g. A Hardware business never sees "Student Exam Grading" in its discoverable capability catalog).
2. **Enablement Gate:** A discoverable capability CANNOT be executed until it passes through the **Entitlement Gateway**.

\`\`\`
  [ ALL PLATFORM CAPABILITIES ]
               |
               v Filtered by Blueprint
  [ SUPPORTED / DISCOVERABLE CAPABILITIES ]
               |
               v Filtered by Active Subscription / Entitlement
  [ ENABLED RUNTIME CAPABILITIES ]
\`\`\`

## 2. CAPABILITY REGISTRY SCHEMA
Each capability exports a manifest defining its permissions, data schemas, and runtime handlers:
\`\`\`typescript
interface CapabilityManifest {
  capabilityId: string; // e.g., 'CAP_MPESA_C2B'
  domain: 'FINANCE' | 'INVENTORY' | 'OPERATIONS' | 'COMMUNICATION';
  displayName: string;
  description: string;
  requiredPermissions: string[];
  dependsOnCapabilities?: string[];
  supportedBlueprints: string[];
  isPremium: boolean;
}
\`\`\`
`;

export const TDBK_V2_ENTITLEMENT_SPEC = `# 11. TDBK V2 ENTITLEMENT SPECIFICATION

**Document ID:** \`TDBK_V2_ENTITLEMENT_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. SUBSCRIPTION TIERS & ENTITLEMENT GATING

| Tier Level | Tier Name | Capabilities Granted | Rate Limits | Support SLA |
| :--- | :--- | :--- | :--- | :--- |
| **Tier 1** | **Starter DBK** | Core Blueprint Workflows + Cash Ledger + basic receipts. | 1,000 tx/mo | Standard |
| **Tier 2** | **Growth DBK** | Tier 1 + M-Pesa Bridge + WhatsApp Notifications + Multi-Branch. | 25,000 tx/mo | Priority |
| **Tier 3** | **Pro / Enterprise DBK** | Tier 2 + KRA eTIMS Bridge + Custom Reports + Advanced AI Insights + Dedicated API. | Unlimited | Dedicated 24/7 |

## 2. ENFORCEMENT ENGINE
The Kernel middleware evaluates claims on every API request:
\`\`\`typescript
function verifyEntitlement(context: SecurityContext, requiredCapability: string): boolean {
  if (!context.blueprintCapabilities.includes(requiredCapability)) {
    throw new Error('CAPABILITY_NOT_SUPPORTED_BY_BLUEPRINT');
  }
  if (!context.activeEntitlements.includes(requiredCapability)) {
    throw new Error('ENTITLEMENT_REQUIRED_UPGRADE_SUBSCRIPTION');
  }
  return true;
}
\`\`\`
`;
