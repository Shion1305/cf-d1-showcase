import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createCheckpoint, listCheckpoints } from "@/lib/database";
import {
  handleRequest,
  HttpError,
  json,
  readObject,
  requireWriteKey,
} from "@/lib/http";

export const dynamic = "force-dynamic";

export async function GET() {
  return handleRequest(async () => {
    const { env } = await getCloudflareContext({ async: true });
    return json({ checkpoints: await listCheckpoints(env.DB) });
  });
}

export async function POST(request: Request) {
  return handleRequest(async () => {
    const { env } = await getCloudflareContext({ async: true });
    await requireWriteKey(request, env);
    const body = await readObject(request);
    if (
      typeof body.title !== "string" ||
      !body.title.trim() ||
      body.title.trim().length > 120
    ) {
      throw new HttpError(400, "Use a title between 1 and 120 characters.");
    }
    return json(
      { checkpoint: await createCheckpoint(env.DB, body.title.trim()) },
      201,
    );
  });
}
