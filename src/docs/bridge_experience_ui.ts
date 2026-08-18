export const TDBK_V2_BRIDGE_SPEC = `# 15. TDBK V2 BRIDGE SPECIFICATION

**Document ID:** \`TDBK_V2_BRIDGE_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. THE BRIDGE PRINCIPLE

External services (M-Pesa Express/C2B, KRA eTIMS, WhatsApp Cloud API, SMS Gateways, Bank Host-to-Host) are **Bridges**.

### Core Rules for Bridges
1. **Asynchronous & Non-Blocking:** UI commands trigger bridge jobs asynchronously via queues. User interfaces NEVER spin or block waiting for remote 3rd-party network calls.
2. **Idempotency Guarantee:** Every bridge message processes a unique idempotency key (\`idempotency_key = dbk_id + transaction_ref\`).
3. **Mock Isolation:** Production code calls abstract \`IBridgeAdapter\` interfaces. In test/dev environments, mock adapters run deterministically without hitting live endpoints.

\`\`\`
  DBK Runtime State
        |
        v Enqueues Job
  [ Level 6 Bridge Adapter ]
        |
        v HTTPS / TLS 1.3
  [ External System (M-Pesa / eTIMS / WhatsApp) ]
        |
        v Asynchronous Callback / Webhook
  [ Bridge Callback Controller ]
        |
        v Verifies HMAC Signature
  [ Runtime Reconciliation Worker ]
        |
        v Updates Authoritative State & Ledger
\`\`\`
`;

export const TDBK_V2_EXPERIENCE_SPEC = `# 16. TDBK V2 EXPERIENCE SPECIFICATION

**Document ID:** \`TDBK_V2_EXPERIENCE_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. MULTI-SURFACE PROJECTION

The Experience layer translates core domain models into format-agnostic payloads suitable for various interaction surfaces:
- **Web App (React/Vite SPA & PWA):** Rich visual interaction, graphs, tables, bulk actions.
- **WhatsApp Bot / Conversational UI:** Concise text flows, quick reply buttons, document downloads (PDF receipts).
- **Mobile Native (Android/iOS):** Touch-optimized, offline-first barcode scanning, receipt printer pairing.
- **REST / GraphQL APIs:** Headless integration for third-party client systems.

The underlying business state remains identical regardless of which surface initiated the operation.
`;

export const TDBK_V2_UI_SYSTEM_SPEC = `# 17. TDBK V2 UI SYSTEM SPECIFICATION (SHA/AFYANGU REFERENCE)

**Document ID:** \`TDBK_V2_UI_SYSTEM_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. SHA / AFYANGU INTERACTION MODEL ADOPTION

We adopt the **interaction architecture** observed in modern Kenya healthcare & public sector systems (SHA/Afyangu), adapted for SME operations across all sectors.

### THE CONTINUOUS NAVIGATION PIPELINE
\`\`\`
[ BUSINESS IDENTITY ] -> Select DBK Context
        |
        v
[ VERTICAL CONTEXT ] -> Apply Sector Theme & Terminology
        |
        v
[ ACTIVE ENTITY ] -> Search / Select Entity (e.g., Student, Item, Patient, Invoice)
        |
        v
[ HORIZONTAL CONTEXTUAL TABS ] -> Overview | Transactions | Records | History | Actions
        |
        v
[ WORKFLOW ACTION ] -> Form / Modal / Step Execution
        |
        v
[ VISIBLE STATE ] -> Updated Ledger, Badge Status, Audit Feedback
\`\`\`

---

## 2. DYNAMIC TERMINOLOGY ADAPTATION MATRIX

| Blueprint | Primary Entity | Secondary Entity | Primary Action | Transaction Name | Location Term |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **School** | Student | Parent / Guardian | Collect Fees | Fee Payment | Classroom |
| **Hardware** | Product / Item | Supplier | Process Sale | Counter Sale | Warehouse / Aisle |
| **Healthcare** | Patient | Clinician | Record Triage | Consultation | Ward / Clinic |
| **Logistics** | Shipment / Waybill | Driver / Carrier | Dispatch Trip | Freight Invoice | Depot / Route |
| **Retail** | Merchandise | Customer | Ring Checkout | POS Receipt | Counter |

---

## 3. UI ANTI-PATTERNS BANNED IN TDBK V2
- ❌ **No Monolithic Sidebars:** Do NOT build 50-item deep nested sidebars listing every module.
- ❌ **No Unsolicited Hero Banners:** Do NOT show marketing hero headers or promotional splash screens in operational apps.
- ❌ **No Hardcoded Terms:** Never write hardcoded "Student" or "Patient" in shared platform components. Always fetch from Blueprint terminology context.
`;

export const TDBK_V2_AI_ARCHITECTURE = `# 18. TDBK V2 AI ARCHITECTURE SPECIFICATION

**Document ID:** \`TDBK_V2_AI_ARCHITECTURE\`  
**Version:** 2.0.0-POINT0  

---

## 1. SERVER-SIDE AI INTEGRATION (GEMINI API)

1. **Security Isolation:** All Gemini API key handling and LLM orchestrations run strictly **server-side** via Express API routes (\`/api/ai/*\`). Keys are NEVER exposed to client browsers.
2. **AI as an Assistant, Not Authority:** Gemini provides natural language search, automated report summarization, draft invoice extraction from images/PDFs, and anomaly detection.
3. **Data Integrity Guarantee:** Gemini output is treated as **untrusted user input**. Every AI action that mutates business state MUST be explicitly confirmed by a human actor or validated against DBK Runtime schemas.
4. **Conversation Memory Isolation:** Chat sessions and vector indexes are stored in separate telemetry stores, completely isolated from the double-entry financial ledger.
`;
