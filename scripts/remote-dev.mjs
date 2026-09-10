import { readFileSync, writeFileSync } from "node:fs";
import { remoteDevConfig } from "./lib/config.mjs";
import { cli } from "./lib/process.mjs";

if (process.argv.length > 2)
  throw new Error(
    "dev:remote always targets dev. Do not pass a production or staging environment.",
  );
const config = remoteDevConfig(
  JSON.parse(readFileSync("wrangler.json", "utf8")),
  JSON.parse(readFileSync(".wrangler.dev.json", "utf8")),
);
const path = ".wrangler.dev-remote.json";
writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
console.log(
  "Starting local Next.js with REAL DEV D1 and LOCAL Secrets Store. Writes change the dev database.",
);
cli("next", ["dev"], {
  env: { ...process.env, SHOWCASE_WRANGLER_CONFIG: path },
});
