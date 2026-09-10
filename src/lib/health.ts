import type { Health } from "./types";

export async function getHealth(env: CloudflareEnv): Promise<Health> {
  const started = performance.now();
  const [database, secret] = await Promise.allSettled([
    (async () => {
      // Check the actual application schema, not just connectivity via SELECT 1.
      await env.DB.prepare(
        "SELECT id, title, status, created_at FROM checkpoints LIMIT 0",
      ).all();
      return env.DB.prepare("SELECT name FROM d1_migrations ORDER BY id").all<{
        name: string;
      }>();
    })(),
    (async () => {
      const key = await env.ADMIN_API_KEY.get();
      if (!key) throw new Error("Missing API key");
      return true;
    })(),
  ]);

  return {
    ok: database.status === "fulfilled" && secret.status === "fulfilled",
    environment: env.APP_ENV,
    databaseMode: env.DATABASE_MODE,
    release: env.RELEASE_SHA,
    database: database.status === "fulfilled" ? "ready" : "unavailable",
    secret: secret.status === "fulfilled" ? "ready" : "unavailable",
    migrations:
      database.status === "fulfilled"
        ? database.value.results.map((row) => row.name)
        : [],
    queryTimeMs: Math.round((performance.now() - started) * 10) / 10,
  };
}
