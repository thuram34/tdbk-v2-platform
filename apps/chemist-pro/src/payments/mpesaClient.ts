/**
 * Chemist Pro M-Pesa client boundary.
 *
 * The browser must never call Safaricom Daraja directly or hold Daraja secrets.
 * This client talks only to the trusted TDBK server API. STK initiation is PENDING;
 * only a server-verified Daraja callback/reconciliation may confirm payment.
 */
export type MpesaPaymentStatus =
  | "PENDING"
  | "PAID"
  | "FAILED"
  | "CANCELLED"
  | "UNKNOWN"
  | "REQUIRES_RECONCILIATION";

export interface StartMpesaPaymentInput {
  tenantId: string;
  branchId: string;
  saleId: string;
  phoneNumber: string;
  amountKes: number;
}

export interface StartMpesaPaymentResult {
  paymentId: string;
  status: "PENDING";
  providerReference: string;
  customerMessage?: string;
}

export interface MpesaPaymentStatusResult {
  paymentId: string;
  saleId: string;
  status: MpesaPaymentStatus;
  amountKes: number;
  receiptNumber?: string;
  message?: string;
}

const API_BASE = (import.meta.env.VITE_TDBK_API_BASE_URL as string | undefined)?.replace(/\/$/, "");

function apiUrl(path: string): string {
  if (!API_BASE) {
    throw new Error("M-Pesa is not configured: set VITE_TDBK_API_BASE_URL to the trusted TDBK API.");
  }
  return `${API_BASE}${path}`;
}

function normalizeKenyanPhone(input: string): string {
  const digits = input.replace(/\D/g, "");
  const normalized = digits.startsWith("254")
    ? digits
    : digits.startsWith("0")
      ? `254${digits.slice(1)}`
      : digits.startsWith("7") || digits.startsWith("1")
        ? `254${digits}`
        : "";
  if (!/^254(?:7|1)\d{8}$/.test(normalized)) {
    throw new Error("Enter a valid Kenyan M-Pesa number, e.g. 0712345678.");
  }
  return normalized;
}

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof body?.error?.message === "string"
      ? body.error.message
      : typeof body?.message === "string"
        ? body.message
        : `Payment service returned HTTP ${response.status}.`;
    throw new Error(message);
  }
  return body as T;
}

/**
 * Starts a Daraja STK Push through the trusted TDBK backend.
 * The backend must authenticate the operator, authorize tenant/branch access,
 * persist the pending payment, and use the configured server-side Daraja bridge.
 */
export async function startMpesaPayment(
  input: StartMpesaPaymentInput,
  idToken: string,
): Promise<StartMpesaPaymentResult> {
  if (!idToken) throw new Error("Sign in to the chemist workspace before taking M-Pesa payments.");
  if (!input.tenantId || !input.branchId || !input.saleId) {
    throw new Error("Tenant, branch, and sale references are required for payment.");
  }
  if (!Number.isSafeInteger(input.amountKes) || input.amountKes < 1) {
    throw new Error("M-Pesa amount must be a whole number of Kenyan shillings.");
  }

  const response = await fetch(apiUrl("/api/chemist/payments/mpesa/stk-push"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${idToken}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      tenantId: input.tenantId,
      branchId: input.branchId,
      saleId: input.saleId,
      phoneNumber: normalizeKenyanPhone(input.phoneNumber),
      amountKes: input.amountKes,
    }),
  });
  const result = await readJson<StartMpesaPaymentResult>(response);
  if (result.status !== "PENDING" || !result.paymentId || !result.providerReference) {
    throw new Error("The payment service returned an invalid initiation response.");
  }
  return result;
}

/**
 * Reads server-authoritative payment state. A client-side timeout or a successful
 * STK request is never interpreted as proof of payment.
 */
export async function getMpesaPaymentStatus(
  paymentId: string,
  idToken: string,
): Promise<MpesaPaymentStatusResult> {
  if (!idToken) throw new Error("Sign in to check payment status.");
  if (!paymentId || !/^[A-Za-z0-9_-]{3,160}$/.test(paymentId)) {
    throw new Error("Invalid payment reference.");
  }
  const response = await fetch(
    apiUrl(`/api/chemist/payments/${encodeURIComponent(paymentId)}`),
    {
      headers: {
        Authorization: `Bearer ${idToken}`,
        Accept: "application/json",
      },
    },
  );
  return readJson<MpesaPaymentStatusResult>(response);
}
