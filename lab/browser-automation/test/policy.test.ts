import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedTarget, isAuthorized } from "../src/policy.js";

test("allows only exact allowlisted HTTP(S) hosts", () => {
  assert.equal(isAllowedTarget("https://example.com/path", ["example.com"]), true);
  assert.equal(isAllowedTarget("https://sub.example.com", ["example.com"]), false);
  assert.equal(isAllowedTarget("javascript:alert(1)", ["example.com"]), false);
  assert.equal(isAllowedTarget("https://evil.test", ["example.com"]), false);
});
test("blocks local and private network targets", () => {
  assert.equal(isAllowedTarget("http://localhost:3000", ["localhost"]), false);
  assert.equal(isAllowedTarget("http://192.168.1.1", ["192.168.1.1"]), false);
  assert.equal(isAllowedTarget("http://127.0.0.1", ["127.0.0.1"]), false);
});
test("requires a configured bearer token", () => {
  assert.equal(isAuthorized("secret", "secret"), true);
  assert.equal(isAuthorized("wrong", "secret"), false);
  assert.equal(isAuthorized("secret", undefined), false);
});
