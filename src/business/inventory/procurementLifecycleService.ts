import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';

const intentPath=(tenant:string,id:string)=>`/tenants/${tenant}/entities/procurement_intents/records/${id}`;
const supplierPath=(tenant:string,id:string)=>`/tenants/${tenant}/entities/suppliers/records/${id}`;
const poPath=(tenant:string,id:string)=>`/tenants/${tenant}/entities/purchase_orders/records/${id}`;
const grnPath=(tenant:string,id:string)=>`/tenants/${tenant}/entities/goods_receipts/records/${id}`;
const stockPath=(tenant:string,id:string)=>`/tenants/${tenant}/entities/stock_control/records/${id}`;

function requireNumber(value: unknown, field: string): number {
  const n=Number(value);
  if(!Number.isFinite(n)||n<0) throw new KernelError('VALIDATION_ERROR',`${field} must be a non-negative number.`,400);
  return n;
}

export class ProcurementLifecycleService {
  private async authorize(context: SecurityContext, dbkId: string, action: string): Promise<{tenantId:string;branchId:string}> {
    const tenantId=context.tenantContext?.tenantId ?? dbkId;
    const branchId=context.branchContext?.branchId;
    if(tenantId!==dbkId) throw new KernelError('TENANT_ISOLATION_ERROR','Procurement tenant does not match target business.',403,context.requestId);
    if(!branchId) throw new KernelError('VALIDATION_ERROR','An active branch is required for procurement.',400,context.requestId);
    const auth=await rbacEngine.authorizeAsync(context.principal,action,`dbk:${dbkId}`,{tenantId,branchId,requiredPermission:'manage:purchasing',requestId:context.requestId});
    if(!auth.allowed) throw new KernelError('AUTHORIZATION_ERROR',auth.reason,403,context.requestId);
    await dbkCapabilityManager.assertCapabilityOperational(context,dbkId,'purchase_orders',action);
    return {tenantId,branchId};
  }

