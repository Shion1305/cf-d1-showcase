import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { environment, requireEnv, run } from "./lib/process.mjs";

const [action, candidate] = process.argv.slice(2);
const target = environment(candidate);
if (!["init", "plan", "apply", "output"].includes(action))
  throw new Error(
    "Usage: pnpm infra <init|plan|apply|output> <dev|staging|production>",
  );
const account = requireEnv("CLOUDFLARE_ACCOUNT_ID");
if (!/^[a-f0-9]{32}$/.test(account))
  throw new Error("Invalid CLOUDFLARE_ACCOUNT_ID.");
const project = process.env.PROJECT_NAME ?? "cf-d1-showcase";
if (!/^[a-z][a-z0-9-]{2,34}$/.test(project))
  throw new Error(
    "PROJECT_NAME must be 3–35 lowercase letters, numbers, or hyphens.",
  );
requireEnv("AWS_ACCESS_KEY_ID");
requireEnv("AWS_SECRET_ACCESS_KEY");
requireEnv("CLOUDFLARE_API_TOKEN");

const env = {
  ...process.env,
  TF_DATA_DIR: resolve(`infra/.terraform-${target}`),
  TF_VAR_account_id: account,
  TF_VAR_environment: target,
  TF_VAR_project_name: project,
  TF_VAR_secrets_store_id: requireEnv("SECRETS_STORE_ID"),
};
function terraform(args, capture = false) {
  return run("terraform", ["-chdir=infra", ...args], { env, capture });
}

// Both backend key and local Terraform metadata are isolated by environment.
terraform([
  "init",
  "-input=false",
  "-reconfigure",
  `-backend-config=bucket=${requireEnv("TF_STATE_BUCKET")}`,
  `-backend-config=key=${project}/${target}/terraform.tfstate`,
  `-backend-config=endpoints={s3="https://${account}.r2.cloudflarestorage.com"}`,
]);

if (action === "plan" || action === "apply") {
  terraform([
    "plan",
    "-input=false",
    "-lock-timeout=5m",
    `-out=${target}.tfplan`,
  ]);
}
if (action === "apply")
  terraform(["apply", "-input=false", "-lock-timeout=5m", `${target}.tfplan`]);
if (action === "apply" || action === "output") {
  writeFileSync(
    `infra/outputs.${target}.json`,
    terraform(["output", "-json"], true),
  );
  console.log(
    `Wrote infra/outputs.${target}.json. Next: pnpm config:generate ${target}`,
  );
}
