/**
 * Matches the "Local: http://localhost:PORT/" style banner printed by
 * Vite, CRA, Next.js, Astro, SvelteKit, and most plain http.listen logs.
 */
const PORT_BANNER = /https?:\/\/(?:[a-z0-9][a-z0-9.-]*|\[::1?\]):(\d{2,5})\b/i;

/**
 * Strips ANSI SGR color codes (e.g. `\x1b[1m`). Tools like Vite colorize
 * their banner even when stdout is piped (not a real TTY), which can split
 * digits like "localhost:" + "\x1b[1m" + "5173" apart — stripping first
 * keeps the port regex matching the visible text a human would read.
 */
const ANSI_SGR = /\x1b\[[0-9;]*m/g;

/** Scan a line of dev-server output for a port; returns undefined if none found. */
export function scanLineForPort(line: string): number | undefined {
  const match = PORT_BANNER.exec(line.replace(ANSI_SGR, ""));
  if (!match) return undefined;
  const port = Number(match[1]);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : undefined;
}
