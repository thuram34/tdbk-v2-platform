import test from "node:test";
import assert from "node:assert/strict";
import type { Browser } from "playwright";
import { createBrowserLabServer } from "../src/server.js";

test("browser job API authenticates, runs a read-only workflow and exposes screenshot evidence", async () => {
  let currentUrl = "about:blank";
  const page = {
    setDefaultTimeout() {},
    async goto(url: string) { currentUrl = url; },
    async title() { return "TDBK LAB Test"; },
    url() { return currentUrl; },
    locator() {
      return {
        first() { return this; },
        async click() {},
        async fill() {},
        async innerText() { return "Thuram Digital Bridge Kenya"; },
      };
    },
    async screenshot() { return Buffer.from("fake-png-evidence"); },
  };
  const context = {
    async route() {},
    async newPage() { return page; },
    async close() {},
  };
  const browser = {
    async newContext() { return context; },
    async close() {},
  };
  const server = createBrowserLabServer({
    token: "test-secret",
    allowedHosts: ["example.test"],
    launchBrowser: async () => browser as unknown as Browser,
    resolveHost: async () => ["93.184.216.34"],
    host: "127.0.0.1",
    port: 0,
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const base = `http://127.0.0.1:${address.port}`;
  try {
    const unauthorized = await fetch(`${base}/v1/jobs`, { method: "POST" });
    assert.equal(unauthorized.status, 401);

    const rejectedInteraction = await fetch(`${base}/v1/jobs`, {
      method: "POST",
      headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "tdbk", requestId: "req_denied", createdBy: "owner", url: "https://example.test",
        steps: [{ type: "click", selector: "#submit" }],
      }),
    });
    assert.equal(rejectedInteraction.status, 400);

    const submitted = await fetch(`${base}/v1/jobs`, {
      method: "POST",
      headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "tdbk", requestId: "req_lab_test", createdBy: "owner", url: "https://example.test",
        steps: [{ type: "inspect" }, { type: "assertText", text: "Thuram Digital Bridge" }, { type: "screenshot" }],
      }),
    });
    assert.equal(submitted.status, 202);
    const accepted = await submitted.json() as { jobId: string; status: string };
    assert.ok(accepted.jobId);

    let result: { status: string; results: Array<{ status: string; evidenceId?: string }> } | undefined;
    for (let attempt = 0; attempt < 30; attempt++) {
      const response = await fetch(`${base}/v1/jobs/${accepted.jobId}`, { headers: { authorization: "Bearer test-secret" } });
      result = await response.json() as typeof result;
      if (result?.status === "COMPLETED" || result?.status === "FAILED") break;
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    assert.equal(result?.status, "COMPLETED");
    assert.equal(result?.results.length, 3);
    assert.ok(result?.results[2].evidenceId);

    const duplicate = await fetch(`${base}/v1/jobs`, {
      method: "POST",
      headers: { authorization: "Bearer test-secret", "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "tdbk", requestId: "req_lab_test", createdBy: "owner", url: "https://example.test",
        steps: [{ type: "inspect" }, { type: "assertText", text: "Thuram Digital Bridge" }, { type: "screenshot" }],
      }),
    });
    const duplicateJob = await duplicate.json() as { jobId: string };
    assert.equal(duplicateJob.jobId, accepted.jobId, "retries with the same request ID must not create duplicate browser jobs");

    const evidence = await fetch(`${base}/v1/jobs/${accepted.jobId}/evidence/2`, { headers: { authorization: "Bearer test-secret" } });
    assert.equal(evidence.status, 200);
    const image = await evidence.json() as { mimeType: string; dataBase64: string };
    assert.equal(image.mimeType, "image/png");
    assert.ok(Buffer.from(image.dataBase64, "base64").length > 0);
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
