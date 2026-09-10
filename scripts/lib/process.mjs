import { spawnSync } from "node:child_process";

export function run(command, args, options = {}) {
  const { capture = false, ...rest } = options;
  const result = spawnSync(command, args, {
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
    encoding: "utf8",
    ...rest,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} ${args[0] ?? ""} failed (exit ${result.status}).`,
    );
  return result.stdout;
}

export function cli(binary, args, options) {
  return run("pnpm", ["exec", binary, ...args], options);
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`Set ${name} first. See docs/deployment.md.`);
  return value;
}

export function environment(value) {
  if (!["dev", "staging", "production"].includes(value)) {
    throw new Error("Environment must be dev, staging, or production.");
  }
  return value;
}
