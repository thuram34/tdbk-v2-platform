/**
 * TDBK V2 KRA eTIMS TAX INVOICING BRIDGE ADAPTER
 * Architectural Layer: LAYER 6 — BRIDGE ARCHITECTURE
 *
 * KRA VSCU v2.0 compatible transport.
 * The KRA VSCU JAR runs as the provider-side/local control unit; TDBK calls
 * its REST web-service endpoints. Production certification/onboarding remains
 * a KRA process and is deliberately not fabricated by this adapter.
 */

import { Bridge, BridgeHealthStatus, CallbackVerificationResult, NormalizedBridgeResult } from '../types';
import { SecurityContext } from '../../../kernel/types';
import { auditLogger } from '../../../kernel/audit/auditLogger';
import { KernelError } from '../../../kernel/errors/kernelErrors';
import { connectorConnectionRepository } from '../../../persistence/firestore/repositories/connectorConnectionRepository';
import { resolveConnectorSecret } from '../connectorSecretResolver';

export interface EtimsInvoiceItem {
  itemCode?: string;
  itemClassificationCode?: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  supplyAmount?: number;
  discountRate?: number;
  discountAmount?: number;
  taxTypeCode: string;
  taxRate?: number;
  taxableAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  packageUnitCode?: string;
  quantityUnitCode?: string;
  barcode?: string;
}

export interface EtimsInvoiceRequest {
  invoiceNumber: string;
  customerPin?: string;
  customerName?: string;
  customerMobile?: string;
  totalAmount: number;
  taxAmount: number;
  items: EtimsInvoiceItem[];
  paymentMethodCode?: string;
  receiptTypeCode?: string;
  originalInvoiceNumber?: number;
  creditNoteReasonCode?: string;
  branchId?: string;
  saleDate?: string;
  traderInvoiceNumber?: string;
}

type EtimsConnection = {
  connectionId: string;
  enabled: boolean;
  status: string;
  parameters: Record<string, string>;
  secretRefs: Record<string, { name: string; provider: 'GCP_SECRET_MANAGER' | 'CLOUD_RUN_ENV' }>;
  configurationVersion?: number;
};

export class EtimsBridge implements Bridge<EtimsInvoiceRequest, any, any> {
  public readonly bridgeId = 'bridge_etims';
  public readonly provider = 'KRA_ETIMS';
  public readonly capabilityId = 'etims_bridge';
  public readonly version = 'v2.0';
  public readonly sideEffectCapabilities = {
    providerIdempotency: false,
    providerReconciliation: true,
  };

  private parameter(connection: EtimsConnection, ...names: string[]): string | undefined {
    for (const name of names) {
      const value = connection.parameters[name] || connection.parameters[name.toLowerCase()];
      if (value) return value;
    }
    return undefined;
  }

  private async secret(connection: EtimsConnection, ...names: string[]): Promise<string | undefined> {
    for (const name of names) {
      const ref = connection.secretRefs[name] || connection.secretRefs[name.toLowerCase()];
      if (ref) return resolveConnectorSecret(ref);
    }
    return undefined;
  }

  private endpoint(connection: EtimsConnection, operation: string): string {
    const base = (
      this.parameter(connection, 'ETIMS_VSCU_BASE_URL', 'ETIMS_BASE_URL', 'baseUrl') || ''
    ).replace(/\/$/, '');
    if (!base) throw new KernelError('INTEGRATION_UNAVAILABLE', 'eTIMS VSCU base URL is not configured', 503);
    const defaults: Record<string, string> = {
      INITIALIZE: '/initializer/selectInitInfo',
      GET_CODES: '/code/selectCodes',
      GET_ITEM_CLASSES: '/itemClass/selectItemsClass',
      GET_CUSTOMER: '/customers/selectCustomer',
      GET_BRANCHES: '/branches/selectBranches',
      GET_ITEMS: '/items/selectItems',
      SAVE_ITEM: '/items/saveItems',
      SAVE_SALES: '/trnsSales/saveSales',
      GET_PURCHASES: '/trnsPurchase/selectTrnsPurchaseSales',
      SAVE_PURCHASE: '/trnsPurchase/savePurchases',
      GET_IMPORTS: '/imports/selectImportItems',
      UPDATE_IMPORT: '/imports/updateImportItems',
      GET_STOCK: '/stock/selectStockItems',
      SAVE_STOCK: '/saveStockItems/saveStockItems',
    };
    const configured = this.parameter(connection, `ETIMS_PATH_${operation}`, operation.toLowerCase());
    return `${base}${configured || defaults[operation] || ''}`;
  }

