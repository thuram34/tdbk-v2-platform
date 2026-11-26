import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { lookup } from "node:dns/promises";
import { randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { isAllowedTarget, isAuthorized, isSafeResolvedTarget } from "./policy.js";
import { parseBrowserJobInput, type BrowserJobInput, type BrowserStep } from "./task.js";

type JobStatus = "QUEUED" | "RUNNING" | "COMPLETED" | "FAILED";
interface StepResult {
  index: number;
  type: BrowserStep["type"];
  status: "COMPLETED" | "FAILED";
  startedAt: string;
  completedAt: string;
  url?: string;
  title?: string;
  text?: string;
  evidenceId?: string;
  error?: string;
}
interface BrowserJobRecord {
  jobId: string;
  tenantId: string;
  requestId: string;
  createdBy: string;
  status: JobStatus;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  results: StepResult[];
  error?: string;
}
interface LabOptions {
  token?: string;
  allowedHosts?: string[];
  host?: string;
  port?: number;
  launchBrowser?: () => Promise<Browser>;
  resolveHost?: (hostname: string) => Promise<string[]>;
}
const MAX_ACTIVE_JOBS = 5;
const MAX_SESSIONS = 5;
const MAX_RETAINED_JOBS = 100;
const MAX_EVIDENCE_BYTES = 4 * 1024 * 1024;

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
async function readBody(req: IncomingMessage): Promise<unknown> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (Buffer.byteLength(raw) > 32_000) throw new Error("Request body exceeds 32 KB");
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw new Error("Invalid JSON body"); }
}
function routeError(error: unknown): { status: number; message: string } {
  const message = error instanceof Error ? error.message : "Unexpected error";
  if (message === "Session not found" || message === "Job not found") return { status: 404, message };
  if (message.startsWith("Invalid ") || message.includes("exceeds") || message.startsWith("Unsupported ")) return { status: 400, message };
  return { status: 500, message };
}
function requiredString(value: unknown, name: string, max = 4000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${name}`);
  return value.trim();
}
function publicJob(job: BrowserJobRecord) {
  return { ...job, results: job.results.map(result => ({ ...result })) };
}

export function createBrowserLabServer(options: LabOptions = {}): Server {
  const host = options.host || process.env.HOST || "127.0.0.1";
  const port = options.port ?? Number(process.env.PORT || 8787);
  const token = options.token ?? process.env.LAB_API_TOKEN;
  const allowedHosts = options.allowedHosts ?? (process.env.LAB_ALLOWED_HOSTS || "").split(",").map(v => v.trim()).filter(Boolean);
  const launchBrowser = options.launchBrowser || (() => chromium.launch({ headless: process.env.LAB_HEADLESS !== "false", args: ["--no-sandbox"] }));
  const resolveHost = options.resolveHost || (async (hostname: string) => (await lookup(hostname, { all: true, verbatim: true })).map(item => item.address));
  const sessions = new Map<string, { context: BrowserContext; page: Page; createdAt: string }>();
  const jobs = new Map<string, BrowserJobRecord>();
  const evidence = new Map<string, Buffer>();
  let browser: Browser | undefined;

  const getBrowser = async () => browser ??= await launchBrowser();
  const safeTarget = (url: string) => isSafeResolvedTarget(url, allowedHosts, resolveHost);
  const createContext = async () => {
    const context = await (await getBrowser()).newContext({
      acceptDownloads: false,
      ignoreHTTPSErrors: false,
      serviceWorkers: "block",
    });
    // Context-level routing covers pages and popups; service workers are blocked
    // so they cannot bypass the host policy.
    await context.route("**/*", async route => {
      const allowed = await safeTarget(route.request().url());
      if (allowed) await route.continue();
      else await route.abort("blockedbyclient");
    });
    return context;
  };

  async function executeJob(job: BrowserJobRecord, input: BrowserJobInput) {
    let context: BrowserContext | undefined;
    try {
      job.status = "RUNNING";
      job.startedAt = new Date().toISOString();
      context = await createContext();
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      await page.goto(input.url, { waitUntil: "domcontentloaded", timeout: 20_000 });

      for (let index = 0; index < input.steps.length; index++) {
        const step = input.steps[index];
        const startedAt = new Date().toISOString();
        const result: StepResult = { index, type: step.type, status: "COMPLETED", startedAt, completedAt: startedAt };
        try {
          if (step.type === "navigate") {
            if (!await safeTarget(step.url)) throw new Error("Target host is not allowlisted or resolves to a non-public address");
            await page.goto(step.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
          } else if (step.type === "inspect") {
            result.title = await page.title();
            result.text = (await page.locator("body").innerText()).slice(0, 10_000);
          } else if (step.type === "assertText") {
            const text = (await page.locator("body").innerText()).slice(0, 20_000);
            if (!text.includes(step.text)) throw new Error(`Expected page text was not found: ${step.text.slice(0, 120)}`);
            result.text = step.text;
          } else if (step.type === "screenshot") {
            const image = await page.screenshot({ type: "png", fullPage: false });
            if (image.byteLength > MAX_EVIDENCE_BYTES) throw new Error("Screenshot exceeds the 4 MB evidence limit");
            const evidenceId = `${job.jobId}:${index}`;
            evidence.set(evidenceId, image);
            result.evidenceId = evidenceId;
          } else if (step.type === "click") {
            if (!input.allowInteractions) throw new Error("Interactive step was not approved");
            await page.locator(step.selector).first().click();
          } else if (step.type === "fill") {
            if (!input.allowInteractions) throw new Error("Interactive step was not approved");
            await page.locator(step.selector).first().fill(step.value);
          }
          result.url = page.url();
          if (!result.title && step.type !== "inspect") result.title = await page.title().catch(() => undefined);
        } catch (error) {
          result.status = "FAILED";
          result.error = error instanceof Error ? error.message : String(error);
          result.completedAt = new Date().toISOString();
          job.results.push(result);
          throw error;
        }
        result.completedAt = new Date().toISOString();
        job.results.push(result);
      }
      job.status = "COMPLETED";
    } catch (error) {
      job.status = "FAILED";
      job.error = error instanceof Error ? error.message : String(error);
    } finally {
      await context?.close().catch(() => undefined);
      job.completedAt = new Date().toISOString();
    }
  }

  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url || "/", "http://localhost").pathname;
      if (req.method === "GET" && pathname === "/health") {
        return send(res, 200, {
          ok: true,
          service: "tdbk-browser-lab",
          version: "1.0.0",
          browser: browser ? "ready" : "lazy",
          activeSessions: sessions.size,
          activeJobs: [...jobs.values()].filter(job => job.status === "QUEUED" || job.status === "RUNNING").length,
          allowlistConfigured: allowedHosts.length > 0,
        });
      }
      if (!isAuthorized(req.headers.authorization?.replace(/^Bearer\s+/i, ""), token)) {
        return send(res, 401, { error: "Unauthorized" });
      }
      if (!allowedHosts.length && (pathname.startsWith("/v1/"))) {
        return send(res, 503, { error: "Configure LAB_ALLOWED_HOSTS before browser execution" });
      }

      if (req.method === "POST" && pathname === "/v1/jobs") {
        const input = parseBrowserJobInput(await readBody(req));
        if (!await safeTarget(input.url)) return send(res, 403, { error: "Initial target is not allowlisted or does not resolve exclusively to public addresses" });
        for (const step of input.steps) {
          if (step.type === "navigate" && !await safeTarget(step.url)) {
            return send(res, 403, { error: "A navigation step targets a non-allowlisted or non-public host" });
          }
        }
        const active = [...jobs.values()].filter(job => job.status === "QUEUED" || job.status === "RUNNING").length;
        if (active >= MAX_ACTIVE_JOBS) return send(res, 429, { error: "Browser worker is at active job capacity" });
        const job: BrowserJobRecord = {
          jobId: randomUUID(), tenantId: input.tenantId, requestId: input.requestId, createdBy: input.createdBy,
          status: "QUEUED", createdAt: new Date().toISOString(), results: [],
        };
        jobs.set(job.jobId, job);
        while (jobs.size > MAX_RETAINED_JOBS) {
          const oldest = [...jobs.values()].find(item => item.status === "COMPLETED" || item.status === "FAILED");
          if (!oldest) break;
          jobs.delete(oldest.jobId);
          for (const key of evidence.keys()) if (key.startsWith(`${oldest.jobId}:`)) evidence.delete(key);
        }
        void executeJob(job, input);
        return send(res, 202, publicJob(job));
      }

      const evidenceMatch = pathname.match(/^\/v1\/jobs\/([a-f0-9-]+)\/evidence\/(\d+)$/);
      if (req.method === "GET" && evidenceMatch) {
        const [, jobId, index] = evidenceMatch;
        const job = jobs.get(jobId);
        if (!job) return send(res, 404, { error: "Job not found" });
        const image = evidence.get(`${jobId}:${index}`);
        if (!image) return send(res, 404, { error: "Evidence not found" });
        return send(res, 200, { mimeType: "image/png", dataBase64: image.toString("base64") });
      }

      const jobMatch = pathname.match(/^\/v1\/jobs\/([a-f0-9-]+)$/);
      if (req.method === "GET" && jobMatch) {
        const job = jobs.get(jobMatch[1]);
        return job ? send(res, 200, publicJob(job)) : send(res, 404, { error: "Job not found" });
      }

      if (req.method === "POST" && pathname === "/v1/sessions") {
        const input = await readBody(req) as Record<string, unknown>;
        const startUrl = typeof input.url === "string" ? requiredString(input.url, "url", 2048) : undefined;
        if (startUrl && !await safeTarget(startUrl)) return send(res, 403, { error: "Target host is not allowlisted or public" });
        if (sessions.size >= MAX_SESSIONS) return send(res, 429, { error: "Browser session capacity reached" });
        const context = await createContext();
        const page = await context.newPage();
        page.setDefaultTimeout(10_000);
        const id = randomUUID();
        sessions.set(id, { context, page, createdAt: new Date().toISOString() });
        if (startUrl) await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
        return send(res, 201, { sessionId: id, createdAt: new Date().toISOString(), url: page.url() });
      }

      const sessionMatch = pathname.match(/^\/v1\/sessions\/([a-f0-9-]+)(?:\/(navigate|click|fill|screenshot|close))?$/);
      if (sessionMatch) {
        const [, id, action] = sessionMatch;
        const current = sessions.get(id);
        if (!current) return send(res, 404, { error: "Session not found" });
        if (req.method === "POST" && action === "navigate") {
          const input = await readBody(req) as Record<string, unknown>;
          const url = requiredString(input.url, "url", 2048);
          if (!await safeTarget(url)) return send(res, 403, { error: "Target host is not allowlisted or public" });
          await current.page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
          return send(res, 200, { ok: true, url: current.page.url(), title: await current.page.title() });
        }
        if (req.method === "POST" && action === "click") {
          const input = await readBody(req) as Record<string, unknown>;
          await current.page.locator(requiredString(input.selector, "selector", 500)).first().click();
          return send(res, 200, { ok: true, url: current.page.url() });
        }
        if (req.method === "POST" && action === "fill") {
          const input = await readBody(req) as Record<string, unknown>;
          const value = typeof input.value === "string" && input.value.length <= 4000 ? input.value : "";
          await current.page.locator(requiredString(input.selector, "selector", 500)).first().fill(value);
          return send(res, 200, { ok: true });
        }
        if (req.method === "POST" && action === "screenshot") {
          const image = await current.page.screenshot({ type: "png", fullPage: false });
          return send(res, 200, { ok: true, mimeType: "image/png", dataBase64: image.toString("base64"), url: current.page.url() });
        }
        if (req.method === "DELETE" && action === "close") {
          await current.context.close();
          sessions.delete(id);
          return send(res, 200, { ok: true, closed: true });
        }
      }
      return send(res, 404, { error: "Route not found" });
    } catch (error) {
      const result = routeError(error);
      return send(res, result.status, { error: result.message });
    }
  });

  server.on("close", async () => {
    for (const item of sessions.values()) await item.context.close().catch(() => undefined);
    sessions.clear();
    await browser?.close().catch(() => undefined);
  });
  return server;
}

export function startBrowserLab() {
  const server = createBrowserLabServer();
  const host = process.env.HOST || "127.0.0.1";
  const port = Number(process.env.PORT || 8787);
  server.listen(port, host, () => console.log(`TDBK Browser Lab v1.0 listening on http://${host}:${port}`));
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) startBrowserLab();
