import React, { useState } from 'react';
import { DbkExperienceResolved } from '../../experience/types';
import { ShoppingCart, Smartphone, CheckCircle, RefreshCw, Send, AlertCircle } from 'lucide-react';

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
  const [phoneNumber, setPhoneNumber] = useState('+254712345678');
  const [amount, setAmount] = useState('1500');
  const [reference, setReference] = useState('INV-2026-004');
  const [isProcessing, setIsProcessing] = useState(false);
  const [transactionResult, setTransactionResult] = useState<any>(null);

  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    setTransactionResult(null);

    try {
      const res = await onDispatchCommand('INVOKE_ACTION', {
        actionName: `EXECUTE_${capabilityId.toUpperCase()}`,
        payload: { phoneNumber, amount, reference },
      });

      const result = res?.result || {};
      const succeeded = res?.success === true;
      setTransactionResult({
        status: succeeded ? 'SUCCESS' : 'FAILED',
        message: succeeded
          ? 'Command accepted by the TDBK runtime.'
          : (res?.error?.message || 'Command was not accepted'),
        providerReference: result.providerReference || result.receipt || result.transactionId,
        amount,
        reference,
        timestamp: res?.serverTimestamp || new Date().toISOString(),
      });
    } catch {
      setTransactionResult({ status: 'FAILED', message: 'Transaction could not be authorized' });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
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
          High-throughput transactional flow connected directly to TDBK Kernel Authorization and Audit Log.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Terminal Form */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5 md:col-span-2">
          <h2 className="text-sm font-bold text-white mb-4 flex items-center space-x-2">
            <Smartphone className="w-4 h-4 text-emerald-400" />
            <span>M-Pesa STK Push / Instant Settlement</span>
          </h2>

          <form onSubmit={handleCheckout} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  Customer M-Pesa Phone Number
                </label>
                <input
                  type="text"
                  required
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                  Amount to Bill (KES)
                </label>
                <input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs font-mono font-bold text-emerald-400 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-mono text-neutral-400 mb-1">
                Account / Invoice Reference
              </label>
              <input
                type="text"
                required
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <button
              type="submit"
              disabled={isProcessing}
              className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded transition flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Authorizing via TDBK Kernel & Daraja Gateway...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Trigger Instant M-Pesa STK Push (KES {Number(amount).toLocaleString()})</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Transaction Summary Panel */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-5">
          <h3 className="text-xs font-bold text-neutral-300 uppercase tracking-wider font-mono mb-3">
            Transaction Status
          </h3>

          {transactionResult ? (
            <div className="space-y-3">
              <div className="p-3.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs">
                <div className="flex items-center space-x-1.5 font-bold">
                  <CheckCircle className="w-4 h-4" />
                  <span>{transactionResult.status === 'SUCCESS' ? 'Command Accepted' : 'Command Failed'}</span>
                </div>
                <div className="mt-2 space-y-1 font-mono text-[11px]">
                  {transactionResult.providerReference && <div>Provider Ref: {transactionResult.providerReference}</div>}
                  <div>Status: {transactionResult.message}</div>
                  <div>Amount: KES {transactionResult.amount}</div>
                  <div>Ref: {transactionResult.reference}</div>
                  <div>Time: {transactionResult.timestamp}</div>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-neutral-500 border border-dashed border-neutral-800 rounded">
              Ready for counter checkout. Emits authoritative commands to server.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
