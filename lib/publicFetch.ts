import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import http from "node:http";
import https from "node:https";

const MAX_BYTES = 5 * 1024 * 1024;
export function isPublicAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return !(a === 0 || a === 10 || a === 127 || a >= 224 ||
      (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || b === 2)) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0));
  }
  // Accept only global unicast IPv6; excludes mapped IPv4, loopback, link-local,
  // unique local, multicast, NAT64 and documentation ranges.
  return isIP(address) === 6 && /^[23][0-9a-f]{3}:/i.test(address) &&
    !/^2001:(?:db8|0|10|20):/i.test(address) && !/^2002:/i.test(address);
}

/** Resolve once, reject private networks, then pin the connection to that address. */
export async function fetchPublicResource(value: string, headers: Record<string, string> = {}, hops = 0): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }> {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      (url.port && url.port !== "80" && url.port !== "443")) throw new Error("Use a public HTTP or HTTPS link on a standard port.");
  const hostname = url.hostname.replace(/^\[|\]$/g, "");
  const addresses = await lookup(hostname, { all: true });
  if (!addresses.length || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new Error("Private and local network sources are not allowed.");
  }
  const pinned = addresses[0];
  const result = await new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const req = transport.request(url, {
      headers, agent: false,
      lookup: (_hostname, _options, callback) => callback(null, pinned.address, pinned.family),
    }, (res) => {
      const chunks: Buffer[] = [];
      let bytes = 0;
      res.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > MAX_BYTES) req.destroy(new Error("Source exceeds the 5 MB reading limit."));
        else chunks.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({ status: res.statusCode ?? 500, headers: res.headers, body: Buffer.concat(chunks) }));
    });
    const timer = setTimeout(() => req.destroy(new Error("Source request timed out.")), 15000);
    req.on("close", () => clearTimeout(timer));
    req.on("error", reject);
    req.end();
  });
  if ([301, 302, 303, 307, 308].includes(result.status) && result.headers.location) {
    if (hops >= 5) throw new Error("Too many source redirects.");
    return fetchPublicResource(new URL(result.headers.location, url).href, headers, hops + 1);
  }
  return result;
}
