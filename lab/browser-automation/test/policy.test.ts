import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedTarget, isAuthorized, isPublicAddress, isSafeResolvedTarget } from "../src/policy.js";

test("allows only exact allowlisted HTTP(S) hosts", () => {
  assert.equal(isAllowedTarget("https://example.com/path", ["example.com"]), true);
  assert.equal(isAllowedTarget("https://sub.example.com", ["example.com"]), false);
  assert.equal(isAllowedTarget("javascript:alert(1)", ["example.com"]), false);
  assert.equal(isAllowedTarget("https://evil.test", ["example.com"]), false);
  assert.equal(isAllowedTarget("https://user:pass@example.com", ["example.com"]), false);
});
test("blocks local, private, reserved and IP literal targets", () => {
  for (const target of ["http://localhost:3000", "http://192.168.1.1", "http://127.0.0.1", "http://10.0.0.1", "http://169.254.1.1"]) {
    assert.equal(isAllowedTarget(target, ["localhost", "192.168.1.1", "127.0.0.1", "10.0.0.1", "169.254.1.1"]), false);
  }
  for (const address of ["127.0.0.1", "10.2.3.4", "172.16.0.1", "192.168.0.1", "169.254.1.1", "100.64.0.1", "::1", "fc00::1", "fe80::1"]) {
    assert.equal(isPublicAddress(address), false, address);
  }
  assert.equal(isPublicAddress("8.8.8.8"), true);
  assert.equal(isPublicAddress("2606:4700:4700::1111"), true);
});
test("validates resolved addresses to mitigate DNS rebinding and private-network access", async () => {
  assert.equal(await isSafeResolvedTarget("https://example.com", ["example.com"], async () => ["93.184.216.34"]), true);
  assert.equal(await isSafeResolvedTarget("https://example.com", ["example.com"], async () => ["10.0.0.5"]), false);
  assert.equal(await isSafeResolvedTarget("https://example.com", ["example.com"], async () => { throw new Error("DNS failed"); }), false);
});
test("requires a configured bearer token and compares safely", () => {
  assert.equal(isAuthorized("secret", "secret"), true);
  assert.equal(isAuthorized("wrong", "secret"), false);
  assert.equal(isAuthorized("secret", undefined), false);
});
