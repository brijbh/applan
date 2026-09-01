export type ParsedArgs =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "error"; message: string }
  | { kind: "run"; name?: string; commandArgs: string[] };

/**
 * applan's own flags (--help, --version, --name/-n) must come before the
 * wrapped command — the first token that isn't one of them, or an explicit
 * `--`, marks the start of the command and everything after it is passed
 * through untouched.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  if (argv.length === 0) {
    return { kind: "error", message: "no command given" };
  }

  let i = 0;
  let name: string | undefined;

  while (i < argv.length) {
    const arg = argv[i];

    if (arg === "--") {
      i++;
      break;
    }
    if (arg === "--help" || arg === "-h") {
      return { kind: "help" };
    }
    if (arg === "--version") {
      return { kind: "version" };
    }
    if (arg === "--name" || arg === "-n") {
      const value = argv[i + 1];
      if (value === undefined) {
        return { kind: "error", message: `${arg} requires a value` };
      }
      name = value;
      i += 2;
      continue;
    }
    if (arg.startsWith("--name=")) {
      name = arg.slice("--name=".length);
      i += 1;
      continue;
    }

    break;
  }

  const commandArgs = argv.slice(i);
  if (commandArgs.length === 0) {
    return { kind: "error", message: "no command given" };
  }
  return { kind: "run", name, commandArgs };
}
