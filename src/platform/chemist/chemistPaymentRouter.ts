import { createHash, randomBytes } from "node:crypto";
import { Router, Request, Response } from "express";
import { securityContextFactory } from "../kernel/context/contextFactory";
import { KernelError } from "../kernel/errors/kernelErrors";
import { tenantIsolation } from "../kernel/tenancy/tenantIsolation";
import { bridgeRegistry } from "../orchestration/bridge/registry";
import { MpesaRawCallback, MpesaSTKPushRequest } from "../orchestration/bridge/adapters/mpesaBridge";
import { firestoreClient } from "../persistence/firestore/firestoreClient";
import { SecurityContext } from "../kernel/types";

type ChemistSale = {
  saleId: string;
  tenantId: string;
  branchId: string;
  totalMinor: number;
  status: "OPEN" | "COMPLETED" | "CANCELLED";
  paymentStatus: "UNPAID" | "PENDING" | "PAID" | "FAILED" | "REQUIRES_RECONCILIATION";
  createdAt?: string;
  paidAt?: string | null;
  lines?: Array<{ productId: string; name: string; sku: string; quantity: number; unitPriceMinor: number; lineTotalMinor: number; batch: string; expiry: string }>;
};
type ChemistProduct = {
  productId: string; tenantId: string; branchId: string; sku: string; name: string;
  category: string; barcode?: string; priceMinor: number; costMinor: number;
  stock: number; reserved?: number; reorderLevel: number; batch: string; expiry: string;
  status: "active" | "quarantined"; updatedAt?: string;
};

type ChemistPayment = {
  paymentId: string;
  tenantId: string;
  branchId: string;
  saleId: string;
  amountMinor: number;
  amountKes: number;
  currency: "KES";
  method: "MPESA";
  status: "PENDING" | "PAID" | "FAILED" | "REQUIRES_RECONCILIATION";
  providerReference: string | null;
  receiptNumber: string | null;
  paidAmountKes?: number | null;
  payerPhone?: string | null;
  providerResultCode?: number | null;
  providerResultDescription?: string | null;
  paidAt?: string | null;
  callbackTokenHash: string;
  createdAt: string;
  updatedAt: string;
};

const router = Router();
const safeId = /^[A-Za-z0-9_-]{3,160}$/;
const salePath = (tenantId: string, saleId: string) => `/tenants/${tenantId}/chemistSales/${saleId}`;
const paymentPath = (tenantId: string, paymentId: string) => `/tenants/${tenantId}/chemistPayments/${paymentId}`;
const callbackTokenPath = (hash: string) => `/system/chemistMpesaCallbacks/${hash}`;
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

function apiError(res: Response, error: unknown): Response {
  if (error instanceof KernelError) return res.status(error.statusCode).json(error.toJSON());
  return res.status(500).json({ error: { code: "INTERNAL_ERROR", message: "Chemist payment operation failed." } });
}

function tenantAndBranch(context: SecurityContext): { tenantId: string; branchId: string } {
  const tenantId = context.tenantContext?.tenantId || context.principal.tenantId;
  const branchId = context.branchContext?.branchId || context.principal.branchId;
  if (!tenantId || !branchId) {
    throw new KernelError("TENANT_ISOLATION_ERROR", "Chemist payment requires an authorized tenant and branch.", 403, context.requestId);
  }
  return { tenantId, branchId };
}


router.get("/api/chemist/products", async (req: Request, res: Response) => {
  try {
    const tenantIdInput = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    const branchIdInput = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const context = await securityContextFactory.createSecurityContext({
      authHeader: req.headers.authorization, targetTenantId: tenantIdInput,
      targetBranchId: branchIdInput, ipAddress: req.ip, userAgent: req.headers["user-agent"],
    });
    const { tenantId, branchId } = tenantAndBranch(context);
    const products = await firestoreClient.listCollection<ChemistProduct>(`/tenants/${tenantId}/chemistProducts`);
    return res.json({
      status: "SUCCESS",
      products: products.filter(p => p.tenantId === tenantId && p.branchId === branchId),
    });
  } catch (error) { return apiError(res, error); }
});

