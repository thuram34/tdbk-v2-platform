import { supplierInvoiceService } from './supplierInvoiceService';

describe('SupplierInvoiceService',()=>{it('exports authoritative invoice matching service',()=>{expect(supplierInvoiceService).toBeDefined();expect(typeof supplierInvoiceService.match).toBe('function');});});
