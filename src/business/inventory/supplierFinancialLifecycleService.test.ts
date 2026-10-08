import { supplierFinancialLifecycleService } from './supplierFinancialLifecycleService';

describe('SupplierFinancialLifecycleService', () => {
  it('exposes the authoritative AP/payment lifecycle boundaries', () => {
    expect(supplierFinancialLifecycleService).toBeDefined();
    expect(typeof supplierFinancialLifecycleService.postPayable).toBe('function');
    expect(typeof supplierFinancialLifecycleService.initiatePayment).toBe('function');
    expect(typeof supplierFinancialLifecycleService.confirmPayment).toBe('function');
  });
});
