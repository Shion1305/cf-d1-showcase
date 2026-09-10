import { copyFileSync, existsSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { cli } from "./lib/process.mjs";

if (!existsSync(".dev.vars")) copyFileSync(".dev.vars.example", ".dev.vars");
const config = JSON.parse(readFileSync("wrangler.json", "utf8"));
if (
  config.vars.APP_ENV !== "local" ||
  config.d1_databases.some((binding) => binding.remote)
) {
  throw new Error(
    "setup:local requires the local-only wrangler.json configuration.",
  );
}
cli("wrangler", [
  "d1",
  "migrations",
  "apply",
  "DB",
  "--local",
  "--config",
  "wrangler.json",
]);
cli("wrangler", [
  "d1",
  "execute",
  "DB",
  "--local",
  "--config",
  "wrangler.json",
  "--file",
  "seeds/local.sql",
]);

const secret = config.secrets_store_secrets[0];
// Listing returns metadata, never a value. Re-running setup preserves an existing local key.
const listing = spawnSync(
  "pnpm",
  [
    "exec",
    "wrangler",
    "secrets-store",
    "secret",
    "list",
    secret.store_id,
    "--config",
    "wrangler.json",
  ],
  { encoding: "utf8" },
);
if (listing.error) throw listing.error;
if (
  listing.status !== 0 &&
  !listing.stderr.includes("List request returned no secrets")
) {
  throw new Error(
    "Could not inspect the local Secrets Store. Run wrangler secrets-store secret list locally to diagnose.",
  );
}
if (!listing.stdout.includes(secret.secret_name)) {
  cli("wrangler", [
    "secrets-store",
    "secret",
    "create",
    secret.store_id,
    "--name",
    secret.secret_name,
    "--scopes",
    "workers",
    "--value",
    "local-showcase-only",
    "--config",
    "wrangler.json",
  ]);
}
console.log(
  "Local bindings ready. Run pnpm dev. The fake local write key is local-showcase-only.",
);
