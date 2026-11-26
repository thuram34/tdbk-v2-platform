import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";

test("launches Chromium, inspects a page and captures screenshot evidence", async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ serviceWorkers: "block" });
  try {
    const page = await context.newPage();
    await page.setContent("<main><h1>TDBK Browser Lab</h1><p>Chromium smoke test passed</p></main>");
    assert.equal(await page.locator("h1").innerText(), "TDBK Browser Lab");
    assert.match(await page.locator("body").innerText(), /Chromium smoke test passed/);
    const screenshot = await page.screenshot({ type: "png" });
    assert.ok(screenshot.byteLength > 100);
  } finally {
    await context.close();
    await browser.close();
  }
});
