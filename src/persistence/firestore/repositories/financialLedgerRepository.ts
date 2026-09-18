/**
 * TDBK V2 — DURABLE FINANCIAL LEDGER REPOSITORY
 * Atomic transaction + balanced immutable double-entry posting.
 */
import { IFinancialLedgerRepository, FinancialTransaction, LedgerEntry } from '../../types';
import { firestoreClient } from '../firestoreClient';
export class FinancialLedgerRepository implements IFinancialLedgerRepository {
  private static instance: FinancialLedgerRepository;
  private constructor() {}
  public static getInstance(): FinancialLedgerRepository { return this.instance ??= new FinancialLedgerRepository(); }
  private txPath(t:string,id:string){return `/tenants/${t}/financial_transactions/${id}`;}
  private entryPath(t:string,id:string){return `/tenants/${t}/ledger_entries/${id}`;}
  public async postTransaction(transaction: FinancialTransaction, entries: LedgerEntry[]): Promise<void> {
    if (!transaction.tenantId || transaction.amount <= 0 || !Number.isFinite(transaction.amount)) throw new Error('Invalid financial transaction');
    const debit=entries.filter(e=>e.entryType==='DEBIT').reduce((s,e)=>s+e.amount,0);
    const credit=entries.filter(e=>e.entryType==='CREDIT').reduce((s,e)=>s+e.amount,0);
    if (!entries.length || Math.abs(debit-credit)>0.000001 || Math.abs(debit-transaction.amount)>0.000001) throw new Error('Unbalanced financial transaction');
    if (entries.some(e=>e.transactionId!==transaction.transactionId||e.tenantId!==transaction.tenantId||e.immutable!==true)) throw new Error('Invalid ledger entry ownership');
    await firestoreClient.runTransaction(async tx=>{
      const existing=await tx.get<FinancialTransaction>(this.txPath(transaction.tenantId,transaction.transactionId));
      if(existing) { if(existing.status!=='POSTED') throw new Error('Existing transaction is not posted'); return; }
      await tx.set(this.txPath(transaction.tenantId,transaction.transactionId),transaction);
      for(const entry of entries) await tx.set(this.entryPath(transaction.tenantId,entry.entryId),entry);
    });
  }
  public async getTransaction(tenantId:string,transactionId:string){return firestoreClient.get<FinancialTransaction>(this.txPath(tenantId,transactionId));}
  public async listEntries(tenantId:string,transactionId:string){const all=await firestoreClient.listCollection<LedgerEntry>(`/tenants/${tenantId}/ledger_entries`);return all.filter(e=>e.transactionId===transactionId);}
}
export const financialLedgerRepository=FinancialLedgerRepository.getInstance();
