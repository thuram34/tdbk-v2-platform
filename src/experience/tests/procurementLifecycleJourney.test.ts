import { beforeEach, describe, expect, it } from 'vitest';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { dbkRegistry } from '../../platform/dbkRegistry';
import { provisioningService } from '../../platform/provisioning/provisioningService';
import { spaceMembershipRepository } from '../../persistence/firestore/repositories/spaceMembershipRepository';
import { experienceResolver } from '../../experience/experienceResolver';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { outboxRepository } from '../../persistence/firestore/repositories/outboxRepository';
import { eventBus } from '../../orchestration/events/eventBus';
import { financialLedgerRepository } from '../../persistence/firestore/repositories/financialLedgerRepository';

const dbkId = 'procurement-journey-hardware-01';

function ownerContext(): any {
  return {
    requestId:'procurement-owner-request', correlationId:'procurement-owner-correlation',
    timestamp:new Date().toISOString(),
    principal:{id:'procurement-owner',email:'owner@tdbk.test',isMaster:false,tenantId:null,branchId:null,roles:['BUSINESS_OWNER'],permissions:['DBK_PROVISION']},
    tenantContext:null,branchContext:null,
  };
}
function procurementContext(branchId:string): any {
  return {
    requestId:'procurement-runtime-request',correlationId:'procurement-runtime-correlation',
    timestamp:new Date().toISOString(),
    principal:{id:'procurement-officer',email:'procurement@tdbk.test',isMaster:false,tenantId:dbkId,branchId,roles:['PROCUREMENT_OFFICER'],permissions:['manage:purchasing','manage:suppliers']},
    tenantContext:{tenantId:dbkId,name:'Procurement Journey Hardware',blueprintId:'hardware_v1',status:'ACTIVE'},
    branchContext:{branchId,name:'Mombasa HQ',isHeadquarters:true,status:'ACTIVE'},
  };
}

