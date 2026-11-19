import { readFileSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import type { IncomingMessage, Server, ServerResponse } from 'node:http';
import path from 'node:path';
import type { DatabaseSync } from 'node:sqlite';
import { pathToFileURL } from 'node:url';
import { ADMIN_PAGE_HEADERS, renderAdminPage } from './adminPage.js';
import { requireAdminAuth, requireMcpAuth } from './auth.js';
import { openDatabase } from './db.js';
import { HttpError, sendJson, sendText } from './http.js';
import { handleMcpHttp } from './mcp.js';
import { handleAdminApi } from './routes/adminApi.js';
import { handleTelemetryPost } from './routes/telemetry.js';

export interface AppServerOptions {
  db?: DatabaseSync;
  distDir?: string;
  autoOpenDb?: boolean;
}

export interface AppServer {
  server: Server;
  db: DatabaseSync;
}

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] ?? 'application/octet-stream';
}

function tryServeStatic(
  method: string,
  pathname: string,
  distDir: string,
  res: ServerResponse,
): boolean {
  if (method !== 'GET' && method !== 'HEAD') {
    return false;
  }

  let decodedPath: string;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    sendJson(res, 400, { error: 'Bad request path' });
    return true;
  }

  const relPath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  if (!relPath) {
    return false;
  }

  const targetPath = path.resolve(distDir, relPath);
  if (targetPath !== distDir && !targetPath.startsWith(distDir + path.sep)) {
    sendJson(res, 404, { error: 'Not found' });
    return true;
  }

  let isFile = false;
  try {
    isFile = statSync(targetPath).isFile();
  } catch {
    isFile = false;
  }

  if (!isFile) {
    return false;
  }

  const content = readFileSync(targetPath);
  const contentType = getMimeType(targetPath);
  res.writeHead(200, {
    'content-type': contentType,
    'content-length': String(content.byteLength),
  });
  if (method === 'HEAD') {
    res.end();
  } else {
    res.end(content);
  }
  return true;
}

async function routeRequest(
  req: IncomingMessage,
  res: ServerResponse,
  db: DatabaseSync,
  distDir: string,
): Promise<void> {
  const method = (req.method ?? 'GET').toUpperCase();
  const host = req.headers.host || 'localhost';
  const url = new URL(req.url || '/', `http://${host}`);
  const { pathname } = url;

  if ((method === 'GET' || method === 'HEAD') && pathname === '/health') {
    if (method === 'HEAD') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end();
    } else {
      sendJson(res, 200, { ok: true });
    }
    return;
  }

  if (method === 'POST' && pathname === '/api/telemetry') {
    await handleTelemetryPost(req, res, db);
    return;
  }

  if (await handleAdminApi(req, res, url, db)) {
    return;
  }

  if ((method === 'GET' || method === 'HEAD') && (pathname === '/admin' || pathname === '/admin/')) {
    if (!requireAdminAuth(req, res)) {
      return;
    }
    const html = renderAdminPage();
    if (method === 'HEAD') {
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'content-length': String(Buffer.byteLength(html)),
        ...ADMIN_PAGE_HEADERS,
      });
      res.end();
    } else {
      sendText(res, 200, html, 'text/html; charset=utf-8', ADMIN_PAGE_HEADERS);
    }
    return;
  }

  if (pathname === '/mcp') {
    if (!requireMcpAuth(req, res)) {
      return;
    }
    await handleMcpHttp(req, res, db);
    return;
  }

  if (tryServeStatic(method, pathname, distDir, res)) {
    return;
  }

  sendJson(res, 404, { error: 'Not found' });
}

export function createAppServer(opts: AppServerOptions = {}): AppServer {
  const db = opts.db ?? (opts.autoOpenDb === false ? openDatabase(':memory:') : openDatabase());
  const distDir = path.resolve(opts.distDir ?? path.resolve(process.cwd(), 'dist'));

  const server = createServer((req, res) => {
    void routeRequest(req, res, db, distDir).catch((err: unknown) => {
      if (res.headersSent) {
        if (!res.writableEnded) res.end();
        return;
      }
      if (err instanceof HttpError) {
        sendJson(res, err.status, { error: err.message });
        return;
      }
      console.error('[server] unhandled error:', err);
      sendJson(res, 500, { error: 'Internal server error' });
    });
  });

  return { server, db };
}

const isMain =
  Boolean(process.argv[1]) &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMain) {
  const { server, db } = createAppServer();
  const port = Number(process.env.PORT || 3000);

  server.listen(port, '0.0.0.0', () => {
    console.log(`[server] listening on http://0.0.0.0:${port}`);
  });

  const shutdown = (signal: string) => {
    console.log(`[server] received ${signal}, shutting down`);
    server.close(() => {
      try {
        db.close();
      } catch {
        // Ignore close errors
      }
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}
