import { createRequire } from "node:module";
import { networkInterfaces } from "node:os";
import { isIP } from "node:net";

const require = createRequire(import.meta.url);

export interface Advertisement {
  hostname: string;
  stop(): Promise<void>;
}

type RecordData = {
  name: string;
  type: string;
  ttl: number;
  data: unknown;
};

type Query = {
  questions?: Array<{ name: string; type: string }>;
};

type MdnsInstance = {
  on(event: "query", listener: (query: Query) => void): MdnsInstance;
  respond(packet: { answers: RecordData[]; additionals?: RecordData[] }, done?: () => void): void;
  destroy(done?: () => void): void;
};

const mdnsFactory = require("multicast-dns") as (options: { multicast: boolean; reuseAddr: boolean }) => MdnsInstance;

/**
 * Don't advertise Docker (172.17.*), Tailscale (100.64/10), VPN, or
 * unrelated IPv6 addresses as the app's .local hostname. Such records may
 * resolve on phones but lead to a route that cannot reach Mini.
 */
export function selectLanIPv4(interfaces: ReturnType<typeof networkInterfaces> = networkInterfaces()): string | undefined {
  const candidates: Array<{ priority: number; name: string; ip: string }> = [];
  for (const [name, addresses] of Object.entries(interfaces)) {
    if (/^(?:docker|br-|veth|virbr|tailscale|tun|tap|wg|zt|utun|lo)/i.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.internal || address.family !== "IPv4" || isIP(address.address) !== 4) continue;
      const [a, b] = address.address.split(".").map(Number);
      const isPrivate = a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
      if (!isPrivate) continue;
      candidates.push({
        priority: /^(?:wlan|wlp|wl|en|eth)/i.test(name) ? 0 : 1,
        name,
        ip: address.address,
      });
    }
  }
  candidates.sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  return candidates[0]?.ip;
}

export function recordsFor(name: string, port: number, address: string): RecordData[] {
  const hostname = `${name}.local`;
  const service = `${name}._http._tcp.local`;
  return [
    { name: "_http._tcp.local", type: "PTR", ttl: 120, data: service },
    { name: service, type: "SRV", ttl: 120, data: { priority: 0, weight: 0, port, target: hostname } },
    { name: service, type: "TXT", ttl: 120, data: Buffer.from([0]) },
    { name: hostname, type: "A", ttl: 120, data: address },
  ];
}

/** Publish the hostname's A record explicitly, not as a side effect of
 * Bonjour's service enumeration across ALL network interfaces.
 */
export function advertise(name: string, port: number): Advertisement {
  const address = selectLanIPv4();
  if (!address) {
    throw new Error("applan: no usable private LAN IPv4 interface; cannot advertise .local");
  }
  const hostname = `${name}.local`;
  const mdns = mdnsFactory({ multicast: true, reuseAddr: true }) as MdnsInstance;
  const records = recordsFor(name, port, address);
  let stopped = false;
  const onQuery = (packet: Query) => {
    if (stopped) return;
    const asked = packet.questions ?? [];
    const matched = records.filter((record) =>
      asked.some((question) =>
        question.name.toLowerCase().replace(/\.$/, "") === record.name.toLowerCase()
        && (question.type === record.type || question.type === "ANY")
      )
    );
    if (matched.length) {
      mdns.respond({ answers: matched, additionals: records.filter((r) => r.type === "A" && !matched.includes(r)) });
    }
  };
  mdns.on("query", onQuery);
  mdns.respond({ answers: records });
  const periodic = setInterval(() => {
    if (!stopped) mdns.respond({ answers: records });
  }, 60000);
  periodic.unref();
  return {
    hostname,
    stop() {
      if (stopped) return Promise.resolve();
      stopped = true;
      clearInterval(periodic);
      return new Promise<void>((resolve) => {
        mdns.respond({ answers: records.map((record) => ({ ...record, ttl: 0 })) }, () => mdns.destroy(resolve));
      });
    },
  };
}
