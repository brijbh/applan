#!/usr/bin/env node
import spawn from "cross-spawn";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { advertise, type Advertisement } from "./mdns.js";
import { scanLineForPort } from "./detectPort.js";
import { resolveAppName } from "./name.js";

const HELP = `Usage: applan [--] <command> [args...]

Runs <command> (typically your normal dev-server command, e.g. "npm run dev")
and additionally advertises it on your LAN as http://<appname>.local:<port>,
using mDNS (Bonjour/Zeroconf) so other devices on the same WiFi — phones,
tablets, other computers — can reach it by name instead of by IP address.

<appname> comes from the "name" field of the nearest package.json, or the
current folder name if there isn't one.

No admin/sudo privileges are required, and nothing is persisted: the mDNS
advertisement exists only while <command> is running and is withdrawn the
moment it exits.

Examples:
  applan -- npm run dev
  applan npm run dev
  applan -- vite --host

Options:
  -h, --help       Show this help
  --version        Show the installed version
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

  if (argv.length === 0 || argv[0] === "--help" || argv[0] === "-h") {
    process.stdout.write(HELP);
    process.exitCode = argv.length === 0 ? 1 : 0;
    return;
  }
  if (argv[0] === "--version") {
    process.stdout.write(`${readVersion()}\n`);
    return;
  }

  const commandArgs = argv[0] === "--" ? argv.slice(1) : argv;
  if (commandArgs.length === 0) {
    process.stderr.write("applan: no command given\n\n");
    process.stdout.write(HELP);
    process.exitCode = 1;
    return;
  }

  const [cmd, ...cmdArgs] = commandArgs;
  const appName = resolveAppName(process.cwd());

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
