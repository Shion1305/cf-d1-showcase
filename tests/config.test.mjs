import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import test from "node:test";
import { makeConfig, remoteDevConfig } from "../scripts/lib/config.mjs";

const base = JSON.parse(
  readFileSync(new URL("../wrangler.json", import.meta.url), "utf8"),
);
const sha = "c".repeat(40);
function outputs(environment) {
  const name = `cf-d1-showcase-${environment}`;
  return {
    deployment: {
      value: {
        environment,
        account_id: "a".repeat(32),
        worker_name: name,
        database_id: "12345678-1234-1234-1234-123456789abc",
        database_name: `${name}-db`,
        secrets_store_id: "b".repeat(32),
        api_key_secret_name: `${name}-admin-api-key`,
      },
    },
  };
}

test("all cloud environments bind explicitly and preserve runtime compatibility", () => {
  for (const env of ["dev", "staging", "production"]) {
    const result = makeConfig(base, outputs(env), env, sha);
    assert.equal(result.vars.APP_ENV, env);
    assert.equal(result.vars.RELEASE_SHA, sha);
    assert.equal(result.compatibility_date, base.compatibility_date);
    assert.deepEqual(result.compatibility_flags, base.compatibility_flags);
    assert.equal(result.services[0].service, result.name);
    assert.equal(
      result.secrets_store_secrets[0].secret_name,
      `${result.name}-admin-api-key`,
    );
    assert.equal(result.d1_databases[0].remote, undefined);
  }
});

test("a staging output cannot accidentally target production", () => {
  assert.throws(
    () => makeConfig(base, outputs("staging"), "production"),
    /does not match/,
  );
  const mixed = outputs("production");
  mixed.deployment.value.database_name = "cf-d1-showcase-staging-db";
  assert.throws(() => makeConfig(base, mixed, "production"), /Database name/);
});

test("reject placeholders, wrong secret names, unknown targets, and invalid revisions", () => {
  const local = outputs("dev");
  local.deployment.value.database_id = base.d1_databases[0].database_id;
  assert.throws(() => makeConfig(base, local, "dev"), /placeholder/);
  const secret = outputs("staging");
  secret.deployment.value.api_key_secret_name =
    "cf-d1-showcase-production-admin-api-key";
  assert.throws(() => makeConfig(base, secret, "staging"), /Secret name/);
  assert.throws(() => makeConfig(base, outputs("dev"), "test"), /Environment/);
  assert.throws(
    () => makeConfig(base, outputs("dev"), "dev", "untrusted\nvalue"),
    /revision/,
  );
});

test("remote development uses only dev D1 and never a deployed secret", () => {
  const result = remoteDevConfig(base, makeConfig(base, outputs("dev"), "dev"));
  assert.equal(result.d1_databases[0].remote, true);
  assert.deepEqual(result.secrets_store_secrets, base.secrets_store_secrets);
  for (const env of ["staging", "production"]) {
    assert.throws(
      () => remoteDevConfig(base, makeConfig(base, outputs(env), env)),
      /only supports dev/,
    );
  }
});
