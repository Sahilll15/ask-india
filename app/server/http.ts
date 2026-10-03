export function bad(error: string, status = 400) {
  return Response.json({ error }, { status });
}

export type Capped = { ok: true; bytes: Uint8Array } | { ok: false; reason: 'too_large' | 'unreadable' };

/** Reads the body as a stream and stops at maxBytes, whatever content-length says. */
export async function readCapped(req: Request, maxBytes: number): Promise<Capped> {
  const declared = req.headers.get('content-length');
  if (declared !== null && !(Number(declared) <= maxBytes)) {
    await req.body?.cancel().catch(() => {});
    return { ok: false, reason: 'too_large' };
  }
  if (!req.body) return { ok: true, bytes: new Uint8Array(0) };

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        return { ok: false, reason: 'too_large' };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, reason: 'unreadable' };
  }

  const bytes = new Uint8Array(total);
  let at = 0;
  for (const c of chunks) {
    bytes.set(c, at);
    at += c.byteLength;
  }
  return { ok: true, bytes };
}

type Read = { ok: true; body: unknown } | { ok: false; res: Response };

export async function readJson(req: Request, maxBytes: number): Promise<Read> {
  const read = await readCapped(req, maxBytes);
  if (!read.ok) {
    return {
      ok: false,
      res: read.reason === 'too_large' ? bad('Request is too large.', 413) : bad('Could not read the request.'),
    };
  }
  const text = new TextDecoder().decode(read.bytes);
  if (!text.trim()) return { ok: false, res: bad('Request body is empty.') };
  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, res: bad('Request body must be JSON.') };
  }
}

export function upstreamError(err: unknown) {
  const status = (err as { status?: number })?.status;
  console.error('openai error', status, (err as Error)?.message);
  if (status === 429) return bad('The model is busy right now. Try again in a minute.', 503);
  return bad('Something went wrong talking to the model. Try again.', 502);
}
