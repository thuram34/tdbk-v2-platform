# TDBK Chemist Pro

Standalone React + TypeScript retail chemist POS, designed for a local-first single-device workflow.

## Run locally

```bash
cd apps/chemist-pro
npm install --legacy-peer-deps
npm run typecheck
npm test
npm run build
npm run dev
```

## Deploy a hosted static build

Import this repository into Vercel with **Root Directory** set to `apps/chemist-pro`. Use the Vite framework preset, `npm run build` as the build command and `dist` as the output directory. `vercel.json` configures SPA fallback routing. This is a static frontend; hosting does not create a backend or make local records cloud-synced.

## Handover boundary — read before real use

The current build supports a local catalogue, cash checkout, local stock deduction, sales history, itemized printable receipts, expiry-date exclusion, and JSON backup/restore. Records are stored in this browser's local storage. They do **not** sync across devices and can be lost if browser storage is cleared or the device fails. The app starts with an empty catalogue; enter only physically verified opening stock before any trial.

This build does **not** provide authenticated users, cloud persistence, a trusted server-side stock ledger, multi-device conflict handling, verified M-Pesa, KRA eTIMS fiscal receipts, or complete pharmacy batch/dispensing controls. The printable receipt explicitly is not an eTIMS receipt. It is suitable only for a controlled single-device trial after the owner accepts these limitations and confirms an external backup routine. Do not enter patient-identifiable or clinical data.

## Before operating

1. Replace sample products with a physically verified stock count, including batch and expiry details.
2. Export a JSON backup before the first shift and after each shift; store copies off-device.
3. Test a cash sale, receipt print, stock deduction, expired-item exclusion, backup export, and restore.
4. Confirm that totals and stock match the physical opening count.
5. Do not enable or advertise M-Pesa/eTIMS as available until the server integration is deployed and end-to-end tested.

## Production gates still required

1. Authenticated multi-user access and a trusted server-side stock ledger.
2. Cloud persistence, conflict-safe synchronization and audit logging.
3. Batch/expiry allocation, returns, purchasing and financial reconciliation.
4. Verified Daraja M-Pesa callback processing with server-authoritative payment status.
5. eTIMS support where required, automated backups, monitoring and production security tests.
