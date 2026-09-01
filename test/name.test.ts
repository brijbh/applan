import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { resolveAppName, sanitizeLabel } from "../src/name.js";

describe("sanitizeLabel", () => {
  it("lowercases and keeps simple names as-is", () => {
    expect(sanitizeLabel("gavipuram")).toBe("gavipuram");
    expect(sanitizeLabel("Gavipuram")).toBe("gavipuram");
  });

  it("collapses invalid characters to a single hyphen", () => {
    expect(sanitizeLabel("@scope/my_app!!")).toBe("scope-my-app");
    expect(sanitizeLabel("my   app")).toBe("my-app");
  });

  it("strips leading/trailing hyphens", () => {
    expect(sanitizeLabel("--weird--")).toBe("weird");
  });

  it("never returns an empty label", () => {
    expect(sanitizeLabel("!!!")).toBe("app");
    expect(sanitizeLabel("")).toBe("app");
  });

  it("truncates to 63 characters", () => {
    const long = "a".repeat(100);
    expect(sanitizeLabel(long).length).toBe(63);
  });

  it("rejects mDNS/shell metacharacters instead of passing them through", () => {
    const result = sanitizeLabel("app`; rm -rf /`.local");
    expect(result).toMatch(/^[a-z0-9-]+$/);
  });
});

describe("resolveAppName", () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
  });

  it("uses the name field from the nearest package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "applan-test-"));
    dirs.push(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "My Cool App" }));
    expect(resolveAppName(dir)).toBe("my-cool-app");
  });

  it("falls back to the folder name when there is no package.json", () => {
    const dir = mkdtempSync(join(tmpdir(), "applan-test-"));
    dirs.push(dir);
    const expected = sanitizeLabel(dir.split(/[\\/]/).pop()!);
    expect(resolveAppName(dir)).toBe(expected);
  });

  it("falls back to the folder name when package.json has no name field", () => {
    const dir = mkdtempSync(join(tmpdir(), "applan-test-"));
    dirs.push(dir);
    writeFileSync(join(dir, "package.json"), JSON.stringify({ version: "1.0.0" }));
    const expected = sanitizeLabel(dir.split(/[\\/]/).pop()!);
    expect(resolveAppName(dir)).toBe(expected);
  });

  it("falls back to the folder name when package.json is malformed", () => {
    const dir = mkdtempSync(join(tmpdir(), "applan-test-"));
    dirs.push(dir);
    writeFileSync(join(dir, "package.json"), "{not valid json");
    const expected = sanitizeLabel(dir.split(/[\\/]/).pop()!);
    expect(resolveAppName(dir)).toBe(expected);
  });
});
