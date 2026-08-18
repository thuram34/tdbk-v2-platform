import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Upload, 
  Sparkles, 
  Bot, 
  ShieldCheck, 
  ShieldAlert, 
  CheckCircle, 
  XCircle, 
  RefreshCw, 
  Eye, 
  Check, 
  X, 
  AlertTriangle,
  Layers,
  Send,
  Lock
} from 'lucide-react';
import { DocumentMetadata, AiProposedAction, AiConversationMessage } from '../../document_ai/types';

export const DocumentAiShellPanel: React.FC<{ tenantId?: string }> = ({ tenantId = 'tenant_school_01' }) => {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [proposals, setProposals] = useState<AiProposedAction[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocumentMetadata | null>(null);
  const [chatMessages, setChatMessages] = useState<AiConversationMessage[]>([]);
  const [promptInput, setPromptInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [injectionFlagged, setInjectionFlagged] = useState(false);

  // Form input for quick sample upload
  const [sampleType, setSampleType] = useState<'invoice' | 'waybill' | 'student'>('invoice');

  const sampleTexts = {
    invoice: `TAX INVOICE
Invoice No: INV-2026-904
Total Amount: KES 85,000
PIN: P051982736Z
Customer: Apex Hardware & Timber Ltd
Date: 2026-04-15
Line Items:
1. Hardwood Timber Planks (50 pcs) @ KES 1,000 = KES 50,000
2. High-tensile steel roofing nails (35 kgs) @ KES 1,000 = KES 35,000`,

    waybill: `CONSIGNMENT DISPATCH WAYBILL
Waybill Number: WB-KE-88192
Consignor: Nairobi Commercial Mills
Consignee: Eldoret Central Depot
Weight: 4,500 KG
Transport Vehicle: KDF 492X
Status: IN_TRANSIT`,

    student: `STUDENT ADMISSION ENROLLMENT FORM
Admission Number: ADM-2026-883
Student Full Name: Grace Wanjiku Ndung'u
Grade Level: Grade 8
Campus: Westlands Junior Campus
Enrollment Term: Term 1 2026`,
  };

  const loadData = async () => {
    try {
      const docRes = await fetch(`/api/documents/${tenantId}`);
      if (docRes.ok) {
        const dData = await docRes.json();
        setDocuments(dData.documents || []);
      }

      const propRes = await fetch(`/api/ai/proposals/${tenantId}`);
      if (propRes.ok) {
        const pData = await propRes.json();
        setProposals(pData.proposals || []);
      }

      const chatRes = await fetch(`/api/ai/conversation/${tenantId}`);
      if (chatRes.ok) {
        const cData = await chatRes.json();
        setChatMessages(cData.conversation?.messages || []);
      }
    } catch (err) {
      console.error('Failed to load Document AI data', err);
    }
  };

  useEffect(() => {
    loadData();
  }, [tenantId]);

  const handleUploadSample = async () => {
    setIsUploading(true);
    try {
      const fileName = `${sampleType}_${Date.now()}.pdf`;
      const res = await fetch('/api/documents/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId,
          branchId: `${tenantId}_hq`,
          fileName,
          mimeType: 'application/pdf',
          textContent: sampleTexts[sampleType],
          source: 'MANUAL_UPLOAD',
        }),
      });
      if (res.ok) {
        await loadData();
      }
    } finally {
      setIsUploading(false);
    }
  };

  const handleProcessDocument = async (docId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/documents/${tenantId}/${docId}/process`, { method: 'POST' });
      if (res.ok) {
        await loadData();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApproveProposal = async (proposalId: string) => {
    try {
      const res = await fetch(`/api/ai/proposals/${tenantId}/${proposalId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to approve proposal', err);
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      const res = await fetch(`/api/ai/proposals/${tenantId}/${proposalId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual reviewer rejected proposal' }),
      });
      if (res.ok) {
        await loadData();
      }
    } catch (err) {
      console.error('Failed to reject proposal', err);
    }
  };

  const handleSendChatMessage = async () => {
    if (!promptInput.trim()) return;
    const msg = promptInput;
    setPromptInput('');
    setInjectionFlagged(false);

    try {
      const res = await fetch(`/api/ai/conversation/${tenantId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, branchId: `${tenantId}_hq` }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.isFlagged) {
          setInjectionFlagged(true);
        }
        await loadData();
      }
    } catch (err) {
      console.error('Failed to send AI message', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Overview Banner */}
      <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-lg">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Bot className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Document Ingestion & AI Authority Workspace</h2>
            </div>
            <p className="text-xs text-neutral-400">
              Authoritative document vault with SHA-256 integrity, structured OCR extraction, and human-in-the-loop AI proposals.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={sampleType}
              onChange={(e) => setSampleType(e.target.value as any)}
              className="bg-neutral-950 border border-neutral-800 text-xs text-white px-3 py-1.5 rounded focus:outline-none"
            >
              <option value="invoice">Sample Tax Invoice</option>
              <option value="waybill">Sample Waybill</option>
              <option value="student">Sample Admission Form</option>
            </select>
            <button
              onClick={handleUploadSample}
              disabled={isUploading}
              className="flex items-center space-x-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition disabled:opacity-50 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isUploading ? 'Uploading...' : 'Ingest Document'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* LEFT COLUMN: Document Vault & Extraction (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Document Ingestion Vault */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center space-x-2">
                <FileText className="w-4 h-4 text-neutral-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Document Ingestion Vault</h3>
              </div>
              <span className="text-[11px] font-mono text-neutral-500">{documents.length} Records</span>
            </div>

            {documents.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 font-mono">
                No documents in vault. Click "Ingest Document" above to upload.
              </div>
            ) : (
              <div className="divide-y divide-neutral-800 max-h-72 overflow-y-auto pr-1">
                {documents.map((doc) => (
                  <div key={doc.documentId} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs font-semibold text-white truncate">{doc.fileName}</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-neutral-950 text-neutral-400 border border-neutral-800 rounded">
                          {doc.documentType}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-neutral-500 truncate">
                        Hash: {doc.checksum.substring(0, 16)}... | Status: <span className="text-emerald-400 font-semibold">{doc.status}</span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 shrink-0">
                      <button
                        onClick={() => handleProcessDocument(doc.documentId)}
                        disabled={isProcessing}
                        className="text-[11px] bg-neutral-800 hover:bg-neutral-700 text-white font-mono px-2.5 py-1 rounded transition cursor-pointer"
                      >
                        Extract Data
                      </button>
                      <button
                        onClick={() => setSelectedDoc(doc)}
                        className="p-1 hover:bg-neutral-800 text-neutral-400 hover:text-white rounded transition cursor-pointer"
                        title="View Metadata"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* AI Proposals Review Queue */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2">
              <div className="flex items-center space-x-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">AI Proposals Review Gate</h3>
              </div>
              <span className="text-[10px] bg-indigo-950 text-indigo-400 border border-indigo-900/60 font-mono px-2 py-0.5 rounded">
                Human Authorization Mandatory
              </span>
            </div>

            {proposals.length === 0 ? (
              <div className="p-6 text-center text-xs text-neutral-500 font-mono">
                No active proposals pending review.
              </div>
            ) : (
              <div className="space-y-3">
                {proposals.map((prop) => (
                  <div key={prop.proposalId} className="p-3 bg-neutral-950 border border-neutral-800 rounded space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center space-x-2">
                          <span className="text-xs font-bold text-white font-mono">{prop.proposalType}</span>
                          <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                            prop.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                            prop.status === 'REJECTED' ? 'bg-red-950 text-red-400 border border-red-800' :
                            'bg-amber-950 text-amber-400 border border-amber-800'
                          }`}>
                            {prop.status}
                          </span>
                        </div>
                        <p className="text-xs text-neutral-300 mt-1">{prop.summary}</p>
                      </div>

                      <div className="text-[11px] font-mono text-emerald-400 font-bold shrink-0">
                        {Math.round(prop.confidence * 100)}% Conf
                      </div>
                    </div>

                    <div className="text-[11px] font-mono bg-neutral-900 p-2 rounded text-neutral-300 overflow-x-auto">
                      {JSON.stringify(prop.suggestedPayload, null, 2)}
                    </div>

                    {prop.status === 'PENDING_REVIEW' && (
                      <div className="flex items-center justify-end space-x-2 pt-1">
                        <button
                          onClick={() => handleRejectProposal(prop.proposalId)}
                          className="flex items-center space-x-1 text-xs bg-red-950/60 hover:bg-red-900/80 text-red-400 border border-red-900/60 px-3 py-1 rounded transition cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Reject</span>
                        </button>
                        <button
                          onClick={() => handleApproveProposal(prop.proposalId)}
                          className="flex items-center space-x-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-3 py-1 rounded transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Approve & Execute</span>
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: AI Tenant Assistant & Security Boundaries (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Conversational Assistant */}
          <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-4 flex flex-col h-[480px]">
            <div className="flex items-center justify-between border-b border-neutral-800 pb-2 mb-3">
              <div className="flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h3 className="text-xs font-bold text-white uppercase tracking-wider">Tenant AI Copilot</h3>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-900/60">
                Tenant-Isolated
              </span>
            </div>

            {/* Chat message thread */}
            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 font-sans text-xs">
              {chatMessages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-neutral-500 text-center font-mono p-4">
                  Ask questions regarding tenant documents, fee payments, or workflow proposals.
                </div>
              ) : (
                chatMessages.map((m) => (
                  <div
                    key={m.id}
                    className={`p-2.5 rounded max-w-[90%] space-y-1 ${
                      m.sender === 'USER'
                        ? 'ml-auto bg-indigo-950/80 text-white border border-indigo-900/60'
                        : 'bg-neutral-950 text-neutral-200 border border-neutral-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[10px] text-neutral-400 font-mono">
                      <span>{m.sender === 'USER' ? 'Authorized User' : 'DBK Assistant'}</span>
                      <span>{new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <p className="text-xs leading-relaxed whitespace-pre-wrap">{m.text}</p>
                    {m.untrustedWarning && (
                      <div className="flex items-center space-x-1 text-[10px] text-amber-400 font-mono mt-1 pt-1 border-t border-amber-900/40">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Prompt injection neutralized</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Prompt Injection Warning Alert */}
            {injectionFlagged && (
              <div className="my-2 p-2 bg-amber-950/40 border border-amber-900/60 rounded flex items-center space-x-2 text-[11px] text-amber-400 font-mono">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>Untrusted prompt injection pattern neutralized by Security Guard.</span>
              </div>
            )}

            {/* Input Bar */}
            <div className="mt-3 pt-2 border-t border-neutral-800 flex items-center space-x-2">
              <input
                type="text"
                placeholder="Ask assistant or test injection..."
                value={promptInput}
                onChange={(e) => setPromptInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSendChatMessage()}
                className="flex-1 bg-neutral-950 border border-neutral-800 text-xs text-white px-3 py-2 rounded focus:outline-none focus:border-indigo-500 font-mono"
              />
              <button
                onClick={handleSendChatMessage}
                className="bg-indigo-600 hover:bg-indigo-500 text-white p-2 rounded transition cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