router.post("/api/chemist/products", async (req: Request, res: Response) => {
  try {
    const { tenantId: tenantIdInput, branchId: branchIdInput } = req.body || {};
    const context = await securityContextFactory.createSecurityContext({
      authHeader: req.headers.authorization,
      targetTenantId: typeof tenantIdInput === "string" ? tenantIdInput : undefined,
      targetBranchId: typeof branchIdInput === "string" ? branchIdInput : undefined,
      ipAddress: req.ip, userAgent: req.headers["user-agent"],
    });
    const { tenantId, branchId } = tenantAndBranch(context);
    const canManageInventory = context.principal.isMaster ||
      context.principal.roles.some(role => ["BUSINESS_OWNER", "TENANT_ADMIN", "PHARMACY_MANAGER", "SYSTEM_ADMIN"].includes(role)) ||
      context.principal.permissions.includes("chemist:inventory:write");
    if (!canManageInventory) return res.status(403).json({ error: { code: "AUTHORIZATION_ERROR", message: "Inventory management permission is required." } });
    const body = req.body || {};
    const sku = typeof body.sku === "string" ? body.sku.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const batch = typeof body.batch === "string" ? body.batch.trim() : "";
    const expiry = typeof body.expiry === "string" ? body.expiry : "";
    const priceMinor = body.priceMinor;
    const costMinor = body.costMinor;
    const stock = body.stock;
    const reorderLevel = body.reorderLevel;
    if (!sku || !name || !batch || !/^\d{4}-\d{2}-\d{2}$/.test(expiry) ||
        !Number.isSafeInteger(priceMinor) || priceMinor < 0 ||
        !Number.isSafeInteger(costMinor) || costMinor < 0 ||
        !Number.isSafeInteger(stock) || stock < 0 ||
        !Number.isSafeInteger(reorderLevel) || reorderLevel < 0) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Valid SKU, name, batch, expiry, price, cost, stock and reorder level are required." } });
    }
    const existing = await firestoreClient.listCollection<ChemistProduct>(`/tenants/${tenantId}/chemistProducts`);
    if (existing.some(p => p.tenantId === tenantId && p.branchId === branchId && p.sku.toLowerCase() === sku.toLowerCase())) {
      return res.status(409).json({ error: { code: "SKU_EXISTS", message: "That SKU already exists in this branch." } });
    }
    const productId = `chem_prod_${randomBytes(12).toString("hex")}`;
    const product: ChemistProduct = {
      productId, tenantId, branchId, sku, name,
      category: typeof body.category === "string" && body.category.trim() ? body.category.trim() : "General",
      barcode: typeof body.barcode === "string" ? body.barcode.trim() : "",
      priceMinor, costMinor, stock, reserved: 0, reorderLevel, batch, expiry,
      status: body.status === "quarantined" ? "quarantined" : "active",
      updatedAt: new Date().toISOString(),
    };
    await firestoreClient.set(`/tenants/${tenantId}/chemistProducts/${productId}`, product);
    return res.status(201).json({ status: "SUCCESS", product });
  } catch (error) { return apiError(res, error); }
});

