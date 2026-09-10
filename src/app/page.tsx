import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Dashboard } from "@/components/dashboard";
import { listCheckpoints } from "@/lib/database";
import { getHealth } from "@/lib/health";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { env } = await getCloudflareContext({ async: true });
  const health = await getHealth(env);
  const checkpoints =
    health.database === "ready" ? await listCheckpoints(env.DB) : [];
  return <Dashboard initialData={{ checkpoints, health }} />;
}
