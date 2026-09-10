import { readFileSync, writeFileSync } from "node:fs";
import { makeConfig } from "./lib/config.mjs";
import { environment } from "./lib/process.mjs";

const target = environment(process.argv[2]);
const outputFile = process.argv[3] ?? `infra/outputs.${target}.json`;
const config = makeConfig(
  JSON.parse(readFileSync("wrangler.json", "utf8")),
  JSON.parse(readFileSync(outputFile, "utf8")),
  target,
  process.env.RELEASE_SHA ?? process.env.GITHUB_SHA ?? "manual",
);
writeFileSync(
  `.wrangler.${target}.json`,
  `${JSON.stringify(config, null, 2)}\n`,
);
console.log(
  `Generated .wrangler.${target}.json from Terraform output (references only).`,
);
