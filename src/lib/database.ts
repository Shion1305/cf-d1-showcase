import type { D1Database } from "@cloudflare/workers-types";
import type { Checkpoint } from "./types";

const columns = "id, title, status, created_at";

export async function listCheckpoints(db: D1Database): Promise<Checkpoint[]> {
  const { results } = await db
    .prepare(
      `SELECT ${columns} FROM checkpoints ORDER BY created_at DESC, id DESC LIMIT 100`,
    )
    .all<Checkpoint>();
  return results;
}

export async function createCheckpoint(db: D1Database, title: string) {
  return db
    .prepare(
      `INSERT INTO checkpoints (id, title) VALUES (?, ?) RETURNING ${columns}`,
    )
    .bind(crypto.randomUUID(), title)
    .first<Checkpoint>();
}

export async function setCheckpointStatus(
  db: D1Database,
  id: string,
  status: Checkpoint["status"],
) {
  return db
    .prepare(
      `UPDATE checkpoints SET status = ? WHERE id = ? RETURNING ${columns}`,
    )
    .bind(status, id)
    .first<Checkpoint>();
}

export async function deleteCheckpoint(db: D1Database, id: string) {
  return db
    .prepare("DELETE FROM checkpoints WHERE id = ? RETURNING id")
    .bind(id)
    .first<{ id: string }>();
}
