import { describe, expect, it } from 'vitest';
import { validateSupplierInvoiceInput } from './supplierInvoiceService';

const base = {
  invoiceId: 'SUP-INV-001',
  supplierId: 'SUP-001',
  supplierInvoiceNumber: 'INV-001',
  invoiceDate: '2026-10-08',
  lines: [{ description: 'Cement 42.5N', quantity: 10, unitCostKes: 780 }],
};

describe('Supplier Invoice contract', () => {
  it('accepts a valid supplier invoice', () => expect(() => validateSupplierInvoiceInput(base, 'req-1')).not.toThrow());
  it('rejects an invoice without lines', () => expect(() => validateSupplierInvoiceInput({ ...base, lines: [] }, 'req-2')).toThrow(/at least one line/i));
  it('rejects negative monetary values', () => expect(() => validateSupplierInvoiceInput({ ...base, lines: [{ ...base.lines[0], unitCostKes: -1 }] }, 'req-3')).toThrow(/unitCostKes/i));
  it('rejects malformed invoice identifiers', () => expect(() => validateSupplierInvoiceInput({ ...base, invoiceId: 'x' }, 'req-4')).toThrow(/invoiceId/i));
});