describe('TDBK retail procurement journey acceptance',()=>{
  beforeEach(async()=>{
    await firestoreClient.clearAllForTesting();
    dbkRegistry.clearStoreForTesting();
    provisioningService.clearStoreForTesting();
  });

  it('PJ_01: supplier selection -> PO -> GRN -> authoritative stock receipt',async()=>{
    const provisioned=await provisioningService.provisionDbk(ownerContext(),{
      dbkId,legalName:'Procurement Journey Hardware',displayName:'Procurement Journey Hardware',
      blueprintId:'hardware_v1',subscriptionTier:'GROWTH',primaryBranchName:'Mombasa HQ',
      idempotencyKey:'procurement-journey-v1',
    });
    expect(provisioned.success).toBe(true);
    const branchId=provisioned.branches[0].branchId;
    await spaceMembershipRepository.saveMembership({
      membershipId:`mem_${dbkId}_procurement`,userId:'procurement-officer',spaceId:branchId,tenantId:dbkId,
      role:'PROCUREMENT_OFFICER',roleTitle:'Procurement Officer',status:'ACTIVE',
      joinedAt:new Date().toISOString(),permissions:['manage:purchasing','manage:suppliers'],
    });

    const enableSupplier=await experienceResolver.dispatchCommand(ownerContext(),{
      commandType:'ENABLE_CAPABILITY',targetDbkId:dbkId,payload:{capabilityId:'supplier_registry'},
    });
    expect(enableSupplier.success).toBe(true);
    const enablePurchasing=await experienceResolver.dispatchCommand(ownerContext(),{
      commandType:'ENABLE_CAPABILITY',targetDbkId:dbkId,payload:{capabilityId:'purchase_orders'},
    });
    expect(enablePurchasing.success).toBe(true);

    await firestoreClient.set(`/tenants/${dbkId}/entities/suppliers/records/supplier-001`,{
      id:'supplier-001',entityType:'suppliers',primaryIdentifier:'supplier-001',status:'ACTIVE',branchId,
      attributes:{name:'Canonical Supplier Ltd',paymentTermsDays:30},createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    });
    await firestoreClient.set(`/tenants/${dbkId}/entities/stock_control/records/stock-001`,{
      id:'stock-001',entityType:'stock_control',primaryIdentifier:'stock-001',status:'ACTIVE',branchId,
      attributes:{skuCode:'SKU-001',itemName:'Test Item',quantityOnHand:3,reorderLevel:3,targetStockLevel:8},
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    });
    await firestoreClient.set(`/tenants/${dbkId}/entities/procurement_intents/records/intent-001`,{
      id:'intent-001',entityType:'procurement_intents',primaryIdentifier:'intent-001',status:'PENDING',branchId,
      attributes:{inventoryRecordId:'stock-001',skuCode:'SKU-001',itemName:'Test Item',quantity:5,status:'SUPPLIER_SELECTION_REQUIRED'},
      createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),
    });

    const ctx=procurementContext(branchId);
    const selected=await experienceResolver.dispatchCommand(ctx,{
      commandType:'SELECT_PROCUREMENT_SUPPLIER',targetDbkId:dbkId,
      payload:{procurementIntentId:'intent-001',supplierId:'supplier-001'},
    });
    expect(selected.success).toBe(true);
    expect(selected.result).toMatchObject({supplierId:'supplier-001',status:'READY_FOR_PURCHASE_ORDER'});

    const po=await experienceResolver.dispatchCommand(ctx,{
      commandType:'ISSUE_PURCHASE_ORDER',targetDbkId:dbkId,
      payload:{procurementIntentId:'intent-001',purchaseOrderId:'PO-CANONICAL-001',unitCostKes:100},
    });
    expect(po.success).toBe(true);
    expect(po.result).toMatchObject({purchaseOrderId:'PO-CANONICAL-001',status:'ISSUED',quantity:5});

    const grn=await experienceResolver.dispatchCommand(ctx,{
      commandType:'RECEIVE_PURCHASE_GOODS',targetDbkId:dbkId,
      payload:{purchaseOrderId:'PO-CANONICAL-001',receivedQuantity:5,receiptId:'GRN-CANONICAL-001'},
    });
    expect(grn.success).toBe(true);
    expect(grn.result).toMatchObject({status:'RECEIVED',receivedQuantity:5,stockQuantityAfter:8});

    const stock=await firestoreClient.get<any>(`/tenants/${dbkId}/entities/stock_control/records/stock-001`);
    const poRecord=await firestoreClient.get<any>(`/tenants/${dbkId}/entities/purchase_orders/records/PO-CANONICAL-001`);
    const receipt=await firestoreClient.get<any>(`/tenants/${dbkId}/entities/goods_receipts/records/GRN-CANONICAL-001`);
    const intent=await firestoreClient.get<any>(`/tenants/${dbkId}/entities/procurement_intents/records/intent-001`);
    expect(stock?.attributes?.quantityOnHand).toBe(8);
    expect(poRecord?.status).toBe('RECEIVED');
    expect(receipt?.status).toBe('POSTED');
    expect(intent?.status).toBe('FULFILLED');

    const matched=await experienceResolver.dispatchCommand(ctx,{
      commandType:'MATCH_SUPPLIER_INVOICE',targetDbkId:dbkId,
      payload:{purchaseOrderId:'PO-CANONICAL-001',invoiceNumber:'INV-CANONICAL-001',totalAmountKes:500},
    });
    expect(matched.success).toBe(true);
    expect(matched.result).toMatchObject({status:'MATCHED',apStatus:'OPEN',paymentStatus:'UNPAID'});

    const payable=await experienceResolver.dispatchCommand(ctx,{
      commandType:'POST_ACCOUNTS_PAYABLE',targetDbkId:dbkId,
      payload:{invoiceId:matched.result.invoiceId},
    });
    expect(payable.success).toBe(true);
    expect(payable.result).toMatchObject({status:'AP_POSTED'});

    const paymentTransactionId='supplier_pay_INV-CANONICAL-001';
    await financialLedgerRepository.savePendingTransaction({
      transactionId:paymentTransactionId,
      tenantId:dbkId,
      branchId,
      source:'BANK',
      providerReference:'BANK-PENDING-001',
      amount:500,
      currency:'KES',
      status:'PENDING',
      description:'Supplier payment acceptance test',
      correlationId:ctx.correlationId,
      createdAt:new Date().toISOString(),
      postedAt:null,
      reversedAt:null,
    });
    await firestoreClient.set(`/tenants/${dbkId}/entities/supplier_payment_intents/records/supplier_payment_${matched.result.invoiceId}`,{
      id:`supplier_payment_${matched.result.invoiceId}`,
      entityType:'supplier_payment_intent',
      primaryIdentifier:`supplier_payment_${matched.result.invoiceId}`,
      status:'PENDING',
      branchId,
      invoiceId:matched.result.invoiceId,
      transactionId:paymentTransactionId,
      amountKes:500,
      destinationAccount:'001234567890',
      sourceAccount:'009876543210',
      bankCode:'01',
      createdAt:new Date().toISOString(),
      updatedAt:new Date().toISOString(),
    });

    const confirmed=await experienceResolver.dispatchCommand(ctx,{
      commandType:'CONFIRM_SUPPLIER_PAYMENT',targetDbkId:dbkId,
      payload:{invoiceId:matched.result.invoiceId,providerReference:'BANK-CONFIRMED-001',status:'SUCCESS',providerReceiptReference:'BANK-RCPT-001'},
    });
    expect(confirmed.success).toBe(true);
    expect(confirmed.result).toMatchObject({status:'PAID',closureStatus:'CLOSED'});

    const closedInvoice=await firestoreClient.get<any>(`/tenants/${dbkId}/entities/supplier_invoices/records/${matched.result.invoiceId}`);
    const settledPayment=await firestoreClient.get<any>(`/tenants/${dbkId}/entities/supplier_payment_intents/records/supplier_payment_${matched.result.invoiceId}`);
    const paidTransaction=await financialLedgerRepository.getTransaction(dbkId,paymentTransactionId);
    const paymentEntries=await financialLedgerRepository.listEntries(dbkId,paymentTransactionId);
    expect(closedInvoice?.status).toBe('CLOSED');
    expect(closedInvoice?.attributes?.apStatus).toBe('SETTLED');
    expect(closedInvoice?.attributes?.paymentStatus).toBe('PAID');
    expect(settledPayment?.status).toBe('SETTLED');
    expect(paidTransaction?.status).toBe('POSTED');
    expect(paidTransaction?.providerReference).toBe('BANK-CONFIRMED-001');
    expect(paymentEntries).toHaveLength(2);
    expect(paymentEntries.filter(e=>e.entryType==='DEBIT')).toHaveLength(1);
    expect(paymentEntries.filter(e=>e.entryType==='CREDIT')).toHaveLength(1);

    const delivery=await outboxEngine.processTenantOutbox(dbkId,'procurement-journey-worker',30000,async event=>eventBus.publish(event));
    expect(delivery.failed).toBe(0);
    const events=await outboxRepository.listOutbox(dbkId);
    expect(events.filter(e=>e.eventType==='procurement.supplier.selected.v1'&&e.status==='DELIVERED')).toHaveLength(1);
    expect(events.filter(e=>e.eventType==='procurement.purchase_order.issued.v1'&&e.status==='DELIVERED')).toHaveLength(1);
    expect(events.filter(e=>e.eventType==='inventory.goods.received.v1'&&e.status==='DELIVERED')).toHaveLength(1);

    const workflows=await (await import('../../persistence/firestore/repositories/workflowInstanceRepository')).workflowInstanceRepository.listWorkflows(dbkId);
    expect(workflows.some(w=>w.workflowType==='wf_supplier_selection'&&w.status==='COMPLETED')).toBe(true);
    expect(workflows.some(w=>w.workflowType==='wf_purchase_order_issuance'&&w.status==='COMPLETED')).toBe(true);
    expect(workflows.some(w=>w.workflowType==='wf_goods_receiving'&&w.status==='COMPLETED')).toBe(true);
  });
});
