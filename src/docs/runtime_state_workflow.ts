export const TDBK_V2_RUNTIME_SPEC = `# 12. TDBK V2 RUNTIME SPECIFICATION

**Document ID:** \`TDBK_V2_RUNTIME_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. RUNTIME ARCHITECTURE

The **DBK Runtime** is the server-side authoritative engine that processes business commands, executes state transitions, enforces financial rules, and maintains ledger integrity.

\`\`\`
  Client Request (Command)
           |
           v
  [ Command Handler ]
           |
           +---> 1. Verify Authentication & DBK Security Context
           +---> 2. Verify Capability Entitlement
           +---> 3. Load Current Aggregate State from Database
           +---> 4. Execute Domain Business Logic & Rules
           +---> 5. Commit Transaction to DB (State Transition)
           +---> 6. Publish Event to Event Bus (Level 6)
           |
           v
  Command Result (Acknowledged State)
\`\`\`

---

## 2. DOUBLE-ENTRY FINANCIAL LEDGER MANDATE
All money movements inside a DBK MUST be recorded as atomic, double-entry ledger entries.
- **Rule 1:** \`SUM(Debit) - SUM(Credit) == 0.0000\` for every financial transaction group.
- **Rule 2:** Ledger entries are append-only and immutable. Reversals must be executed via distinct counter-entries.
`;

export const TDBK_V2_STATE_MODEL = `# 13. TDBK V2 STATE MODEL SPECIFICATION

**Document ID:** \`TDBK_V2_STATE_MODEL\`  
**Version:** 2.0.0-POINT0  

---

## 1. THE PERMANENT STATE PRINCIPLE

### \`STATEFUL BUSINESS. STATELESS EXPERIENCE.\`

1. **State Persistence Guarantee:** The business state lives exclusively in persistent databases (PostgreSQL/Cloud SQL / Firestore) governed by the DBK Runtime.
2. **Experience Independence:** Web clients, mobile apps, and WhatsApp bots are disposable projection targets.
   - If a browser crashes or closes during an invoice creation, the backend draft transaction is saved and recoverable.
   - If a WhatsApp session expires during an M-Pesa prompt, the payment state continues processing asynchronously in the runtime.
   - If AI Studio restarts or Gemini memory is flushed, zero business financial records are lost.

## 2. OPTIMISTIC UI RECONCILIATION
UI components may display optimistic updates with visual pending markers, but MUST reconcile with authoritative server state snapshots upon event receipt.
`;

export const TDBK_V2_WORKFLOW_EVENT_SPEC = `# 14. TDBK V2 WORKFLOW & EVENT SPECIFICATION

**Document ID:** \`TDBK_V2_WORKFLOW_EVENT_SPEC\`  
**Version:** 2.0.0-POINT0  

---

## 1. CANONICAL EVENT SCHEMA
All platform and business events published on the Level 6 Event Bus follow CloudEvents standard:
\`\`\`typescript
interface TDBKCloudEvent<T = Record<string, unknown>> {
  id: string; // UUIDv4
  source: string; // e.g., 'tdbk.dbk_school_0041.finance'
  specversion: '1.0';
  type: string; // e.g., 'tdbk.payment.received.v1'
  datacontenttype: 'application/json';
  dbkId: string;
  branchId: string;
  time: string; // ISO8601 UTC timestamp
  data: T;
  traceId: string;
}
\`\`\`

## 2. SAMPLE EVENT-DRIVEN WORKFLOW (PAYMENT TO RECEIPT)

\`\`\`
[ M-Pesa Bridge Webhook ]
        |
        v  (Publishes: tdbk.mpesa.stk_callback_received.v1)
[ Ledger Worker ]
        |
        +---> Validates payload signature & amount
        +---> Posts Debit: Cash Account | Credit: Fee Income
        +---> Updates Invoice Status to 'PAID'
        |
        v  (Publishes: tdbk.payment.reconciled.v1)
[ Receipt Generation Service ]
        |
        +---> Generates Digital Cryptographic Receipt PDF
        +---> Logs Audit Record
        |
        v  (Publishes: tdbk.receipt.generated.v1)
[ Notification Bridge ]
        +---> Sends WhatsApp Receipt link to Parent/Customer
        +---> Transmits eTIMS tax invoice payload (if eTIMS capability enabled)
\`\`\`
`;
