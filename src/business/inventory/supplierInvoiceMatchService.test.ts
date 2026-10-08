import {beforeEach,describe,expect,it} from 'vitest';
import {firestoreClient} from '../../persistence/firestore/firestoreClient';
import {outboxRepository} from '../../persistence/firestore/repositories/outboxRepository';
import {supplierInvoiceMatchService} from './supplierInvoiceMatchService';

const tenant='supplier-invoice-test-tenant';
const branch='supplier-invoice-test-branch';
const ctx:any={requestId:'supplier-invoice-test',correlationId:'supplier-invoice-correlation',timestamp:new Date().toISOString(),principal:{id:'procurement-user',email:'procurement@test',isMaster:false,tenantId:tenant,branchId:branch,roles:['PROCUREMENT_OFFICER'],permissions:['manage:purchasing']},tenantContext:{tenantId:tenant,status:'ACTIVE'},branchContext:{branchId:branch}};

describe('SupplierInvoiceMatchService',()=>{beforeEach(async()=>{await firestoreClient.clearAllForTesting();});
it('matches a supplier invoice only against received PO value and emits durable event',async()=>{
await firestoreClient.set(`/tenants/${tenant}/entities/purchase_orders/records/po-001`,{id:'po-001',entityType:'purchase_orders',primaryIdentifier:'po-001',status:'RECEIVED',branchId:branch,attributes:{supplierId:'supplier-001',supplierName:'Canonical Supplier Ltd',quantity:5,receivedQuantity:5,unitCostKes:100},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const result=await supplierInvoiceMatchService.match(ctx,tenant,{purchaseOrderId:'po-001',invoiceNumber:'INV-001',totalAmountKes:500,taxAmountKes:75,etimsInvoiceNumber:'ETIMS-001'});
expect(result).toMatchObject({status:'MATCHED',apStatus:'OPEN',paymentStatus:'UNPAID',idempotent:false});
const invoice=await firestoreClient.get<any>(`/tenants/${tenant}/entities/supplier_invoices/records/${result.invoiceId}`);
expect(invoice?.status).toBe('MATCHED');
expect(invoice?.attributes?.etimsStatus).toBe('IDENTIFIED');
const match=await firestoreClient.get<any>(`/tenants/${tenant}/entities/purchase_invoice_matches/records/${result.matchId}`);
expect(match?.attributes?.matchType).toBe('PO_GRN_INVOICE');
const events=await outboxRepository.listOutbox(tenant);
expect(events.filter(e=>e.eventType==='procurement.supplier.invoice.matched.v1')).toHaveLength(1);
});
it('rejects an invoice whose value differs from received PO value',async()=>{
await firestoreClient.set(`/tenants/${tenant}/entities/purchase_orders/records/po-002`,{id:'po-002',entityType:'purchase_orders',primaryIdentifier:'po-002',status:'RECEIVED',branchId:branch,attributes:{supplierId:'supplier-001',quantity:5,receivedQuantity:5,unitCostKes:100},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
await expect(supplierInvoiceMatchService.match(ctx,tenant,{purchaseOrderId:'po-002',invoiceNumber:'INV-002',totalAmountKes:600})).rejects.toMatchObject({code:'VALIDATION_ERROR'});
});
});