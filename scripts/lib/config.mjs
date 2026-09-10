import { environment } from "./process.mjs";

function checked(value, pattern, name) {
  if (typeof value !== "string" || !pattern.test(value))
    throw new Error(`Invalid ${name}.`);
  return value;
}

export function makeConfig(base, outputs, target, revision = "manual") {
  environment(target);
  const resource = outputs.deployment?.value;
  if (!resource || resource.environment !== target)
    throw new Error(
      "Terraform output environment does not match the deployment target.",
    );
  const account = checked(
    resource.account_id,
    /^[a-f0-9]{32}$/,
    "Cloudflare account ID",
  );
  const id = checked(
    resource.database_id,
    /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
    "D1 ID",
  );
  if (/^0+(?:-0+)*$/.test(id))
    throw new Error("Refusing to deploy the local placeholder database.");
  const name = checked(
    resource.worker_name,
    /^[a-z][a-z0-9-]{1,53}$/,
    "Worker name",
  );
  if (!name.endsWith(`-${target}`))
    throw new Error("Worker name must end in the target environment.");
  const databaseName = checked(
    resource.database_name,
    /^[a-z][a-z0-9-]+$/,
    "database name",
  );
  if (databaseName !== `${name}-db`)
    throw new Error("Database name does not match the Worker environment.");
  const store = checked(
    resource.secrets_store_id,
    /^[a-f0-9]{32}$/,
    "Secrets Store ID",
  );
  if (/^0+$/.test(store))
    throw new Error("A remote Secrets Store ID is required.");
  if (resource.api_key_secret_name !== `${name}-admin-api-key`)
    throw new Error("Secret name does not match the target environment.");

  return {
    ...base,
    name,
    account_id: account,
    vars: {
      APP_ENV: target,
      DATABASE_MODE: "remote",
      RELEASE_SHA: checked(
        revision,
        /^(?:[a-f0-9]{40}|manual)$/,
        "release revision",
      ),
    },
    services: [{ binding: "WORKER_SELF_REFERENCE", service: name }],
    d1_databases: [
      {
        binding: "DB",
        database_name: databaseName,
        database_id: id,
        migrations_dir: "migrations",
      },
    ],
    secrets_store_secrets: [
      {
        binding: "ADMIN_API_KEY",
        store_id: store,
        secret_name: resource.api_key_secret_name,
      },
    ],
  };
}

export function remoteDevConfig(base, deployed) {
  if (deployed.vars.APP_ENV !== "dev" || !deployed.name.endsWith("-dev"))
    throw new Error("Remote development only supports dev.");
  return {
    ...deployed,
    d1_databases: deployed.d1_databases.map((binding) => ({
      ...binding,
      remote: true,
    })),
    // Secrets Store has no remote development binding. Keep the local fake secret.
    secrets_store_secrets: base.secrets_store_secrets,
  };
}
