export type BrowserStep =
  | { type: "navigate"; url: string }
  | { type: "inspect" }
  | { type: "assertText"; text: string }
  | { type: "screenshot" }
  | { type: "click"; selector: string }
  | { type: "fill"; selector: string; value: string };

export interface BrowserJobInput {
  tenantId: string;
  requestId: string;
  createdBy: string;
  url: string;
  steps: BrowserStep[];
  allowInteractions?: boolean;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const requiredText = (value: unknown, field: string, max: number): string => {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    throw new Error(`Invalid ${field}`);
  }
  return value.trim();
};

export function parseBrowserJobInput(value: unknown): BrowserJobInput {
  if (!isRecord(value)) throw new Error("Invalid job payload");
  const tenantId = requiredText(value.tenantId, "tenantId", 128);
  const requestId = requiredText(value.requestId, "requestId", 128);
  const createdBy = requiredText(value.createdBy, "createdBy", 128);
  const url = requiredText(value.url, "url", 2048);
  if (!Array.isArray(value.steps) || value.steps.length < 1 || value.steps.length > 20) {
    throw new Error("Invalid steps: provide between 1 and 20 steps");
  }
  const steps = value.steps.map((raw, index): BrowserStep => {
    if (!isRecord(raw) || typeof raw.type !== "string") throw new Error(`Invalid step ${index}`);
    switch (raw.type) {
      case "navigate":
        return { type: "navigate", url: requiredText(raw.url, `steps[${index}].url`, 2048) };
      case "inspect":
      case "screenshot":
        return { type: raw.type };
      case "assertText":
        return { type: "assertText", text: requiredText(raw.text, `steps[${index}].text`, 2000) };
      case "click": {
        const selector = requiredText(raw.selector, `steps[${index}].selector`, 500);
        if (/submit|checkout|purchase|delete|remove|archive|transfer|approve|publish|payment|pay-now/i.test(selector)) {
          throw new Error("High-impact browser controls are disabled in v1.0");
        }
        return { type: "click", selector };
      }
      case "fill": {
        const selector = requiredText(raw.selector, `steps[${index}].selector`, 500);
        if (/password|passcode|otp|one[-_ ]?time|secret|token|pin|credit[-_ ]?card|cvv|cvc|mpesa|bank[-_ ]?account/i.test(selector)) {
          throw new Error("Sensitive form fields require the future credential vault and are disabled in v1.0");
        }
        const value = typeof raw.value === "string" && raw.value.length <= 4000 ? raw.value : (() => { throw new Error(`Invalid steps[${index}].value`); })();
        return { type: "fill", selector, value };
      }
      default:
        throw new Error(`Unsupported browser step at index ${index}`);
    }
  });
  const allowInteractions = value.allowInteractions === true;
  if (!allowInteractions && steps.some(step => step.type === "click" || step.type === "fill")) {
    throw new Error("Interactive steps require explicit approval");
  }
  return { tenantId, requestId, createdBy, url, steps, allowInteractions };
}