  async selectSupplier(context:SecurityContext,dbkId:string,input:{procurementIntentId:string;supplierId:string}) {
    const {tenantId,branchId}=await this.authorize(context,dbkId,'SELECT_SUPPLIER');
    const now=new Date().toISOString();
    return firestoreClient.runTransaction(async tx=>{
      const intent=await tx.get<any>(intentPath(tenantId,input.procurementIntentId));
      if(!intent) throw new KernelError('NOT_FOUND','Procurement intent was not found.',404,context.requestId);
      if(intent.branchId!==branchId) throw new KernelError('AUTHORIZATION_ERROR','Procurement intent belongs to another branch.',403,context.requestId);
      const supplier=await tx.get<any>(supplierPath(tenantId,input.supplierId));
      if(!supplier||supplier.status!=='ACTIVE') throw new KernelError('VALIDATION_ERROR',`Supplier '${input.supplierId}' is not an active authoritative supplier.`,400,context.requestId);
      const attrs={...(intent.attributes||{}),supplierId:input.supplierId,supplierName:supplier.attributes?.name||supplier.primaryIdentifier,status:'READY_FOR_PURCHASE_ORDER',supplierSelectedAt:now};
      await tx.update<any>(intentPath(tenantId,input.procurementIntentId),{attributes:attrs,status:'READY_FOR_PURCHASE_ORDER',updatedAt:now});
      const eventId=`supplier-selected-${input.procurementIntentId}`;
      await outboxEngine.enqueueEvent(tenantId,{eventId,eventType:'procurement.supplier.selected.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:context.principal.id,correlationId:context.correlationId,causationId:input.procurementIntentId,source:'ProcurementLifecycleService',payload:{procurementIntentId:input.procurementIntentId,supplierId:input.supplierId},metadata:{}},tx,context.principal.id);
      return {procurementIntentId:input.procurementIntentId,supplierId:input.supplierId,status:'READY_FOR_PURCHASE_ORDER',idempotent:false};
    });
  }

  async issuePurchaseOrder(context:SecurityContext,dbkId:string,input:{procurementIntentId:string;purchaseOrderId?:string;unitCostKes?:number}) {
    const {tenantId,branchId}=await this.authorize(context,dbkId,'ISSUE_PURCHASE_ORDER');
    const poId=input.purchaseOrderId || `po_${input.procurementIntentId}`;
    const now=new Date().toISOString();
    return firestoreClient.runTransaction(async tx=>{
      const intent=await tx.get<any>(intentPath(tenantId,input.procurementIntentId));
      if(!intent) throw new KernelError('NOT_FOUND','Procurement intent was not found.',404,context.requestId);
      if(intent.branchId!==branchId) throw new KernelError('AUTHORIZATION_ERROR','Procurement intent belongs to another branch.',403,context.requestId);
      if(intent.attributes?.supplierId==null) throw new KernelError('VALIDATION_ERROR','Supplier selection is required before issuing a purchase order.',400,context.requestId);
      const existing=await tx.get<any>(poPath(tenantId,poId));
      if(existing) return {purchaseOrderId:poId,status:existing.status,idempotent:true,supplierId:existing.attributes?.supplierId,quantity:existing.attributes?.quantity};
      const quantity=requireNumber(intent.attributes?.quantity,'Procurement quantity');
      if(quantity<=0) throw new KernelError('VALIDATION_ERROR','Procurement quantity must be greater than zero.',400,context.requestId);
      const unitCostKes=requireNumber(input.unitCostKes ?? intent.attributes?.unitCostKes ?? 0,'Unit cost');
      const total=quantity*unitCostKes;
      const po={id:poId,entityType:'purchase_orders',primaryIdentifier:poId,secondaryIdentifier:String(intent.attributes?.skuCode||intent.attributes?.itemName||intent.id),status:'ISSUED',branchId,attributes:{procurementIntentId:input.procurementIntentId,supplierId:intent.attributes.supplierId,supplierName:intent.attributes.supplierName||null,inventoryRecordId:intent.attributes.inventoryRecordId,skuCode:intent.attributes.skuCode,itemName:intent.attributes.itemName,quantity,unitCostKes,totalAmountKes:total,receivedQuantity:0,remainingQuantity:quantity,issuedAt:now},createdAt:now,updatedAt:now};
      await tx.set(poPath(tenantId,poId),po);
      await tx.update<any>(intentPath(tenantId,input.procurementIntentId),{status:'PO_ISSUED',attributes:{...(intent.attributes||{}),purchaseOrderId:poId,unitCostKes,totalAmountKes:total,status:'PO_ISSUED'},updatedAt:now});
      await outboxEngine.enqueueEvent(tenantId,{eventId:`po-issued-${poId}`,eventType:'procurement.purchase_order.issued.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:context.principal.id,correlationId:context.correlationId,causationId:input.procurementIntentId,source:'ProcurementLifecycleService',payload:{purchaseOrderId:poId,procurementIntentId:input.procurementIntentId,supplierId:intent.attributes.supplierId,quantity,inventoryRecordId:intent.attributes.inventoryRecordId},metadata:{}},tx,context.principal.id);
      return {purchaseOrderId:poId,status:'ISSUED',supplierId:intent.attributes.supplierId,quantity,idempotent:false};
    });
  }

  async receiveGoods(context:SecurityContext,dbkId:string,input:{purchaseOrderId:string;receivedQuantity:number;receiptId?:string;receivedUnitCostKes?:number}) {
    const {tenantId,branchId}=await this.authorize(context,dbkId,'RECEIVE_GOODS');
    const receiptId=input.receiptId || `grn_${input.purchaseOrderId}_${input.receivedQuantity}`;
    const now=new Date().toISOString();
    return firestoreClient.runTransaction(async tx=>{
      const existingReceipt=await tx.get<any>(grnPath(tenantId,receiptId));
      if(existingReceipt) return {receiptId,purchaseOrderId:input.purchaseOrderId,status:existingReceipt.status,receivedQuantity:existingReceipt.attributes?.receivedQuantity,stockQuantityAfter:existingReceipt.attributes?.stockQuantityAfter,idempotent:true};
      const po=await tx.get<any>(poPath(tenantId,input.purchaseOrderId));
      if(!po) throw new KernelError('NOT_FOUND','Purchase order was not found.',404,context.requestId);
      if(po.branchId!==branchId) throw new KernelError('AUTHORIZATION_ERROR','Purchase order belongs to another branch.',403,context.requestId);
      if(!['ISSUED','PARTIALLY_RECEIVED'].includes(po.status)) throw new KernelError('VALIDATION_ERROR',`Purchase order cannot receive goods from status '${po.status}'.`,400,context.requestId);
      const receivedQuantity=requireNumber(input.receivedQuantity,'Received quantity');
      if(receivedQuantity<=0) throw new KernelError('VALIDATION_ERROR','Received quantity must be greater than zero.',400,context.requestId);
      const previousReceived=requireNumber(po.attributes?.receivedQuantity ?? 0,'Previously received quantity');
      const ordered=requireNumber(po.attributes?.quantity,'Ordered quantity');
      if(previousReceived+receivedQuantity>ordered) throw new KernelError('VALIDATION_ERROR','Received quantity exceeds the purchase order quantity.',400,context.requestId);
      const stock=await tx.get<any>(stockPath(tenantId,po.attributes.inventoryRecordId));
      if(!stock) throw new KernelError('NOT_FOUND','Authoritative inventory record was not found.',404,context.requestId);
      if(stock.branchId!==branchId) throw new KernelError('AUTHORIZATION_ERROR','Inventory belongs to another branch.',403,context.requestId);
      const before=requireNumber(stock.attributes?.quantityOnHand,'Stock quantity');
      const after=before+receivedQuantity;
      const totalReceived=previousReceived+receivedQuantity;
      const remaining=ordered-totalReceived;
      const poStatus=remaining===0?'RECEIVED':'PARTIALLY_RECEIVED';
      const grn={id:receiptId,entityType:'goods_receipts',primaryIdentifier:receiptId,secondaryIdentifier:input.purchaseOrderId,status:'POSTED',branchId,attributes:{purchaseOrderId:input.purchaseOrderId,procurementIntentId:po.attributes.procurementIntentId,supplierId:po.attributes.supplierId,inventoryRecordId:po.attributes.inventoryRecordId,skuCode:po.attributes.skuCode,itemName:po.attributes.itemName,orderedQuantity:ordered,previousReceivedQuantity:previousReceived,receivedQuantity,receivedTotal:totalReceived,remainingQuantity:remaining,unitCostKes:input.receivedUnitCostKes ?? po.attributes.unitCostKes,totalAmountKes:receivedQuantity*Number(input.receivedUnitCostKes ?? po.attributes.unitCostKes ?? 0),stockQuantityBefore:before,stockQuantityAfter:after,receivedAt:now},createdAt:now,updatedAt:now};
      await tx.set(grnPath(tenantId,receiptId),grn);
      await tx.update<any>(stockPath(tenantId,po.attributes.inventoryRecordId),{attributes:{...(stock.attributes||{}),quantityOnHand:after,lastReceivedAt:now,lastGoodsReceiptId:receiptId},updatedAt:now});
      await tx.update<any>(poPath(tenantId,input.purchaseOrderId),{status:poStatus,attributes:{...(po.attributes||{}),receivedQuantity:totalReceived,remainingQuantity:remaining,lastGoodsReceiptId:receiptId},updatedAt:now});
      const intent=await tx.get<any>(intentPath(tenantId,po.attributes.procurementIntentId));
      if(intent) await tx.update<any>(intentPath(tenantId,po.attributes.procurementIntentId),{status:remaining===0?'FULFILLED':'PO_ISSUED',attributes:{...(intent.attributes||{}),status:remaining===0?'FULFILLED':'PO_ISSUED',...(remaining===0?{fulfilledAt:now}: {})},updatedAt:now});
      await outboxEngine.enqueueEvent(tenantId,{eventId:`goods-received-${receiptId}`,eventType:'inventory.goods.received.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:context.principal.id,correlationId:context.correlationId,causationId:input.purchaseOrderId,source:'ProcurementLifecycleService',payload:{receiptId,purchaseOrderId:input.purchaseOrderId,inventoryRecordId:po.attributes.inventoryRecordId,receivedQuantity,stockQuantityBefore:before,stockQuantityAfter:after,status:poStatus},metadata:{}},tx,context.principal.id);
      return {receiptId,purchaseOrderId:input.purchaseOrderId,status:poStatus,receivedQuantity,stockQuantityAfter:after,idempotent:false};
    });
  }
}
export const procurementLifecycleService=new ProcurementLifecycleService();
