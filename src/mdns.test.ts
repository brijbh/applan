import { describe, expect, it } from "vitest";
import { recordsFor, selectLanIPv4 } from "./mdns.js";

describe("Applan LAN-only DNS", () => {
  it("prefers actual Wi-Fi/Ethernet addresses over VPN and Docker", () => {
    const address = selectLanIPv4({
      tailscale0: [{ address: "100.122.44.114", family: "IPv4", internal: false }],
      docker0: [{ address: "172.17.0.1", family: "IPv4", internal: false }],
      wlp2s0: [{ address: "192.168.86.120", family: "IPv4", internal: false }],
      lo: [{ address: "127.0.0.1", family: "IPv4", internal: true }],
    } as ReturnType<typeof import("node:os").networkInterfaces>);
    expect(address).toBe("192.168.86.120");
  });

  it("does not advertise a public or tailnet address as LAN", () => {
    expect(selectLanIPv4({
      tailscale0: [{ address: "100.122.44.114", family: "IPv4", internal: false }],
      eth0: [{ address: "8.8.8.8", family: "IPv4", internal: false }],
    } as ReturnType<typeof import("node:os").networkInterfaces>)).toBeUndefined();
  });

  it("publishes only the chosen A record, with matching SRV target", () => {
    const records = recordsFor("silkboard", 8767, "192.168.86.120");
    const addresses = records.filter((r) => r.type === "A");
    expect(addresses).toEqual([{ name: "silkboard.local", type: "A", ttl: 120, data: "192.168.86.120" }]);
    expect(records.find((r) => r.type === "SRV")?.data).toMatchObject({ port: 8767, target: "silkboard.local" });
    expect(records.some((r) => r.type === "AAAA")).toBe(false);
  });
});
