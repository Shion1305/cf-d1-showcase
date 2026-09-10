import { readFileSync } from "node:fs";
import { environment, requireEnv, cli } from "./lib/process.mjs";

const target = environment(process.argv[2]);
const path = `.wrangler.${target}.json`;
const config = JSON.parse(readFileSync(path, "utf8"));
if (
  config.vars.APP_ENV !== target ||
  !config.name.endsWith(`-${target}`) ||
  config.vars.DATABASE_MODE !== "remote"
) {
  throw new Error(
    "The generated config does not match the release environment.",
  );
}
if (config.account_id !== requireEnv("CLOUDFLARE_ACCOUNT_ID"))
  throw new Error("Deployment account does not match the generated config.");
if (
  config.d1_databases.some(
    (binding) => binding.remote || /^0+(?:-0+)*$/.test(binding.database_id),
  )
) {
  throw new Error(
    "Refusing a local or remote-development config for deployment.",
  );
}
requireEnv("CLOUDFLARE_API_TOKEN");
// Build is supplied by CI or pnpm build:worker. Never rebuild during promotion.
readFileSync(".open-next/worker.js");
cli("wrangler", [
  "d1",
  "migrations",
  "apply",
  "DB",
  "--remote",
  "--config",
  path,
]);
cli("opennextjs-cloudflare", ["deploy", "--config", path]);
