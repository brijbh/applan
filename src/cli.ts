#!/usr/bin/env node
import spawn from "cross-spawn";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { advertise, type Advertisement } from "./mdns.js";
import { scanLineForPort } from "./detectPort.js";
import { resolveAppName, sanitizeLabel } from "./name.js";
import { parseArgs } from "./args.js";

const HELP = `Usage: applan [options] [--] <command> [args...]

Runs <command> (typically your normal dev-server command, e.g. "npm run dev")
and additionally advertises it on your LAN as http://<appname>.local:<port>,
using mDNS (Bonjour/Zeroconf) so other devices on the same WiFi — phones,
tablets, other computers — can reach it by name instead of by IP address.

<appname> defaults to the "name" field of the nearest package.json, or the
current folder name if there isn't one; override it with --name.

No admin/sudo privileges are required, and nothing is persisted: the mDNS
advertisement exists only while <command> is running and is withdrawn the
moment it exits.

Examples:
  applan -- npm run dev
  applan npm run dev
  applan --name myapp -- vite --host

Options:
  -n, --name <name>   Use this name instead of auto-detecting one
  -h, --help          Show this help
  --version           Show the installed version
`;

function readVersion(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  try {
    const pkg = JSON.parse(
      readFileSync(join(here, "..", "package.json"), "utf8"),
    ) as { version?: string };
    return pkg.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const parsed = parseArgs(argv);

  if (parsed.kind === "help") {
    process.stdout.write(HELP);
    return;
  }
  if (parsed.kind === "version") {
    process.stdout.write(`${readVersion()}\n`);
    return;
  }
  if (parsed.kind === "error") {
    process.stderr.write(`applan: ${parsed.message}\n\n`);
    process.stdout.write(HELP);
    process.exitCode = 1;
    return;
  }

  const [cmd, ...cmdArgs] = parsed.commandArgs;
  const appName =
    parsed.name !== undefined ? sanitizeLabel(parsed.name) : resolveAppName(process.cwd());

  const child = spawn(cmd, cmdArgs, {
    stdio: ["inherit", "pipe", "pipe"],
  });

  let advertisement: Advertisement | undefined;
  let announced = false;

  const handleChunk = (chunk: Buffer, isStdout: boolean) => {
    const stream = isStdout ? process.stdout : process.stderr;
    stream.write(chunk);
    if (announced) return;
    for (const line of chunk.toString("utf8").split(/\r?\n/)) {
      const port = scanLineForPort(line);
      if (port !== undefined) {
        announced = true;
        advertisement = advertise(appName, port);
        process.stdout.write(
          `\n➜  applan:  http://${advertisement.hostname}:${port}   (visible to devices on this WiFi)\n` +
            `    Note: some dev servers reject unrecognized hostnames by default\n` +
            `    (e.g. Vite 5+: "Blocked request" — add "${advertisement.hostname}" to\n` +
            `    server.allowedHosts in your config to allow it).\n\n`,
        );
        break;
      }
    }
  };

  child.stdout?.on("data", (chunk: Buffer) => handleChunk(chunk, true));
  child.stderr?.on("data", (chunk: Buffer) => handleChunk(chunk, false));

  process.on("SIGINT", () => child.kill("SIGINT"));
  process.on("SIGTERM", () => child.kill("SIGTERM"));

  const exitCode = await new Promise<number>((resolve) => {
    child.on("exit", (code, signal) => {
      resolve(code ?? (signal ? 1 : 0));
    });
    child.on("error", (err) => {
      process.stderr.write(`applan: failed to start "${cmd}": ${err.message}\n`);
      resolve(1);
    });
  });

  if (advertisement) {
    await advertisement.stop();
  }
  process.exitCode = exitCode;
}

main();
