# TDBK Chemist Pro

Standalone retail chemist management application for Kenya. This folder is an independently runnable Vite + React + TypeScript app.

## Run locally

```bash
cd apps/chemist-pro
npm install
npm run dev
```

## Current milestone

The first UI milestone provides a responsive dashboard, searchable product catalogue, a local POS cart, demo checkout, and a stock list using browser local storage. It is a **development prototype only**: records are local to this browser, are not synchronized to Firebase, and must not be used for real pharmacy transactions.

## Next implementation gates

1. Add typed domain models, validation, and unit tests.
2. Implement Firebase Authentication, Firestore schema/rules, trusted sale-posting functions, and audit logging.
3. Replace demo persistence with IndexedDB outbox and server reconciliation.
4. Add batch/expiry receipt workflows, payment verification, returns and financial settlement.
5. Add integration tests, security tests, backups, monitoring and production deployment controls.

Do not enter real patient data or rely on the demo checkout for financial or stock records.
