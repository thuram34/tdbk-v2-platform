import {beforeEach,describe,expect,it} from 'vitest';
import {firestoreClient} from '../../persistence/firestore/firestoreClient';
import {outboxRepository} from '../../persistence/firestore/repositories/outboxRepository';
import {procurementLifecycleService} from './procurementLifecycleService';

const tenant='procurement-test-tenant';
const branch='procurement-test-branch';
const ctx:any={requestId:'procurement-test',correlationId:'procurement-correlation',timestamp:new Date().toISOString(),principal:{id:'procurement-user',email:'procurement@test',isMaster:false,tenantId:tenant,branchId:branch,roles:['PROCUREMENT_OFFICER'],permissions:['manage:purchasing']},tenantContext:{tenantId:tenant,status:'ACTIVE'},branchContext:{branchId:branch}};
describe('ProcurementLifecycleService',()=>{beforeEach(async()=>{await firestoreClient.clearAllForTesting();});
it('selects supplier, issues PO, receives goods and increments authoritative stock',async()=>{
await firestoreClient.set(`/tenants/${tenant}/entities/suppliers/records/supplier-001`,{id:'supplier-001',entityType:'suppliers',primaryIdentifier:'supplier-001',status:'ACTIVE',branchId:branch,attributes:{name:'Canonical Supplier Ltd'},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
await firestoreClient.set(`/tenants/${tenant}/entities/stock_control/records/stock-001`,{id:'stock-001',entityType:'stock_control',primaryIdentifier:'stock-001',status:'ACTIVE',branchId:branch,attributes:{skuCode:'SKU-001',itemName:'Test Item',quantityOnHand:3},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
await firestoreClient.set(`/tenants/${tenant}/entities/procurement_intents/records/intent-001`,{id:'intent-001',entityType:'procurement_intents',primaryIdentifier:'intent-001',status:'PENDING',branchId:branch,attributes:{inventoryRecordId:'stock-001',skuCode:'SKU-001',itemName:'Test Item',quantity:5,status:'SUPPLIER_SELECTION_REQUIRED'},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
const selected=await procurementLifecycleService.selectSupplier(ctx,tenant,{procurementIntentId:'intent-001',supplierId:'supplier-001'});
expect(selected.status).toBe('READY_FOR_PURCHASE_ORDER');
const po=await procurementLifecycleService.issuePurchaseOrder(ctx,tenant,{procurementIntentId:'intent-001',unitCostKes:100});
expect(po.status).toBe('ISSUED');
const grn=await procurementLifecycleService.receiveGoods(ctx,tenant,{purchaseOrderId:po.purchaseOrderId,receivedQuantity:5,receiptId:'grn-001'});
expect(grn).toMatchObject({status:'RECEIVED',receivedQuantity:5,stockQuantityAfter:8});
const stock=await firestoreClient.get<any>(`/tenants/${tenant}/entities/stock_control/records/stock-001`);
expect(stock?.attributes?.quantityOnHand).toBe(8);
const persistedPo=await firestoreClient.get<any>(`/tenants/${tenant}/entities/purchase_orders/records/${po.purchaseOrderId}`);
expect(persistedPo?.status).toBe('RECEIVED');
const receipt=await firestoreClient.get<any>(`/tenants/${tenant}/entities/goods_receipts/records/grn-001`);
expect(receipt?.status).toBe('POSTED');
const events=await outboxRepository.listOutbox(tenant);
expect(events.filter(e=>e.eventType==='procurement.supplier.selected.v1')).toHaveLength(1);
expect(events.filter(e=>e.eventType==='procurement.purchase_order.issued.v1')).toHaveLength(1);
expect(events.filter(e=>e.eventType==='inventory.goods.received.v1')).toHaveLength(1);
});
it('rejects receiving beyond ordered quantity',async()=>{
await firestoreClient.set(`/tenants/${tenant}/entities/purchase_orders/records/po-002`,{id:'po-002',entityType:'purchase_orders',primaryIdentifier:'po-002',status:'ISSUED',branchId:branch,attributes:{inventoryRecordId:'stock-002',quantity:5,receivedQuantity:0},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
await expect(procurementLifecycleService.receiveGoods(ctx,tenant,{purchaseOrderId:'po-002',receivedQuantity:6})).rejects.toMatchObject({code:'VALIDATION_ERROR'});
});
});
