import React, { useState } from 'react';
import { DbkExperienceResolved } from '../../experience/types';
import { AlertCircle, CheckCircle, Package, RefreshCw, Send, ShoppingCart } from 'lucide-react';

interface OperationalFlowViewProps {
  experience: DbkExperienceResolved;
  capabilityId: string;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => Promise<any>;
}

export const OperationalFlowView: React.FC<OperationalFlowViewProps> = ({
  experience,
  capabilityId,
  onDispatchCommand,
}) => {
  const [inventoryRecordId, setInventoryRecordId] = useState('stock_item_001');
  const [quantity, setQuantity] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'CREDIT'>('PAID');
  const [saleId, setSaleId] = useState(() => `sale-${Date.now()}`);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionResult, setTransactionResult] = useState<any>(null);

  const isSalesCounter = capabilityId === 'sales_counter';

  const handleSale = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTransactionResult(null);

    try {
      const res = await onDispatchCommand('EXECUTE_SALE', {
        saleId,
        items: [{ inventoryRecordId: inventoryRecordId.trim(), quantity: Number(quantity) }],
        paymentStatus,
        customerName: customerName.trim() || undefined,
      });

      const commandResponse = res?.commandResponse;
      const result = commandResponse?.result || {};
      const succeeded = commandResponse?.success === true;
      setTransactionResult({
        status: succeeded ? 'SUCCESS' : 'FAILED',
        message: succeeded ? 'Sale completed and committed by the TDBK runtime.' : (commandResponse?.error?.message || 'Sale was not accepted'),
        saleId: result.saleId || saleId,
        totalAmountKes: result.totalAmountKes,
        idempotent: result.idempotent,
        eventId: result.eventId,
        timestamp: commandResponse?.serverTimestamp || new Date().toISOString(),
      });

      if (succeeded && !result.idempotent) setSaleId(`sale-${Date.now()}`);
    } catch (error: any) {
      setTransactionResult({ status: 'FAILED', message: error?.message || 'Sale could not be authorized', saleId, timestamp: new Date().toISOString() });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='space-y-6'>
      <div className='rounded-lg border border-neutral-800 bg-neutral-900 p-5'>
        <div className='flex items-center space-x-2'>
          <span className='rounded border border-emerald-500/30 bg-emerald-500/20 px-2 py-0.5 text-[10px] font-mono font-bold uppercase text-emerald-400'>OPERATIONAL FLOW</span>
          <span className='rounded bg-neutral-800 px-2 py-0.5 text-[10px] font-mono font-bold text-neutral-300'>{experience.activeBranch.name}</span>
        </div>
        <h1 className='mt-2 text-xl font-bold text-white'>{capabilityId.replace(/_/g, ' ').toUpperCase()} Terminal</h1>
        <p className='mt-1 text-xs text-neutral-400'>Server-authoritative operation through the Experience Command boundary, branch authority, transaction service, persistence and audit/outbox.</p>
      </div>

      {!isSalesCounter ? (
        <div className='rounded-lg border border-amber-800/60 bg-amber-950/20 p-6 text-sm text-amber-200'>
          <div className='flex items-start gap-3'><AlertCircle className='mt-0.5 h-5 w-5 shrink-0' /><div>
            <p className='font-semibold'>This operational surface is not wired to an executable command yet.</p>
            <p className='mt-1 text-xs leading-5 text-amber-300/80'>The UI will not fabricate provider execution. The implemented transaction path currently supports the Sales Counter through EXECUTE_SALE.</p>
          </div></div>
        </div>
      ) : (
        <div className='grid grid-cols-1 gap-6 md:grid-cols-3'>
          <div className='rounded-lg border border-neutral-800 bg-neutral-900 p-5 md:col-span-2'>
            <h2 className='mb-4 flex items-center space-x-2 text-sm font-bold text-white'><ShoppingCart className='h-4 w-4 text-emerald-400' /><span>Complete Sale</span></h2>
            <form onSubmit={handleSale} className='space-y-4'>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div><label className='mb-1 block text-[11px] font-mono text-neutral-400'>Inventory Record ID</label><input type='text' required value={inventoryRecordId} onChange={(e) => setInventoryRecordId(e.target.value)} className='w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none' /></div>
                <div><label className='mb-1 block text-[11px] font-mono text-neutral-400'>Quantity</label><input type='number' min='1' step='1' required value={quantity} onChange={(e) => setQuantity(e.target.value)} className='w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:border-indigo-500 focus:outline-none' /></div>
              </div>
              <div className='grid grid-cols-1 gap-4 md:grid-cols-2'>
                <div><label className='mb-1 block text-[11px] font-mono text-neutral-400'>Customer Name (optional)</label><input type='text' value={customerName} onChange={(e) => setCustomerName(e.target.value)} className='w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none' /></div>
                <div><label className='mb-1 block text-[11px] font-mono text-neutral-400'>Payment Status</label><select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as 'PAID' | 'PENDING' | 'CREDIT')} className='w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none'><option value='PAID'>PAID</option><option value='PENDING'>PENDING</option><option value='CREDIT'>CREDIT</option></select></div>
              </div>
              <div><label className='mb-1 block text-[11px] font-mono text-neutral-400'>Sale ID / Idempotency Key</label><input type='text' required value={saleId} onChange={(e) => setSaleId(e.target.value)} className='w-full rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-xs font-mono text-white focus:border-indigo-500 focus:outline-none' /></div>
              <button type='submit' disabled={isProcessing} className='flex w-full cursor-pointer items-center justify-center space-x-2 rounded bg-emerald-600 py-2.5 text-xs font-bold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50'>
                {isProcessing ? <><RefreshCw className='h-3.5 w-3.5 animate-spin' /><span>Committing sale…</span></> : <><Send className='h-3.5 w-3.5' /><span>Complete Sale</span></>}
              </button>
            </form>
          </div>

          <div className='rounded-lg border border-neutral-800 bg-neutral-900 p-5'>
            <h3 className='mb-3 text-xs font-bold uppercase tracking-wider text-neutral-300 font-mono'>Transaction Status</h3>
            {transactionResult ? (
              <div className={'rounded border p-3.5 text-xs ' + (transactionResult.status === 'SUCCESS' ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-rose-500/30 bg-rose-500/10 text-rose-300')}>
                <div className='flex items-center space-x-1.5 font-bold'>{transactionResult.status === 'SUCCESS' ? <CheckCircle className='h-4 w-4' /> : <AlertCircle className='h-4 w-4' />}<span>{transactionResult.status === 'SUCCESS' ? 'Sale Completed' : 'Sale Failed'}</span></div>
                <div className='mt-2 space-y-1 font-mono text-[11px]'><div>Status: {transactionResult.message}</div><div>Sale ID: {transactionResult.saleId}</div>{transactionResult.totalAmountKes !== undefined && <div>Total: KES {Number(transactionResult.totalAmountKes).toLocaleString()}</div>}{transactionResult.eventId && <div>Event: {transactionResult.eventId}</div>}{transactionResult.idempotent !== undefined && <div>Idempotent: {String(transactionResult.idempotent)}</div>}<div>Time: {transactionResult.timestamp}</div></div>
              </div>
            ) : <div className='rounded border border-dashed border-neutral-800 p-6 text-center text-xs text-neutral-500'><Package className='mx-auto mb-2 h-5 w-5' />Ready for counter checkout. The server owns stock, sale and event truth.</div>}
          </div>
        </div>
      )}
    </div>
  );
};
