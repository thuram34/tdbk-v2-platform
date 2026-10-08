import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { etimsBridge } from '../../orchestration/bridge/adapters/etimsBridge';

export interface FiscalizeSaleInput { saleId: string; }

export interface FiscalizeSaleResult {
  saleId: string;
  fiscalizationId: string;
  invoiceNumber: string;
  status: 'FISCALIZED' | 'FAILED' | 'REQUIRES_RECONCILIATION';
  providerReference: string | null;
}

const salePath=(tenantId:string,saleId:string)=>'/tenants/'+tenantId+'/entities/sales_counter/records/'+saleId;
const fiscalPath=(tenantId:string,saleId:string)=>'/tenants/'+tenantId+'/entities/etims_fiscalizations/records/'+saleId;

export class SaleEtimsFiscalizationService {
  public async fiscalize(context: SecurityContext, dbkId: string, input: FiscalizeSaleInput): Promise<FiscalizeSaleResult> {
    const tenantId=context.tenantContext?.tenantId ?? dbkId;
    const branchId=context.branchContext?.branchId;
    if(tenantId!==dbkId) throw new KernelError('TENANT_ISOLATION_ERROR','eTIMS sale tenant does not match target business.',403,context.requestId);
    if(!branchId) throw new KernelError('VALIDATION_ERROR','An active branch is required for eTIMS fiscalization.',400,context.requestId);
    const authorization=await rbacEngine.authorizeAsync(context.principal,'execute','sales:fiscalize',{
      tenantId,branchId,requiredPermission:'execute:sales',requestId:context.requestId,
    });
    if(!authorization.allowed) throw new KernelError('AUTHORIZATION_ERROR',authorization.reason,403,context.requestId);
    await dbkCapabilityManager.assertCapabilityOperational(context,dbkId,'capability_statutory_tax','FISCALIZE_SALE_ETIMS');

    const sale=await firestoreClient.get<any>(salePath(tenantId,input.saleId));
    if(!sale) throw new KernelError('NOT_FOUND',`Sale '${input.saleId}' was not found.`,404,context.requestId);
    if(sale.tenantId && sale.tenantId!==tenantId) throw new KernelError('TENANT_ISOLATION_ERROR','Sale tenant mismatch.',403,context.requestId);
    if(sale.branchId!==branchId) throw new KernelError('AUTHORIZATION_ERROR','Sale belongs to another branch.',403,context.requestId);
    if(sale.status!=='COMPLETED') throw new KernelError('VALIDATION_ERROR','Only completed sales can be fiscalized.',400,context.requestId);
    const amount=Number(sale.attributes?.totalAmountKes);
    if(!Number.isFinite(amount)||amount<=0) throw new KernelError('VALIDATION_ERROR','Sale has no valid fiscal amount.',400,context.requestId);

    const existing=await firestoreClient.get<any>(fiscalPath(tenantId,input.saleId));
    if(existing?.status==='FISCALIZED') return existing.result as FiscalizeSaleResult;
    if(existing?.status==='REQUIRES_RECONCILIATION') return existing.result as FiscalizeSaleResult;

    const invoiceNumber='TDBK-'+input.saleId;
    const items=(sale.attributes?.items||[]).map((item:any)=>({
      itemCode:item.skuCode,
      itemName:item.itemName,
      quantity:Number(item.quantity),
      unitPrice:Number(item.unitPriceKes),
      supplyAmount:Number(item.lineTotalKes),
      taxTypeCode:String(item.taxTypeCode||'B'),
      taxRate:Number(item.taxRate||0),
      taxableAmount:Number(item.taxableAmount ?? item.lineTotalKes),
      taxAmount:Number(item.taxAmount||0),
      totalAmount:Number(item.totalAmount ?? item.lineTotalKes),
    }));
    if(items.length===0) throw new KernelError('VALIDATION_ERROR','Sale has no fiscalizable line items.',400,context.requestId);

    const fiscalizationId='etims_'+input.saleId;
    const request={invoiceNumber,branchId,totalAmount:amount,taxAmount:items.reduce((s:number,i:any)=>s+Number(i.taxAmount||0),0),items,customerName:sale.attributes?.customerName||undefined,customerMobile:sale.attributes?.customerPhone||undefined,paymentMethodCode:sale.attributes?.paymentMethod==='MPESA'?'02':'01',saleDate:sale.attributes?.completedAt,traderInvoiceNumber:invoiceNumber,idempotencyKey:fiscalizationId};
    const now=new Date().toISOString();
    await firestoreClient.set(fiscalPath(tenantId,input.saleId),{id:fiscalizationId,tenantId,branchId,saleId:input.saleId,invoiceNumber,status:'INITIATING',createdAt:now,updatedAt:now});

    try {
      const result=await etimsBridge.execute(context,'SAVE_SALES',request as any);
      if(result.status==='REQUIRES_RECONCILIATION'||result.status==='UNKNOWN'){
        const out={saleId:input.saleId,fiscalizationId,invoiceNumber,status:'REQUIRES_RECONCILIATION' as const,providerReference:result.providerReference||null};
        await firestoreClient.set(fiscalPath(tenantId,input.saleId),{id:fiscalizationId,tenantId,branchId,saleId:input.saleId,invoiceNumber,status:out.status,providerReference:out.providerReference,result:out,updatedAt:new Date().toISOString()});
        return out;
      }
      if(result.status!=='SUCCESS') {
        const out={saleId:input.saleId,fiscalizationId,invoiceNumber,status:'FAILED' as const,providerReference:result.providerReference||null};
        await firestoreClient.set(fiscalPath(tenantId,input.saleId),{id:fiscalizationId,tenantId,branchId,saleId:input.saleId,invoiceNumber,status:out.status,providerReference:out.providerReference,result:out,updatedAt:new Date().toISOString()});
        return out;
      }
      const out={saleId:input.saleId,fiscalizationId,invoiceNumber,status:'FISCALIZED' as const,providerReference:result.providerReference||null};
      await firestoreClient.runTransaction(async tx=>{
        const current=await tx.get<any>(salePath(tenantId,input.saleId));
        if(!current||current.status!=='COMPLETED'||current.branchId!==branchId) throw new Error('Authoritative sale changed during eTIMS fiscalization');
        await tx.set(fiscalPath(tenantId,input.saleId),{id:fiscalizationId,tenantId,branchId,saleId:input.saleId,invoiceNumber,status:out.status,providerReference:out.providerReference,result:out,providerData:result.data,createdAt:now,updatedAt:new Date().toISOString()});
        await tx.update<any>(salePath(tenantId,input.saleId),{attributes:{...(current.attributes||{}),etimsStatus:'FISCALIZED',etimsInvoiceNumber:invoiceNumber,etimsProviderReference:out.providerReference,etimsFiscalizedAt:new Date().toISOString()},updatedAt:new Date().toISOString()});
      });
      return out;
    } catch(error:any) {
      const out={saleId:input.saleId,fiscalizationId,invoiceNumber,status:'REQUIRES_RECONCILIATION' as const,providerReference:null};
      await firestoreClient.set(fiscalPath(tenantId,input.saleId),{id:fiscalizationId,tenantId,branchId,saleId:input.saleId,invoiceNumber,status:out.status,result:out,lastError:error?.message||'eTIMS provider outcome unresolved',updatedAt:new Date().toISOString()});
      return out;
    }
  }
}
export const saleEtimsFiscalizationService=new SaleEtimsFiscalizationService();
