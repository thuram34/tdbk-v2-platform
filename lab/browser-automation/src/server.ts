import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { isAllowedTarget, isAuthorized } from "./policy.js";

const port = Number(process.env.PORT || 8787);
const host = process.env.HOST || "127.0.0.1";
const token = process.env.LAB_API_TOKEN;
const allowedHosts = (process.env.LAB_ALLOWED_HOSTS || "").split(",").map(v => v.trim()).filter(Boolean);
const sessions = new Map<string, { context: BrowserContext; page: Page; createdAt: string }>();
let browser: Browser | undefined;

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  res.end(JSON.stringify(data));
}
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk.toString();
    if (raw.length > 32_000) throw new Error("Request body exceeds 32 KB");
  }
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Expected a JSON object");
  return parsed as Record<string, unknown>;
}
function session(id: string) {
  const found = sessions.get(id);
  if (!found) throw new Error("Session not found");
  return found;
}
function assertString(value: unknown, name: string, max = 4000): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error(`Invalid ${name}`);
  return value;
}

const server = createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      return send(res, 200, { ok: true, service: "tdbk-browser-lab", version: "0.1.0", browser: browser ? "ready" : "starting", activeSessions: sessions.size, allowlistConfigured: allowedHosts.length > 0 });
    }
    if (!isAuthorized(req.headers.authorization?.replace(/^Bearer\s+/i, ""), token)) {
      return send(res, 401, { error: "Unauthorized" });
    }
    if (req.method === "POST" && req.url === "/v1/sessions") {
      const input = await body(req);
      const startUrl = typeof input.url === "string" ? input.url : undefined;
      if (startUrl && !isAllowedTarget(startUrl, allowedHosts)) return send(res, 403, { error: "Target host is not allowlisted" });
      if (!allowedHosts.length) return send(res, 503, { error: "Configure LAB_ALLOWED_HOSTS before creating sessions" });
      browser ??= await chromium.launch({ headless: process.env.LAB_HEADLESS !== "false", args: ["--no-sandbox"] });
      const context = await browser.newContext({ acceptDownloads: false, ignoreHTTPSErrors: false });
      const page = await context.newPage();
      page.setDefaultTimeout(10_000);
      const id = randomUUID();
      sessions.set(id, { context, page, createdAt: new Date().toISOString() });
      if (startUrl) await page.goto(startUrl, { waitUntil: "domcontentloaded", timeout: 20_000 });
      return send(res, 201, { sessionId: id, createdAt: new Date().toISOString(), url: page.url() });
    }
    const match = req.url?.match(/^\/v1\/sessions\/([a-f0-9-]+)(?:\/(navigate|click|fill|screenshot|close))?$/);
    if (!match) return send(res, 404, { error: "Route not found" });
    const [, id, action] = match;
    const current = session(id);
    if (req.method === "POST" && action === "navigate") {
      const input = await body(req), url = assertString(input.url, "url");
      if (!isAllowedTarget(url, allowedHosts)) return send(res, 403, { error: "Target host is not allowlisted" });
      await current.page.goto(url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      return send(res, 200, { ok: true, url: current.page.url(), title: await current.page.title() });
    }
    if (req.method === "POST" && action === "click") {
      const input = await body(req), selector = assertString(input.selector, "selector", 1000);
      await current.page.locator(selector).first().click();
      return send(res, 200, { ok: true, url: current.page.url() });
    }
    if (req.method === "POST" && action === "fill") {
      const input = await body(req), selector = assertString(input.selector, "selector", 1000);
      const value = typeof input.value === "string" ? input.value : "";
      if (value.length > 4000) throw new Error("Value exceeds 4000 characters");
      await current.page.locator(selector).first().fill(value);
      return send(res, 200, { ok: true, selector });
    }
    if (req.method === "POST" && action === "screenshot") {
      const image = await current.page.screenshot({ type: "png", fullPage: false });
      return send(res, 200, { ok: true, mimeType: "image/png", dataBase64: image.toString("base64"), url: current.page.url() });
    }
    if (req.method === "DELETE" && action === "close") {
      await current.context.close(); sessions.delete(id);
      return send(res, 200, { ok: true, closed: true });
    }
    return send(res, 405, { error: "Method not allowed" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    const status = message === "Session not found" ? 404 : message.startsWith("Invalid ") || message.includes("exceeds") ? 400 : 500;
    return send(res, status, { error: message });
  }
});

server.listen(port, host, () => console.log(`TDBK Browser Lab listening on http://${host}:${port}`));
async function shutdown() {
  server.close();
  for (const item of sessions.values()) await item.context.close().catch(() => undefined);
  sessions.clear();
  await browser?.close();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
