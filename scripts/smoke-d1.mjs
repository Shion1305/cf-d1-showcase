import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
import { environment, cli } from "./lib/process.mjs";

const target = environment(process.argv[2]);
const path = `.wrangler.${target}.json`;
const config = JSON.parse(readFileSync(path, "utf8"));
if (
  config.vars.APP_ENV !== target ||
  config.d1_databases[0].database_name !== `${config.name}-db`
)
  throw new Error("Mismatched database target.");
const id = `smoke-${crypto.randomUUID()}`;
function query(sql) {
  return JSON.parse(
    cli(
      "wrangler",
      [
        "d1",
        "execute",
        "DB",
        "--remote",
        "--config",
        path,
        "--command",
        sql,
        "--json",
      ],
      { capture: true },
    ),
  );
}
try {
  query(
    `INSERT INTO checkpoints (id, title) VALUES ('${id}', 'Deployment database probe')`,
  );
  query(`UPDATE checkpoints SET status = 'verified' WHERE id = '${id}'`);
  assert.equal(
    query(`SELECT status FROM checkpoints WHERE id = '${id}'`)[0].results[0]
      .status,
    "verified",
  );
} finally {
  query(`DELETE FROM checkpoints WHERE id = '${id}'`);
}
console.log(`Remote D1 insert/update/read/delete passed for ${target}.`);
