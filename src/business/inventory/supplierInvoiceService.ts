import { KernelError } from '../../kernel/errors/kernelErrors';
import type { SecurityContext } from '../../kernel/types';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';

export class SupplierInvoiceService {
  private async auth(c: SecurityContext, dbkId: string) {
    const tenantId = c.tenantContext?.tenantId ?? dbkId;
    const branchId = c.branchContext?.branchId;
    if (tenantId !== dbkId || !branchId) throw new KernelError('AUTHORIZATION_ERROR','Authoritative tenant and branch context required.',403,c.requestId);
    const a = await rbacEngine.authorizeAsync(c.principal,'MATCH_SUPPLIER_INVOICE',`dbk:${dbkId}`,{tenantId,branchId,requiredPermission:'manage:purchasing',requestId:c.requestId});
    if (!a.allowed) throw new KernelError('AUTHORIZATION_ERROR',a.reason,403,c.requestId);
    await dbkCapabilityManager.assertCapabilityOperational(c,dbkId,'purchase_orders','MATCH_SUPPLIER_INVOICE');
    return {tenantId,branchId};
  }
  public async match(c: SecurityContext, dbkId: string, input:{purchaseOrderId:string;invoiceNumber:string;totalAmountKes:number;taxAmountKes?:number;etimsInvoiceNumber?:string}) {
    const {tenantId,branchId}=await this.auth(c,dbkId);
    const id=`sinv_${input.purchaseOrderId}_${input.invoiceNumber.replace(/[^A-Za-z0-9_-]/g,'_')}`;
    const now=new Date().toISOString();
    return firestoreClient.runTransaction(async tx=>{
      const existing=await tx.get<any>(`/tenants/${tenantId}/entities/supplier_invoices/records/${id}`);
      if(existing) return existing;
      const po=await tx.get<any>(`/tenants/${tenantId}/entities/purchase_orders/records/${input.purchaseOrderId}`);
      if(!po || po.branchId!==branchId) throw new KernelError('NOT_FOUND','Purchase order not found in this branch.',404,c.requestId);
      const received=Number(po.attributes?.receivedQuantity||0), unit=Number(po.attributes?.unitCostKes||0);
      if(received<=0) throw new KernelError('VALIDATION_ERROR','Supplier invoice requires received goods.',400,c.requestId);
      const expected=received*unit, amount=Number(input.totalAmountKes);
      if(!Number.isFinite(amount)||Math.abs(amount-expected)>0.01) throw new KernelError('VALIDATION_ERROR',`Invoice amount ${amount} does not match received PO value ${expected}.`,400,c.requestId);
      const invoice={id,entityType:'supplier_invoices',primaryIdentifier:input.invoiceNumber,status:'MATCHED',branchId,attributes:{purchaseOrderId:input.purchaseOrderId,supplierId:po.attributes?.supplierId,supplierName:po.attributes?.supplierName,totalAmountKes:amount,taxAmountKes:Number(input.taxAmountKes||0),etimsInvoiceNumber:input.etimsInvoiceNumber||null,matchType:'PO_GRN_INVOICE',apStatus:'OPEN',paymentStatus:'UNPAID',matchedAt:now},createdAt:now,updatedAt:now};
      const matchId=`pim_${id}`;
      tx.set(`/tenants/${tenantId}/entities/supplier_invoices/records/${id}`,invoice);
      tx.set(`/tenants/${tenantId}/entities/purchase_invoice_matches/records/${matchId}`,{id:matchId,entityType:'purchase_invoice_matches',primaryIdentifier:matchId,status:'MATCHED',branchId,attributes:{invoiceId:id,purchaseOrderId:input.purchaseOrderId,poAmountKes:expected,invoiceAmountKes:amount,receivedQuantity:received,matchType:'PO_GRN_INVOICE'},createdAt:now,updatedAt:now});
      await outboxEngine.enqueueEvent(tenantId,{eventId:`supplier-invoice-matched-${id}`,eventType:'procurement.supplier.invoice.matched.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:c.principal.id,correlationId:c.correlationId,causationId:input.purchaseOrderId,source:'SupplierInvoiceService',payload:{invoiceId:id,purchaseOrderId:input.purchaseOrderId,totalAmountKes:amount},metadata:{}},tx,c.principal.id);
      return invoice;
    });
  }
}
export const supplierInvoiceService=new SupplierInvoiceService();
