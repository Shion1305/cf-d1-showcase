import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getHealth } from "@/lib/health";
import { handleRequest, json } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const { env } = await getCloudflareContext({ async: true });
    const health = await getHealth(env);
    return json(health, health.ok ? 200 : 503);
  });
}
