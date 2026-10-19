import { describe, expect, it } from "vitest";
import { normalizeKenyanPhone } from "./mpesaClient";

describe("normalizeKenyanPhone", () => {
  it.each([
    ["0712345678", "254712345678"],
    ["712345678", "254712345678"],
    ["254712345678", "254712345678"],
    ["+254 712 345 678", "254712345678"],
    ["0112345678", "254112345678"],
  ])("normalizes %s to E.164-style Safaricom format", (input, expected) => {
    expect(normalizeKenyanPhone(input)).toBe(expected);
  });

  it.each(["", "12345", "254612345678", "071234567", "07123456789", "+1 415 555 2671"])(
    "rejects invalid Kenyan mobile number %s",
    (input) => {
      expect(() => normalizeKenyanPhone(input)).toThrow("valid Kenyan M-Pesa number");
    },
  );
});
