import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';

const poPath=(t:string,id:string)=>`/tenants/${t}/entities/purchase_orders/records/${id}`;
const invoicePath=(t:string,id:string)=>`/tenants/${t}/entities/supplier_invoices/records/${id}`;
const matchPath=(t:string,id:string)=>`/tenants/${t}/entities/purchase_invoice_matches/records/${id}`;

export class SupplierInvoiceMatchService {
  private async authorize(c:SecurityContext,dbkId:string){
    const tenantId=c.tenantContext?.tenantId??dbkId, branchId=c.branchContext?.branchId;
    if(tenantId!==dbkId) throw new KernelError('TENANT_ISOLATION_ERROR','Supplier invoice tenant mismatch.',403,c.requestId);
    if(!branchId) throw new KernelError('VALIDATION_ERROR','An active branch is required.',400,c.requestId);
    const auth=await rbacEngine.authorizeAsync(c.principal,'MATCH_SUPPLIER_INVOICE',`dbk:${dbkId}`,{tenantId,branchId,requiredPermission:'manage:purchasing',requestId:c.requestId});
    if(!auth.allowed) throw new KernelError('AUTHORIZATION_ERROR',auth.reason,403,c.requestId);
    await dbkCapabilityManager.assertCapabilityOperational(c,dbkId,'purchase_orders','MATCH_SUPPLIER_INVOICE');
    return {tenantId,branchId};
  }
  async match(c:SecurityContext,dbkId:string,input:{purchaseOrderId:string;invoiceNumber:string;totalAmountKes:number;taxAmountKes?:number;etimsInvoiceNumber?:string;invoiceDate?:string}){
    const {tenantId,branchId}=await this.authorize(c,dbkId);
    const invoiceId=`sinv_${input.purchaseOrderId}_${input.invoiceNumber.replace(/[^A-Za-z0-9_-]/g,'_')}`;
    const now=new Date().toISOString();
    return firestoreClient.runTransaction(async tx=>{
      const existing=await tx.get<any>(invoicePath(tenantId,invoiceId));
      if(existing) return {invoiceId,status:existing.status,idempotent:true};
      const po=await tx.get<any>(poPath(tenantId,input.purchaseOrderId));
      if(!po) throw new KernelError('NOT_FOUND','Purchase order was not found.',404,c.requestId);
      if(po.branchId!==branchId) throw new KernelError('AUTHORIZATION_ERROR','Purchase order belongs to another branch.',403,c.requestId);
      if(!['RECEIVED','PARTIALLY_RECEIVED'].includes(po.status)) throw new KernelError('VALIDATION_ERROR','Invoice requires GRN evidence.',400,c.requestId);
      const received=Number(po.attributes?.receivedQuantity??0), unitCost=Number(po.attributes?.unitCostKes??0), amount=Number(input.totalAmountKes);
      if(received<=0||!Number.isFinite(amount)||amount<=0||Math.abs(amount-(received*unitCost))>0.01) throw new KernelError('VALIDATION_ERROR','Supplier invoice does not match PO/GRN received value.',400,c.requestId);
      const matchId=`pim_${invoiceId}`;
      await tx.set(invoicePath(tenantId,invoiceId),{id:invoiceId,entityType:'supplier_invoices',primaryIdentifier:input.invoiceNumber,status:'MATCHED',branchId,attributes:{purchaseOrderId:input.purchaseOrderId,supplierId:po.attributes?.supplierId,supplierName:po.attributes?.supplierName,totalAmountKes:amount,taxAmountKes:Number(input.taxAmountKes??0),invoiceDate:input.invoiceDate??null,etimsInvoiceNumber:input.etimsInvoiceNumber??null,etimsStatus:input.etimsInvoiceNumber?'IDENTIFIED':'NOT_IDENTIFIED',apStatus:'OPEN',paymentStatus:'UNPAID',matchedAt:now},createdAt:now,updatedAt:now});
      await tx.set(matchPath(tenantId,matchId),{id:matchId,entityType:'purchase_invoice_matches',primaryIdentifier:matchId,status:'MATCHED',branchId,attributes:{invoiceId,purchaseOrderId:input.purchaseOrderId,matchType:'PO_GRN_INVOICE',poAmountKes:received*unitCost,invoiceAmountKes:amount,matchedAt:now},createdAt:now,updatedAt:now});
      await outboxEngine.enqueueEvent(tenantId,{eventId:`supplier-invoice-matched-${invoiceId}`,eventType:'procurement.supplier.invoice.matched.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:c.principal.id,correlationId:c.correlationId,causationId:input.purchaseOrderId,source:'SupplierInvoiceMatchService',payload:{invoiceId,purchaseOrderId:input.purchaseOrderId,supplierId:po.attributes?.supplierId,totalAmountKes:amount},metadata:{}},tx,c.principal.id);
      return {invoiceId,matchId,status:'MATCHED',apStatus:'OPEN',paymentStatus:'UNPAID',idempotent:false};
    });
  }
}
export const supplierInvoiceMatchService=new SupplierInvoiceMatchService();
