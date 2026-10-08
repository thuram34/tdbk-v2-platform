import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { financialLedgerRepository } from '../../persistence/firestore/repositories/financialLedgerRepository';
import { reconciliationRepository } from '../../persistence/firestore/repositories/reconciliationRepository';
import { bankBridge } from '../../orchestration/bridge/adapters/bankBridge';
import type { FinancialTransaction, LedgerEntry } from '../../finance/types';

const invoicePath=(t:string,id:string)=>`/tenants/${t}/entities/supplier_invoices/records/${id}`;
const paymentPath=(t:string,id:string)=>`/tenants/${t}/entities/supplier_payment_intents/records/${id}`;

type ProviderPaymentStatus = 'SUCCESS' | 'FAILED' | 'UNKNOWN' | 'REQUIRES_RECONCILIATION' | 'PENDING';

export class SupplierFinancialLifecycleService {
  private async auth(c:SecurityContext,dbk:string,permission='manage:purchasing'){
    const tenantId=c.tenantContext?.tenantId??dbk,branchId=c.branchContext?.branchId;
    if(tenantId!==dbk||!branchId) throw new KernelError('AUTHORIZATION_ERROR','Authoritative tenant and branch context required.',403,c.requestId);
    const a=await rbacEngine.authorizeAsync(c.principal,'SUPPLIER_FINANCE',`dbk:${dbk}`,{tenantId,branchId,requiredPermission:permission,requestId:c.requestId});
    if(!a.allowed) throw new KernelError('AUTHORIZATION_ERROR',a.reason,403,c.requestId);
    await dbkCapabilityManager.assertCapabilityOperational(c,dbk,'purchase_orders','SUPPLIER_FINANCE');
    return {tenantId,branchId};
  }

  private paymentEntries(transaction:FinancialTransaction,postedAt:string):LedgerEntry[]{
    return [
      {entryId:`${transaction.transactionId}_debit`,transactionId:transaction.transactionId,tenantId:transaction.tenantId,account:'LIABILITIES:SUPPLIER_PAYABLES',entryType:'DEBIT',amount:transaction.amount,currency:transaction.currency,createdAt:postedAt,immutable:true},
      {entryId:`${transaction.transactionId}_credit`,transactionId:transaction.transactionId,tenantId:transaction.tenantId,account:'CASH:BANK',entryType:'CREDIT',amount:transaction.amount,currency:transaction.currency,createdAt:postedAt,immutable:true},
    ];
  }

  private async closePaidInvoice(tenantId:string,invoiceId:string,paymentId:string,transaction:FinancialTransaction,providerReference:string,providerReceiptReference?:string|null){
    const now=new Date().toISOString();
    await firestoreClient.update(invoicePath(tenantId,invoiceId),{
      status:'CLOSED',
      'attributes.apStatus':'SETTLED',
      'attributes.paymentStatus':'PAID',
      'attributes.paymentTransactionId':transaction.transactionId,
      'attributes.paymentProviderReference':providerReference,
      'attributes.paymentProviderReceiptReference':providerReceiptReference??null,
      'attributes.closedAt':now,
      updatedAt:now,
    } as any);
    await firestoreClient.update(paymentPath(tenantId,paymentId),{
      status:'SETTLED',
      providerStatus:'SUCCESS',
      providerReference,
      providerReceiptReference:providerReceiptReference??null,
      settledAt:now,
      updatedAt:now,
    } as any);
    await outboxEngine.enqueueEvent(tenantId,{
      eventId:`supplier-payment-settled-${invoiceId}`,
      eventType:'finance.supplier.payment.settled.v1',
      eventVersion:'v1',
      occurredAt:now,
      tenantId,
      branchId:transaction.branchId,
      principalId:'system',
      correlationId:transaction.correlationId,
      causationId:providerReference,
      source:'SupplierFinancialLifecycleService',
      payload:{invoiceId,paymentId,transactionId:transaction.transactionId,providerReference,amountKes:transaction.amount},
      metadata:{},
    });
  }

