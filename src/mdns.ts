// bonjour-service ships as `export = Bonjour` (classic CJS), so the
// default import IS the constructor itself — no named-export interop
// to rely on.
import Bonjour from "bonjour-service";

export interface Advertisement {
  hostname: string;
  stop(): Promise<void>;
}

/**
 * Advertise `<name>.local` over mDNS for the given port.
 *
 * bonjour-service's `host` option is used verbatim as the A/AAAA/SRV
 * record target — it does NOT append `.local` itself (only the internal
 * service-type record gets that suffix) — so we build the hostname here
 * and pass it through explicitly.
 */
export function advertise(name: string, port: number): Advertisement {
  const bonjour = new Bonjour();
  const hostname = `${name}.local`;

  const service = bonjour.publish({
    name,
    host: hostname,
    type: "http",
    port,
  });

  let stopped = false;
  const stop = () =>
    new Promise<void>((resolve) => {
      if (stopped) {
        resolve();
        return;
      }
      stopped = true;
      service.stop(() => {
        bonjour.destroy();
        resolve();
      });
    });

  return { hostname, stop };
}
