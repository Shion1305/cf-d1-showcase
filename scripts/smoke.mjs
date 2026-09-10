import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { setTimeout } from "node:timers/promises";

const base = new URL(process.env.SMOKE_BASE_URL ?? "http://localhost:8787");
const expectedEnv = process.env.EXPECTED_ENV ?? "local";
const key = process.env.SMOKE_API_KEY;
if (
  key &&
  base.protocol !== "https:" &&
  !["localhost", "127.0.0.1"].includes(base.hostname)
) {
  throw new Error("API keys may only be sent over HTTPS or to localhost.");
}

async function request(path, init) {
  return fetch(new URL(path, base), {
    ...init,
    redirect: "error",
    signal: AbortSignal.timeout(15_000),
  });
}

let health;
for (let attempt = 0; attempt < 12; attempt++) {
  try {
    const response = await request("/api/health");
    assert.equal(response.status, 200);
    health = await response.json();
    assert.equal(health.ok, true);
    assert.equal(health.environment, expectedEnv);
    if (process.env.EXPECTED_SHA)
      assert.equal(health.release, process.env.EXPECTED_SHA);
    break;
  } catch (error) {
    if (attempt === 11) throw error;
    await setTimeout(2500);
  }
}
assert.equal(health.secret, "ready");
assert.equal(health.database, "ready");
assert.deepEqual(
  health.migrations,
  readdirSync("migrations")
    .filter((name) => name.endsWith(".sql"))
    .sort(),
);
const list = await request("/api/checkpoints");
assert.equal(list.status, 200);
assert.ok(Array.isArray((await list.json()).checkpoints));
assert.equal(
  (await request("/api/checkpoints", { method: "POST" })).status,
  401,
);

if (key) {
  const headers = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
  const response = await request("/api/checkpoints", {
    method: "POST",
    headers,
    body: JSON.stringify({ title: `smoke-${crypto.randomUUID()}` }),
  });
  assert.equal(response.status, 201);
  const { checkpoint } = await response.json();
  try {
    const updated = await request(`/api/checkpoints/${checkpoint.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "verified" }),
    });
    assert.equal(updated.status, 200);
    assert.equal((await updated.json()).checkpoint.status, "verified");
  } finally {
    const removed = await request(`/api/checkpoints/${checkpoint.id}`, {
      method: "DELETE",
      headers,
    });
    assert.equal(removed.status, 204);
  }
}
console.log(
  `Smoke passed: ${expectedEnv}, release ${health.release}, D1 + Secrets Store ready${key ? ", authenticated writes verified" : ""}.`,
);