router.post("/api/chemist/sales", async (req: Request, res: Response) => {
  try {
    const { tenantId: tenantIdInput, branchId: branchIdInput } = req.body || {};
    const context = await securityContextFactory.createSecurityContext({
      authHeader: req.headers.authorization,
      targetTenantId: typeof tenantIdInput === "string" ? tenantIdInput : undefined,
      targetBranchId: typeof branchIdInput === "string" ? branchIdInput : undefined,
      ipAddress: req.ip, userAgent: req.headers["user-agent"],
    });
    const { tenantId, branchId } = tenantAndBranch(context);
    const requestedLines = req.body?.items;
    if (!Array.isArray(requestedLines) || requestedLines.length < 1 || requestedLines.length > 100) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "A sale must contain between 1 and 100 line items." } });
    }
    const quantities = new Map<string, number>();
    for (const line of requestedLines) {
      if (!line || typeof line.productId !== "string" || !safeId.test(line.productId) ||
          !Number.isSafeInteger(line.quantity) || line.quantity < 1 || line.quantity > 10000) {
        return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Each sale item requires a valid productId and positive integer quantity." } });
      }
      quantities.set(line.productId, (quantities.get(line.productId) || 0) + line.quantity);
    }
    const saleId = `chem_sale_${randomBytes(12).toString("hex")}`;
    const now = new Date().toISOString();
    const pathByProduct = (id: string) => `/tenants/${tenantId}/chemistProducts/${id}`;
    let sale: ChemistSale | null = null;
    await firestoreClient.runTransaction(async (tx) => {
      const products = new Map<string, ChemistProduct>();
      // All transaction reads happen before the first write.
      for (const productId of quantities.keys()) {
        const product = await tx.get<ChemistProduct>(pathByProduct(productId));
        if (!product || product.tenantId !== tenantId || product.branchId !== branchId) {
          throw new KernelError("NOT_FOUND", "One or more products were not found in the authorized branch.", 404, context.requestId);
        }
        if (product.status !== "active" || product.expiry < now.slice(0, 10)) {
          throw new KernelError("VALIDATION_ERROR", `Product ${product.sku} is quarantined or expired and cannot be sold.`, 422, context.requestId);
        }
        const quantity = quantities.get(productId)!;
        const available = product.stock - (product.reserved || 0);
        if (available < quantity) {
          throw new KernelError("CONFLICT", `Insufficient available stock for ${product.name}.`, 409, context.requestId);
        }
        products.set(productId, product);
      }
      const lines = [...quantities.entries()].map(([productId, quantity]) => {
        const product = products.get(productId)!;
        return {
          productId, name: product.name, sku: product.sku, quantity,
          unitPriceMinor: product.priceMinor, lineTotalMinor: product.priceMinor * quantity,
          batch: product.batch, expiry: product.expiry,
        };
      });
      const totalMinor = lines.reduce((sum, line) => sum + line.lineTotalMinor, 0);
      if (!Number.isSafeInteger(totalMinor) || totalMinor < 100 || totalMinor % 100 !== 0) {
        throw new KernelError("VALIDATION_ERROR", "Sale total must be a valid whole-KSh amount of at least KSh 1 for this checkout.", 422, context.requestId);
      }
      sale = {
        saleId, tenantId, branchId, totalMinor, status: "OPEN", paymentStatus: "UNPAID",
        lines, createdAt: now, paidAt: null,
      };
      for (const [productId, quantity] of quantities.entries()) {
        const product = products.get(productId)!;
        await tx.update(pathByProduct(productId), { reserved: (product.reserved || 0) + quantity, updatedAt: now });
      }
      await tx.set(salePath(tenantId, saleId), sale);
    });
    return res.status(201).json({ status: "SUCCESS", sale });
  } catch (error) { return apiError(res, error); }
});

router.post("/api/chemist/sales/:saleId/cancel", async (req: Request, res: Response) => {
  try {
    const { tenantId: tenantIdInput, branchId: branchIdInput } = req.body || {};
    const context = await securityContextFactory.createSecurityContext({
      authHeader: req.headers.authorization,
      targetTenantId: typeof tenantIdInput === "string" ? tenantIdInput : undefined,
      targetBranchId: typeof branchIdInput === "string" ? branchIdInput : undefined,
      ipAddress: req.ip, userAgent: req.headers["user-agent"],
    });
    const { tenantId, branchId } = tenantAndBranch(context);
    const saleId = req.params.saleId;
    if (!safeId.test(saleId)) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid sale reference." } });
    await firestoreClient.runTransaction(async (tx) => {
      const sale = await tx.get<ChemistSale>(salePath(tenantId, saleId));
      if (!sale || sale.tenantId !== tenantId || sale.branchId !== branchId) throw new KernelError("NOT_FOUND", "Sale not found in the authorized branch.", 404, context.requestId);
      if (sale.status !== "OPEN" || sale.paymentStatus === "PENDING" || sale.paymentStatus === "REQUIRES_RECONCILIATION") {
        throw new KernelError("CONFLICT", "A pending or uncertain payment must be reconciled before this sale can be cancelled.", 409, context.requestId);
      }
      const productRecords = new Map<string, ChemistProduct>();
      for (const line of sale.lines || []) {
        const product = await tx.get<ChemistProduct>(`/tenants/${tenantId}/chemistProducts/${line.productId}`);
        if (product) productRecords.set(line.productId, product);
      }
      const now = new Date().toISOString();
      for (const line of sale.lines || []) {
        const product = productRecords.get(line.productId);
        if (product) await tx.update(`/tenants/${tenantId}/chemistProducts/${line.productId}`, {
          reserved: Math.max(0, (product.reserved || 0) - line.quantity), updatedAt: now,
        });
      }
      await tx.update(salePath(tenantId, saleId), { status: "CANCELLED", paymentStatus: "FAILED" });
    });
    return res.json({ status: "SUCCESS", saleId, saleStatus: "CANCELLED" });
  } catch (error) { return apiError(res, error); }
});

