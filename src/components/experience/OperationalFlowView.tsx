import React, { useState } from 'react';
import { DbkExperienceResolved } from '../../experience/types';
import { CheckCircle, RefreshCw, Send, AlertCircle } from 'lucide-react';

interface OperationalFlowViewProps {
  experience: DbkExperienceResolved;
  capabilityId: string;
  onDispatchCommand: (commandType: string, payload: Record<string, unknown>) => Promise<any>;
}

interface SaleResult {
  saleId: string;
  totalAmountKes: number;
  currency: 'KES';
  status: 'COMPLETED';
  idempotent: boolean;
  eventId: string;
}

export const OperationalFlowView: React.FC<OperationalFlowViewProps> = ({
  experience,
  capabilityId,
  onDispatchCommand,
}) => {
  const [inventoryRecordId, setInventoryRecordId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [customerName, setCustomerName] = useState('');
  const [reference, setReference] = useState('');
  const [paymentStatus, setPaymentStatus] = useState<'PAID' | 'PENDING' | 'CREDIT'>('PENDING');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionResult, setTransactionResult] = useState<SaleResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTransactionResult(null);
    setErrorMessage(null);

    const saleId = reference.trim() || `sale-${Date.now()}`;
    const parsedQuantity = Number(quantity);

    try {
      const response = await onDispatchCommand('EXECUTE_SALE', {
        saleId,
        items: [{ inventoryRecordId: inventoryRecordId.trim(), quantity: parsedQuantity }],
        paymentStatus,
        ...(customerName.trim() ? { customerName: customerName.trim() } : {}),
      });

      if (!response?.success || !response?.result) {
        throw new Error(response?.error?.message || 'Sale could not be completed.');
      }

      setTransactionResult(response.result as SaleResult);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Sale could not be completed.');
    } finally {
      setIsProcessing(false);
    }
  };

  const isSaleCapability = capabilityId.toLowerCase() === 'sales_counter' || capabilityId.toLowerCase() === 'sale';

  return (
    <div className="space-y-6">
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
        <div className="flex items-center space-x-2">
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            OPERATIONAL FLOW
          </span>
          <span className="px-2 py-0.5 text-[10px] font-mono font-bold uppercase rounded bg-neutral-800 text-neutral-300">
            {experience.activeBranch.name}
          </span>
        </div>
        <h1 className="text-xl font-bold text-white mt-2">
          {capabilityId.replace(/_/g, ' ').toUpperCase()} Terminal
        </h1>
        <p className="text-xs text-neutral-400 mt-1">
          {isSaleCapability
            ? 'Authoritative sale transaction through TDBK Kernel, inventory controls, Firestore and the event outbox.'
            : 'Authoritative operational command through the TDBK Kernel.'}
        </p>
      </div>

      {isSaleCapability ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 md:col-span-2">
            <h2 className="text-sm font-bold text-white mb-4">Complete Sale</h2>
            <form onSubmit={handleCheckout} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">Inventory Record ID</label>
                  <input
                    type="text"
                    required
                    value={inventoryRecordId}
                    onChange={(e) => setInventoryRecordId(e.target.value)}
                    placeholder="Select a real stock_control record"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">Quantity</label>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">Customer Name (optional)</label>
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-mono text-neutral-400 mb-1">Sale Reference / ID</label>
                  <input
                    type="text"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="Optional; generated if empty"
                    className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">Payment Status</label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as 'PAID' | 'PENDING' | 'CREDIT')}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="PENDING">Pending</option>
                  <option value="PAID">Paid</option>
                  <option value="CREDIT">Credit</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isProcessing || !inventoryRecordId.trim() || !Number.isInteger(parsedQuantity) || parsedQuantity <= 0}
                className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded transition flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <><RefreshCw className="w-3.5 h-3.5 animate-spin" /><span>Executing sale through TDBK Kernel...</span></>
                ) : (
                  <><Send className="w-3.5 h-3.5" /><span>Complete Sale</span></>
                )}
              </button>
            </form>
          </div>

          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
            <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono mb-3">Transaction Status</h3>
            {transactionResult ? (
              <div className="p-3.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                <div className="flex items-center space-x-1.5 font-bold"><CheckCircle className="w-4 h-4" /><span>Sale completed</span></div>
                <div className="mt-2 space-y-1 font-mono text-[11px]">
                  <div>Sale: {transactionResult.saleId}</div>
                  <div>Total: KES {transactionResult.totalAmountKes.toLocaleString()}</div>
                  <div>Status: {transactionResult.status}</div>
                  <div>Idempotent: {transactionResult.idempotent ? 'YES' : 'NO'}</div>
                  <div>Event: {transactionResult.eventId}</div>
                </div>
              </div>
            ) : errorMessage ? (
              <div className="p-3.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" /><span>{errorMessage}</span>
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded">Ready for an inventory-backed sale.</div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 text-sm text-neutral-400">
          This operational flow is not a sales transaction. Its command contract must be supplied by the capability before an operational UI is enabled.
        </div>
      )}
    </div>
  );
};
