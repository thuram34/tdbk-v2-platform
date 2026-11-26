import type { SecurityContext } from "../../../kernel/types";
export type BrowserStep =
  | { type: "navigate"; url: string }
  | { type: "inspect" }
  | { type: "assertText"; text: string }
  | { type: "screenshot" }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string };

export interface BrowserJobSubmission {
  tenantId: string;
  requestId: string;
  createdBy: string;
  url: string;
  steps: BrowserStep[];
  allowInteractions?: boolean;
}

export class BrowserAutomationTool {
  private configuration() {
    const baseUrl = process.env.TDBK_BROWSER_LAB_URL;
    const token = process.env.TDBK_BROWSER_LAB_TOKEN;
    if (!baseUrl || !token) {
      throw new Error("Browser Lab is not connected. Configure TDBK_BROWSER_LAB_URL and TDBK_BROWSER_LAB_TOKEN.");
    }
    return { baseUrl: baseUrl.replace(/\/+$/, ""), token };
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const { baseUrl, token } = this.configuration();
    const response = await fetch(`${baseUrl}${path}`, {
      ...init,
      headers: {
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        ...(init.headers || {}),
      },
      signal: AbortSignal.timeout(15_000),
    });
    const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
    if (!response.ok) {
      const message = typeof payload.error === "string" ? payload.error : `Browser Lab returned HTTP ${response.status}`;
      throw new Error(message);
    }
    return payload as T;
  }

  public submit(_context: SecurityContext, input: BrowserJobSubmission) {
    return this.request<{ jobId: string; tenantId: string; requestId: string; status: string; createdAt: string }>(
      "/v1/jobs",
      { method: "POST", body: JSON.stringify(input) },
    );
  }

  public async get(_context: SecurityContext, jobId: string, tenantId: string) {
    if (!/^[a-f0-9-]{36}$/i.test(jobId)) throw new Error("Invalid browser job ID");
    const job = await this.request<{ jobId: string; tenantId: string; status: string; results: unknown[]; [key: string]: unknown }>(
      `/v1/jobs/${jobId}`,
      { method: "GET" },
    );
    if (job.tenantId !== tenantId) throw new Error("Browser job tenant boundary mismatch");
    return job;
  }

  public health() {
    return this.request<{ ok: boolean; service: string; version: string }>("/health", { method: "GET" });
  }
}

export const browserAutomationTool = new BrowserAutomationTool();