router.post("/api/chemist/payments/mpesa/stk-push", async (req: Request, res: Response) => {
  let payment: ChemistPayment | null = null;
  let tokenHashValue = "";
  try {
    const tenantIdInput = typeof req.body?.tenantId === "string" ? req.body.tenantId : "";
    const branchIdInput = typeof req.body?.branchId === "string" ? req.body.branchId : "";
    const saleId = typeof req.body?.saleId === "string" ? req.body.saleId : "";
    const phoneNumber = typeof req.body?.phoneNumber === "string" ? req.body.phoneNumber : "";
    if (!safeId.test(saleId) || !tenantIdInput || !branchIdInput || !phoneNumber) {
      return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "tenantId, branchId, saleId and phoneNumber are required." } });
    }

    const context = await securityContextFactory.createSecurityContext({
      authHeader: req.headers.authorization,
      targetTenantId: tenantIdInput,
      targetBranchId: branchIdInput,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    const { tenantId, branchId } = tenantAndBranch(context);
    if (tenantId !== tenantIdInput || branchId !== branchIdInput) {
      return res.status(403).json({ error: { code: "TENANT_ISOLATION_ERROR", message: "Requested tenant or branch does not match the authorized workspace." } });
    }

    const sale = await firestoreClient.get<ChemistSale>(salePath(tenantId, saleId));
    if (!sale || sale.saleId !== saleId || sale.tenantId !== tenantId || sale.branchId !== branchId) {
      return res.status(404).json({ error: { code: "SALE_NOT_FOUND", message: "The sale was not found in the authorized branch." } });
    }
    if (sale.status !== "OPEN" || !["UNPAID", "PENDING", "FAILED", "REQUIRES_RECONCILIATION"].includes(sale.paymentStatus)) {
      return res.status(409).json({ error: { code: "SALE_NOT_PAYABLE", message: "This sale is not open for M-Pesa payment." } });
    }
    if (!Number.isSafeInteger(sale.totalMinor) || sale.totalMinor < 100 || sale.totalMinor % 100 !== 0) {
      return res.status(422).json({ error: { code: "INVALID_SALE_TOTAL", message: "Sale total must be at least KSh 1 and represent whole Kenyan shillings for STK Push." } });
    }

    // A single durable payment slot per sale prevents repeated clicks from creating
    // multiple STK prompts. A previous ambiguous attempt must be reconciled, not replayed.
    const slotPath = `/tenants/${tenantId}/chemistPaymentBySale/${saleId}`;
    const existingSlot = await firestoreClient.get<{ paymentId: string; status: string }>(slotPath);
    if (existingSlot) {
      const existing = await firestoreClient.get<ChemistPayment>(paymentPath(tenantId, existingSlot.paymentId));
      if (existing && ["PENDING", "REQUIRES_RECONCILIATION", "PAID"].includes(existing.status)) {
        return res.status(200).json({
          paymentId: existing.paymentId,
          status: existing.status,
          providerReference: existing.providerReference || "AWAITING_PROVIDER_REFERENCE",
          customerMessage: existing.status === "PAID" ? "Payment already confirmed." : "An attempt already exists; check its status before retrying.",
        });
      }
    }

    const publicBase = process.env.TDBK_PUBLIC_API_BASE_URL?.replace(/\/$/, "");
    if (process.env.NODE_ENV === "production" && (!publicBase || !publicBase.startsWith("https://"))) {
      return res.status(503).json({ error: { code: "PAYMENT_CALLBACK_NOT_CONFIGURED", message: "A public HTTPS TDBK callback URL must be configured before accepting live payments." } });
    }
    if (process.env.NODE_ENV === "production" && process.env.TDBK_ALLOW_LIVE_MPESA !== "true") {
      return res.status(503).json({ error: { code: "LIVE_MPESA_DISABLED", message: "Live M-Pesa is disabled until the production payment release gate is approved." } });
    }

    const paymentId = `chem_mpesa_${randomBytes(12).toString("hex")}`;
    const callbackToken = randomBytes(32).toString("hex");
    tokenHashValue = tokenHash(callbackToken);
    const now = new Date().toISOString();
    const candidatePayment: ChemistPayment = {
      paymentId, tenantId, branchId, saleId,
      amountMinor: sale.totalMinor,
      amountKes: sale.totalMinor / 100,
      currency: "KES", method: "MPESA", status: "PENDING",
      providerReference: null, receiptNumber: null,
      callbackTokenHash: tokenHashValue, createdAt: now, updatedAt: now,
    };

    await firestoreClient.runTransaction(async (tx) => {
      const slot = await tx.get<{ paymentId: string; status: string }>(slotPath);
      if (slot && ["PENDING", "REQUIRES_RECONCILIATION", "PAID"].includes(slot.status)) {
        throw new KernelError("CONFLICT", "An M-Pesa payment attempt already exists for this sale; check its status before retrying.", 409, context.requestId);
      }
      await tx.set(paymentPath(tenantId, paymentId), candidatePayment);
      await tx.set(slotPath, { tenantId, branchId, saleId, paymentId, status: "PENDING", updatedAt: now });
      await tx.set(callbackTokenPath(tokenHashValue), {
        tokenHash: tokenHashValue, tenantId, branchId, saleId, paymentId,
        createdAt: now, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      await tx.update(salePath(tenantId, saleId), { paymentStatus: "PENDING" });
    });
    payment = candidatePayment;

    const adapter = bridgeRegistry.getBridgeInstance("bridge_mpesa");
    if (!adapter) throw new KernelError("INTEGRATION_UNAVAILABLE", "TDBK M-Pesa adapter is not available.", 503, context.requestId);
    const callbackUrl = publicBase
      ? `${publicBase}/api/chemist/payments/mpesa/callback?token=${encodeURIComponent(callbackToken)}`
      : undefined;
    const result = await adapter.execute(context, "STK_PUSH", {
      phoneNumber,
      amount: sale.totalMinor / 100,
      accountReference: saleId.slice(0, 12),
      transactionDesc: `Chemist sale ${saleId.slice(0, 24)}`,
      callbackUrl,
    } satisfies MpesaSTKPushRequest);

    if (result.status !== "PENDING" || !result.providerReference) {
      throw new Error("Provider did not return a pending checkout reference.");
    }
    await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<ChemistPayment>(paymentPath(tenantId, paymentId));
      if (!current) throw new Error("Payment record disappeared after STK initiation.");
      const updated: ChemistPayment = {
        ...current,
        providerReference: result.providerReference,
        updatedAt: new Date().toISOString(),
      };
      await tx.set(paymentPath(tenantId, paymentId), updated);
      await tx.set(slotPath, { tenantId, branchId, saleId, paymentId, status: updated.status, updatedAt: updated.updatedAt });
      await tx.set(callbackTokenPath(tokenHashValue), {
        tokenHash: tokenHashValue, tenantId, branchId, saleId, paymentId,
        providerReference: result.providerReference,
        createdAt: current.createdAt,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
    });
    return res.status(202).json({
      paymentId, status: "PENDING", providerReference: result.providerReference,
      customerMessage: typeof result.data?.customerMessage === "string" ? result.data.customerMessage : "Check the customer's phone for the M-Pesa prompt.",
    });
  } catch (error) {
    if (payment) {
      try {
        await firestoreClient.runTransaction(async (tx) => {
          const current = await tx.get<ChemistPayment>(paymentPath(payment!.tenantId, payment!.paymentId));
          // A fast provider callback may have already confirmed payment. Never downgrade it.
          if (current?.status === "PAID") return;
          const failed: ChemistPayment = {
            ...(current || payment!),
            status: "REQUIRES_RECONCILIATION",
            updatedAt: new Date().toISOString(),
          };
          await tx.set(paymentPath(failed.tenantId, failed.paymentId), failed);
          await tx.set(`/tenants/${failed.tenantId}/chemistPaymentBySale/${failed.saleId}`, {
            tenantId: failed.tenantId, branchId: failed.branchId, saleId: failed.saleId,
            paymentId: failed.paymentId, status: "REQUIRES_RECONCILIATION", updatedAt: failed.updatedAt,
          });
          await tx.update(salePath(failed.tenantId, failed.saleId), { paymentStatus: "REQUIRES_RECONCILIATION" });
        });
      } catch { /* preserve the original error; reconcile against provider truth */ }
    }
    return apiError(res, error);
  }
});

router.get("/api/chemist/payments/:paymentId", async (req: Request, res: Response) => {
  try {
    const tenantIdInput = typeof req.query.tenantId === "string" ? req.query.tenantId : undefined;
    const branchIdInput = typeof req.query.branchId === "string" ? req.query.branchId : undefined;
    const context = await securityContextFactory.createSecurityContext({
      authHeader: req.headers.authorization,
      targetTenantId: tenantIdInput,
      targetBranchId: branchIdInput,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
    });
    const { tenantId, branchId } = tenantAndBranch(context);
    const paymentId = req.params.paymentId;
    if (!safeId.test(paymentId)) return res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invalid payment reference." } });
    const payment = await firestoreClient.get<ChemistPayment>(paymentPath(tenantId, paymentId));
    if (!payment || payment.tenantId !== tenantId || payment.branchId !== branchId) {
      return res.status(404).json({ error: { code: "PAYMENT_NOT_FOUND", message: "Payment was not found in the authorized branch." } });
    }
    return res.json({
      paymentId: payment.paymentId, saleId: payment.saleId, status: payment.status,
      amountKes: payment.amountKes, receiptNumber: payment.receiptNumber,
      providerReference: payment.providerReference,
    });
  } catch (error) { return apiError(res, error); }
});

router.post("/api/chemist/payments/mpesa/callback", async (req: Request, res: Response) => {
  try {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!/^[a-f0-9]{64}$/.test(token)) return res.status(401).json({ error: { code: "CALLBACK_UNAUTHORIZED", message: "Invalid callback token." } });
    const hash = tokenHash(token);
    const binding = await firestoreClient.get<{
      tokenHash: string; tenantId: string; branchId: string; saleId: string; paymentId: string;
      providerReference?: string; expiresAt: string;
    }>(callbackTokenPath(hash));
    if (!binding || binding.tokenHash !== hash || new Date(binding.expiresAt).getTime() < Date.now()) {
      return res.status(401).json({ error: { code: "CALLBACK_UNAUTHORIZED", message: "Callback token is invalid or expired." } });
    }
    const rawCallback = req.body as MpesaRawCallback;
    const checkoutId = rawCallback?.Body?.stkCallback?.CheckoutRequestID;
    if (!checkoutId || (binding.providerReference && binding.providerReference !== checkoutId)) {
      return res.status(422).json({ error: { code: "CALLBACK_REFERENCE_MISMATCH", message: "Callback does not match the initiated checkout request." } });
    }

    const payment = await firestoreClient.get<ChemistPayment>(paymentPath(binding.tenantId, binding.paymentId));
    if (!payment || payment.saleId !== binding.saleId || payment.tenantId !== binding.tenantId) {
      return res.status(404).json({ error: { code: "PAYMENT_NOT_FOUND", message: "No matching payment attempt exists." } });
    }
    const context: SecurityContext = {
      requestId: `mpesa_callback_${checkoutId}`,
      correlationId: `chemist_payment_${payment.paymentId}`,
      timestamp: new Date().toISOString(),
      principal: {
        id: "TDBK_MPESA_CALLBACK_SERVICE", isMaster: false, tenantId: binding.tenantId,
        branchId: binding.branchId, roles: ["SYSTEM_SERVICE"], permissions: ["PAYMENT_CALLBACK"],
        authTime: Math.floor(Date.now() / 1000), tokenSource: "SERVICE_KEY",
      },
      tenantContext: tenantIsolation.resolveTenantContext(binding.tenantId),
      branchContext: null,
      ipAddress: req.ip,
      userAgent: "Safaricom-Daraja-Callback",
    };
    const adapter = bridgeRegistry.getBridgeInstance("bridge_mpesa");
    if (!adapter) return res.status(503).json({ error: { code: "INTEGRATION_UNAVAILABLE", message: "M-Pesa callback handler is unavailable." } });
    const result = await adapter.handleCallback(context, rawCallback);
    const stk = rawCallback.Body.stkCallback;
    const success = stk.ResultCode === 0 && result.status === "SUCCESS";
    const failed = stk.ResultCode !== 0 || result.status === "FAILED";
    const nextStatus: ChemistPayment["status"] = success ? "PAID" : failed ? "FAILED" : "REQUIRES_RECONCILIATION";
    const metadata = stk.CallbackMetadata?.Item || [];
    const receipt = metadata.find(item => item.Name === "MpesaReceiptNumber")?.Value;
    const paidAmount = metadata.find(item => item.Name === "Amount")?.Value;
    const payerPhone = metadata.find(item => item.Name === "PhoneNumber")?.Value;
    const now = new Date().toISOString();
    await firestoreClient.runTransaction(async (tx) => {
      const current = await tx.get<ChemistPayment>(paymentPath(binding.tenantId, binding.paymentId));
      if (!current) throw new Error("Payment record disappeared during callback settlement.");
      if (current.status === "PAID" && nextStatus === "PAID") return;
      if (current.providerReference && current.providerReference !== checkoutId) throw new Error("Provider reference mismatch during settlement.");
      const updated: ChemistPayment = {
        ...current, status: nextStatus, providerReference: checkoutId,
        receiptNumber: typeof receipt === "string" ? receipt : current.receiptNumber,
        paidAmountKes: typeof paidAmount === "number" && Number.isFinite(paidAmount) ? paidAmount : current.paidAmountKes ?? null,
        payerPhone: typeof payerPhone === "number" || typeof payerPhone === "string" ? String(payerPhone) : current.payerPhone ?? null,
        providerResultCode: Number.isInteger(stk.ResultCode) ? stk.ResultCode : current.providerResultCode ?? null,
        providerResultDescription: typeof stk.ResultDesc === "string" ? stk.ResultDesc.slice(0, 500) : current.providerResultDescription ?? null,
        paidAt: success ? now : current.paidAt ?? null,
        updatedAt: now,
      };
      await tx.set(paymentPath(binding.tenantId, binding.paymentId), updated);
      await tx.set(`/tenants/${binding.tenantId}/chemistPaymentBySale/${binding.saleId}`, {
        tenantId: binding.tenantId, branchId: binding.branchId, saleId: binding.saleId,
        paymentId: binding.paymentId, status: nextStatus, updatedAt: now,
      });
      await tx.update(salePath(binding.tenantId, binding.saleId), {
        paymentStatus: nextStatus,
        ...(success ? { status: "COMPLETED", paidAt: now } : {}),
      });
    });
    return res.status(200).json({ ResultCode: 0, ResultDesc: "Accepted" });
  } catch (error) {
    // Return non-2xx so a provider retry or manual reconciliation can recover.
    if (error instanceof KernelError) return res.status(error.statusCode).json(error.toJSON());
    return res.status(500).json({ ResultCode: 1, ResultDesc: "Callback processing failed; reconciliation required." });
  }
});

export default router;
