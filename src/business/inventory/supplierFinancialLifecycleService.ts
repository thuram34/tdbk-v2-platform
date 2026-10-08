import type { SecurityContext } from '../../kernel/types';
import { KernelError } from '../../kernel/errors/kernelErrors';
import { rbacEngine } from '../../kernel/authorization/rbacEngine';
import { dbkCapabilityManager } from '../../capability/dbkCapabilityManager';
import { firestoreClient } from '../../persistence/firestore/firestoreClient';
import { outboxEngine } from '../../orchestration/outbox/outboxEngine';
import { financialLedgerRepository } from '../../persistence/firestore/repositories/financialLedgerRepository';
import type { FinancialTransaction, LedgerEntry } from '../../finance/types';

const invoicePath=(t:string,id:string)=>`/tenants/${t}/entities/supplier_invoices/records/${id}`;
const paymentPath=(t:string,id:string)=>`/tenants/${t}/entities/supplier_payment_intents/records/${id}`;

export class SupplierFinancialLifecycleService {
 private async auth(c:SecurityContext,dbk:string,permission='manage:purchasing'){
  const tenantId=c.tenantContext?.tenantId??dbk,branchId=c.branchContext?.branchId;
  if(tenantId!==dbk||!branchId) throw new KernelError('AUTHORIZATION_ERROR','Authoritative tenant and branch context required.',403,c.requestId);
  const a=await rbacEngine.authorizeAsync(c.principal,'SUPPLIER_FINANCE',`dbk:${dbk}`,{tenantId,branchId,requiredPermission:permission,requestId:c.requestId});
  if(!a.allowed) throw new KernelError('AUTHORIZATION_ERROR',a.reason,403,c.requestId);
  await dbkCapabilityManager.assertCapabilityOperational(c,dbk,'purchase_orders','SUPPLIER_FINANCE');
  return {tenantId,branchId};
 }
 public async postPayable(c:SecurityContext,dbk:string,input:{invoiceId:string}){
  const {tenantId,branchId}=await this.auth(c,dbk,'manage:purchasing');
  const path=invoicePath(tenantId,input.invoiceId), invoice=await firestoreClient.get<any>(path);
  if(!invoice||invoice.branchId!==branchId) throw new KernelError('NOT_FOUND','Supplier invoice not found.',404,c.requestId);
  if(invoice.status!=='MATCHED'&&invoice.status!=='AP_OPEN') throw new KernelError('VALIDATION_ERROR','Only a matched supplier invoice can enter accounts payable.',400,c.requestId);
  if(invoice.attributes?.apStatus==='POSTED') return {invoiceId:input.invoiceId,status:'AP_POSTED',idempotent:true,transactionId:invoice.attributes.apTransactionId};
  const amount=Number(invoice.attributes?.totalAmountKes); if(!Number.isFinite(amount)||amount<=0) throw new KernelError('VALIDATION_ERROR','Invoice amount must be positive.',400,c.requestId);
  const transactionId=`ap_${input.invoiceId}`,now=new Date().toISOString();
  const tx:FinancialTransaction={transactionId,tenantId,branchId,source:'OTHER',providerReference:`AP-${input.invoiceId}`,amount,currency:'KES',status:'POSTED',description:`Accounts payable for supplier invoice ${invoice.primaryIdentifier}`,correlationId:c.correlationId,createdAt:now,postedAt:now,reversedAt:null};
  const entries:LedgerEntry[]=[
   {entryId:`${transactionId}_debit`,transactionId,tenantId,account:'EXPENSES:PURCHASES',entryType:'DEBIT',amount,currency:'KES',createdAt:now,immutable:true},
   {entryId:`${transactionId}_credit`,transactionId,tenantId,account:'LIABILITIES:SUPPLIERS',entryType:'CREDIT',amount,currency:'KES',createdAt:now,immutable:true}
  ];
  await financialLedgerRepository.postTransaction(tx,entries);
  await firestoreClient.update(path,{status:'AP_OPEN','attributes.apStatus':'POSTED','attributes.apTransactionId':transactionId,updatedAt:now} as any);
  await outboxEngine.enqueueEvent(tenantId,{eventId:`supplier-ap-posted-${input.invoiceId}`,eventType:'finance.accounts_payable.posted.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:c.principal.id,correlationId:c.correlationId,causationId:input.invoiceId,source:'SupplierFinancialLifecycleService',payload:{invoiceId:input.invoiceId,transactionId,amountKes:amount},metadata:{}});
  return {invoiceId:input.invoiceId,status:'AP_POSTED',transactionId,idempotent:false};
 }
 public async initiatePayment(c:SecurityContext,dbk:string,input:{invoiceId:string;bankCode?:string;destinationAccount:string;sourceAccount:string}){
  const {tenantId,branchId}=await this.auth(c,dbk,'manage:purchasing');
  const invoice=await firestoreClient.get<any>(invoicePath(tenantId,input.invoiceId));
  if(!invoice||invoice.branchId!==branchId) throw new KernelError('NOT_FOUND','Supplier invoice not found.',404,c.requestId);
  if(invoice.attributes?.apStatus!=='POSTED') throw new KernelError('VALIDATION_ERROR','Accounts payable must be posted before supplier payment.',400,c.requestId);
  if(invoice.attributes?.paymentStatus==='PAID') return {invoiceId:input.invoiceId,status:'PAID',idempotent:true};
  const amount=Number(invoice.attributes.totalAmountKes), paymentId=`supplier_payment_${input.invoiceId}`,transactionId=`supplier_pay_${input.invoiceId}`,now=new Date().toISOString();
  const existing=await firestoreClient.get<any>(paymentPath(tenantId,paymentId));
  if(existing) return existing;
  const financial:FinancialTransaction={transactionId,tenantId,branchId,source:'BANK',providerReference:`SUPPLIER-${input.invoiceId}`,amount,currency:'KES',status:'PENDING',description:`Supplier payment for invoice ${invoice.primaryIdentifier}`,correlationId:c.correlationId,createdAt:now,postedAt:null,reversedAt:null};
  await financialLedgerRepository.savePendingTransaction(financial);
  const intent={id:paymentId,entityType:'supplier_payment_intent',primaryIdentifier:paymentId,status:'PENDING',branchId,invoiceId:input.invoiceId,transactionId,amountKes:amount,destinationAccount:input.destinationAccount,sourceAccount:input.sourceAccount,bankCode:input.bankCode||null,createdAt:now,updatedAt:now};
  await firestoreClient.set(paymentPath(tenantId,paymentId),intent);
  await outboxEngine.enqueueEvent(tenantId,{eventId:`supplier-payment-instruction-${input.invoiceId}`,eventType:'finance.supplier.payment.instruction.created.v1',eventVersion:'v1',occurredAt:now,tenantId,branchId,principalId:c.principal.id,correlationId:c.correlationId,causationId:input.invoiceId,source:'SupplierFinancialLifecycleService',payload:{invoiceId:input.invoiceId,paymentId,transactionId,amountKes:amount},metadata:{}});
  return {...intent,status:'PENDING',providerState:'AWAITING_TENANT_BANK_ADAPTER'};
 }
 public async confirmPayment(c:SecurityContext,dbk:string,input:{invoiceId:string;providerReference:string;status:'SUCCESS'|'FAILED';providerReceiptReference?:string}){
  const {tenantId,branchId}=await this.auth(c,dbk,'manage:purchasing');
  const invoice=await firestoreClient.get<any>(invoicePath(tenantId,input.invoiceId));
  if(!invoice||invoice.branchId!==branchId) throw new KernelError('NOT_FOUND','Supplier invoice not found.',404,c.requestId);
  const transactionId=invoice.attributes?.paymentTransactionId||`supplier_pay_${input.invoiceId}`;
  const transaction=await firestoreClient.get<FinancialTransaction>(`/tenants/${tenantId}/financialTransactions/${transactionId}`);
  if(!transaction) throw new KernelError('NOT_FOUND','Supplier payment transaction not found.',404,c.requestId);
  if (transaction.status === 'RECONCILIATION_REQUIRED') {
   throw new KernelError('RECONCILIATION_REQUIRED','Supplier payment has an ambiguous provider outcome and must be resolved by the authoritative reconciliation adapter before it can be confirmed.',409,c.requestId);
  }
  if (transaction.status !== 'POSTED') {
   throw new KernelError('VALIDATION_ERROR','Supplier payment is not provider-confirmed. Confirmation cannot promote a PENDING transaction.',409,c.requestId);
  }
  if (transaction.providerReference !== input.providerReference) {
   throw new KernelError('VALIDATION_ERROR','Provider reference does not match the authoritative financial transaction.',409,c.requestId);
  }
  if(input.status==='FAILED') {
   throw new KernelError('CONFLICT','A payment already confirmed as POSTED cannot be changed to FAILED.',409,c.requestId);
  }
  await firestoreClient.update(invoicePath(tenantId,input.invoiceId),{'attributes.paymentStatus':'PAID','attributes.paymentTransactionId':transactionId,'attributes.paymentProviderReference':input.providerReference,'updatedAt':new Date().toISOString()} as any);
  await outboxEngine.enqueueEvent(tenantId,{eventId:`supplier-payment-confirmed-${input.invoiceId}`,eventType:'finance.supplier.payment.confirmed.v1',eventVersion:'v1',occurredAt:new Date().toISOString(),tenantId,branchId,principalId:c.principal.id,correlationId:c.correlationId,causationId:input.providerReference,source:'SupplierFinancialLifecycleService',payload:{invoiceId:input.invoiceId,transactionId,providerReference:input.providerReference,amountKes:transaction.amount},metadata:{}});
  return {invoiceId:input.invoiceId,status:'PAID',transactionId,providerReference:input.providerReference};
 }
}
export const supplierFinancialLifecycleService=new SupplierFinancialLifecycleService();
