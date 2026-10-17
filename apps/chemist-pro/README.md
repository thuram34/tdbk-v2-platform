# TDBK Chemist Pro

A **single-device, local-first cash POS** for a small shop/chemist workflow. This release candidate stores its product catalogue and sales in the current browser's local storage.

## Run and build

```bash
cd apps/chemist-pro
npm install
npm run typecheck
npm test
npm run build
npm run dev
```

## Supported in this release candidate

- Add products with SKU, category, selling price, cost, opening stock, reorder threshold, batch and expiry date.
- Search the local catalogue and record a cash sale.
- Reject checkout when requested stock is insufficient or the listed batch is expired.
- Deduct local stock and save a sale record with item lines, total, timestamp and receipt number.
- Print a local sales receipt.
- Export a JSON backup and restore a validated backup in the same browser profile.

## Handover checklist

1. Open the deployed app on the client's designated computer and browser profile.
2. Confirm the product list is empty before entering the client's actual stock. Do not treat sample/test data as inventory.
3. Enter and verify opening stock, selling price, SKU, batch and expiry. Have the owner cross-check quantities against physical stock.
4. Run a test with a non-sale test product: record a cash sale, print its receipt, confirm stock decreased once, and confirm the sale remains after refreshing the page. Then remove the test record or reset the test environment before trading.
5. Export a backup and test restoring it in a separate browser profile before the client begins trading.
6. At every closing, export the backup and store a copy outside the POS computer. Local browser data can be lost if browser data is cleared, the profile is reset, or the device fails.

## Important limits

- **Single device only:** there is no cloud sync, multi-user access control, or server-side authoritative stock ledger.
- **Cash only:** this release does not verify M-Pesa payments. Do not mark an M-Pesa payment as received based on a customer screen or STK request.
- **No KRA eTIMS fiscal receipts:** the printable receipt is an internal sales receipt only.
- Supplier purchasing, returns, accounting settlement, user audit logs and regulatory workflows are not complete.
- Do not store patient records or rely on this build for clinical decisions, controlled-medicine dispensing, or regulated reporting.

Treat it as a limited local cash POS only if the owner explicitly accepts the single-device and backup limitations. Do not describe it as a cloud-backed or production-grade pharmacy management system.
