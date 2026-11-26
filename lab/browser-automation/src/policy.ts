import { isIP } from "node:net";

export function isAllowedTarget(rawUrl: string, allowedHosts: string[]): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
  if (isIP(hostname)) {
    const parts = hostname.split(".").map(Number);
    if (parts.length === 4 && (parts[0] === 10 || parts[0] === 127 || parts[0] === 0 ||
      (parts[0] === 169 && parts[1] === 254) || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) ||
      (parts[0] === 192 && parts[1] === 168))) return false;
    if (parts.length === 4) return false; // IP literals require a future explicit policy.
    return false;
  }
  return allowedHosts.some(host => hostname === host.toLowerCase().trim());
}

export function isAuthorized(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected) return false;
  if (!provided || provided.length !== expected.length) return false;
  // Constant-time comparison without introducing a crypto dependency.
  let mismatch = 0;
  for (let i = 0; i < expected.length; i++) mismatch |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return mismatch === 0;
}
