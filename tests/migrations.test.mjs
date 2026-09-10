import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cli } from "../scripts/lib/process.mjs";

test(
  "a populated v1 database upgrades without losing data, and replay is safe",
  { timeout: 120_000 },
  () => {
    const state = mkdtempSync(join(tmpdir(), "d1-showcase-migration-"));
    const args = [
      "--local",
      "--config",
      "wrangler.json",
      "--persist-to",
      state,
    ];
    function sql(command) {
      return JSON.parse(
        cli(
          "wrangler",
          ["d1", "execute", "DB", ...args, "--command", command, "--json"],
          { capture: true },
        ),
      );
    }
    try {
      cli(
        "wrangler",
        [
          "d1",
          "execute",
          "DB",
          ...args,
          "--file",
          "migrations/0001_create_checkpoints.sql",
        ],
        { capture: true },
      );
      sql(
        "INSERT INTO checkpoints (id, title) VALUES ('existing', 'Before upgrade'); CREATE TABLE d1_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL); INSERT INTO d1_migrations (name) VALUES ('0001_create_checkpoints.sql');",
      );
      cli("wrangler", ["d1", "migrations", "apply", "DB", ...args], {
        capture: true,
      });
      cli("wrangler", ["d1", "migrations", "apply", "DB", ...args], {
        capture: true,
      });
      const rows = sql("SELECT id, title, status FROM checkpoints")[0].results;
      assert.deepEqual(rows, [
        { id: "existing", title: "Before upgrade", status: "open" },
      ]);
      assert.equal(
        sql("SELECT COUNT(*) AS count FROM d1_migrations")[0].results[0].count,
        2,
      );
      sql(
        "INSERT INTO checkpoints (id, title) VALUES ('old-app', 'Old application still works')",
      );
      assert.equal(
        sql("SELECT status FROM checkpoints WHERE id = 'old-app'")[0].results[0]
          .status,
        "open",
      );
    } finally {
      rmSync(state, { recursive: true, force: true });
    }
  },
);
