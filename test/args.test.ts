import { describe, expect, it } from "vitest";
import { parseArgs } from "../src/args.js";

describe("parseArgs", () => {
  it("treats the first non-flag token as the start of the command", () => {
    expect(parseArgs(["npm", "run", "dev"])).toEqual({
      kind: "run",
      name: undefined,
      commandArgs: ["npm", "run", "dev"],
    });
  });

  it("supports an explicit -- separator", () => {
    expect(parseArgs(["--", "npm", "run", "dev"])).toEqual({
      kind: "run",
      name: undefined,
      commandArgs: ["npm", "run", "dev"],
    });
  });

  it("parses --name <value> before the command", () => {
    expect(parseArgs(["--name", "myapp", "--", "npm", "run", "dev"])).toEqual({
      kind: "run",
      name: "myapp",
      commandArgs: ["npm", "run", "dev"],
    });
  });

  it("parses -n <value> before the command", () => {
    expect(parseArgs(["-n", "myapp", "vite", "--host"])).toEqual({
      kind: "run",
      name: "myapp",
      commandArgs: ["vite", "--host"],
    });
  });

  it("parses --name=value form", () => {
    expect(parseArgs(["--name=myapp", "vite"])).toEqual({
      kind: "run",
      name: "myapp",
      commandArgs: ["vite"],
    });
  });

  it("does not mistake the wrapped command's own --name-like flags for applan's", () => {
    // Once the command starts, everything after it is passed through verbatim.
    expect(parseArgs(["vite", "--name", "something"])).toEqual({
      kind: "run",
      name: undefined,
      commandArgs: ["vite", "--name", "something"],
    });
  });

  it("recognizes --help and -h", () => {
    expect(parseArgs(["--help"])).toEqual({ kind: "help" });
    expect(parseArgs(["-h"])).toEqual({ kind: "help" });
  });

  it("recognizes --version", () => {
    expect(parseArgs(["--version"])).toEqual({ kind: "version" });
  });

  it("errors when no command is given", () => {
    expect(parseArgs([])).toEqual({ kind: "error", message: "no command given" });
    expect(parseArgs(["--name", "myapp"])).toEqual({
      kind: "error",
      message: "no command given",
    });
    expect(parseArgs(["--"])).toEqual({ kind: "error", message: "no command given" });
  });

  it("errors when --name is missing its value", () => {
    expect(parseArgs(["--name"])).toEqual({
      kind: "error",
      message: "--name requires a value",
    });
  });
});
