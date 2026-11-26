import test from "node:test";
import assert from "node:assert/strict";
import { parseBrowserJobInput } from "../src/task.js";

const valid = {
  tenantId: "tdbk",
  requestId: "req_test",
  createdBy: "owner",
  url: "https://example.test",
  steps: [{ type: "inspect" }, { type: "assertText", text: "TDBK" }, { type: "screenshot" }],
};

test("accepts bounded read-only browser jobs", () => {
  const parsed = parseBrowserJobInput(valid);
  assert.equal(parsed.steps.length, 3);
  assert.equal(parsed.allowInteractions, false);
});
test("rejects interactions unless explicitly approved", () => {
  assert.throws(() => parseBrowserJobInput({ ...valid, steps: [{ type: "click", selector: "#save" }] }), /explicit approval/);
  assert.equal(parseBrowserJobInput({ ...valid, allowInteractions: true, steps: [{ type: "click", selector: "#save" }] }).allowInteractions, true);
});
test("rejects excessive steps and unsupported operations", () => {
  assert.throws(() => parseBrowserJobInput({ ...valid, steps: Array(21).fill({ type: "inspect" }) }), /between 1 and 20/);
  assert.throws(() => parseBrowserJobInput({ ...valid, steps: [{ type: "evaluate", code: "alert(1)" }] }), /Unsupported browser step/);
});
test("rejects unbounded values and missing tenant identity", () => {
  assert.throws(() => parseBrowserJobInput({ ...valid, tenantId: "" }), /tenantId/);
  assert.throws(() => parseBrowserJobInput({ ...valid, steps: [{ type: "fill", selector: "#x", value: "x".repeat(4001) }], allowInteractions: true }), /value/);
});
