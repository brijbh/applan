import { describe, expect, it } from "vitest";
import { scanLineForPort } from "../src/detectPort.js";

describe("scanLineForPort", () => {
  it("matches Vite's banner", () => {
    expect(scanLineForPort("  ➜  Local:   http://localhost:5173/")).toBe(5173);
  });

  it("matches Vite's banner even when colorized with ANSI codes splitting the port digits", () => {
    // Real output captured from `vite --host`, piped (non-TTY) stdout:
    const line = "  \x1b[32m\x1b[1mLocal\x1b[22m:   \x1b[36mhttp://localhost:\x1b[1m5174\x1b[22m/\x1b[39m";
    expect(scanLineForPort(line)).toBe(5174);
  });

  it("matches Create React App's banner", () => {
    expect(
      scanLineForPort("You can now view my-app in the browser.\n  Local:            http://localhost:3000"),
    ).toBe(3000);
  });

  it("matches Next.js's banner", () => {
    expect(scanLineForPort("- Local:        http://localhost:3000")).toBe(3000);
  });

  it("matches a plain http.listen log with an IP", () => {
    expect(scanLineForPort("Server listening on http://127.0.0.1:8080")).toBe(8080);
  });

  it("matches 0.0.0.0-bound servers", () => {
    expect(scanLineForPort("Listening on http://0.0.0.0:4000")).toBe(4000);
  });

  it("recognizes custom HTTPS server hostnames", () => {
    expect(scanLineForPort("> Beagle production server ready on https://beagle:3000")).toBe(3000);
    expect(scanLineForPort("Server ready at https://my-app.local:3443")).toBe(3443);
  });

  it("returns undefined for unrelated lines", () => {
    expect(scanLineForPort("Compiled successfully!")).toBeUndefined();
    expect(scanLineForPort("")).toBeUndefined();
  });

  it("returns undefined for a URL with no port", () => {
    expect(scanLineForPort("See https://example.com for docs")).toBeUndefined();
  });

  it("ignores out-of-range port-like numbers", () => {
    expect(scanLineForPort("http://localhost:99999")).toBeUndefined();
  });
});
