import { timingSafeEqual } from "node:crypto";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function json(value: unknown, status = 200) {
  return Response.json(value, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export async function handleRequest(handler: () => Promise<Response>) {
  try {
    return await handler();
  } catch (error) {
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    // Binding exceptions can contain sensitive context. Don't serialize or log them.
    return json(
      {
        error:
          "Service unavailable. Check the database migrations and secret binding.",
      },
      503,
    );
  }
}

export async function requireWriteKey(request: Request, env: CloudflareEnv) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin)
    throw new HttpError(403, "Cross-origin writes are not allowed.");
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer "))
    throw new HttpError(401, "Enter the API key to make changes.");
  const expected = await env.ADMIN_API_KEY.get();
  if (!expected)
    throw new HttpError(503, "The API key binding is unavailable.");
  const encoder = new TextEncoder();
  const [actualHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(header.slice(7))),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ]);
  if (
    !timingSafeEqual(new Uint8Array(actualHash), new Uint8Array(expectedHash))
  ) {
    throw new HttpError(401, "The API key is incorrect.");
  }
}

export async function readObject(
  request: Request,
): Promise<Record<string, unknown>> {
  if (
    !request.headers
      .get("content-type")
      ?.toLowerCase()
      .startsWith("application/json")
  ) {
    throw new HttpError(415, "Send an application/json body.");
  }
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "A JSON object is required.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 4096) {
      await reader.cancel();
      throw new HttpError(413, "The request body is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
    if (value === null || typeof value !== "object" || Array.isArray(value))
      throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new HttpError(400, "A valid JSON object is required.");
  }
}