  private async settleSuccess(c:SecurityContext,tenantId:string,branchId:string,invoice:any,paymentId:string,transaction:FinancialTransaction,providerReference:string,providerReceiptReference?:string|null,fromReconciliation=false){
    const postedAt=new Date().toISOString();
    const confirmed:FinancialTransaction={
      ...transaction,
      branchId,
      providerReference,
      providerReceiptReference:providerReceiptReference??null,
      status:'POSTED',
      postedAt,
      reversedAt:null,
    };
    const entries=this.paymentEntries(confirmed,postedAt);
    if(fromReconciliation) await financialLedgerRepository.confirmReconciledTransaction(confirmed,entries);
    else await financialLedgerRepository.confirmPendingTransaction(confirmed,entries);
    await this.closePaidInvoice(tenantId,invoice.id,paymentId,confirmed,providerReference,providerReceiptReference);
    return {invoiceId:invoice.id,status:'PAID',closureStatus:'CLOSED',transactionId:confirmed.transactionId,paymentId,providerReference,providerReceiptReference:providerReceiptReference??null};
  }

  public async postPayable(c:SecurityContext,dbk:string,input:{invoiceId:string}){
    const {tenantId,branchId}=await this.auth(c,dbk,'manage:purchasing');
    const path=invoicePath(tenantId,input.invoiceId), invoice=await firestoreClient.get<any>(path);
    if(!invoice||invoice.branchId!==branchId) throw new KernelError('NOT_FOUND','Supplier invoice not found.',404,c.requestId);
    if(invoice.status==='CLOSED'&&invoice.attributes?.apStatus==='SETTLED') return {invoiceId:input.invoiceId,status:'CLOSED',idempotent:true};
    if(invoice.status!=='MATCHED'&&invoice.status!=='AP_OPEN') throw new KernelError('VALIDATION_ERROR','Only a matched supplier invoice can enter accounts payable.',400,c.requestId);
    if(invoice.attributes?.apStatus==='POSTED') return {invoiceId:input.invoiceId,status:'AP_POSTED',idempotent:true,transactionId:invoice.attributes.apTransactionId};
    const amount=Number(invoice.attributes?.totalAmountKes);
    if(!Number.isFinite(amount)||amount<=0) throw new KernelError('VALIDATION_ERROR','Invoice amount must be positive.',400,c.requestId);
    const transactionId=`ap_${input.invoiceId}`,now=new Date().toISOString();
    const tx:FinancialTransaction={transactionId,tenantId,branchId,source:'OTHER',providerReference:`AP-${input.invoiceId}`,amount,currency:'KES',status:'POSTED',description:`Accounts payable for supplier invoice ${invoice.primaryIdentifier}`,correlationId:c.correlationId,createdAt:now,postedAt:now,reversedAt:null};
    const entries:LedgerEntry[]=[
      {entryId:`${transactionId}_debit`,transactionId,tenantId,account:'INVENTORY:SUPPLIER_PURCHASES',entryType:'DEBIT',amount,currency:'KES',createdAt:now,immutable:true},
      {entryId:`${transactionId}_credit`,transactionId,tenantId,account:'LIABILITIES:SUPPLIER_PAYABLES',entryType:'CREDIT',amount,currency:'KES',createdAt:now,immutable:true},
    ];
    await financialLedgerRepository.postTransaction(tx,entries);
    await firestoreClient.update(path,{status:'AP_OPEN','attributes.apStatus':'POSTED','attributes.apTransactionId':transactionId,updatedAt:now} as any);
    await outboxEngine.enqueueEvent(tenantId,{eventId:`supplier-ap-posted-${input.invoiceId}`,eventType:'finance.accounts_payable.posted.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:c.principal.id,correlationId:c.correlationId,causationId:input.invoiceId,source:'SupplierFinancialLifecycleService',payload:{invoiceId:input.invoiceId,transactionId,amountKes:amount},metadata:{}});
    return {invoiceId:input.invoiceId,status:'AP_POSTED',transactionId,idempotent:false};
  }

  public async initiatePayment(c:SecurityContext,dbk:string,input:{invoiceId:string;bankCode:string;destinationAccount:string;sourceAccount:string;simulateAmbiguousResult?:boolean}){
    const {tenantId,branchId}=await this.auth(c,dbk,'manage:purchasing');
    const invoice=await firestoreClient.get<any>(invoicePath(tenantId,input.invoiceId));
    if(!invoice||invoice.branchId!==branchId) throw new KernelError('NOT_FOUND','Supplier invoice not found.',404,c.requestId);
    if(invoice.attributes?.apStatus!=='POSTED') throw new KernelError('VALIDATION_ERROR','Accounts payable must be posted before supplier payment.',400,c.requestId);
    if(invoice.status==='CLOSED'&&invoice.attributes?.paymentStatus==='PAID') return {invoiceId:input.invoiceId,status:'PAID',closureStatus:'CLOSED',idempotent:true};
    const amount=Number(invoice.attributes.totalAmountKes);
    if(!Number.isFinite(amount)||amount<=0) throw new KernelError('VALIDATION_ERROR','Supplier payment amount must be positive.',400,c.requestId);
    const paymentId=`supplier_payment_${input.invoiceId}`,transactionId=`supplier_pay_${input.invoiceId}`,now=new Date().toISOString();
    const existing=await firestoreClient.get<any>(paymentPath(tenantId,paymentId));
    if(existing?.status==='SETTLED') return existing;
    if(existing?.status==='PENDING'||existing?.status==='RECONCILIATION_REQUIRED') return existing;

    const financial:FinancialTransaction={transactionId,tenantId,branchId,source:'BANK',providerReference:`SUPPLIER-${input.invoiceId}`,amount,currency:'KES',status:'PENDING',description:`Supplier payment for invoice ${invoice.primaryIdentifier}`,correlationId:c.correlationId,createdAt:now,postedAt:null,reversedAt:null};
    await financialLedgerRepository.savePendingTransaction(financial);
    const intent={id:paymentId,entityType:'supplier_payment_intent',primaryIdentifier:paymentId,status:'PENDING',branchId,invoiceId:input.invoiceId,transactionId,amountKes:amount,destinationAccount:input.destinationAccount,sourceAccount:input.sourceAccount,bankCode:input.bankCode,createdAt:now,updatedAt:now};
    await firestoreClient.set(paymentPath(tenantId,paymentId),intent);

    const provider=await bankBridge.execute(c,'INITIATE_TRANSFER',{
      sourceAccount:input.sourceAccount,
      destinationAccount:input.destinationAccount,
      bankCode:input.bankCode,
      amount,
      referenceText:`SUPPLIER_PAYMENT:${input.invoiceId}`,
      simulateAmbiguousResult:input.simulateAmbiguousResult,
    });
    const providerStatus=provider.status as ProviderPaymentStatus;
    const providerReference=provider.providerReference;
    const providerReceiptReference=(provider.data?.receiptReference||provider.data?.bankRef||null) as string|null;

    if(providerStatus==='SUCCESS'){
      return this.settleSuccess(c,tenantId,branchId,invoice,paymentId,financial,providerReference,providerReceiptReference);
    }
    if(providerStatus==='FAILED'){
      await financialLedgerRepository.failPendingTransaction(tenantId,transactionId,provider.errorDetails||'Bank provider rejected supplier payment');
      await firestoreClient.update(paymentPath(tenantId,paymentId),{status:'FAILED',providerStatus:'FAILED',providerReference,providerReceiptReference,updatedAt:new Date().toISOString()} as any);
      return {invoiceId:input.invoiceId,status:'FAILED',closureStatus:'OPEN',transactionId,paymentId,providerReference};
    }

    const reconciliation=await reconciliationRepository.markRequired(tenantId,transactionId,'PENDING',{providerReference,description:`${financial.description} [provider outcome requires reconciliation]`});
    await firestoreClient.update(invoicePath(tenantId,input.invoiceId),{'attributes.paymentStatus':'RECONCILIATION_REQUIRED','attributes.paymentTransactionId':transactionId,'attributes.paymentProviderReference':providerReference,updatedAt:new Date().toISOString()} as any);
    await firestoreClient.update(paymentPath(tenantId,paymentId),{status:'RECONCILIATION_REQUIRED',providerStatus:providerStatus,providerReference,providerReceiptReference,updatedAt:new Date().toISOString()} as any);
    return {invoiceId:input.invoiceId,status:'RECONCILIATION_REQUIRED',closureStatus:'OPEN',transactionId,paymentId,providerReference,reconciliationStatus:reconciliation.status};
  }

  public async confirmPayment(c:SecurityContext,dbk:string,input:{invoiceId:string;providerReference:string;status:'SUCCESS'|'FAILED';providerReceiptReference?:string}){
    const {tenantId,branchId}=await this.auth(c,dbk,'manage:purchasing');
    const invoice=await firestoreClient.get<any>(invoicePath(tenantId,input.invoiceId));
    if(!invoice||invoice.branchId!==branchId) throw new KernelError('NOT_FOUND','Supplier invoice not found.',404,c.requestId);
    const paymentId=`supplier_payment_${input.invoiceId}`,transactionId=`supplier_pay_${input.invoiceId}`;
    const transaction=await financialLedgerRepository.getTransaction(tenantId,transactionId);
    if(!transaction) throw new KernelError('NOT_FOUND','Supplier payment transaction not found.',404,c.requestId);
    if(input.status==='FAILED'){
      if(transaction.status==='PENDING') await financialLedgerRepository.failPendingTransaction(tenantId,transactionId,'Authoritative provider failure');
      else if(transaction.status==='RECONCILIATION_REQUIRED') await reconciliationRepository.resolve(tenantId,transactionId,'RECONCILIATION_REQUIRED','FAILED');
      else if(transaction.status==='POSTED') throw new KernelError('CONFLICT','A provider-confirmed payment cannot be changed to FAILED.',409,c.requestId);
      await firestoreClient.update(paymentPath(tenantId,paymentId),{status:'FAILED',providerStatus:'FAILED',providerReference:input.providerReference,updatedAt:new Date().toISOString()} as any);
      await firestoreClient.update(invoicePath(tenantId,input.invoiceId),{'attributes.paymentStatus':'UNPAID',updatedAt:new Date().toISOString()} as any);
      return {invoiceId:input.invoiceId,status:'FAILED',closureStatus:'OPEN',transactionId,paymentId,providerReference:input.providerReference};
    }
    if(transaction.status==='POSTED'){
      if(transaction.providerReference!==input.providerReference) throw new KernelError('CONFLICT','Provider reference conflicts with posted financial truth.',409,c.requestId);
      await this.closePaidInvoice(tenantId,input.invoiceId,paymentId,transaction,input.providerReference,input.providerReceiptReference);
      return {invoiceId:input.invoiceId,status:'PAID',closureStatus:'CLOSED',transactionId,paymentId,providerReference:input.providerReference,idempotent:true};
    }
    if(transaction.status==='RECONCILIATION_REQUIRED'){
      if(transaction.providerReference!==input.providerReference) throw new KernelError('CONFLICT','Provider reference conflicts with reconciliation identity.',409,c.requestId);
      return this.settleSuccess(c,tenantId,branchId,invoice,paymentId,transaction,input.providerReference,input.providerReceiptReference,true);
    }
    if(transaction.status!=='PENDING') throw new KernelError('CONFLICT',`Supplier payment cannot be confirmed from status '${transaction.status}'.`,409,c.requestId);
    return this.settleSuccess(c,tenantId,branchId,invoice,paymentId,transaction,input.providerReference,input.providerReceiptReference,false);
  }
}
export const supplierFinancialLifecycleService=new SupplierFinancialLifecycleService();
