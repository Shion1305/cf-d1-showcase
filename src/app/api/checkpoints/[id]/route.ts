import { getCloudflareContext } from "@opennextjs/cloudflare";
import { deleteCheckpoint, setCheckpointStatus } from "@/lib/database";
import {
  handleRequest,
  HttpError,
  json,
  readObject,
  requireWriteKey,
} from "@/lib/http";

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  return handleRequest(async () => {
    const { env } = await getCloudflareContext({ async: true });
    await requireWriteKey(request, env);
    const body = await readObject(request);
    if (body.status !== "open" && body.status !== "verified")
      throw new HttpError(400, "Choose open or verified.");
    const { id } = await context.params;
    const checkpoint = await setCheckpointStatus(env.DB, id, body.status);
    if (!checkpoint) throw new HttpError(404, "Checkpoint not found.");
    return json({ checkpoint });
  });
}

export async function DELETE(request: Request, context: Context) {
  return handleRequest(async () => {
    const { env } = await getCloudflareContext({ async: true });
    await requireWriteKey(request, env);
    const { id } = await context.params;
    if (!(await deleteCheckpoint(env.DB, id)))
      throw new HttpError(404, "Checkpoint not found.");
    return new Response(null, {
      status: 204,
      headers: { "Cache-Control": "no-store" },
    });
  });
}
