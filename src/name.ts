import { readFileSync, existsSync } from "node:fs";
import { join, dirname, parse as parsePath, basename } from "node:path";

/**
 * Sanitize arbitrary input into a single valid DNS label: lowercase,
 * [a-z0-9-] only, no leading/trailing hyphen, max 63 chars. This is the
 * boundary that keeps unsanitized package.json/folder names from ever
 * reaching the mDNS advertisement.
 */
export function sanitizeLabel(input: string): string {
  const collapsed = input
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");
  const trimmed = collapsed.slice(0, 63).replace(/-+$/g, "");
  return trimmed.length > 0 ? trimmed : "app";
}

function findNearestPackageJsonName(startDir: string): string | undefined {
  let dir = startDir;
  const root = parsePath(dir).root;
  for (;;) {
    const candidate = join(dir, "package.json");
    if (existsSync(candidate)) {
      try {
        const parsed = JSON.parse(readFileSync(candidate, "utf8")) as {
          name?: unknown;
        };
        if (typeof parsed.name === "string" && parsed.name.trim().length > 0) {
          return parsed.name;
        }
      } catch {
        // Malformed package.json — fall through to folder-name resolution.
      }
      return undefined;
    }
    if (dir === root) return undefined;
    dir = dirname(dir);
  }
}

/** Resolve the app name to advertise: nearest package.json `name`, else the folder name. */
export function resolveAppName(cwd: string): string {
  const fromPackageJson = findNearestPackageJsonName(cwd);
  const raw = fromPackageJson ?? basename(cwd);
  return sanitizeLabel(raw);
}
