import type { IncomingMessage, ServerResponse } from 'node:http';

export class HttpError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

function isJsonCompatibleContentType(header: string | string[] | undefined): boolean {
  if (!header) return true;
  const raw = Array.isArray(header) ? header[0] : header;
  if (!raw) return true;
  const mediaType = raw.split(';')[0]?.trim().toLowerCase() ?? '';
  return (
    mediaType === '' ||
    mediaType === 'application/json' ||
    mediaType === 'text/plain' ||
    mediaType.endsWith('+json')
  );
}

/**
 * Read and parse a JSON request body up to `maxBytes`.
 * Accepts `application/json` and `text/plain` (for `navigator.sendBeacon`).
 */
export async function readJsonBody(req: IncomingMessage, maxBytes = 262144): Promise<unknown> {
  if (!isJsonCompatibleContentType(req.headers['content-type'])) {
    throw new HttpError(415, 'Unsupported Content-Type');
  }

  const contentLengthHeader = req.headers['content-length'];
  if (contentLengthHeader !== undefined) {
    const declaredLength = Number(Array.isArray(contentLengthHeader) ? contentLengthHeader[0] : contentLengthHeader);
    if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
      throw new HttpError(413, 'Payload too large');
    }
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      req.destroy();
      throw new HttpError(413, 'Payload too large');
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks, totalBytes).toString('utf8').trim();
  if (!raw) {
    throw new HttpError(400, 'Empty request body');
  }

  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}

export function sendJson(
  res: ServerResponse,
  status: number,
  data: unknown,
  headers?: Record<string, string>,
): void {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    ...headers,
  });
  res.end(body);
}

export function sendText(
  res: ServerResponse,
  status: number,
  text: string,
  contentType: string,
  headers?: Record<string, string>,
): void {
  res.writeHead(status, {
    'content-type': contentType,
    'content-length': String(Buffer.byteLength(text)),
    ...headers,
  });
  res.end(text);
}
