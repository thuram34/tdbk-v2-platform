import { isIP } from "node:net";
import { timingSafeEqual } from "node:crypto";

export function isAllowedTarget(rawUrl: string, allowedHosts: string[]): boolean {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return false; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return false;
  if (url.username || url.password) return false;
  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
  if (isIP(hostname)) return false;
  return allowedHosts.some(host => hostname === host.toLowerCase().trim());
}

export function isPublicAddress(address: string): boolean {
  const version = isIP(address);
  if (version === 4) {
    const p = address.split(".").map(Number);
    const [a, b, c] = p;
    if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && (b === 168 || (b === 0 && c === 0) || (b === 0 && c === 2))) return false;
    if (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) return false;
    if (a === 203 && b === 0 && c === 113) return false;
    return true;
  }
  if (version === 6) {
    const value = address.toLowerCase();
    if (value === "::" || value === "::1" || value.startsWith("fc") || value.startsWith("fd") ||
      value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") ||
      value.startsWith("feb") || value.startsWith("ff") || value.startsWith("2001:db8:")) return false;
    if (value.startsWith("::ffff:")) {
      const mapped = value.slice(7);
      return isIP(mapped) === 4 && isPublicAddress(mapped);
    }
    return true;
  }
  return false;
}

export async function isSafeResolvedTarget(
  rawUrl: string,
  allowedHosts: string[],
  resolve: (hostname: string) => Promise<string[]>,
): Promise<boolean> {
  if (!isAllowedTarget(rawUrl, allowedHosts)) return false;
  const hostname = new URL(rawUrl).hostname;
  try {
    const addresses = await resolve(hostname);
    return addresses.length > 0 && addresses.every(isPublicAddress);
  } catch {
    return false;
  }
}

export function isAuthorized(provided: string | undefined, expected: string | undefined): boolean {
  if (!expected || !provided) return false;
  const left = Buffer.from(provided);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}