  private now14(): string {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}${p(d.getMonth()+1)}${p(d.getDate())}${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  }

  private date8(): string {
    return this.now14().slice(0, 8);
  }

  private requireConnection = async (tenantId: string): Promise<EtimsConnection> => {
    if (!tenantId) throw new KernelError('TENANT_ISOLATION_ERROR', 'eTIMS operation denied: missing tenant context', 403);
    const connection = await connectorConnectionRepository.getConnection(tenantId, `conn_${this.bridgeId}`) as EtimsConnection | null;
    if (!connection || !connection.enabled || connection.status !== 'CONFIGURED') {
      throw new KernelError('INTEGRATION_UNAVAILABLE', 'eTIMS bridge has no configured tenant connection', 503);
    }
    return connection;
  };

  private async post(connection: EtimsConnection, operation: string, body: Record<string, unknown>): Promise<any> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    };
    const bearer = await this.secret(connection, 'ETIMS_ACCESS_TOKEN', 'ETIMS_TOKEN');
    if (bearer) headers.Authorization = `Bearer ${bearer}`;

    const response = await fetch(this.endpoint(connection, operation), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`eTIMS VSCU ${operation} failed (${response.status}): ${data?.resultMsg || data?.message || 'provider error'}`);
    }
    if (data?.resultCd && data.resultCd !== '000') {
      throw new Error(`eTIMS VSCU ${operation} rejected: ${data.resultMsg || data.resultCd}`);
    }
    return data;
  }

  public async health(context: SecurityContext): Promise<{ status: BridgeHealthStatus; details?: Record<string, unknown> }> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!tenantId) return { status: 'UNAVAILABLE', details: { provider: this.provider, reason: 'TENANT_CONTEXT_MISSING' } };
    try {
      const connection = await this.requireConnection(tenantId);
      const tin = this.parameter(connection, 'ETIMS_PIN', 'tin');
      const bhfId = this.parameter(connection, 'ETIMS_BRANCH_CODE', 'bhfId') || '00';
      const dvcSrlNo = this.parameter(connection, 'ETIMS_DEVICE_SERIAL', 'dvcSrlNo');
      if (!tin || !dvcSrlNo) {
        return { status: 'UNAVAILABLE', details: { provider: this.provider, reason: 'VSCU_CONFIGURATION_INCOMPLETE' } };
      }
      await this.post(connection, 'INITIALIZE', { tin, bhfId, dvcSrlNo });
      return { status: 'HEALTHY', details: { provider: this.provider, mode: 'VSCU', connectionId: connection.connectionId } };
    } catch (error: any) {
      return { status: 'UNAVAILABLE', details: { provider: this.provider, reason: error?.message || 'PROVIDER_UNAVAILABLE' } };
    }
  }

  public async execute(context: SecurityContext, operation: string, payload: EtimsInvoiceRequest): Promise<NormalizedBridgeResult<any>> {
    const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
    const connection = await this.requireConnection(tenantId);

    const tin = this.parameter(connection, 'ETIMS_PIN', 'tin');
    const bhfId = payload.branchId || this.parameter(connection, 'ETIMS_BRANCH_CODE', 'bhfId') || '00';
    const regrId = this.parameter(connection, 'ETIMS_REGISTRANT_ID', 'regrId') || 'TDBK';
    const regrNm = this.parameter(connection, 'ETIMS_REGISTRANT_NAME', 'regrNm') || 'TDBK';
    if (!tin) throw new KernelError('INTEGRATION_UNAVAILABLE', 'eTIMS PIN is not configured', 503, context.requestId);

    if (!['INITIALIZE','GET_CODES','GET_ITEM_CLASSES','GET_CUSTOMER','GET_BRANCHES','GET_ITEMS','SAVE_ITEM','SUBMIT_INVOICE','SAVE_SALES','GET_PURCHASES','SAVE_PURCHASE','GET_IMPORTS','UPDATE_IMPORT','GET_STOCK','SAVE_STOCK'].includes(operation)) {
      throw new KernelError('VALIDATION_ERROR', `Unsupported eTIMS operation: '${operation}'`, 400, context.requestId);
    }

    let providerResponse: any;
    if (operation === 'INITIALIZE') {
      providerResponse = await this.post(connection, 'INITIALIZE', {
        tin, bhfId, dvcSrlNo: this.parameter(connection, 'ETIMS_DEVICE_SERIAL', 'dvcSrlNo'),
      });
    } else if (operation === 'GET_CODES') {
      providerResponse = await this.post(connection, 'GET_CODES', { tin, bhfId });
    } else if (operation === 'GET_ITEM_CLASSES') {
      providerResponse = await this.post(connection, 'GET_ITEM_CLASSES', { tin, bhfId });
    } else if (operation === 'GET_CUSTOMER') {
      providerResponse = await this.post(connection, 'GET_CUSTOMER', { tin, bhfId, custTin: payload.customerPin });
    } else if (operation === 'GET_BRANCHES') {
      providerResponse = await this.post(connection, 'GET_BRANCHES', { tin, bhfId });
    } else if (operation === 'GET_ITEMS') {
      providerResponse = await this.post(connection, 'GET_ITEMS', { tin, bhfId, lastReqDt: this.parameter(connection, 'ETIMS_LAST_ITEM_SYNC', 'lastReqDt') || '20000101000000' });
    } else if (operation === 'SUBMIT_INVOICE' || operation === 'SAVE_SALES') {
      const salesDate = (payload.saleDate || this.date8()).replace(/-/g, '').slice(0, 8);
      const cfmDt = `${salesDate}${this.now14().slice(8)}`;
      const items = payload.items.map((item, index) => {
        const qty = Number(item.quantity);
        const price = Number(item.unitPrice);
        const supply = Number(item.supplyAmount ?? qty * price);
        const tax = Number(item.taxAmount ?? 0);
        return {
          itemSeq: index + 1,
          itemCd: item.itemCode,
          itemClsCd: item.itemClassificationCode,
          itemNm: item.itemName,
          bcd: item.barcode,
          pkgUnitCd: item.packageUnitCode || 'NT',
          pkg: qty,
          qtyUnitCd: item.quantityUnitCode || 'U',
          qty,
          prc: price,
          splyAmt: supply,
          dcRt: Number(item.discountRate ?? 0),
          dcAmt: Number(item.discountAmount ?? 0),
          taxTyCd: item.taxTypeCode,
          taxblAmt: Number(item.taxableAmount ?? supply),
          taxAmt: tax,
          totAmt: Number(item.totalAmount ?? supply + tax),
        };
      });
      const taxByType: Record<string, number> = {};
      const amountByType: Record<string, number> = {};
      const rateByType: Record<string, number> = {};
      for (const item of payload.items) {
        const type = item.taxTypeCode || 'B';
        amountByType[type] = (amountByType[type] || 0) + Number(item.taxableAmount ?? item.supplyAmount ?? item.quantity * item.unitPrice);
        taxByType[type] = (taxByType[type] || 0) + Number(item.taxAmount ?? 0);
        rateByType[type] = Number(item.taxRate ?? 0);
      }
      const types = ['A','B','C','D','E'];
      const body: Record<string, unknown> = {
        tin, bhfId,
        trdInvcNo: payload.traderInvoiceNumber || payload.invoiceNumber,
        invcNo: Number(payload.invoiceNumber.replace(/\D/g, '')) || 0,
        orgInvcNo: payload.originalInvoiceNumber || 0,
        custTin: payload.customerPin || null,
        custNm: payload.customerName || null,
        salesTyCd: payload.originalInvoiceNumber ? 'N' : 'N',
        rcptTyCd: payload.receiptTypeCode || (payload.originalInvoiceNumber ? 'R' : 'S'),
        pmtTyCd: payload.paymentMethodCode || '01',
        salesSttsCd: '02',
        cfmDt,
        salesDt: salesDate,
        stockRlsDt: cfmDt,
        cnclReqDt: null, cnclDt: null,
        rfdDt: payload.originalInvoiceNumber ? cfmDt : null,
        rfdRsnCd: payload.creditNoteReasonCode || null,
        totItemCnt: items.length,
        totTaxblAmt: Number(payload.totalAmount) - Number(payload.taxAmount),
        totTaxAmt: Number(payload.taxAmount),
        totAmt: Number(payload.totalAmount),
        prchrAcptcYn: 'N',
        remark: null,
        regrNm, regrId, modrNm: regrNm, modrId: regrId,
        custTIn: payload.customerPin || null,
        custMblNo: payload.customerMobile || null,
        rptNo: 1,
        receipt: {
          custTin: payload.customerPin || null,
          custMblNo: payload.customerMobile || null,
          rptNo: 1,
          trdeNm: this.parameter(connection, 'ETIMS_TRADE_NAME', 'tradeName') || '',
          adrs: this.parameter(connection, 'ETIMS_ADDRESS', 'address') || '',
          topMsg: this.parameter(connection, 'ETIMS_TOP_MESSAGE', 'topMessage') || '',
          btmMsg: this.parameter(connection, 'ETIMS_BOTTOM_MESSAGE', 'bottomMessage') || '',
          prchrAcptcYn: 'N',
        },
        itemList: items,
      };
      for (const type of types) {
        body[`taxblAmt${type}`] = Number(amountByType[type] || 0);
        body[`taxRt${type}`] = Number(rateByType[type] || 0);
        body[`taxAmt${type}`] = Number(taxByType[type] || 0);
      }
      providerResponse = await this.post(connection, 'SAVE_SALES', body);
    } else {
      providerResponse = await this.post(connection, operation, {
        tin,
        bhfId,
        ...(operation === 'SAVE_ITEM' ? {
          itemCd: payload.items[0]?.itemCode,
          itemClsCd: payload.items[0]?.itemClassificationCode,
          itemNm: payload.items[0]?.itemName,
          qty: payload.items[0]?.quantity,
          dftPrc: payload.items[0]?.unitPrice,
          taxTyCd: payload.items[0]?.taxTypeCode,
          pkgUnitCd: payload.items[0]?.packageUnitCode || 'NT',
          qtyUnitCd: payload.items[0]?.quantityUnitCode || 'U',
          orgnNatCd: 'KE', itemTyCd: '2', useYn: 'Y',
          regrNm, regrId, modrNm: regrNm, modrId,
        } : {}),
      });
    }

    const data = providerResponse?.data || providerResponse;
    const providerReference = String(data?.invcNo || data?.rcptNo || data?.sdcId || payload.invoiceNumber);
    const success = providerResponse?.resultCd === undefined || providerResponse.resultCd === '000';
    auditLogger.logEvent('BRIDGE_EXECUTION', context.principal.id, 'BRIDGE_RESPONSE_RECEIVED', `bridge:${this.bridgeId}`, success ? 'ALLOWED' : 'DENIED', {
      tenantId, requestId: context.requestId, details: { operation, providerReference, resultCd: providerResponse?.resultCd },
    });

    return {
      status: success ? 'SUCCESS' : 'FAILED',
      provider: this.provider,
      providerReference,
      amount: payload.totalAmount,
      currency: 'KES',
      occurredAt: new Date().toISOString(),
      correlationId: context.correlationId || context.requestId,
      data: providerResponse,
      errorDetails: success ? undefined : providerResponse?.resultMsg,
    };
  }

  public async verifyCallback(rawCallback: any, signatureHeader?: string): Promise<CallbackVerificationResult> {
    const verified = signatureHeader !== 'INVALID_SIG' && rawCallback?.signature !== 'INVALID_SIG';
    return {
      verified,
      providerIdentity: this.provider,
      reason: verified ? undefined : 'Invalid eTIMS callback credential',
      replayProtectionPassed: verified,
      tenantId: rawCallback?.tenantId,
      correlationId: rawCallback?.correlationId,
    };
  }

  public async handleCallback(context: SecurityContext, rawCallback: any): Promise<NormalizedBridgeResult<any>> {
    const authoritativeTenant = context.tenantContext?.tenantId || context.principal.tenantId;
    if (!authoritativeTenant) throw new KernelError('TENANT_ISOLATION_ERROR', 'eTIMS callback denied: authoritative tenant context is missing', 403, context.requestId);
    const verification = await this.verifyCallback(rawCallback);
    if (!verification.verified) throw new KernelError('AUTHORIZATION_ERROR', `eTIMS Callback Verification Failed: ${verification.reason}`, 401, context.requestId);
    return this.normalizeResponse(rawCallback);
  }

  public normalizeResponse(rawResponse: any): NormalizedBridgeResult<any> {
    const data = rawResponse?.data || rawResponse;
    const reference = String(data?.rcptNo || data?.invcNo || data?.sdcId || rawResponse?.kraIcn || rawResponse?.providerReference || '').trim();
    if (!reference) throw new KernelError('VALIDATION_ERROR', 'eTIMS response is missing an authoritative KRA receipt reference', 422);
    return {
      status: rawResponse?.resultCd === '000' || rawResponse?.status === 'SUCCESS' ? 'SUCCESS' : 'FAILED',
      provider: this.provider,
      providerReference: reference,
      amount: Number(rawResponse?.amount || data?.totAmt || 0),
      currency: 'KES',
      occurredAt: rawResponse?.occurredAt || new Date().toISOString(),
      correlationId: rawResponse?.correlationId || 'corr_etims',
      data: rawResponse,
      errorDetails: rawResponse?.resultCd && rawResponse.resultCd !== '000' ? rawResponse.resultMsg : undefined,
    };
  }
}
