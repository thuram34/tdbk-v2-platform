# TDBK Chemist Pro

Standalone retail chemist management application for Kenya. This folder is an independently runnable Vite + React + TypeScript app.

## Run locally

```bash
cd apps/chemist-pro
npm install
npm run dev
```

## Current milestone

The current handover build provides a local-first catalogue, cash checkout, stock deduction, sales history, basic reports, and JSON backup export. Products and sales are stored in the current browser's local storage; they do not sync across devices and can be lost if browser data is cleared or the device fails. Start with the client's verified inventory rather than sample products. The app does not yet provide cloud sync, authenticated users, verified M-Pesa, batch-level stock allocation, tax/eTIMS handling, or production pharmacy controls. Use only after the owner accepts these limits and establishes a backup routine.

## Next implementation gates

1. Implement authenticated multi-user access and a trusted server-side stock ledger.
2. Add cloud persistence, conflict-safe synchronization and audit logging.
3. Add batch/expiry allocation, returns, purchasing and financial reconciliation.
4. Integrate and test verified Daraja M-Pesa callbacks; keep payment state server-authoritative.
5. Add tax/eTIMS support where required, automated backups, monitoring and production security tests.

Do not enter real patient data or rely on the demo checkout for financial or stock records.
